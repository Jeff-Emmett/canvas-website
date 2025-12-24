import React, { useState, useEffect, useMemo, useContext, useRef } from 'react'
import { ObsidianImporter, ObsidianObsNote, ObsidianVault, FolderNode, ObsidianVaultRecord } from '@/lib/obsidianImporter'
import { AuthContext } from '@/context/AuthContext'
import { useEditor } from '@tldraw/tldraw'
import { useAutomergeHandle } from '@/context/AutomergeHandleContext'

interface ObsidianVaultBrowserProps {
  onObsNoteSelect: (obs_note: ObsidianObsNote) => void
  onObsNotesSelect: (obs_notes: ObsidianObsNote[]) => void
  onClose: () => void
  className?: string
  autoOpenFolderPicker?: boolean
  showVaultBrowser?: boolean
  shapeMode?: boolean // When true, renders without modal overlay for use in shape
}

export const ObsidianVaultBrowser: React.FC<ObsidianVaultBrowserProps> = ({
  onObsNoteSelect,
  onObsNotesSelect,
  onClose,
  className = '',
  autoOpenFolderPicker = false,
  showVaultBrowser = true,
  shapeMode = false
}) => {
  // Safely get auth context - use useContext directly to avoid throwing error
  // This allows the component to work even when used outside AuthProvider (e.g., during SVG export)
  const authContext = useContext(AuthContext)
  const fallbackSession = {
    username: '',
    authed: false,
    loading: false,
    backupCreated: null,
    obsidianVaultPath: undefined,
    obsidianVaultName: undefined
  }
  const session = authContext?.session || fallbackSession
  const updateSession = authContext?.updateSession || (() => {})
  const [importer] = useState(() => new ObsidianImporter())
  const [vault, setVault] = useState<ObsidianVault | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(() => {
    // Check if we have a vault configured and start loading immediately
    return !!(session.obsidianVaultPath && session.obsidianVaultPath !== 'folder-selected') ||
           !!(session.obsidianVaultPath === 'folder-selected' && session.obsidianVaultName)
  })
  const [error, setError] = useState<string | null>(null)
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set())
  const [showVaultInput, setShowVaultInput] = useState(false)
  const [vaultPath, setVaultPath] = useState('')
  const [inputMethod, setInputMethod] = useState<'folder' | 'url' | 'quartz'>('folder')
  const [showFolderReselect, setShowFolderReselect] = useState(false)
  const [isLoadingVault, setIsLoadingVault] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [folderTree, setFolderTree] = useState<FolderNode | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'tree'>('tree')
  
  // Track previous vault path/name to prevent unnecessary reloads
  const previousVaultPathRef = useRef<string | undefined>(session.obsidianVaultPath)
  const previousVaultNameRef = useRef<string | undefined>(session.obsidianVaultName)
  
  const editor = useEditor()
  const automergeHandle = useAutomergeHandle()

  // Initialize debounced search query to match search query
  useEffect(() => {
    setDebouncedSearchQuery(searchQuery)
  }, [])

  // Update folder tree when vault changes
  useEffect(() => {
    if (vault && vault.folderTree) {
      setFolderTree(vault.folderTree)
      // Expand root folder by default
      setExpandedFolders(new Set(['']))
    }
  }, [vault])

  // Save vault to Automerge store
  const saveVaultToAutomerge = (vault: ObsidianVault) => {
    if (!automergeHandle) {
      try {
        const vaultRecord = importer.vaultToRecord(vault)
        localStorage.setItem(`obsidian_vault_cache:${vault.name}`, JSON.stringify({
          ...vaultRecord,
          lastImported: vaultRecord.lastImported instanceof Date ? vaultRecord.lastImported.toISOString() : vaultRecord.lastImported
        }))
      } catch (localStorageError) {
        console.warn('Could not save vault to localStorage:', localStorageError)
      }
      return
    }

    try {
      const vaultRecord = importer.vaultToRecord(vault)

      // Save directly to Automerge, bypassing TLDraw store validation
      automergeHandle.change((doc: any) => {
        if (!doc.store) {
          doc.store = {}
        }

        const recordToSave = {
          ...vaultRecord,
          lastImported: vaultRecord.lastImported instanceof Date
            ? vaultRecord.lastImported.toISOString()
            : vaultRecord.lastImported
        }

        doc.store[vaultRecord.id] = recordToSave
      })

      // Also save to localStorage as a backup
      try {
        localStorage.setItem(`obsidian_vault_cache:${vault.name}`, JSON.stringify({
          ...vaultRecord,
          lastImported: vaultRecord.lastImported instanceof Date ? vaultRecord.lastImported.toISOString() : vaultRecord.lastImported
        }))
      } catch (localStorageError) {
        // Silent fail for backup
      }
    } catch (error) {
      console.error('Error saving vault to Automerge:', error)
      // Try localStorage as fallback
      try {
        const vaultRecord = importer.vaultToRecord(vault)
        localStorage.setItem(`obsidian_vault_cache:${vault.name}`, JSON.stringify({
          ...vaultRecord,
          lastImported: vaultRecord.lastImported instanceof Date ? vaultRecord.lastImported.toISOString() : vaultRecord.lastImported
        }))
      } catch (localStorageError) {
        console.warn('Could not save vault to localStorage:', localStorageError)
      }
    }
  }

  // Load vault from Automerge store
  const loadVaultFromAutomerge = (vaultName: string): ObsidianVault | null => {
    // Try loading from Automerge first
    if (automergeHandle) {
      try {
        const doc = automergeHandle.doc()
        if (doc && doc.store) {
          const vaultId = `obsidian_vault:${vaultName}`
          const vaultRecord = doc.store[vaultId] as ObsidianVaultRecord | undefined

          if (vaultRecord && vaultRecord.typeName === 'obsidian_vault') {
            const recordCopy = JSON.parse(JSON.stringify(vaultRecord))
            if (typeof recordCopy.lastImported === 'string') {
              recordCopy.lastImported = new Date(recordCopy.lastImported)
            }
            return importer.recordToVault(recordCopy)
          }
        }
      } catch (error) {
        // Fall through to localStorage
      }
    }

    // Try localStorage as fallback
    try {
      const cached = localStorage.getItem(`obsidian_vault_cache:${vaultName}`)
      if (cached) {
        const vaultRecord = JSON.parse(cached) as ObsidianVaultRecord
        if (vaultRecord && vaultRecord.typeName === 'obsidian_vault') {
          if (typeof vaultRecord.lastImported === 'string') {
            vaultRecord.lastImported = new Date(vaultRecord.lastImported)
          }
          return importer.recordToVault(vaultRecord)
        }
      }
    } catch (e) {
      // Silent fail
    }

    return null
  }

  // Load vault on component mount - prioritize user's configured vault from session
  useEffect(() => {
    // Prevent multiple loads if already loading or already loaded once
    if (isLoadingVault || hasLoadedOnce) {
      return
    }

    // FIRST PRIORITY: Try to load from user's configured vault in session (user identity)
    if (session.obsidianVaultPath && session.obsidianVaultPath !== 'folder-selected') {
      // First try to load from Automerge cache for faster loading
      if (session.obsidianVaultName) {
        const cachedVault = loadVaultFromAutomerge(session.obsidianVaultName)
        if (cachedVault) {
          setVault(cachedVault)
          setIsLoading(false)
          setHasLoadedOnce(true)
          return
        }
      }

      // If not in cache, load from source (Quartz URL or local path)
      loadVault(session.obsidianVaultPath)
    } else if (session.obsidianVaultPath === 'folder-selected' && session.obsidianVaultName) {
      // For folder-selected vaults, we can't reload them, so show a special reselect interface
      setVault(null)
      setShowFolderReselect(true)
      setIsLoading(false)
      setHasLoadedOnce(true)
    } else {
      setVault(null)
      setIsLoading(false)
      setHasLoadedOnce(true)
    }
  }, []) // Remove dependencies to ensure this only runs once on mount

  // Handle session changes only if we haven't loaded yet AND values actually changed
  useEffect(() => {
    // Check if values actually changed (not just object reference)
    const vaultPathChanged = previousVaultPathRef.current !== session.obsidianVaultPath
    const vaultNameChanged = previousVaultNameRef.current !== session.obsidianVaultName

    // If vault is already loaded and values haven't changed, don't do anything
    if (hasLoadedOnce && !vaultPathChanged && !vaultNameChanged) {
      return
    }

    // Update refs to current values
    previousVaultPathRef.current = session.obsidianVaultPath
    previousVaultNameRef.current = session.obsidianVaultName

    // Only proceed if values actually changed and we haven't loaded yet
    if (!vaultPathChanged && !vaultNameChanged) {
      return
    }

    if (hasLoadedOnce || isLoadingVault) {
      return
    }

    if (session.obsidianVaultPath && session.obsidianVaultPath !== 'folder-selected') {
      loadVault(session.obsidianVaultPath)
    } else if (session.obsidianVaultPath === 'folder-selected' && session.obsidianVaultName) {
      setVault(null)
      setShowFolderReselect(true)
      setIsLoading(false)
      setHasLoadedOnce(true)
    }
  }, [session.obsidianVaultPath, session.obsidianVaultName, hasLoadedOnce, isLoadingVault])

  // Auto-open folder picker if requested
  useEffect(() => {
    if (autoOpenFolderPicker) {
      handleFolderPicker()
    }
  }, [autoOpenFolderPicker])

  // Reset loading state when component is closed (but not in shape mode)
  useEffect(() => {
    if (!showVaultBrowser && !shapeMode) {
      // Reset states when component is closed (only in modal mode, not shape mode)
      setHasLoadedOnce(false)
      setIsLoadingVault(false)
    }
  }, [showVaultBrowser, shapeMode])


  // Debounce search query for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 150) // 150ms delay

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Handle ESC key to close the browser
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const loadVault = async (path?: string) => {
    // Prevent concurrent loading operations
    if (isLoadingVault) {
      return
    }

    setIsLoadingVault(true)
    setIsLoading(true)
    setError(null)

    try {
      if (path) {
        // Check if it's a Quartz URL
        if (path.startsWith('http') || path.includes('quartz') || path.includes('.xyz') || path.includes('.com')) {
          const loadedVault = await importer.importFromQuartzUrl(path)
          setVault(loadedVault)
          setShowVaultInput(false)
          setShowFolderReselect(false)
          updateSession({
            obsidianVaultPath: path,
            obsidianVaultName: loadedVault.name
          })
          saveVaultToAutomerge(loadedVault)
        } else {
          const loadedVault = await importer.importFromDirectory(path)
          setVault(loadedVault)
          setShowVaultInput(false)
          setShowFolderReselect(false)
          updateSession({
            obsidianVaultPath: path,
            obsidianVaultName: loadedVault.name
          })
          saveVaultToAutomerge(loadedVault)
        }
      } else {
        setVault(null)
        setShowVaultInput(false)
      }
    } catch (err) {
      console.error('Failed to load vault:', err)
      setError('Failed to load Obsidian vault. Please try again.')
      setVault(null)
      if (!session.obsidianVaultPath) {
        setShowVaultInput(true)
      }
    } finally {
      setIsLoading(false)
      setIsLoadingVault(false)
      setHasLoadedOnce(true)
    }
  }

  const handleVaultPathSubmit = async () => {
    if (!vaultPath.trim()) {
      setError('Please enter a vault path or URL')
      return
    }

    if (inputMethod === 'quartz') {
      try {
        setIsLoading(true)
        setError(null)
        const loadedVault = await importer.importFromQuartzUrl(vaultPath.trim())
        setVault(loadedVault)
        setShowVaultInput(false)
        setShowFolderReselect(false)
        updateSession({
          obsidianVaultPath: vaultPath.trim(),
          obsidianVaultName: loadedVault.name
        })
      } catch (error) {
        console.error('Error loading Quartz vault:', error)
        setError(error instanceof Error ? error.message : 'Failed to load Quartz vault')
      } finally {
        setIsLoading(false)
      }
    } else {
      loadVault(vaultPath.trim())
    }
  }

  const handleFolderPicker = async () => {
    if (!('showDirectoryPicker' in window)) {
      setError('File System Access API is not supported in this browser. Please use "Enter Path" instead.')
      setShowVaultInput(true)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const loadedVault = await importer.importFromFileSystem()

      setVault(loadedVault)
      setShowVaultInput(false)
      setShowFolderReselect(false)

      updateSession({
        obsidianVaultPath: 'folder-selected',
        obsidianVaultName: loadedVault.name
      })

      saveVaultToAutomerge(loadedVault)
    } catch (err) {
      if ((err as any).name === 'AbortError') {
        setError(null)
      } else {
        console.error('Failed to load vault from folder picker:', err)
        setError('Failed to load Obsidian vault. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Filter obs_notes based on search query and folder selection
  const filteredObsNotes = useMemo(() => {
    if (!vault) return []

    let obs_notes = vault.obs_notes

    // Filter out any undefined or null notes first
    obs_notes = obs_notes.filter(obs_note => obs_note != null)

    // Filter by search query - use debounced query for better performance
    // When no search query, show all notes
    if (debouncedSearchQuery && debouncedSearchQuery.trim()) {
      const lowercaseQuery = debouncedSearchQuery.toLowerCase().trim()
      obs_notes = obs_notes.filter(obs_note => 
        obs_note && (
          (obs_note.title && obs_note.title.toLowerCase().includes(lowercaseQuery)) ||
          (obs_note.content && obs_note.content.toLowerCase().includes(lowercaseQuery)) ||
          (obs_note.tags && obs_note.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))) ||
          (obs_note.filePath && obs_note.filePath.toLowerCase().includes(lowercaseQuery))
        )
      )
    }

    // Filter by selected folder if in tree view
    if (viewMode === 'tree' && selectedFolder !== null && folderTree) {
      const folder = importer.findFolderByPath(folderTree, selectedFolder)
      if (folder) {
        const folderNotes = importer.getAllNotesFromTree(folder)
        obs_notes = obs_notes.filter(note => folderNotes.some(folderNote => folderNote.id === note.id))
      }
    }

    return obs_notes
  }, [vault, debouncedSearchQuery, viewMode, selectedFolder, folderTree, importer])

  // Listen for trigger-obsnote-creation event from CustomToolbar
  useEffect(() => {
    const handleTriggerCreation = () => {
      if (selectedNotes.size > 0) {
        const selectedObsNotes = filteredObsNotes.filter(obs_note => selectedNotes.has(obs_note.id))
        onObsNotesSelect(selectedObsNotes)
      } else {
        const allVisibleNotes = filteredObsNotes
        if (allVisibleNotes.length > 0) {
          onObsNotesSelect(allVisibleNotes)
        }
      }
    }

    window.addEventListener('trigger-obsnote-creation', handleTriggerCreation as EventListener)

    return () => {
      window.removeEventListener('trigger-obsnote-creation', handleTriggerCreation as EventListener)
    }
  }, [selectedNotes, filteredObsNotes, onObsNotesSelect])

  // Helper function to get a better title for display
  const getDisplayTitle = (obs_note: ObsidianObsNote): string => {
    // Safety check for undefined obs_note
    if (!obs_note) {
      return 'Untitled'
    }
    
    // Use frontmatter title if available, otherwise use filename without extension
    if (obs_note.frontmatter && obs_note.frontmatter.title) {
      return obs_note.frontmatter.title
    }
    
    // For Quartz URLs, use the title property which should be clean
    if (obs_note.filePath && obs_note.filePath.startsWith('http')) {
      return obs_note.title || 'Untitled'
    }
    
    // Clean up filename for display
    return obs_note.filePath
      .replace(/\.md$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
  }

  // Helper function to get content preview
  const getContentPreview = (obs_note: ObsidianObsNote, maxLength: number = 200): string => {
    // Safety check for undefined obs_note
    if (!obs_note) {
      return 'No content available'
    }
    
    let content = obs_note.content || ''
    
    // Remove frontmatter if present
    content = content.replace(/^---\n[\s\S]*?\n---\n/, '')
    
    // Remove markdown headers for cleaner preview
    content = content.replace(/^#+\s+/gm, '')
    
    // Clean up and truncate
    content = content
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '...'
    }
    
    return content || 'No content preview available'
  }

  // Helper function to get file path, checking session for quartz link if blank
  const getFilePath = (obs_note: ObsidianObsNote): string => {
    // If filePath exists and is not blank, use it
    if (obs_note.filePath && obs_note.filePath.trim() !== '') {
      if (obs_note.filePath.startsWith('http')) {
        try {
          return new URL(obs_note.filePath).pathname.replace(/^\//, '') || 'Home'
        } catch (e) {
          return obs_note.filePath
        }
      }
      return obs_note.filePath
    }
    
    // If filePath is blank, check session for quartz link (user API)
    if (session.obsidianVaultPath && 
        session.obsidianVaultPath !== 'folder-selected' &&
        (session.obsidianVaultPath.startsWith('http') || 
         session.obsidianVaultPath.includes('quartz') || 
         session.obsidianVaultPath.includes('.xyz') || 
         session.obsidianVaultPath.includes('.com'))) {
      // Construct file path from quartz URL and note title/ID
      try {
        const baseUrl = new URL(session.obsidianVaultPath)
        // Use note title or ID to construct a path
        const notePath = obs_note.title || obs_note.id || 'Untitled'
        // Clean up the note path to make it URL-friendly
        const cleanPath = notePath.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
        return `${baseUrl.hostname}${baseUrl.pathname}/${cleanPath}`
      } catch (e) {
        // If URL parsing fails, just return the vault path
        return session.obsidianVaultPath
      }
    }
    
    // If no quartz link found in session, return a fallback based on note info
    return obs_note.title || obs_note.id || 'Untitled'
  }

  // Helper function to highlight search matches
  const highlightSearchMatches = (text: string, query: string): string => {
    if (!query.trim()) return text
    
    try {
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      return text.replace(regex, '<mark>$1</mark>')
    } catch (error) {
      console.error('Error highlighting search matches:', error)
      return text
    }
  }

  const handleObsNoteClick = (obs_note: ObsidianObsNote) => {
    onObsNoteSelect(obs_note)
  }

  const handleObsNoteToggle = (obs_note: ObsidianObsNote) => {
    const newSelected = new Set(selectedNotes)
    if (newSelected.has(obs_note.id)) {
      newSelected.delete(obs_note.id)
    } else {
      newSelected.add(obs_note.id)
    }
    setSelectedNotes(newSelected)
  }

  const handleBulkImport = () => {
    const selectedObsNotes = filteredObsNotes.filter(obs_note => selectedNotes.has(obs_note.id))
    onObsNotesSelect(selectedObsNotes)
    setSelectedNotes(new Set())
  }

  const handleSelectAll = () => {
    if (selectedNotes.size === filteredObsNotes.length) {
      setSelectedNotes(new Set())
    } else {
      setSelectedNotes(new Set(filteredObsNotes.map(obs_note => obs_note.id)))
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setDebouncedSearchQuery('')
    setSelectedNotes(new Set())
  }

  // Folder management functions
  const toggleFolderExpansion = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath)
    } else {
      newExpanded.add(folderPath)
    }
    setExpandedFolders(newExpanded)
  }

  const selectFolder = (folderPath: string) => {
    setSelectedFolder(folderPath)
  }

  const getNotesFromFolder = (folder: FolderNode): ObsidianObsNote[] => {
    if (!folder) return []
    
    let notes = [...folder.notes]
    
    // If folder is expanded, include notes from subfolders
    if (expandedFolders.has(folder.path)) {
      folder.children.forEach(child => {
        notes.push(...getNotesFromFolder(child))
      })
    }
    
    return notes
  }


  const handleDisconnectVault = () => {
    updateSession({
      obsidianVaultPath: undefined,
      obsidianVaultName: undefined
    })

    setVault(null)
    setSearchQuery('')
    setDebouncedSearchQuery('')
    setSelectedNotes(new Set())
    setShowVaultInput(false)
    setShowFolderReselect(false)
    setError(null)
    setHasLoadedOnce(false)
    setIsLoadingVault(false)
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking on the backdrop, not on the modal content
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (isLoading) {
    return (
      <div className={`obsidian-browser ${className}`} onClick={handleBackdropClick}>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading Obsidian vault...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`obsidian-browser ${className}`} onClick={handleBackdropClick}>
        <div className="error-container">
          <h3>Error Loading Vault</h3>
          <p>{error}</p>
          <button onClick={() => loadVault()} className="retry-button">
            Try Again
          </button>
          <button onClick={onClose} className="close-button">
            Close
          </button>
        </div>
      </div>
    )
  }

  if (!vault && !showVaultInput && !isLoading) {
    // Check if user has a folder-selected vault that needs reselection
    if (showFolderReselect && session.obsidianVaultPath === 'folder-selected' && session.obsidianVaultName) {
      return (
        <div className={`obsidian-browser ${className}`} onClick={handleBackdropClick}>
          <div className="folder-reselect-container">
            <h3>Reselect Obsidian Vault</h3>
            <p>Your vault "<strong>{session.obsidianVaultName}</strong>" was previously selected via folder picker.</p>
            <p>Due to browser security restrictions, we need you to reselect the folder to access your notes.</p>
            <div className="vault-options">
              <button onClick={handleFolderPicker} className="load-vault-button primary">
                📁 Reselect Folder
              </button>
              <button onClick={() => setShowVaultInput(true)} className="load-vault-button secondary">
                📝 Enter Path Instead
              </button>
            </div>
            <p className="help-text">
              Select the same folder again to continue using your Obsidian vault, or enter the path manually.
            </p>
          </div>
        </div>
      )
    }
    
    // Check if user has a vault configured but it failed to load
    if (session.obsidianVaultPath && session.obsidianVaultPath !== 'folder-selected') {
      return (
        <div className={`obsidian-browser ${className}`} onClick={handleBackdropClick}>
          <div className="error-container">
            <h3>Vault Loading Failed</h3>
            <p>Failed to load your configured Obsidian vault at: <code>{session.obsidianVaultPath}</code></p>
            <p>This might be because the path has changed or the vault is no longer accessible.</p>
            <div className="vault-options">
              <button onClick={() => loadVault(session.obsidianVaultPath)} className="retry-button">
                🔄 Retry Loading
              </button>
              <button onClick={() => setShowVaultInput(true)} className="load-vault-button secondary">
                📝 Change Path
              </button>
              <button onClick={handleFolderPicker} className="load-vault-button primary">
                📁 Select New Folder
              </button>
            </div>
          </div>
        </div>
      )
    }
    
    // No vault configured at all
    return (
      <div className={`obsidian-browser ${className}`} onClick={handleBackdropClick}>
        <div className="no-vault-container">
          <h3>Load Obsidian Vault</h3>
          <p>Choose how you'd like to load your Obsidian vault:</p>
          <div className="vault-options">
            <button
              onClick={handleFolderPicker}
              className="load-vault-button primary"
            >
              📁 Select Folder
            </button>
            <button
              onClick={() => {
                if (session.obsidianVaultPath && session.obsidianVaultPath !== 'folder-selected') {
                  setVaultPath(session.obsidianVaultPath)
                }
                setShowVaultInput(true)
              }}
              className="load-vault-button secondary"
            >
              📝 Enter Path
            </button>
          </div>
          <p className="help-text">
            Select a folder containing your Obsidian vault, or enter the path manually.
          </p>
        </div>
      </div>
    )
  }

  if (showVaultInput) {
    return (
      <div className={`obsidian-browser ${className}`} onClick={handleBackdropClick}>
        <div className="vault-input-container">
          <h3>Enter Vault Path</h3>
          <div className="input-method-selector">
            <button
              onClick={() => setInputMethod('folder')}
              className={`method-button ${inputMethod === 'folder' ? 'active' : ''}`}
            >
              📁 Local Folder
            </button>
            <button
              onClick={() => setInputMethod('url')}
              className={`method-button ${inputMethod === 'url' ? 'active' : ''}`}
            >
              🌐 URL/Path
            </button>
            <button
              onClick={() => setInputMethod('quartz')}
              className={`method-button ${inputMethod === 'quartz' ? 'active' : ''}`}
            >
              💎 Quartz Site
            </button>
          </div>
          
          <div className="path-input-section">
            <input
              type="text"
              placeholder={
                inputMethod === 'folder' 
                  ? 'Enter folder path (e.g., /Users/username/Documents/MyVault)' 
                  : inputMethod === 'quartz'
                  ? 'Enter Quartz URL (e.g., https://quartz.jzhao.xyz)'
                  : 'Enter URL or path'
              }
              value={vaultPath}
              onChange={(e) => setVaultPath(e.target.value)}
              className="path-input"
              onKeyPress={(e) => e.key === 'Enter' && handleVaultPathSubmit()}
            />
            <button onClick={handleVaultPathSubmit} className="submit-button">
              Load Vault
            </button>
          </div>
          
          <div className="input-help">
            {inputMethod === 'folder' ? (
              <p>Enter the full path to your Obsidian vault folder on your computer.</p>
            ) : inputMethod === 'quartz' ? (
              <p>Enter a Quartz site URL to import content as Obsidian notes (e.g., https://quartz.jzhao.xyz).</p>
            ) : (
              <p>Enter a URL or path to your Obsidian vault (if accessible via web).</p>
            )}
          </div>
          
          <div className="input-actions">
            <button onClick={() => setShowVaultInput(false)} className="back-button">
              ← Back
            </button>
            <button onClick={handleFolderPicker} className="folder-picker-button">
              📁 Browse Folder
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Helper function to check if a folder has content (notes or subfolders with content)
  const hasContent = (folder: FolderNode): boolean => {
    if (folder.notes.length > 0) return true
    return folder.children.some(child => hasContent(child))
  }

  // Folder tree component - skips Root and content folders, shows only files from content
  const renderFolderTree = (folder: FolderNode, level: number = 0) => {
    if (!folder) return null

    // Skip Root folder - look for content folder inside it
    if (folder.name === 'Root') {
      // Find the "content" folder
      const contentFolder = folder.children.find(child => child.name === 'content' || child.name.toLowerCase() === 'content')
      
      if (contentFolder) {
        // Skip both Root and content folders, render content folder's children and notes directly
        return (
          <div className="folder-children">
            {contentFolder.children
              .filter(child => hasContent(child))
              .map(child => renderFolderTree(child, level))}
            {contentFolder.notes.map(note => (
              <div 
                key={note.id}
                className={`note-item ${selectedNotes.has(note.id) ? 'selected' : ''}`}
                style={{ paddingLeft: `${level * 20}px` }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleObsNoteToggle(note)
                }}
              >
                <span className="note-icon">📄</span>
                <span className="note-name">{getDisplayTitle(note)}</span>
              </div>
            ))}
          </div>
        )
      } else {
        // No content folder found, render root's children (excluding root itself)
        return (
          <div className="folder-children">
            {folder.children
              .filter(child => hasContent(child) && child.name !== 'content')
              .map(child => renderFolderTree(child, level))}
            {folder.notes.map(note => (
              <div 
                key={note.id}
                className={`note-item ${selectedNotes.has(note.id) ? 'selected' : ''}`}
                style={{ paddingLeft: `${level * 20}px` }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleObsNoteToggle(note)
                }}
              >
                <span className="note-icon">📄</span>
                <span className="note-name">{getDisplayTitle(note)}</span>
              </div>
            ))}
          </div>
        )
      }
    }

    // Skip "content" folder - render its children and notes directly
    if (folder.name === 'content' || folder.name.toLowerCase() === 'content') {
      return (
        <div className="folder-children">
          {folder.children
            .filter(child => hasContent(child))
            .map(child => renderFolderTree(child, level))}
          {folder.notes.map(note => (
            <div 
              key={note.id}
              className={`note-item ${selectedNotes.has(note.id) ? 'selected' : ''}`}
              style={{ paddingLeft: `${level * 20}px` }}
              onClick={(e) => {
                e.stopPropagation()
                handleObsNoteToggle(note)
              }}
            >
              <span className="note-icon">📄</span>
              <span className="note-name">{getDisplayTitle(note)}</span>
            </div>
          ))}
        </div>
      )
    }

    // Render normal folders (not Root or content)
    const isExpanded = expandedFolders.has(folder.path)
    const isSelected = selectedFolder === folder.path
    const hasChildren = folder.children.length > 0 || folder.notes.length > 0

    return (
      <div key={folder.path} className="folder-tree-item">
        <div 
          className={`folder-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${level * 20}px` }}
          onClick={() => selectFolder(folder.path)}
        >
          {hasChildren && (
            <button
              className="folder-toggle"
              onClick={(e) => {
                e.stopPropagation()
                toggleFolderExpansion(folder.path)
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          <span className="folder-icon">📁</span>
          <span className="folder-name">{folder.name}</span>
          <span className="folder-count">
            ({folder.notes.length + folder.children.reduce((acc, child) => acc + child.notes.length, 0)})
          </span>
        </div>
        
        {isExpanded && (
          <div className="folder-children">
            {folder.children
              .filter(child => hasContent(child) && child.name !== 'content')
              .map(child => renderFolderTree(child, level + 1))}
            {folder.notes.map(note => (
              <div 
                key={note.id}
                className={`note-item ${selectedNotes.has(note.id) ? 'selected' : ''}`}
                style={{ paddingLeft: `${(level + 1) * 20}px` }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleObsNoteToggle(note)
                }}
              >
                <span className="note-icon">📄</span>
                <span className="note-name">{getDisplayTitle(note)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Shape mode: render without modal overlay
  if (shapeMode) {
    return (
      <div 
        className={`obsidian-browser shape-mode ${className}`}
        onClick={(e) => {
          // Only stop propagation for interactive elements (buttons, inputs, note items, etc.)
          const target = e.target as HTMLElement
          const isInteractive = target.tagName === 'BUTTON' || 
                                target.tagName === 'INPUT' || 
                                target.tagName === 'TEXTAREA' ||
                                target.tagName === 'SELECT' ||
                                target.closest('button') ||
                                target.closest('input') ||
                                target.closest('textarea') ||
                                target.closest('select') ||
                                target.closest('[role="button"]') ||
                                target.closest('a') ||
                                target.closest('.note-item') || // Obsidian note items in list view
                                target.closest('.note-card') // Obsidian note cards in grid/list view
          if (isInteractive) {
            e.stopPropagation()
          }
          // Don't stop propagation for white space - let tldraw handle dragging
        }}
        onPointerDown={(e) => {
          // Only stop propagation for interactive elements to allow tldraw to handle dragging on white space
          const target = e.target as HTMLElement
          const isInteractive = target.tagName === 'BUTTON' || 
                                target.tagName === 'INPUT' || 
                                target.tagName === 'TEXTAREA' ||
                                target.tagName === 'SELECT' ||
                                target.closest('button') ||
                                target.closest('input') ||
                                target.closest('textarea') ||
                                target.closest('select') ||
                                target.closest('[role="button"]') ||
                                target.closest('a') ||
                                target.closest('.note-item') || // Obsidian note items in list view
                                target.closest('.note-card') // Obsidian note cards in grid/list view
          if (isInteractive) {
            e.stopPropagation()
          }
          // Don't stop propagation for white space - let tldraw handle dragging
        }}
        style={{ 
          width: '100%', 
          height: '100%', 
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto'
        }}
      >
        <div className="browser-content" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Close button removed - using StandardizedToolWrapper header instead */}
        <div className="vault-title">
          <h2>
            {vault ? `Obsidian Vault: ${vault.name}` : 'No Obsidian Vault Connected'}
          </h2>
          {!vault && (
            <div className="vault-connect-section">
              <p className="vault-connect-message">
                Connect your Obsidian vault to browse and add notes to the canvas.
              </p>
              <button
                onClick={handleFolderPicker}
                className="connect-vault-button"
                disabled={isLoading}
              >
                {isLoading ? 'Connecting...' : 'Connect Vault'}
              </button>
            </div>
          )}
        </div>

        {vault && (
          <div className="browser-controls">
            <div className="search-container">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  placeholder="Search notes by title, content, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="clear-search-button"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="search-stats">
                <span className="search-results-count">
                  {searchQuery ? (
                    searchQuery !== debouncedSearchQuery ? (
                      <span className="search-loading">Searching...</span>
                    ) : (
                      `${filteredObsNotes.length} result${filteredObsNotes.length !== 1 ? 's' : ''} found`
                    )
                  ) : (
                    `Showing all ${filteredObsNotes.length} notes`
                  )}
                </span>
              </div>
            </div>
            
            <div className="view-controls">
              <div className="view-mode-toggle">
                <button
                  onClick={() => setViewMode('tree')}
                  className={`view-button ${viewMode === 'tree' ? 'active' : ''}`}
                  title="Tree View"
                >
                  🌳
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`view-button ${viewMode === 'grid' ? 'active' : ''}`}
                  title="Grid View"
                >
                  ⊞
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
                  title="List View"
                >
                  ☰
                </button>
              </div>
              <button
                onClick={handleDisconnectVault}
                className="disconnect-vault-button"
                title="Disconnect Vault"
              >
                🔌 Disconnect Vault
              </button>
            </div>
                  
            <div className="selection-controls">
              <button
                onClick={handleSelectAll}
                className="select-all-button"
                disabled={filteredObsNotes.length === 0}
              >
                {selectedNotes.size === filteredObsNotes.length && filteredObsNotes.length > 0 ? 'Deselect All' : 'Select All'}
              </button>
              {selectedNotes.size > 0 && (
                <button
                  onClick={handleBulkImport}
                  className="bulk-import-button primary"
                >
                  🎯 Pull to Canvas ({selectedNotes.size})
                </button>
              )}
            </div>
          </div>
        )}

        {vault && (
          <div className="notes-container">
            <div className="notes-header">
              <span>
                {debouncedSearchQuery && debouncedSearchQuery.trim() 
                  ? `${filteredObsNotes.length} notes found for "${debouncedSearchQuery}"`
                  : `All ${filteredObsNotes.length} notes`
                }
              </span>
              {vault && (
                <span className="debug-info">
                  (Total: {vault.obs_notes.length}, Search: "{debouncedSearchQuery}")
                </span>
              )}
              {vault && vault.lastImported && (
                <span className="last-imported">
                  Last imported: {vault.lastImported.toLocaleString()}
                </span>
              )}
            </div>

            <div className={`notes-display ${viewMode}`}>
              {viewMode === 'tree' ? (
                <div className="folder-tree-container">
                  {folderTree ? (
                    <div className="folder-tree">
                      {renderFolderTree(folderTree)}
                    </div>
                  ) : (
                    <div className="no-folder-tree">
                      <p>No folder structure available</p>
                    </div>
                  )}
                </div>
              ) : filteredObsNotes.length === 0 ? (
                <div className="no-notes">
                  <p>No notes found. {vault ? `Vault has ${vault.obs_notes.length} notes.` : 'Vault not loaded.'}</p>
                  <p>Search query: "{debouncedSearchQuery}"</p>
                </div>
              ) : (
                filteredObsNotes.map(obs_note => {
                  // Safety check for undefined obs_note
                  if (!obs_note) {
                    return null
                  }
                  
                  const isSelected = selectedNotes.has(obs_note.id)
                  const displayTitle = getDisplayTitle(obs_note)
                  const contentPreview = getContentPreview(obs_note, viewMode === 'grid' ? 120 : 200)
                
                  return (
                    <div
                      key={obs_note.id}
                      className={`note-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleObsNoteToggle(obs_note)}
                    >
                      <div className="note-card-header">
                        <div className="note-card-checkbox">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleObsNoteToggle(obs_note)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="note-card-title-section">
                          <h3 
                            className="note-card-title" 
                            title={displayTitle}
                            dangerouslySetInnerHTML={{
                              __html: highlightSearchMatches(displayTitle, debouncedSearchQuery)
                            }}
                          />
                          <span className="note-card-date">
                            {obs_note.modified ? 
                              (obs_note.modified instanceof Date ? 
                                obs_note.modified.toLocaleDateString() : 
                                new Date(obs_note.modified).toLocaleDateString()
                              ) : 'Unknown date'}
                          </span>
                        </div>
                        <button
                          className="note-card-quick-add"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleObsNoteClick(obs_note)
                          }}
                          title="Add to Canvas"
                        >
                          +
                        </button>
                      </div>
                      
                      <div className="note-card-content">
                        <p 
                          className="note-card-preview"
                          dangerouslySetInnerHTML={{
                            __html: highlightSearchMatches(contentPreview, debouncedSearchQuery)
                          }}
                        />
                      </div>

                      {obs_note.tags.length > 0 && (
                        <div className="note-card-tags">
                          {obs_note.tags.slice(0, viewMode === 'grid' ? 2 : 4).map(tag => (
                            <span key={tag} className="note-card-tag">
                              {tag.replace('#', '')}
                            </span>
                          ))}
                          {obs_note.tags.length > (viewMode === 'grid' ? 2 : 4) && (
                            <span className="note-card-tag-more">
                              +{obs_note.tags.length - (viewMode === 'grid' ? 2 : 4)}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="note-card-meta">
                        <span className="note-card-path" title={obs_note.filePath || getFilePath(obs_note)}>
                          {getFilePath(obs_note)}
                        </span>
                        {obs_note.links.length > 0 && (
                          <span className="note-card-links">
                            {obs_note.links.length} links
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    )
  }

  // Modal mode: render with overlay
  return (
    <div className={`obsidian-browser ${className}`} onClick={handleBackdropClick}>
      <div className="browser-content">
        <button onClick={onClose} className="close-button">
          ×
        </button>
        <div className="vault-title">
          <h2>
            {vault ? `Obsidian Vault: ${vault.name}` : 'No Obsidian Vault Connected'}
          </h2>
          {!vault && (
            <div className="vault-connect-section">
              <p className="vault-connect-message">
                Connect your Obsidian vault to browse and add notes to the canvas.
              </p>
              <button
                onClick={handleFolderPicker}
                className="connect-vault-button"
                disabled={isLoading}
              >
                {isLoading ? 'Connecting...' : 'Connect Vault'}
              </button>
            </div>
          )}
        </div>

        {vault && (
          <div className="browser-controls">
            <div className="search-container">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  placeholder="Search notes by title, content, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="clear-search-button"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="search-stats">
                <span className="search-results-count">
                  {searchQuery ? (
                    searchQuery !== debouncedSearchQuery ? (
                      <span className="search-loading">Searching...</span>
                    ) : (
                      `${filteredObsNotes.length} result${filteredObsNotes.length !== 1 ? 's' : ''} found`
                    )
                  ) : (
                    `Showing all ${filteredObsNotes.length} notes`
                  )}
                </span>
              </div>
            </div>
            
            <div className="view-controls">
              <div className="view-mode-toggle">
                <button
                  onClick={() => setViewMode('tree')}
                  className={`view-button ${viewMode === 'tree' ? 'active' : ''}`}
                  title="Tree View"
                >
                  🌳
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`view-button ${viewMode === 'grid' ? 'active' : ''}`}
                  title="Grid View"
                >
                  ⊞
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
                  title="List View"
                >
                  ☰
                </button>
              </div>
              <button
                onClick={handleDisconnectVault}
                className="disconnect-vault-button"
                title="Disconnect Vault"
              >
                🔌 Disconnect Vault
              </button>
            </div>
                  
            <div className="selection-controls">
              <button
                onClick={handleSelectAll}
                className="select-all-button"
                disabled={filteredObsNotes.length === 0}
              >
                {selectedNotes.size === filteredObsNotes.length && filteredObsNotes.length > 0 ? 'Deselect All' : 'Select All'}
              </button>
              {selectedNotes.size > 0 && (
                <button
                  onClick={handleBulkImport}
                  className="bulk-import-button primary"
                >
                  🎯 Pull to Canvas ({selectedNotes.size})
                </button>
              )}
            </div>
          </div>
        )}

        {vault && (
          <div className="notes-container">
            <div className="notes-header">
              <span>
                {debouncedSearchQuery && debouncedSearchQuery.trim() 
                  ? `${filteredObsNotes.length} notes found for "${debouncedSearchQuery}"`
                  : `All ${filteredObsNotes.length} notes`
                }
              </span>
              {vault && (
                <span className="debug-info">
                  (Total: {vault.obs_notes.length}, Search: "{debouncedSearchQuery}")
                </span>
              )}
              {vault && vault.lastImported && (
                <span className="last-imported">
                  Last imported: {vault.lastImported.toLocaleString()}
                </span>
              )}
            </div>

            <div className={`notes-display ${viewMode}`}>
              {viewMode === 'tree' ? (
                <div className="folder-tree-container">
                  {folderTree ? (
                    <div className="folder-tree">
                      {renderFolderTree(folderTree)}
                    </div>
                  ) : (
                    <div className="no-folder-tree">
                      <p>No folder structure available</p>
                    </div>
                  )}
                </div>
              ) : filteredObsNotes.length === 0 ? (
                <div className="no-notes">
                  <p>No notes found. {vault ? `Vault has ${vault.obs_notes.length} notes.` : 'Vault not loaded.'}</p>
                  <p>Search query: "{debouncedSearchQuery}"</p>
                </div>
              ) : (
                filteredObsNotes.map(obs_note => {
                  // Safety check for undefined obs_note
                  if (!obs_note) {
                    return null
                  }
                  
                  const isSelected = selectedNotes.has(obs_note.id)
                  const displayTitle = getDisplayTitle(obs_note)
                  const contentPreview = getContentPreview(obs_note, viewMode === 'grid' ? 120 : 200)
                
                  return (
                    <div
                      key={obs_note.id}
                      className={`note-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleObsNoteToggle(obs_note)}
                    >
                      <div className="note-card-header">
                        <div className="note-card-checkbox">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleObsNoteToggle(obs_note)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="note-card-title-section">
                          <h3 
                            className="note-card-title" 
                            title={displayTitle}
                            dangerouslySetInnerHTML={{
                              __html: highlightSearchMatches(displayTitle, debouncedSearchQuery)
                            }}
                          />
                          <span className="note-card-date">
                            {obs_note.modified ? 
                              (obs_note.modified instanceof Date ? 
                                obs_note.modified.toLocaleDateString() : 
                                new Date(obs_note.modified).toLocaleDateString()
                              ) : 'Unknown date'}
                          </span>
                        </div>
                        <button
                          className="note-card-quick-add"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleObsNoteClick(obs_note)
                          }}
                          title="Add to Canvas"
                        >
                          +
                        </button>
                      </div>
                      
                      <div className="note-card-content">
                        <p 
                          className="note-card-preview"
                          dangerouslySetInnerHTML={{
                            __html: highlightSearchMatches(contentPreview, debouncedSearchQuery)
                          }}
                        />
                      </div>

                      {obs_note.tags.length > 0 && (
                        <div className="note-card-tags">
                          {obs_note.tags.slice(0, viewMode === 'grid' ? 2 : 4).map(tag => (
                            <span key={tag} className="note-card-tag">
                              {tag.replace('#', '')}
                            </span>
                          ))}
                          {obs_note.tags.length > (viewMode === 'grid' ? 2 : 4) && (
                            <span className="note-card-tag-more">
                              +{obs_note.tags.length - (viewMode === 'grid' ? 2 : 4)}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="note-card-meta">
                        <span className="note-card-path" title={obs_note.filePath || getFilePath(obs_note)}>
                          {getFilePath(obs_note)}
                        </span>
                        {obs_note.links.length > 0 && (
                          <span className="note-card-links">
                            {obs_note.links.length} links
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ObsidianVaultBrowser