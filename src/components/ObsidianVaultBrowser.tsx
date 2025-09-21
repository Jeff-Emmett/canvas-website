import React, { useState, useEffect, useMemo } from 'react'
import { ObsidianImporter, ObsidianObsNote, ObsidianVault } from '@/lib/obsidianImporter'
import { useAuth } from '@/context/AuthContext'

interface ObsidianVaultBrowserProps {
  onObsNoteSelect: (obs_note: ObsidianObsNote) => void
  onObsNotesSelect: (obs_notes: ObsidianObsNote[]) => void
  onClose: () => void
  className?: string
  autoOpenFolderPicker?: boolean
  showVaultBrowser?: boolean
}

export const ObsidianVaultBrowser: React.FC<ObsidianVaultBrowserProps> = ({
  onObsNoteSelect,
  onObsNotesSelect,
  onClose,
  className = '',
  autoOpenFolderPicker = false,
  showVaultBrowser = true
}) => {
  const { session, updateSession } = useAuth()
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [showVaultInput, setShowVaultInput] = useState(false)
  const [vaultPath, setVaultPath] = useState('')
  const [inputMethod, setInputMethod] = useState<'folder' | 'url' | 'quartz'>('folder')
  const [showFolderReselect, setShowFolderReselect] = useState(false)
  const [isLoadingVault, setIsLoadingVault] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  // Initialize debounced search query to match search query
  useEffect(() => {
    setDebouncedSearchQuery(searchQuery)
  }, [])

  // Load vault on component mount - only once per component lifecycle
  useEffect(() => {
    // Prevent multiple loads if already loading or already loaded once
    if (isLoadingVault || hasLoadedOnce) {
      console.log('🔧 ObsidianVaultBrowser: Skipping load - already loading or loaded once')
      return
    }

    console.log('🔧 ObsidianVaultBrowser: Component mounted, loading vault...')
    console.log('🔧 Current session vault data:', { 
      path: session.obsidianVaultPath, 
      name: session.obsidianVaultName,
      authed: session.authed,
      username: session.username
    })
    
    // Try to load from stored vault path first
    if (session.obsidianVaultPath && session.obsidianVaultPath !== 'folder-selected') {
      console.log('🔧 Loading vault from stored path:', session.obsidianVaultPath)
      loadVault(session.obsidianVaultPath)
    } else if (session.obsidianVaultPath === 'folder-selected' && session.obsidianVaultName) {
      console.log('🔧 Vault was previously selected via folder picker, showing reselect interface')
      // For folder-selected vaults, we can't reload them, so show a special reselect interface
      setVault(null)
      setShowFolderReselect(true)
      setIsLoading(false)
      setHasLoadedOnce(true)
    } else {
      console.log('🔧 No vault configured, showing empty state...')
      setVault(null)
      setIsLoading(false)
      setHasLoadedOnce(true)
    }
  }, []) // Remove dependencies to ensure this only runs once on mount

  // Handle session changes only if we haven't loaded yet
  useEffect(() => {
    if (hasLoadedOnce || isLoadingVault) {
      return // Don't reload if we've already loaded or are currently loading
    }

    if (session.obsidianVaultPath && session.obsidianVaultPath !== 'folder-selected') {
      console.log('🔧 Session vault path changed, loading vault:', session.obsidianVaultPath)
      loadVault(session.obsidianVaultPath)
    } else if (session.obsidianVaultPath === 'folder-selected' && session.obsidianVaultName) {
      console.log('🔧 Session shows folder-selected vault, showing reselect interface')
      setVault(null)
      setShowFolderReselect(true)
      setIsLoading(false)
      setHasLoadedOnce(true)
    }
  }, [session.obsidianVaultPath, session.obsidianVaultName, hasLoadedOnce, isLoadingVault])

  // Auto-open folder picker if requested
  useEffect(() => {
    if (autoOpenFolderPicker) {
      console.log('Auto-opening folder picker...')
      handleFolderPicker()
    }
  }, [autoOpenFolderPicker])

  // Reset loading state when component is closed
  useEffect(() => {
    if (!showVaultBrowser) {
      // Reset states when component is closed
      setHasLoadedOnce(false)
      setIsLoadingVault(false)
    }
  }, [showVaultBrowser])


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
        console.log('🔧 ESC key pressed, closing vault browser')
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
      console.log('🔧 loadVault: Already loading, skipping concurrent request')
      return
    }

    setIsLoadingVault(true)
    setIsLoading(true)
    setError(null)
    
    try {
      if (path) {
        // Check if it's a Quartz URL
        if (path.startsWith('http') || path.includes('quartz') || path.includes('.xyz') || path.includes('.com')) {
          // Load from Quartz URL - always get latest data
          console.log('🔧 Loading Quartz vault from URL (getting latest data):', path)
          const loadedVault = await importer.importFromQuartzUrl(path)
          console.log('Loaded Quartz vault from URL:', loadedVault)
          setVault(loadedVault)
          setShowVaultInput(false)
          setShowFolderReselect(false)
          // Save the vault path and name to user session
          console.log('🔧 Saving Quartz vault to session:', { path, name: loadedVault.name })
          updateSession({ 
            obsidianVaultPath: path,
            obsidianVaultName: loadedVault.name
          })
          console.log('🔧 Quartz vault saved to session successfully')
        } else {
          // Load from local directory
          console.log('🔧 Loading vault from local directory:', path)
          const loadedVault = await importer.importFromDirectory(path)
          console.log('Loaded vault from path:', loadedVault)
          setVault(loadedVault)
          setShowVaultInput(false)
          setShowFolderReselect(false)
          // Save the vault path and name to user session
          console.log('🔧 Saving vault to session:', { path, name: loadedVault.name })
          updateSession({ 
            obsidianVaultPath: path,
            obsidianVaultName: loadedVault.name
          })
          console.log('🔧 Vault saved to session successfully')
        }
      } else {
        // No vault configured - show empty state
        console.log('No vault configured, showing empty state...')
        setVault(null)
        setShowVaultInput(false)
      }
    } catch (err) {
      console.error('Failed to load vault:', err)
      setError('Failed to load Obsidian vault. Please try again.')
      setVault(null)
      // Don't show vault input if user already has a vault configured
      // Only show vault input if this is a fresh attempt
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
    if (vaultPath.trim()) {
      if (inputMethod === 'quartz') {
        // Handle Quartz URL
        try {
          setIsLoading(true)
          setError(null)
          const loadedVault = await importer.importFromQuartzUrl(vaultPath.trim())
          setVault(loadedVault)
          setShowVaultInput(false)
          setShowFolderReselect(false)
          
          // Save Quartz vault to session
          console.log('🔧 Saving Quartz vault to session:', { 
            path: vaultPath.trim(), 
            name: loadedVault.name 
          })
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
        // Handle regular vault path
        loadVault(vaultPath.trim())
      }
    }
  }

  const handleFolderPicker = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const loadedVault = await importer.importFromFileSystem()
        setVault(loadedVault)
        setShowVaultInput(false)
        setShowFolderReselect(false)
        // Note: We can't get the actual path from importFromFileSystem, 
        // but we can save a flag that a folder was selected
        console.log('🔧 Saving folder-selected vault to session:', { 
          path: 'folder-selected', 
          name: loadedVault.name 
        })
        updateSession({ 
          obsidianVaultPath: 'folder-selected',
          obsidianVaultName: loadedVault.name
        })
        console.log('🔧 Folder-selected vault saved to session successfully')
      } catch (err) {
        console.error('Failed to load vault:', err)
        setError('Failed to load Obsidian vault. Please try again.')
      }
    }
  }

  // Filter obs_notes based on search query
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
    // If no search query, show all notes (obs_notes remains unchanged)

    // Debug logging
    console.log('Search query:', debouncedSearchQuery)
    console.log('Total notes:', vault.obs_notes.length)
    console.log('Filtered notes:', obs_notes.length)
    console.log('Showing all notes:', !debouncedSearchQuery || !debouncedSearchQuery.trim())

    return obs_notes
  }, [vault, debouncedSearchQuery])

  // Listen for trigger-obsnote-creation event from CustomToolbar
  useEffect(() => {
    const handleTriggerCreation = () => {
      console.log('🎯 ObsidianVaultBrowser: Received trigger-obsnote-creation event')
      
      if (selectedNotes.size > 0) {
        // Create shapes from currently selected notes
        const selectedObsNotes = filteredObsNotes.filter(obs_note => selectedNotes.has(obs_note.id))
        console.log('🎯 Creating shapes from selected notes:', selectedObsNotes.length)
        onObsNotesSelect(selectedObsNotes)
      } else {
        // If no notes are selected, select all visible notes
        const allVisibleNotes = filteredObsNotes
        if (allVisibleNotes.length > 0) {
          console.log('🎯 No notes selected, creating shapes from all visible notes:', allVisibleNotes.length)
          onObsNotesSelect(allVisibleNotes)
        } else {
          console.log('🎯 No notes available to create shapes from')
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
    console.log('🎯 ObsidianVaultBrowser: handleObsNoteClick called with:', obs_note)
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
    console.log('🎯 ObsidianVaultBrowser: handleBulkImport called with:', selectedObsNotes.length, 'notes')
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
            <button onClick={handleFolderPicker} className="load-vault-button primary">
              📁 Select Folder
            </button>
            <button onClick={() => setShowVaultInput(true)} className="load-vault-button secondary">
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
              {filteredObsNotes.length === 0 ? (
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
                        <span className="note-card-path" title={obs_note.filePath}>
                          {obs_note.filePath.startsWith('http') 
                            ? new URL(obs_note.filePath).pathname.replace(/^\//, '') || 'Home'
                            : obs_note.filePath
                          }
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