import React, { useState, useRef, useEffect } from 'react'
import { BaseBoxShapeUtil, TLBaseShape, TLShapeId, createShapeId, IndexKey, TLParentId, HTMLContainer } from '@tldraw/tldraw'
import { ObsidianObsNote } from '@/lib/obsidianImporter'
import { QuartzSync, createQuartzNoteFromShape, QuartzSyncConfig } from '@/lib/quartzSync'
import { logGitHubSetupStatus } from '@/lib/githubSetupValidator'
import { getClientConfig } from '@/lib/clientConfig'

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

  const wrapperStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: shape.props.backgroundColor,
    border: shape.props.isModified ? '2px solid #ff6b35' : '2px solid #e0e0e0',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: isSelected ? '0 0 0 2px #007acc' : '0 2px 4px rgba(0,0,0,0.1)',
    cursor: isSelected ? 'move' : 'pointer',
    display: 'flex',
    flexDirection: 'column',
  }

  const headerStyle: React.CSSProperties = {
    padding: '12px',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: '20px',
  }

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
    setIsEditing(true)
    setEditingContent(shape.props.content)
    shapeUtil.editor.updateShape<IObsNoteShape>({
      id: shape.id,
      type: 'ObsNote',
      props: {
        ...shape.props,
        isEditing: true,
        editingContent: shape.props.content,
      }
    })
  }

  const handleStartTitleEdit = () => {
    setIsEditingTitle(true)
    setEditingTitle(shape.props.title || 'Untitled')
  }

  const handleSaveTitleEdit = () => {
    if (editingTitle.trim() !== shape.props.title) {
      shapeUtil.editor.updateShape<IObsNoteShape>({
        id: shape.id,
        type: 'ObsNote',
        props: {
          ...shape.props,
          title: editingTitle.trim(),
          isModified: true
        }
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
    const hasChanged = editingContent !== shape.props.originalContent
    setIsEditing(false)
    shapeUtil.editor.updateShape<IObsNoteShape>({
      id: shape.id,
      type: 'ObsNote',
      props: {
        ...shape.props,
        content: editingContent,
        isEditing: false,
        editingContent: '',
        isModified: hasChanged,
      }
    })
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditingContent(shape.props.content)
    shapeUtil.editor.updateShape<IObsNoteShape>({
      id: shape.id,
      type: 'ObsNote',
      props: {
        ...shape.props,
        isEditing: false,
        editingContent: '',
      }
    })
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
    console.log('🔄 Refreshing ObsNote from vault:', shape.props.title)
    
    try {
      const success = await shapeUtil.refreshFromVault(shape.id)
      if (success) {
        console.log('✅ Successfully refreshed ObsNote from vault')
        alert('✅ Note refreshed with latest content from vault!')
      } else {
        console.log('❌ Failed to refresh ObsNote from vault')
        alert('❌ Failed to refresh note. Check console for details.')
      }
    } catch (error) {
      console.error('❌ Refresh failed:', error)
      alert(`Refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSync = async () => {
    if (isSyncing) return
    
    setIsSyncing(true)
    console.log('🔄 Starting sync process for note:', shape.props.title || 'Untitled')
    console.log('📝 Current content length:', shape.props.content?.length || 0)
    console.log('📝 Original content length:', shape.props.originalContent?.length || 0)
    console.log('🔗 Vault path:', shape.props.vaultPath)
    console.log('📁 Vault name:', shape.props.vaultName)
    
    try {
      let vaultPath = shape.props.vaultPath
      let vaultName = shape.props.vaultName
      
      if (!vaultPath || !vaultName) {
        console.log('⚠️ No vault configured in shape props, trying to get from session...')
        
        // Try to get vault info from session if not in shape props
        // This is a fallback for existing shapes that don't have vault info
        const sessionData = localStorage.getItem('canvas_auth_session')
        if (sessionData) {
          try {
            const session = JSON.parse(sessionData)
            console.log('📋 Found session data:', { 
              vaultPath: session.obsidianVaultPath, 
              vaultName: session.obsidianVaultName 
            })
            
            if (session.obsidianVaultPath && session.obsidianVaultName) {
              // Update the shape with vault info for future syncs
              shapeUtil.editor.updateShape<IObsNoteShape>({
                id: shape.id,
                type: 'ObsNote',
                props: {
                  ...shape.props,
                  vaultPath: session.obsidianVaultPath,
                  vaultName: session.obsidianVaultName,
                }
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
      
      console.log('🌐 Vault type:', isQuartzVault ? 'Quartz' : 'Local')
      
      if (isQuartzVault) {
        // Use the new Quartz sync system
        console.log('🌐 Quartz sync: Using advanced sync system')
        
        try {
          // Validate GitHub setup first
          logGitHubSetupStatus()
          
          // Create Quartz note from shape
          const quartzNote = createQuartzNoteFromShape(shape)
          console.log('📝 Created Quartz note:', quartzNote.title)
          
          // Configure Quartz sync
          const config = getClientConfig()
          console.log('🔧 Client config:', {
            hasGitHubToken: !!config.githubToken,
            hasQuartzRepo: !!config.quartzRepo,
            githubTokenLength: config.githubToken?.length || 0,
            quartzRepo: config.quartzRepo
          })
          
          const syncConfig: QuartzSyncConfig = {
            githubToken: config.githubToken,
            githubRepo: config.quartzRepo,
            quartzUrl: vaultPath,
            cloudflareApiKey: config.cloudflareApiKey,
            cloudflareAccountId: config.cloudflareAccountId
          }
          
          console.log('🔧 Sync config:', {
            hasGitHubToken: !!syncConfig.githubToken,
            hasGitHubRepo: !!syncConfig.githubRepo,
            hasCloudflareApiKey: !!syncConfig.cloudflareApiKey,
            hasCloudflareAccountId: !!syncConfig.cloudflareAccountId,
            quartzUrl: syncConfig.quartzUrl
          })
          
          const quartzSync = new QuartzSync(syncConfig)
          
          // Try smart sync (tries multiple approaches)
          const syncSuccess = await quartzSync.smartSync(quartzNote)
          
          if (syncSuccess) {
            console.log('✅ Successfully synced to Quartz!')
            alert('✅ Note synced to Quartz successfully! Check your GitHub repository for changes.')
          } else {
            throw new Error('All sync methods failed')
          }
        } catch (error) {
          console.error('❌ Quartz sync failed:', error)
          console.error('❌ Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : 'No stack trace',
            error: error
          })
          
          // Fallback to local storage
          console.log('🔄 Falling back to local storage...')
          const quartzStorageKey = `quartz_vault_${vaultName}_${shape.props.noteId || shape.props.title}`
          const tags = shape.props.tags || []
          const title = shape.props.title || 'Untitled'
          const content = shape.props.content || ''
          const frontmatter = `---
title: "${title}"
tags: [${tags.map(tag => `"${tag.replace('#', '')}"`).join(', ')}]
created: ${new Date().toISOString()}
modified: ${new Date().toISOString()}
quartz_url: "${vaultPath}"
---

${content}`
          
          localStorage.setItem(quartzStorageKey, frontmatter)
          console.log('✅ Stored in localStorage as fallback:', quartzStorageKey)
          alert(`Quartz sync: Stored locally as fallback. Check console for details.`)
        }
      } else {
        // For local vaults, try to write using File System Access API
        console.log('💾 Local vault sync: Attempting to write to local file system')
        console.log('📄 Note content to sync:', shape.props.content || '')
        console.log('📁 Target vault:', vaultName)
        console.log('📝 File path:', shape.props.noteId || `${shape.props.title || 'Untitled'}.md`)
        
        // Create the markdown content with frontmatter
        const tags = shape.props.tags || []
        const title = shape.props.title || 'Untitled'
        const content = shape.props.content || ''
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
            const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.md`
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
            
            console.log('✅ Successfully wrote file to local file system!')
            console.log('📁 File saved as:', fileName)
            
            alert(`Local vault sync: File saved successfully as ${fileName}`)
          } else {
            // Fallback: download the file
            console.log('⚠️ File System Access API not available, downloading file instead')
            
            const blob = new Blob([frontmatter], { type: 'text/markdown' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.md`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            
            console.log('📥 File downloaded successfully!')
            alert('Local vault sync: File downloaded! Please save it to your vault folder.')
          }
        } catch (error) {
          console.error('❌ Failed to write local vault file:', error)
          
          // Fallback: store locally and show instructions
          const localStorageKey = `local_vault_${vaultName}_${shape.props.noteId || shape.props.title}`
          localStorage.setItem(localStorageKey, frontmatter)
          
          console.log('📄 Full markdown content:', frontmatter)
          console.log('💾 Stored locally with key:', localStorageKey)
          
          alert(`Local vault sync: Failed to write directly. Content stored locally and logged to console. Key: ${localStorageKey}`)
        }
      }
      
      // Mark as synced regardless of the sync method
      shapeUtil.editor.updateShape<IObsNoteShape>({
        id: shape.id,
        type: 'ObsNote',
        props: {
          ...shape.props,
          isModified: false,
          originalContent: shape.props.content,
        }
      })
      
      console.log('✅ Sync process completed successfully')
      
    } catch (error) {
      console.error('❌ Sync failed:', error)
      alert(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <HTMLContainer style={wrapperStyle}>
      <div style={headerStyle}>
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
            style={titleStyle} 
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
        <div style={{ display: 'flex', gap: '4px' }}>
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
              fontSize: '10px',
              padding: '4px 8px',
              backgroundColor: isRefreshing ? '#ccc' : '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              position: 'relative',
              zIndex: 1001,
              pointerEvents: 'auto',
              opacity: isRefreshing ? 0.7 : 1,
            }}
            title={isRefreshing ? "Refreshing..." : "Refresh from vault"}
          >
            {isRefreshing ? '⏳ Refreshing...' : '🔄 Refresh'}
          </button>
          {shape.props.isModified && !isEditing && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSync()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={isSyncing}
              style={{
                ...buttonStyle,
                fontSize: '10px',
                padding: '4px 8px',
                backgroundColor: isSyncing ? '#ccc' : '#ff6b35',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                position: 'relative',
                zIndex: 1001,
                pointerEvents: 'auto',
                opacity: isSyncing ? 0.7 : 1,
              }}
              title={isSyncing ? "Syncing..." : "Sync changes back to source"}
            >
              {isSyncing ? '⏳ Syncing...' : '🔄 Sync Updates'}
            </button>
          )}
        </div>
      </div>
      
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
      </div>

      {isEditing && (
        <div style={editControlsStyle}>
          <button
            onClick={handleSaveEdit}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ ...buttonStyle, backgroundColor: '#007acc', color: 'white' }}
          >
            Save (Ctrl+Enter)
          </button>
          <button
            onClick={handleCancelEdit}
            onPointerDown={(e) => e.stopPropagation()}
            style={buttonStyle}
          >
            Cancel (Esc)
          </button>
        </div>
      )}
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
  }
>

export class ObsNoteShape extends BaseBoxShapeUtil<IObsNoteShape> {
  static override type = 'ObsNote'

  getDefaultProps(): IObsNoteShape['props'] {
    return {
      w: 300,
      h: 200,
      color: 'black',
      size: 'm',
      font: 'sans',
      textAlign: 'start',
      scale: 1,
      noteId: '',
      title: 'Untitled ObsNote',
      content: '',
      tags: [],
      showPreview: true,
      backgroundColor: '#ffffff',
      textColor: '#000000',
      isEditing: false,
      editingContent: '',
      isModified: false,
      originalContent: '',
      vaultPath: undefined,
      vaultName: undefined,
    }
  }

  component(shape: IObsNoteShape) {
    return <ObsNoteComponent shape={shape} shapeUtil={this} />
  }

  indicator(shape: IObsNoteShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  /**
   * Format markdown content for preview
   */
  formatMarkdownPreview(content: string): string {
    // Simple markdown formatting for preview
    return content
      .replace(/^# (.*$)/gim, '<h1 style="font-size: 16px; margin: 0 0 8px 0; font-weight: bold;">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 style="font-size: 14px; margin: 0 0 6px 0; font-weight: bold;">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 style="font-size: 13px; margin: 0 0 4px 0; font-weight: bold;">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background: #f0f0f0; padding: 1px 3px; border-radius: 3px; font-family: monospace;">$1</code>')
      .replace(/^- (.*$)/gim, '<div style="margin: 2px 0;">• $1</div>')
      .replace(/^\d+\. (.*$)/gim, '<div style="margin: 2px 0;">$&</div>')
      .replace(/\[\[([^\]]+)\]\]/g, '<span style="color: #007acc; text-decoration: underline;">$1</span>')
      .replace(/\n/g, '<br>')
  }

  /**
   * Create an obs_note shape from an ObsidianObsNote
   */
  static createFromObsidianObsNote(obs_note: ObsidianObsNote, x: number = 0, y: number = 0, id?: TLShapeId, vaultPath?: string, vaultName?: string): IObsNoteShape {
    return {
      id: id || createShapeId(),
      type: 'ObsNote',
      x,
      y,
      rotation: 0,
      index: 'a1' as IndexKey,
      parentId: null as unknown as TLParentId,
      isLocked: false,
      opacity: 1,
      meta: {},
      typeName: 'shape',
      props: {
        w: 300,
        h: 200,
        color: 'black',
        size: 'm',
        font: 'sans',
        textAlign: 'start',
        scale: 1,
        noteId: obs_note.id,
        title: obs_note.title,
        content: obs_note.content,
        tags: obs_note.tags,
        showPreview: true,
        backgroundColor: '#ffffff',
        textColor: '#000000',
        isEditing: false,
        editingContent: '',
        isModified: false,
        originalContent: obs_note.content,
        vaultPath,
        vaultName,
      }
    }
  }

  /**
   * Update obs_note content
   */
  updateObsNoteContent(shapeId: string, content: string) {
    this.editor.updateShape<IObsNoteShape>({
      id: shapeId as TLShapeId,
      type: 'ObsNote',
      props: {
        ...this.editor.getShape(shapeId as TLShapeId)?.props,
        content,
      }
    })
  }

  /**
   * Toggle preview mode
   */
  togglePreview(shapeId: string) {
    const shape = this.editor.getShape(shapeId as TLShapeId) as IObsNoteShape
    if (shape) {
      this.editor.updateShape<IObsNoteShape>({
        id: shapeId as TLShapeId,
        type: 'ObsNote',
        props: {
          ...shape.props,
          showPreview: !shape.props.showPreview,
        }
      })
    }
  }

  /**
   * Update obs_note styling
   */
  updateStyling(shapeId: string, backgroundColor: string, textColor: string) {
    this.editor.updateShape<IObsNoteShape>({
      id: shapeId as TLShapeId,
      type: 'ObsNote',
      props: {
        ...this.editor.getShape(shapeId as TLShapeId)?.props,
        backgroundColor,
        textColor,
      }
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
        console.warn('Note not found in vault:', shape.props.noteId)
        return false
      }
      
      // If there are multiple notes with the same ID (duplicates), prefer the one without quotes
      let updatedNote = matchingNotes[0]
      if (matchingNotes.length > 1) {
        console.warn(`Found ${matchingNotes.length} notes with ID ${shape.props.noteId}, selecting best one`)
        const withoutQuotes = matchingNotes.find((note: any) => !note.filePath?.includes('"'))
        if (withoutQuotes) {
          updatedNote = withoutQuotes
          console.log(`Selected note without quotes: ${updatedNote.filePath}`)
        } else {
          // If all have quotes, pick the one with the most content
          updatedNote = matchingNotes.reduce((best: any, current: any) => 
            current.content?.length > best.content?.length ? current : best
          )
          console.log(`Selected note with most content: ${updatedNote.filePath}`)
        }
      }

      // Update the shape with latest content
      this.editor.updateShape<IObsNoteShape>({
        id: shapeId as TLShapeId,
        type: 'ObsNote',
        props: {
          ...shape.props,
          title: updatedNote.title,
          content: updatedNote.content,
          tags: updatedNote.tags,
          originalContent: updatedNote.content,
          isModified: false, // Reset modified flag since we're updating from source
        }
      })

      console.log('✅ Refreshed ObsNote from vault:', shape.props.title)
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
    
    console.log(`🔄 Refresh complete: ${success} successful, ${failed} failed`)
    return { success, failed }
  }
}
