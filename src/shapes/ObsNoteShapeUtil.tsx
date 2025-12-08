import React, { useState, useRef, useEffect, useCallback } from 'react'
import { BaseBoxShapeUtil, TLBaseShape, TLShapeId, createShapeId, IndexKey, TLParentId, HTMLContainer } from '@tldraw/tldraw'
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  UndoRedo,
  BlockTypeSelect,
  CreateLink,
  InsertTable,
  ListsToggle,
  Separator,
  DiffSourceToggleWrapper,
  type MDXEditorMethods,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { ObsidianObsNote } from '@/lib/obsidianImporter'
import { QuartzSync, createQuartzNoteFromShape, QuartzSyncConfig } from '@/lib/quartzSync'
import { logGitHubSetupStatus } from '@/lib/githubSetupValidator'
import { getClientConfig } from '@/lib/clientConfig'
import { StandardizedToolWrapper } from '../components/StandardizedToolWrapper'
import { usePinnedToView } from '../hooks/usePinnedToView'
import { useMaximize } from '../hooks/useMaximize'

// Main ObsNote component with full markdown editing
const ObsNoteComponent: React.FC<{
  shape: IObsNoteShape
  shapeUtil: ObsNoteShape
}> = ({ shape, shapeUtil }) => {
  const isSelected = shapeUtil.editor.getSelectedShapeIds().includes(shape.id)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editingTitle, setEditingTitle] = useState(shape.props.title || 'Untitled')
  const [isSyncing, setIsSyncing] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const editorRef = useRef<MDXEditorMethods>(null)

  // Use the pinning hook to keep the shape fixed to viewport when pinned
  usePinnedToView(shapeUtil.editor, shape.id, shape.props.pinnedToView)

  // Use the maximize hook for fullscreen functionality
  const { isMaximized, toggleMaximize } = useMaximize({
    editor: shapeUtil.editor,
    shapeId: shape.id,
    currentW: shape.props.w,
    currentH: shape.props.h,
    shapeType: 'ObsNote',
  })

  // Track content changes for sync button visibility
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(shape.props.isModified)

  // Notification state for in-shape notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Auto-hide notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Sync external changes to editor (e.g., from vault refresh)
  useEffect(() => {
    if (editorRef.current) {
      const currentMarkdown = editorRef.current.getMarkdown()
      if (currentMarkdown !== shape.props.content) {
        editorRef.current.setMarkdown(shape.props.content || '')
      }
    }
  }, [shape.props.content])

  // Update hasUnsavedChanges when shape.props.isModified changes
  useEffect(() => {
    setHasUnsavedChanges(shape.props.isModified)
  }, [shape.props.isModified])

  const handleContentChange = useCallback((newContent: string) => {
    const hasChanged = newContent !== shape.props.originalContent
    setHasUnsavedChanges(hasChanged)

    const sanitizedProps = ObsNoteShape.sanitizeProps({
      ...shape.props,
      content: newContent,
      isModified: hasChanged,
    })
    shapeUtil.editor.updateShape<IObsNoteShape>({
      id: shape.id,
      type: 'ObsNote',
      props: sanitizedProps
    })
  }, [shape.id, shape.props, shapeUtil.editor])

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
      setHasUnsavedChanges(true)
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

  const handleRefresh = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)

    try {
      const success = await shapeUtil.refreshFromVault(shape.id)
      if (success) {
        setNotification({ message: '✅ Note restored from vault', type: 'success' })
        setHasUnsavedChanges(false)
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

  const handleCopy = async () => {
    if (isCopying) return

    setIsCopying(true)

    try {
      const contentToCopy = shape.props.content || ''
      if (!contentToCopy.trim()) {
        setNotification({ message: '⚠️ No content to copy', type: 'error' })
        setIsCopying(false)
        return
      }

      await navigator.clipboard.writeText(contentToCopy)
      setNotification({ message: '✅ Content copied to clipboard', type: 'success' })
    } catch (error) {
      console.error('❌ Copy failed:', error)
      setNotification({
        message: `Copy failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      })
    } finally {
      setIsCopying(false)
    }
  }

  const handleSync = async () => {
    if (isSyncing) return

    setIsSyncing(true)

    try {
      // Get the current content from the editor
      const contentToSync = editorRef.current?.getMarkdown() || shape.props.content || ''
      const titleToSync = isEditingTitle ? editingTitle : (shape.props.title || 'Untitled')

      // If we're editing title, save that first
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

      let vaultPath = currentShape.props.vaultPath
      let vaultName = currentShape.props.vaultName

      if (!vaultPath || !vaultName) {
        // Try to get vault info from session if not in shape props
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
        // Use the Quartz sync system
        try {
          logGitHubSetupStatus()

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

          const config = getClientConfig()

          const syncConfig: QuartzSyncConfig = {
            githubToken: config.githubToken,
            githubRepo: config.quartzRepo,
            quartzUrl: vaultPath,
            cloudflareApiKey: config.cloudflareApiKey,
            cloudflareAccountId: config.cloudflareAccountId
          }

          const quartzSync = new QuartzSync(syncConfig)
          const syncSuccess = await quartzSync.smartSync(quartzNote)

          if (syncSuccess) {
            setNotification({ message: '✅ Note synced to Quartz!', type: 'success' })
          } else {
            throw new Error('All sync methods failed')
          }
        } catch (error) {
          console.error('❌ Quartz sync failed:', error)

          // Fallback to local storage
          const quartzStorageKey = `quartz_vault_${vaultName}_${currentShape.props.noteId || titleToSync}`
          const tags = currentShape.props.tags || []
          const frontmatter = `---
title: "${titleToSync}"
tags: [${tags.map(tag => `"${tag.replace('#', '')}"`).join(', ')}]
created: ${new Date().toISOString()}
modified: ${new Date().toISOString()}
quartz_url: "${vaultPath}"
---

${contentToSync}`

          localStorage.setItem(quartzStorageKey, frontmatter)
          setNotification({ message: '⚠️ Stored locally as fallback', type: 'error' })
        }
      } else {
        // For local vaults, try to write using File System Access API
        let fileName: string
        if (currentShape.props.filePath && currentShape.props.filePath.trim() !== '') {
          const pathParts = currentShape.props.filePath.split('/')
          fileName = pathParts[pathParts.length - 1]
          if (!fileName.endsWith('.md')) {
            fileName = `${fileName}.md`
          }
        } else {
          fileName = `${titleToSync.replace(/[^a-zA-Z0-9]/g, '_')}.md`
        }

        const tags = currentShape.props.tags || []
        const frontmatter = `---
title: "${titleToSync}"
tags: [${tags.map(tag => `"${tag.replace('#', '')}"`).join(', ')}]
created: ${new Date().toISOString()}
modified: ${new Date().toISOString()}
---

${contentToSync}`

        try {
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

            setNotification({ message: `✅ Saved as ${fileName}`, type: 'success' })
          } else {
            // Fallback: download the file
            const blob = new Blob([frontmatter], { type: 'text/markdown' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = fileName
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            setNotification({ message: '✅ File downloaded!', type: 'success' })
          }
        } catch (error) {
          console.error('❌ Failed to write local vault file:', error)

          const localStorageKey = `local_vault_${vaultName}_${currentShape.props.noteId || titleToSync}`
          localStorage.setItem(localStorageKey, frontmatter)

          setNotification({ message: '⚠️ Stored locally as fallback', type: 'error' })
        }
      }

      // Mark as synced
      const finalShape = shapeUtil.editor.getShape(shape.id) as IObsNoteShape
      if (finalShape) {
        const sanitizedProps = ObsNoteShape.sanitizeProps({
          ...finalShape.props,
          content: contentToSync,
          isModified: false,
          originalContent: contentToSync,
        })
        shapeUtil.editor.updateShape<IObsNoteShape>({
          id: finalShape.id,
          type: 'ObsNote',
          props: sanitizedProps
        })
        setHasUnsavedChanges(false)
      }

    } catch (error) {
      console.error('❌ Sync failed:', error)
      setNotification({
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      })
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

  const handlePinToggle = () => {
    shapeUtil.editor.updateShape<IObsNoteShape>({
      id: shape.id,
      type: shape.type,
      props: {
        ...shape.props,
        pinnedToView: !shape.props.pinnedToView,
      },
    })
  }

  // Custom header content with editable title
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
          style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: shape.props.textColor,
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background-color 0.2s ease',
          }}
          title={shape.props.title}
          onClick={(e) => {
            e.stopPropagation()
            handleStartTitleEdit()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
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
        primaryColor={shape.props.primaryColor || ObsNoteShape.PRIMARY_COLOR}
        isSelected={isSelected}
        width={shape.props.w}
        height={shape.props.h}
        onClose={handleClose}
        onMinimize={handleMinimize}
        isMinimized={isMinimized}
        onMaximize={toggleMaximize}
        isMaximized={isMaximized}
        headerContent={headerContent}
        editor={shapeUtil.editor}
        shapeId={shape.id}
        isPinnedToView={shape.props.pinnedToView}
        onPinToggle={handlePinToggle}
        tags={shape.props.tags}
        onTagsChange={(newTags) => {
          const sanitizedProps = ObsNoteShape.sanitizeProps({
            ...shape.props,
            tags: newTags,
            isModified: true,
          })
          shapeUtil.editor.updateShape<IObsNoteShape>({
            id: shape.id,
            type: 'ObsNote',
            props: sanitizedProps
          })
          setHasUnsavedChanges(true)
        }}
        tagsEditable={true}
      >
        {/* MDXEditor container */}
        <div
          style={{
            width: '100%',
            flex: 1,
            backgroundColor: '#FFFFFF',
            pointerEvents: 'all',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <MDXEditor
            ref={editorRef}
            markdown={shape.props.content || ''}
            onChange={handleContentChange}
            contentEditableClassName="obs-note-editor-content"
            plugins={[
              headingsPlugin(),
              listsPlugin(),
              quotePlugin(),
              thematicBreakPlugin(),
              linkPlugin(),
              linkDialogPlugin(),
              tablePlugin(),
              codeBlockPlugin({ defaultCodeBlockLanguage: 'javascript' }),
              codeMirrorPlugin({
                codeBlockLanguages: {
                  js: 'JavaScript',
                  javascript: 'JavaScript',
                  ts: 'TypeScript',
                  typescript: 'TypeScript',
                  jsx: 'JSX',
                  tsx: 'TSX',
                  css: 'CSS',
                  html: 'HTML',
                  json: 'JSON',
                  python: 'Python',
                  py: 'Python',
                  bash: 'Bash',
                  sh: 'Shell',
                  sql: 'SQL',
                  md: 'Markdown',
                  yaml: 'YAML',
                  go: 'Go',
                  rust: 'Rust',
                  '': 'Plain Text',
                }
              }),
              imagePlugin({
                imageUploadHandler: async () => {
                  return Promise.resolve('https://via.placeholder.com/400x300')
                },
              }),
              markdownShortcutPlugin(),
              diffSourcePlugin({
                viewMode: 'rich-text',
                diffMarkdown: shape.props.content || '',
              }),
              toolbarPlugin({
                toolbarContents: () => (
                  <>
                    <UndoRedo />
                    <Separator />
                    <BoldItalicUnderlineToggles />
                    <Separator />
                    <BlockTypeSelect />
                    <Separator />
                    <ListsToggle />
                    <Separator />
                    <CreateLink />
                    <InsertTable />
                    <Separator />
                    <DiffSourceToggleWrapper>
                      <></>
                    </DiffSourceToggleWrapper>
                  </>
                )
              }),
            ]}
          />

          {/* Notification display */}
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
                  top: '50px',
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
                  animation: 'obsNoteNotificationFade 3s ease-in-out forwards',
                }}
              >
                {notification.message}
              </div>
            </>
          )}
        </div>

        {/* Bottom action buttons */}
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          backgroundColor: '#f9fafb',
          flexShrink: 0,
        }}>
          {/* Refresh from vault button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleRefresh()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={isRefreshing}
            style={{
              fontSize: '11px',
              padding: '6px 12px',
              backgroundColor: isRefreshing ? '#6c757d' : '#6366f1',
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
            title="Refresh content from vault"
          >
            {isRefreshing ? '⏳ Refreshing...' : '🔄 Refresh'}
          </button>

          {/* Copy button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCopy()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={isCopying}
            style={{
              fontSize: '11px',
              padding: '6px 12px',
              backgroundColor: isCopying ? '#6c757d' : '#005a9e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isCopying ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              pointerEvents: 'auto',
              opacity: isCopying ? 0.7 : 1,
            }}
            title="Copy content to clipboard"
          >
            {isCopying ? '⏳ Copying...' : '📋 Copy'}
          </button>

          {/* Save changes button - shown when there are modifications */}
          {hasUnsavedChanges && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSync()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={isSyncing}
              style={{
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
              title="Save changes to vault"
            >
              {isSyncing ? '⏳ Saving...' : '💾 Save to Vault'}
            </button>
          )}
        </div>

        {/* Custom styles for the MDXEditor */}
        <style>{`
          .mdxeditor {
            height: 100%;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }

          .mdxeditor [role="toolbar"] {
            flex-shrink: 0;
            border-bottom: 1px solid #e5e7eb;
            background: #f9fafb;
            padding: 4px 8px;
            gap: 2px;
            flex-wrap: wrap;
          }

          .mdxeditor [role="toolbar"] button {
            padding: 4px 6px;
            border-radius: 4px;
            font-size: 12px;
          }

          .mdxeditor [role="toolbar"] button:hover {
            background: #e5e7eb;
          }

          .mdxeditor [role="toolbar"] button[data-state="on"] {
            background: ${ObsNoteShape.PRIMARY_COLOR}20;
            color: ${ObsNoteShape.PRIMARY_COLOR};
          }

          .mdxeditor .mdxeditor-root-contenteditable {
            flex: 1;
            overflow-y: auto;
            padding: 12px 16px;
          }

          .obs-note-editor-content {
            min-height: 100%;
            outline: none;
          }

          .obs-note-editor-content h1 {
            font-size: 1.75em;
            font-weight: 700;
            margin: 0.5em 0 0.25em;
            color: #111827;
          }

          .obs-note-editor-content h2 {
            font-size: 1.5em;
            font-weight: 600;
            margin: 0.5em 0 0.25em;
            color: #1f2937;
          }

          .obs-note-editor-content h3 {
            font-size: 1.25em;
            font-weight: 600;
            margin: 0.5em 0 0.25em;
            color: #374151;
          }

          .obs-note-editor-content p {
            margin: 0.5em 0;
            line-height: 1.6;
          }

          .obs-note-editor-content ul, .obs-note-editor-content ol {
            margin: 0.5em 0;
            padding-left: 1.5em;
          }

          .obs-note-editor-content li {
            margin: 0.25em 0;
          }

          .obs-note-editor-content blockquote {
            border-left: 3px solid ${ObsNoteShape.PRIMARY_COLOR};
            margin: 0.5em 0;
            padding: 0.5em 1em;
            background: #f3f4f6;
            border-radius: 0 4px 4px 0;
          }

          .obs-note-editor-content code {
            background: #f3f4f6;
            padding: 0.15em 0.4em;
            border-radius: 3px;
            font-family: 'SF Mono', Monaco, 'Courier New', monospace;
            font-size: 0.9em;
          }

          .obs-note-editor-content pre {
            background: #1e1e2e;
            color: #cdd6f4;
            padding: 12px 16px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 0.5em 0;
          }

          .obs-note-editor-content pre code {
            background: none;
            padding: 0;
            color: inherit;
          }

          .obs-note-editor-content a {
            color: ${ObsNoteShape.PRIMARY_COLOR};
            text-decoration: underline;
          }

          .obs-note-editor-content table {
            border-collapse: collapse;
            width: 100%;
            margin: 0.5em 0;
          }

          .obs-note-editor-content th, .obs-note-editor-content td {
            border: 1px solid #e5e7eb;
            padding: 8px 12px;
            text-align: left;
          }

          .obs-note-editor-content th {
            background: #f9fafb;
            font-weight: 600;
          }

          .obs-note-editor-content hr {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 1em 0;
          }

          .obs-note-editor-content img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
          }

          /* Source mode styling */
          .mdxeditor-source-editor {
            flex: 1;
            overflow: auto;
          }

          .mdxeditor-source-editor .cm-editor {
            height: 100%;
          }

          .mdxeditor-source-editor .cm-scroller {
            padding: 12px 16px;
            font-family: 'SF Mono', Monaco, 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.5;
          }

          /* Block type select */
          .mdxeditor [data-radix-popper-content-wrapper] {
            z-index: 100000 !important;
          }
        `}</style>
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
    filePath?: string
    pinnedToView: boolean
    primaryColor?: string
  }
>

export class ObsNoteShape extends BaseBoxShapeUtil<IObsNoteShape> {
  static override type = 'ObsNote'

  // Obsidian Note theme color: Purple (matches Obsidian branding)
  static readonly PRIMARY_COLOR = "#9333ea"

  /**
   * Sanitize props to ensure all values are JSON serializable
   */
  public static sanitizeProps(props: Partial<IObsNoteShape['props']>): IObsNoteShape['props'] {
    const tags = Array.isArray(props.tags)
      ? props.tags.filter(tag => typeof tag === 'string').map(tag => String(tag))
      : []

    const sanitized: IObsNoteShape['props'] = {
      w: typeof props.w === 'number' ? props.w : 500,
      h: typeof props.h === 'number' ? props.h : 400,
      color: typeof props.color === 'string' ? props.color : 'black',
      size: typeof props.size === 'string' ? props.size : 'm',
      font: typeof props.font === 'string' ? props.font : 'sans',
      textAlign: typeof props.textAlign === 'string' ? props.textAlign : 'start',
      scale: typeof props.scale === 'number' ? props.scale : 1,
      noteId: typeof props.noteId === 'string' ? props.noteId : '',
      title: typeof props.title === 'string' ? props.title : 'Untitled ObsNote',
      content: typeof props.content === 'string' ? props.content : '',
      tags: tags.length > 0 ? tags : ['obsidian note', 'markdown'],
      showPreview: typeof props.showPreview === 'boolean' ? props.showPreview : true,
      backgroundColor: typeof props.backgroundColor === 'string' ? props.backgroundColor : '#ffffff',
      textColor: typeof props.textColor === 'string' ? props.textColor : '#000000',
      isEditing: typeof props.isEditing === 'boolean' ? props.isEditing : false,
      editingContent: typeof props.editingContent === 'string' ? props.editingContent : '',
      isModified: typeof props.isModified === 'boolean' ? props.isModified : false,
      originalContent: typeof props.originalContent === 'string' ? props.originalContent : '',
      pinnedToView: typeof props.pinnedToView === 'boolean' ? props.pinnedToView : false,
    }

    if (props.vaultPath !== undefined && typeof props.vaultPath === 'string') {
      sanitized.vaultPath = props.vaultPath
    }
    if (props.vaultName !== undefined && typeof props.vaultName === 'string') {
      sanitized.vaultName = props.vaultName
    }
    if (props.filePath !== undefined && typeof props.filePath === 'string') {
      sanitized.filePath = props.filePath
    }
    if (props.primaryColor !== undefined && typeof props.primaryColor === 'string') {
      sanitized.primaryColor = props.primaryColor
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
   * Create an obs_note shape from an ObsidianObsNote
   */
  static createFromObsidianObsNote(obs_note: ObsidianObsNote, x: number = 0, y: number = 0, id?: TLShapeId, vaultPath?: string, vaultName?: string): IObsNoteShape {
    const obsidianTags = obs_note.tags && obs_note.tags.length > 0
      ? obs_note.tags
      : ['obsidian note', 'markdown']

    const props = ObsNoteShape.sanitizeProps({
      w: 500,
      h: 400,
      color: 'black',
      size: 'm',
      font: 'sans',
      textAlign: 'start',
      scale: 1,
      noteId: obs_note.id || '',
      title: obs_note.title || 'Untitled',
      content: obs_note.content || '',
      tags: obsidianTags,
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

      let vault: any
      if (vaultPath.startsWith('http') || vaultPath.includes('quartz') || vaultPath.includes('.xyz') || vaultPath.includes('.com')) {
        vault = await importer.importFromQuartzUrl(vaultPath)
      } else {
        vault = await importer.importFromDirectory(vaultPath)
      }

      const matchingNotes = vault.obs_notes.filter((note: any) => note.id === shape.props.noteId)
      if (matchingNotes.length === 0) {
        return false
      }

      let updatedNote = matchingNotes[0]
      if (matchingNotes.length > 1) {
        const withoutQuotes = matchingNotes.find((note: any) => !note.filePath?.includes('"'))
        if (withoutQuotes) {
          updatedNote = withoutQuotes
        } else {
          updatedNote = matchingNotes.reduce((best: any, current: any) =>
            current.content?.length > best.content?.length ? current : best
          )
        }
      }

      const sanitizedProps = ObsNoteShape.sanitizeProps({
        ...shape.props,
        title: updatedNote.title,
        content: updatedNote.content,
        tags: updatedNote.tags,
        originalContent: updatedNote.content,
        isModified: false,
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
