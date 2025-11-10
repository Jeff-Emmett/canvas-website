import React, { useState, useRef, useEffect } from 'react'
import { BaseBoxShapeUtil, TLBaseShape, TLShapeId, createShapeId, IndexKey, TLParentId, HTMLContainer } from '@tldraw/tldraw'
import { ObsidianObsNote } from '@/lib/obsidianImporter'
import { QuartzSync, createQuartzNoteFromShape, QuartzSyncConfig } from '@/lib/quartzSync'
import { logGitHubSetupStatus } from '@/lib/githubSetupValidator'
import { getClientConfig } from '@/lib/clientConfig'
import { StandardizedToolWrapper } from '../components/StandardizedToolWrapper'

// Auto-resizing textarea component
const AutoResizeTextarea: React.FC<{
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  style: React.CSSProperties
  placeholder?: string
  onPointerDown?: (e: React.PointerEvent) => void
}> = ({ value, onChange, onBlur, onKeyDown, style, placeholder, onPointerDown }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }

  useEffect(() => {
    adjustHeight()
    // Focus the textarea when it mounts
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [value])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value)
        adjustHeight()
      }}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      style={style}
      placeholder={placeholder}
      rows={1}
      autoFocus
    />
  )
}

// Main ObsNote component with editable content
const ObsNoteComponent: React.FC<{
  shape: IObsNoteShape
  shapeUtil: ObsNoteShape
}> = ({ shape, shapeUtil }) => {
  const isSelected = shapeUtil.editor.getSelectedShapeIds().includes(shape.id)
  const [isEditing, setIsEditing] = useState(shape.props.isEditing)
  const [editingContent, setEditingContent] = useState(shape.props.editingContent || shape.props.content)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editingTitle, setEditingTitle] = useState(shape.props.title || 'Untitled')
  const [isSyncing, setIsSyncing] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  // Store the content at the start of editing to revert to on cancel
  const [contentAtEditStart, setContentAtEditStart] = useState<string | null>(null)
  // Notification state for in-shape notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Sync editingContent with shape content when shape changes (but not when editing)
  // This ensures the component stays in sync with the shape's content
  // Note: We don't sync during editing or immediately after cancel (when contentAtEditStart might be set)
  useEffect(() => {
    if (!isEditing && contentAtEditStart === null && shape.props.content !== editingContent) {
      setEditingContent(shape.props.content)
    }
  }, [shape.props.content, isEditing, contentAtEditStart, editingContent])

  // Auto-hide notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const titleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 'bold',
    color: shape.props.textColor,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    cursor: isEditingTitle ? 'text' : 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'background-color 0.2s ease',
  }

  const tagsStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '4px',
  }

  const tagStyle: React.CSSProperties = {
    backgroundColor: '#007acc',
    color: 'white',
    padding: '2px 6px',
    borderRadius: '12px',
    fontSize: '10px',
    fontWeight: '500',
  }

  const contentStyle: React.CSSProperties = {
    padding: '12px',
    flex: 1,
    overflow: 'auto',
    color: shape.props.textColor,
    fontSize: '12px',
    lineHeight: '1.4',
    cursor: isEditing ? 'text' : 'pointer',
    transition: 'background-color 0.2s ease',
  }

  const previewStyle: React.CSSProperties = {
    height: '100%',
    overflow: 'auto',
  }

  const fullContentStyle: React.CSSProperties = {
    height: '100%',
    overflow: 'auto',
  }

  const emptyStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#999',
    fontSize: '12px',
    fontStyle: 'italic',
    cursor: 'pointer',
    border: '2px dashed #ddd',
    borderRadius: '4px',
    padding: '8px',
    textAlign: 'center',
  }

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '60px',
    border: 'none',
    outline: 'none',
    resize: 'none',
    fontFamily: 'inherit',
    fontSize: '12px',
    lineHeight: '1.4',
    color: shape.props.textColor,
    backgroundColor: 'transparent',
    padding: 0,
    margin: 0,
    position: 'relative',
    zIndex: 1000,
    pointerEvents: 'auto',
  }

  const editControlsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#f8f9fa',
    borderTop: '1px solid #e0e0e0',
    position: 'relative',
    zIndex: 1000,
    pointerEvents: 'auto',
  }

  const buttonStyle: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
  }

  const handleStartEdit = () => {
    try {
      // Capture the current content as the baseline for cancel
      // This is the content that exists BEFORE editing starts
      const currentContent = shape.props.content || ''
      setContentAtEditStart(currentContent)
      setIsEditing(true)
      setEditingContent(currentContent)
      const sanitizedProps = ObsNoteShape.sanitizeProps({
        ...shape.props,
        isEditing: true,
        editingContent: currentContent,
      })
      shapeUtil.editor.updateShape<IObsNoteShape>({
        id: shape.id,
        type: 'ObsNote',
        props: sanitizedProps
      })
    } catch (error) {
      console.error('❌ Error in handleStartEdit:', error)
    }
  }

  const handleStartTitleEdit = () => {
    setIsEditingTitle(true)
    setEditingTitle(shape.props.title || 'Untitled')
  }

  const handleSaveTitleEdit = () => {
    if (editingTitle.trim() !== shape.props.title) {
      const sanitizedProps = ObsNoteShape.sanitizeProps({
        ...shape.props,
        title: editingTitle.trim(),
        isModified: true
      })
      shapeUtil.editor.updateShape<IObsNoteShape>({
        id: shape.id,
        type: 'ObsNote',
        props: sanitizedProps
      })
    }
    setIsEditingTitle(false)
  }

  const handleCancelTitleEdit = () => {
    setEditingTitle(shape.props.title || 'Untitled')
    setIsEditingTitle(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveTitleEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelTitleEdit()
    }
  }

  const handleSaveEdit = () => {
    try {
      const hasChanged = editingContent !== shape.props.originalContent
      
      setIsEditing(false)
      setContentAtEditStart(null) // Clear the stored baseline
      const sanitizedProps = ObsNoteShape.sanitizeProps({
        ...shape.props,
        content: editingContent, // Save the edited content
        isEditing: false,
        editingContent: '',
        isModified: hasChanged,
      })
      shapeUtil.editor.updateShape<IObsNoteShape>({
        id: shape.id,
        type: 'ObsNote',
        props: sanitizedProps
      })
    } catch (error) {
      console.error('❌ Error in handleSaveEdit:', error)
    }
  }

  const handleCancelEdit = () => {
    try {
      // Revert to the content that was there when editing started
      // Priority: contentAtEditStart > originalContent > current content
      const contentToRevert = contentAtEditStart !== null 
        ? contentAtEditStart 
        : (shape.props.originalContent || shape.props.content || '')
      
      // Update state first to exit editing mode
      setIsEditing(false)
      setEditingContent(contentToRevert)
      
      // Update the shape with the reverted content
      const sanitizedProps = ObsNoteShape.sanitizeProps({
        ...shape.props,
        content: contentToRevert, // Revert content to what it was when editing started
        isEditing: false,
        editingContent: '',
        // Reset isModified only if we're reverting all the way back to originalContent
        isModified: contentToRevert === shape.props.originalContent ? false : shape.props.isModified,
      })
      
      shapeUtil.editor.updateShape<IObsNoteShape>({
        id: shape.id,
        type: 'ObsNote',
        props: sanitizedProps
      })
      
      // Clear the stored baseline after reverting
      setContentAtEditStart(null)
    } catch (error) {
      console.error('❌ Error in handleCancelEdit:', error)
      // Fallback: just exit editing mode
      setIsEditing(false)
      setContentAtEditStart(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEdit()
    }
  }

  const handleRefresh = async () => {
    if (isRefreshing) return
    
    setIsRefreshing(true)
    
    try {
      const success = await shapeUtil.refreshFromVault(shape.id)
      if (success) {
        setNotification({ message: '✅ Note restored from vault', type: 'success' })
      } else {
        setNotification({ message: '❌ Failed to restore note', type: 'error' })
      }
    } catch (error) {
      console.error('❌ Refresh failed:', error)
      setNotification({ 
        message: `Refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        type: 'error' 
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSync = async () => {
    if (isSyncing) return
    
    setIsSyncing(true)
    
    try {
      // Capture the content to sync BEFORE any state changes
      // This ensures we have the absolute latest content
      const contentToSync = isEditing ? editingContent : (shape.props.content || '')
      const titleToSync = isEditingTitle ? editingTitle : (shape.props.title || 'Untitled')
      
      // If we're editing, save the edit FIRST to ensure the shape has the latest content
      if (isEditing) {
        // Save the edit synchronously
        const hasChanged = editingContent !== shape.props.originalContent
        const sanitizedProps = ObsNoteShape.sanitizeProps({
          ...shape.props,
          content: editingContent, // Save the edited content
          isEditing: false,
          editingContent: '',
          isModified: hasChanged,
        })
        shapeUtil.editor.updateShape<IObsNoteShape>({
          id: shape.id,
          type: 'ObsNote',
          props: sanitizedProps
        })
        
        // Update local state
        setIsEditing(false)
        setContentAtEditStart(null)
      }
      
      // If we're editing title, save that too
      if (isEditingTitle) {
        const sanitizedProps = ObsNoteShape.sanitizeProps({
          ...shape.props,
          title: editingTitle,
        })
        shapeUtil.editor.updateShape<IObsNoteShape>({
          id: shape.id,
          type: 'ObsNote',
          props: sanitizedProps
        })
        setIsEditingTitle(false)
      }
      
      // Get fresh shape reference for vault info and other properties
      const currentShape = shapeUtil.editor.getShape(shape.id) as IObsNoteShape
      if (!currentShape) {
        throw new Error('Shape not found')
      }
      
      // Use the captured contentToSync and titleToSync (which are the latest)
      
      let vaultPath = currentShape.props.vaultPath
      let vaultName = currentShape.props.vaultName
      
      if (!vaultPath || !vaultName) {
        // Try to get vault info from session if not in shape props
        // This is a fallback for existing shapes that don't have vault info
        const sessionData = localStorage.getItem('canvas_auth_session')
        if (sessionData) {
          try {
            const session = JSON.parse(sessionData)
            
            if (session.obsidianVaultPath && session.obsidianVaultName) {
              // Update the shape with vault info for future syncs
              const sanitizedProps = ObsNoteShape.sanitizeProps({
                ...currentShape.props,
                vaultPath: session.obsidianVaultPath,
                vaultName: session.obsidianVaultName,
              })
              shapeUtil.editor.updateShape<IObsNoteShape>({
                id: currentShape.id,
                type: 'ObsNote',
                props: sanitizedProps
              })
              
              // Use the session vault info
              vaultPath = session.obsidianVaultPath
              vaultName = session.obsidianVaultName
            }
          } catch (e) {
            console.error('Failed to parse session data:', e)
          }
        }
        
        if (!vaultPath || !vaultName) {
          throw new Error('No vault configured for sync. Please configure a vault in settings first.')
        }
      }
      
      // Determine if this is a Quartz URL or local vault
      const isQuartzVault = vaultPath.startsWith('http') || vaultPath.includes('quartz') || vaultPath.includes('.xyz') || vaultPath.includes('.com')
      
      if (isQuartzVault) {
        // Use the new Quartz sync system
        try {
          // Validate GitHub setup first
          logGitHubSetupStatus()
          
          // Create Quartz note with the latest content
          // Create a temporary shape object with the latest content for sync
          const shapeForSync = {
            ...currentShape,
            props: {
              ...currentShape.props,
              content: contentToSync,
              title: titleToSync,
            }
          }
          const quartzNote = createQuartzNoteFromShape(shapeForSync)
          
          // Configure Quartz sync
          const config = getClientConfig()
          
          const syncConfig: QuartzSyncConfig = {
            githubToken: config.githubToken,
            githubRepo: config.quartzRepo,
            quartzUrl: vaultPath,
            cloudflareApiKey: config.cloudflareApiKey,
            cloudflareAccountId: config.cloudflareAccountId
          }
          
          const quartzSync = new QuartzSync(syncConfig)
          
          // Try smart sync (tries multiple approaches)
          const syncSuccess = await quartzSync.smartSync(quartzNote)
          
          if (syncSuccess) {
            alert('✅ Note synced to Quartz successfully! Check your GitHub repository for changes.')
          } else {
            throw new Error('All sync methods failed')
          }
        } catch (error) {
          console.error('❌ Quartz sync failed:', error)
          
          // Fallback to local storage
          const quartzStorageKey = `quartz_vault_${vaultName}_${currentShape.props.noteId || titleToSync}`
          const tags = currentShape.props.tags || []
          const title = titleToSync
          const content = contentToSync
          const frontmatter = `---
title: "${title}"
tags: [${tags.map(tag => `"${tag.replace('#', '')}"`).join(', ')}]
created: ${new Date().toISOString()}
modified: ${new Date().toISOString()}
quartz_url: "${vaultPath}"
---

${content}`
          
          localStorage.setItem(quartzStorageKey, frontmatter)
          alert(`Quartz sync: Stored locally as fallback. Check console for details.`)
        }
      } else {
        // For local vaults, try to write using File System Access API
        // Use stored filePath if available to maintain filename consistency
        // Otherwise, generate from title or noteId
        let fileName: string
        if (currentShape.props.filePath && currentShape.props.filePath.trim() !== '') {
          // Extract just the filename from the full path
          const pathParts = currentShape.props.filePath.split('/')
          fileName = pathParts[pathParts.length - 1]
          // Ensure it ends with .md
          if (!fileName.endsWith('.md')) {
            fileName = `${fileName}.md`
          }
        } else {
          // Generate from title or noteId
          fileName = `${titleToSync.replace(/[^a-zA-Z0-9]/g, '_')}.md`
        }
        
        // Create the markdown content with frontmatter using the latest content
        const tags = currentShape.props.tags || []
        const title = titleToSync
        const content = contentToSync
        const frontmatter = `---
title: "${title}"
tags: [${tags.map(tag => `"${tag.replace('#', '')}"`).join(', ')}]
created: ${new Date().toISOString()}
modified: ${new Date().toISOString()}
---

${content}`
        
        try {
          
          // Try to write using File System Access API
          if ('showSaveFilePicker' in window) {
            const fileHandle = await (window as any).showSaveFilePicker({
              suggestedName: fileName,
              types: [{
                description: 'Markdown files',
                accept: { 'text/markdown': ['.md'] }
              }]
            })
            
            const writable = await fileHandle.createWritable()
            await writable.write(frontmatter)
            await writable.close()
            
            alert(`Local vault sync: File saved successfully as ${fileName}`)
          } else {
            // Fallback: download the file
            const blob = new Blob([frontmatter], { type: 'text/markdown' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = fileName // Use the calculated fileName (preserves original filePath if available)
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            
            alert('Local vault sync: File downloaded! Please save it to your vault folder.')
          }
        } catch (error) {
          console.error('❌ Failed to write local vault file:', error)
          
          // Fallback: store locally and show instructions
          const localStorageKey = `local_vault_${vaultName}_${currentShape.props.noteId || titleToSync}`
          localStorage.setItem(localStorageKey, frontmatter)
          
          alert(`Local vault sync: Failed to write directly. Content stored locally and logged to console. Key: ${localStorageKey}`)
        }
      }
      
      // Mark as synced - get fresh shape to ensure we have the latest
      const finalShape = shapeUtil.editor.getShape(shape.id) as IObsNoteShape
      if (finalShape) {
        const sanitizedProps = ObsNoteShape.sanitizeProps({
          ...finalShape.props,
          isModified: false,
          originalContent: finalShape.props.content, // Update originalContent to current content after successful sync
        })
        shapeUtil.editor.updateShape<IObsNoteShape>({
          id: finalShape.id,
          type: 'ObsNote',
          props: sanitizedProps
        })
      }
      
    } catch (error) {
      console.error('❌ Sync failed:', error)
      alert(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleMinimize = () => {
    setIsMinimized(!isMinimized)
  }

  const handleClose = () => {
    shapeUtil.editor.deleteShape(shape.id)
  }

  // Custom header content with editable title and action buttons
  const headerContent = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
      {isEditingTitle ? (
        <input
          type="text"
          value={editingTitle}
          onChange={(e) => setEditingTitle(e.target.value)}
          onBlur={handleSaveTitleEdit}
          onKeyDown={handleTitleKeyDown}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            ...titleStyle,
            border: '1px solid #007acc',
            borderRadius: '4px',
            padding: '4px 8px',
            backgroundColor: 'white',
            outline: 'none',
            fontSize: '14px',
            fontWeight: 'bold',
            color: shape.props.textColor,
            flex: 1,
            minWidth: 0,
          }}
          autoFocus
        />
      ) : (
        <h3 
          style={{...titleStyle, margin: 0, padding: 0}} 
          title={shape.props.title}
          onClick={(e) => {
            e.stopPropagation()
            handleStartTitleEdit()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseEnter={(e) => {
            if (!isEditingTitle) {
              e.currentTarget.style.backgroundColor = '#f0f0f0'
            }
          }}
          onMouseLeave={(e) => {
            if (!isEditingTitle) {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
        >
          {shape.props.title}
        </h3>
      )}
    </div>
  )

  return (
    <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
      <StandardizedToolWrapper
        title="Obsidian Note"
        primaryColor={ObsNoteShape.PRIMARY_COLOR}
        isSelected={isSelected}
        width={shape.props.w}
        height={shape.props.h}
        onClose={handleClose}
        onMinimize={handleMinimize}
        isMinimized={isMinimized}
        headerContent={headerContent}
        editor={shapeUtil.editor}
        shapeId={shape.id}
      >
      
      {shape.props.tags.length > 0 && (
        <div style={{ padding: '0 12px', paddingBottom: '8px' }}>
          <div style={tagsStyle}>
            {shape.props.tags.slice(0, 3).map((tag, index) => (
              <span key={index} style={tagStyle}>
                {tag.replace('#', '')}
              </span>
            ))}
            {shape.props.tags.length > 3 && (
              <span style={tagStyle}>
                +{shape.props.tags.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      <div 
        style={{
          ...contentStyle,
          backgroundColor: isEditing ? 'transparent' : 'transparent',
          position: 'relative',
          zIndex: isEditing ? 1000 : 'auto',
          pointerEvents: isEditing ? 'auto' : 'auto',
        }}
        onMouseEnter={(e) => {
          if (!isEditing) {
            e.currentTarget.style.backgroundColor = '#f8f9fa'
          }
        }}
        onMouseLeave={(e) => {
          if (!isEditing) {
            e.currentTarget.style.backgroundColor = 'transparent'
          }
        }}
        onClick={(e) => {
          if (!isEditing) {
            e.stopPropagation()
            handleStartEdit()
          }
        }}
        onPointerDown={(e) => {
          if (!isEditing) {
            e.stopPropagation()
          }
        }}
        onWheel={(e) => {
          // Allow mouse wheel scrolling within the obsnote content
          e.stopPropagation()
        }}
        onTouchStart={(e) => {
          // Allow touch scrolling within the obsnote content
          e.stopPropagation()
        }}
        onTouchMove={(e) => {
          // Allow touch scrolling within the obsnote content
          e.stopPropagation()
        }}
        onTouchEnd={(e) => {
          // Allow touch scrolling within the obsnote content
          e.stopPropagation()
        }}
      >
        {isEditing ? (
          <AutoResizeTextarea
            value={editingContent}
            onChange={setEditingContent}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            style={textareaStyle}
            placeholder="Enter your note content..."
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : shape.props.content ? (
          <div 
            style={shape.props.showPreview ? previewStyle : fullContentStyle}
            onWheel={(e) => {
              // Allow mouse wheel scrolling within the content area
              e.stopPropagation()
            }}
            onTouchStart={(e) => {
              // Allow touch scrolling within the content area
              e.stopPropagation()
            }}
            onTouchMove={(e) => {
              // Allow touch scrolling within the content area
              e.stopPropagation()
            }}
            onTouchEnd={(e) => {
              // Allow touch scrolling within the content area
              e.stopPropagation()
            }}
          >
            {shape.props.showPreview ? (
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: shapeUtil.formatMarkdownPreview(shape.props.content) 
                }}
                onWheel={(e) => {
                  // Allow mouse wheel scrolling within the preview content
                  e.stopPropagation()
                }}
                onTouchStart={(e) => {
                  // Allow touch scrolling within the preview content
                  e.stopPropagation()
                }}
                onTouchMove={(e) => {
                  // Allow touch scrolling within the preview content
                  e.stopPropagation()
                }}
                onTouchEnd={(e) => {
                  // Allow touch scrolling within the preview content
                  e.stopPropagation()
                }}
              />
            ) : (
              <pre 
                style={{ 
                  margin: 0, 
                  whiteSpace: 'pre-wrap', 
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  lineHeight: 'inherit'
                }}
                onWheel={(e) => {
                  // Allow mouse wheel scrolling within the pre content
                  e.stopPropagation()
                }}
                onTouchStart={(e) => {
                  // Allow touch scrolling within the pre content
                  e.stopPropagation()
                }}
                onTouchMove={(e) => {
                  // Allow touch scrolling within the pre content
                  e.stopPropagation()
                }}
                onTouchEnd={(e) => {
                  // Allow touch scrolling within the pre content
                  e.stopPropagation()
                }}
              >
                {shape.props.content}
              </pre>
            )}
          </div>
        ) : (
          <div style={emptyStyle}>
            Click to add content
          </div>
        )}
        
        {/* Notification display - positioned at top of content area */}
        {notification && (
          <>
            <style>{`
              @keyframes obsNoteNotificationFade {
                0% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
                10% { opacity: 1; transform: translateX(-50%) translateY(0); }
                90% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
              }
            `}</style>
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '50%',
                zIndex: 10001,
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                color: 'white',
                backgroundColor: notification.type === 'success' ? '#22c55e' : '#ef4444',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                maxWidth: 'calc(100% - 24px)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                animation: 'obsNoteNotificationFade 3s ease-in-out forwards',
              }}
            >
              {notification.message}
            </div>
          </>
        )}
      </div>

      {/* Bottom action buttons - always visible */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        marginTop: 'auto',
      }}>
        {/* Restore button - always shown */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleRefresh()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={isRefreshing}
          style={{
            ...buttonStyle,
            fontSize: '11px',
            padding: '6px 12px',
            backgroundColor: isRefreshing ? '#ccc' : '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            pointerEvents: 'auto',
            opacity: isRefreshing ? 0.7 : 1,
          }}
          title="restore from vault"
        >
          {isRefreshing ? '⏳ Restoring...' : '↩️ Restore'}
        </button>
        
        {/* Save changes button - shown when there are modifications or when editing with changes */}
        {(() => {
          // Check if there are changes: either already modified, or currently editing with different content
          const hasChanges = shape.props.isModified || 
            (isEditing && editingContent !== (contentAtEditStart !== null ? contentAtEditStart : shape.props.originalContent))
          return hasChanges
        })() && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              // Sync will handle saving if editing
              handleSync()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={isSyncing}
            style={{
              ...buttonStyle,
              fontSize: '11px',
              padding: '6px 12px',
              backgroundColor: isSyncing ? '#ccc' : '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              pointerEvents: 'auto',
              opacity: isSyncing ? 0.7 : 1,
            }}
            title="save new content to vault"
          >
            {isSyncing ? '⏳ Saving...' : '💾 Save changes'}
          </button>
        )}
      </div>
      </StandardizedToolWrapper>
    </HTMLContainer>
  )
}

export type IObsNoteShape = TLBaseShape<
  'ObsNote',
  {
    w: number
    h: number
    color: string
    size: string
    font: string
    textAlign: string
    scale: number
    noteId: string
    title: string
    content: string
    tags: string[]
    showPreview: boolean
    backgroundColor: string
    textColor: string
    isEditing: boolean
    editingContent: string
    isModified: boolean
    originalContent: string
    vaultPath?: string
    vaultName?: string
    filePath?: string // Original file path from vault - used to maintain filename consistency
  }
>

export class ObsNoteShape extends BaseBoxShapeUtil<IObsNoteShape> {
  static override type = 'ObsNote'

  // Obsidian Note theme color: Indigo (similar to ObsidianBrowser)
  static readonly PRIMARY_COLOR = "#9333ea"

  /**
   * Sanitize props to ensure all values are JSON serializable
   */
  public static sanitizeProps(props: Partial<IObsNoteShape['props']>): IObsNoteShape['props'] {
    // Ensure tags is a proper string array
    const tags = Array.isArray(props.tags)
      ? props.tags.filter(tag => typeof tag === 'string').map(tag => String(tag))
      : []
    
    // Build sanitized props object
    const sanitized: IObsNoteShape['props'] = {
      w: typeof props.w === 'number' ? props.w : 300,
      h: typeof props.h === 'number' ? props.h : 200,
      color: typeof props.color === 'string' ? props.color : 'black',
      size: typeof props.size === 'string' ? props.size : 'm',
      font: typeof props.font === 'string' ? props.font : 'sans',
      textAlign: typeof props.textAlign === 'string' ? props.textAlign : 'start',
      scale: typeof props.scale === 'number' ? props.scale : 1,
      noteId: typeof props.noteId === 'string' ? props.noteId : '',
      title: typeof props.title === 'string' ? props.title : 'Untitled ObsNote',
      content: typeof props.content === 'string' ? props.content : '',
      tags,
      showPreview: typeof props.showPreview === 'boolean' ? props.showPreview : true,
      backgroundColor: typeof props.backgroundColor === 'string' ? props.backgroundColor : '#ffffff',
      textColor: typeof props.textColor === 'string' ? props.textColor : '#000000',
      isEditing: typeof props.isEditing === 'boolean' ? props.isEditing : false,
      editingContent: typeof props.editingContent === 'string' ? props.editingContent : '',
      isModified: typeof props.isModified === 'boolean' ? props.isModified : false,
      originalContent: typeof props.originalContent === 'string' ? props.originalContent : '',
    }
    
    // Only add optional properties if they're defined and are strings
    if (props.vaultPath !== undefined && typeof props.vaultPath === 'string') {
      sanitized.vaultPath = props.vaultPath
    }
    if (props.vaultName !== undefined && typeof props.vaultName === 'string') {
      sanitized.vaultName = props.vaultName
    }
    if (props.filePath !== undefined && typeof props.filePath === 'string') {
      sanitized.filePath = props.filePath
    }
    
    return sanitized
  }

  getDefaultProps(): IObsNoteShape['props'] {
    return ObsNoteShape.sanitizeProps({})
  }

  component(shape: IObsNoteShape) {
    return <ObsNoteComponent shape={shape} shapeUtil={this} />
  }

  indicator(shape: IObsNoteShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  /**
   * Format markdown content for preview
   * Simplified conversion that avoids extra characters
   */
  formatMarkdownPreview(content: string): string {
    if (!content) return ''
    
    // Escape HTML first to prevent injection
    const escapeHtml = (text: string) => {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    }
    
    // Split into lines for line-based processing
    const lines = content.split('\n')
    const processedLines: string[] = []
    
    for (const line of lines) {
      let processed = escapeHtml(line)
      
      // Headers (must be at start of line)
      if (processed.match(/^### /)) {
        processed = processed.replace(/^### (.*)$/, '<h3 style="font-size: 13px; margin: 0 0 4px 0; font-weight: bold;">$1</h3>')
      } else if (processed.match(/^## /)) {
        processed = processed.replace(/^## (.*)$/, '<h2 style="font-size: 14px; margin: 0 0 6px 0; font-weight: bold;">$1</h2>')
      } else if (processed.match(/^# /)) {
        processed = processed.replace(/^# (.*)$/, '<h1 style="font-size: 16px; margin: 0 0 8px 0; font-weight: bold;">$1</h1>')
      }
      // Lists (only if not already a header)
      else if (processed.match(/^- /) && !processed.startsWith('<h')) {
        processed = processed.replace(/^- (.*)$/, '<div style="margin: 2px 0;">• $1</div>')
      } else if (processed.match(/^\d+\. /) && !processed.startsWith('<h')) {
        processed = processed.replace(/^(\d+)\. (.*)$/, '<div style="margin: 2px 0;">$1. $2</div>')
      }
      // Regular line - apply inline formatting
      else {
        // Process bold first (before italic to avoid conflicts)
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Then italic (single asterisks that aren't part of bold - use a simple pattern)
        // Match *text* but not **text** by checking it's not preceded or followed by *
        processed = processed.replace(/\b\*([^*]+?)\*\b/g, '<em>$1</em>')
        // Code blocks
        processed = processed.replace(/`([^`]+?)`/g, '<code style="background: #f0f0f0; padding: 1px 3px; border-radius: 3px; font-family: monospace;">$1</code>')
        // Wikilinks
        processed = processed.replace(/\[\[([^\]]+)\]\]/g, '<span style="color: #007acc; text-decoration: underline;">$1</span>')
      }
      
      processedLines.push(processed)
    }
    
    return processedLines.join('<br>')
  }

  /**
   * Create an obs_note shape from an ObsidianObsNote
   */
  static createFromObsidianObsNote(obs_note: ObsidianObsNote, x: number = 0, y: number = 0, id?: TLShapeId, vaultPath?: string, vaultName?: string): IObsNoteShape {
    // Use sanitizeProps to ensure all values are JSON serializable
    const props = ObsNoteShape.sanitizeProps({
      w: 300,
      h: 200,
      color: 'black',
      size: 'm',
      font: 'sans',
      textAlign: 'start',
      scale: 1,
      noteId: obs_note.id || '',
      title: obs_note.title || 'Untitled',
      content: obs_note.content || '',
      tags: obs_note.tags || [],
      showPreview: true,
      backgroundColor: '#ffffff',
      textColor: '#000000',
      isEditing: false,
      editingContent: '',
      isModified: false,
      originalContent: obs_note.content || '',
      vaultPath: vaultPath,
      vaultName: vaultName,
      filePath: obs_note.filePath,
    })
    
    return {
      id: id || createShapeId(),
      type: 'ObsNote',
      x,
      y,
      rotation: 0,
      index: 'a1' as IndexKey,
      parentId: 'page:page' as TLParentId,
      isLocked: false,
      opacity: 1,
      meta: {},
      typeName: 'shape',
      props
    }
  }

  /**
   * Update obs_note content
   */
  updateObsNoteContent(shapeId: string, content: string) {
    const shape = this.editor.getShape(shapeId as TLShapeId) as IObsNoteShape
    if (!shape) return
    
    const sanitizedProps = ObsNoteShape.sanitizeProps({
      ...shape.props,
      content,
    })
    this.editor.updateShape<IObsNoteShape>({
      id: shapeId as TLShapeId,
      type: 'ObsNote',
      props: sanitizedProps
    })
  }

  /**
   * Toggle preview mode
   */
  togglePreview(shapeId: string) {
    const shape = this.editor.getShape(shapeId as TLShapeId) as IObsNoteShape
    if (shape) {
      const sanitizedProps = ObsNoteShape.sanitizeProps({
        ...shape.props,
        showPreview: !shape.props.showPreview,
      })
      this.editor.updateShape<IObsNoteShape>({
        id: shapeId as TLShapeId,
        type: 'ObsNote',
        props: sanitizedProps
      })
    }
  }

  /**
   * Update obs_note styling
   */
  updateStyling(shapeId: string, backgroundColor: string, textColor: string) {
    const shape = this.editor.getShape(shapeId as TLShapeId) as IObsNoteShape
    if (!shape) return
    
    const sanitizedProps = ObsNoteShape.sanitizeProps({
      ...shape.props,
      backgroundColor,
      textColor,
    })
    this.editor.updateShape<IObsNoteShape>({
      id: shapeId as TLShapeId,
      type: 'ObsNote',
      props: sanitizedProps
    })
  }

  /**
   * Refresh obs_note content from vault
   */
  async refreshFromVault(shapeId: string): Promise<boolean> {
    const shape = this.editor.getShape(shapeId as TLShapeId) as IObsNoteShape
    if (!shape) return false

    try {
      const { ObsidianImporter } = await import('@/lib/obsidianImporter')
      const importer = new ObsidianImporter()
      
      // Get vault info from shape or session
      let vaultPath = shape.props.vaultPath
      let vaultName = shape.props.vaultName
      
      if (!vaultPath || !vaultName) {
        const sessionData = localStorage.getItem('canvas_auth_session')
        if (sessionData) {
          const session = JSON.parse(sessionData)
          vaultPath = session.obsidianVaultPath
          vaultName = session.obsidianVaultName
        }
      }
      
      if (!vaultPath || !vaultName) {
        console.error('No vault configured for refresh')
        return false
      }

      // Load latest content from vault
      let vault: any
      if (vaultPath.startsWith('http') || vaultPath.includes('quartz') || vaultPath.includes('.xyz') || vaultPath.includes('.com')) {
        vault = await importer.importFromQuartzUrl(vaultPath)
      } else {
        vault = await importer.importFromDirectory(vaultPath)
      }

      // Find the updated note by ID, preferring notes without quotes in filename
      const matchingNotes = vault.obs_notes.filter((note: any) => note.id === shape.props.noteId)
      if (matchingNotes.length === 0) {
        return false
      }
      
      // If there are multiple notes with the same ID (duplicates), prefer the one without quotes
      let updatedNote = matchingNotes[0]
      if (matchingNotes.length > 1) {
        const withoutQuotes = matchingNotes.find((note: any) => !note.filePath?.includes('"'))
        if (withoutQuotes) {
          updatedNote = withoutQuotes
        } else {
          // If all have quotes, pick the one with the most content
          updatedNote = matchingNotes.reduce((best: any, current: any) => 
            current.content?.length > best.content?.length ? current : best
          )
        }
      }

      // Sanitize and update the shape with latest content
      const sanitizedProps = ObsNoteShape.sanitizeProps({
        ...shape.props,
        title: updatedNote.title,
        content: updatedNote.content,
        tags: updatedNote.tags,
        originalContent: updatedNote.content,
        isModified: false, // Reset modified flag since we're updating from source
        // Preserve filePath from updated note if available, otherwise keep existing
        filePath: updatedNote.filePath || shape.props.filePath,
      })
      
      this.editor.updateShape<IObsNoteShape>({
        id: shapeId as TLShapeId,
        type: 'ObsNote',
        props: sanitizedProps
      })

      return true
    } catch (error) {
      console.error('❌ Failed to refresh ObsNote from vault:', error)
      return false
    }
  }

  /**
   * Refresh all ObsNote shapes on the current page
   */
  async refreshAllFromVault(): Promise<{ success: number; failed: number }> {
    const allShapes = this.editor.getCurrentPageShapes()
    const obsNoteShapes = allShapes.filter(shape => shape.type === 'ObsNote')
    
    let success = 0
    let failed = 0
    
    for (const shape of obsNoteShapes) {
      const result = await this.refreshFromVault(shape.id)
      if (result) {
        success++
      } else {
        failed++
      }
    }
    
    return { success, failed }
  }
}
