import React, { useState, useCallback, useRef, useEffect } from 'react'
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
import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer } from '@tldraw/tldraw'
import { StandardizedToolWrapper } from '../components/StandardizedToolWrapper'
import { usePinnedToView } from '../hooks/usePinnedToView'

export type IMarkdownShape = TLBaseShape<
  'Markdown',
  {
    w: number
    h: number
    text: string
    pinnedToView: boolean
    tags: string[]
  }
>

export class MarkdownShape extends BaseBoxShapeUtil<IMarkdownShape> {
  static type = 'Markdown' as const

  // Markdown theme color: Teal
  static readonly PRIMARY_COLOR = "#14b8a6"

  getDefaultProps(): IMarkdownShape['props'] {
    return {
      w: 500,
      h: 400,
      text: '',
      pinnedToView: false,
      tags: ['markdown'],
    }
  }

  component(shape: IMarkdownShape) {
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)
    const [isMinimized, setIsMinimized] = useState(false)
    const editorRef = useRef<MDXEditorMethods>(null)

    // Use the pinning hook
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    const handleClose = () => {
      this.editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<IMarkdownShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    const handleChange = useCallback((newText: string) => {
      this.editor.updateShape<IMarkdownShape>({
        id: shape.id,
        type: 'Markdown',
        props: {
          ...shape.props,
          text: newText,
        },
      })
    }, [shape.id, shape.props])

    // Sync external changes to editor
    useEffect(() => {
      if (editorRef.current) {
        const currentMarkdown = editorRef.current.getMarkdown()
        if (currentMarkdown !== shape.props.text) {
          editorRef.current.setMarkdown(shape.props.text || '')
        }
      }
    }, [shape.props.text])

    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
        <StandardizedToolWrapper
          title="Markdown"
          primaryColor={MarkdownShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={shape.props.w}
          height={shape.props.h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          editor={this.editor}
          shapeId={shape.id}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          tags={shape.props.tags}
          onTagsChange={(newTags) => {
            this.editor.updateShape<IMarkdownShape>({
              id: shape.id,
              type: 'Markdown',
              props: {
                ...shape.props,
                tags: newTags,
              }
            })
          }}
          tagsEditable={true}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#FFFFFF',
              pointerEvents: 'all',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <MDXEditor
              ref={editorRef}
              markdown={shape.props.text || ''}
              onChange={handleChange}
              contentEditableClassName="mdx-editor-content"
              plugins={[
                // Core formatting
                headingsPlugin(),
                listsPlugin(),
                quotePlugin(),
                thematicBreakPlugin(),
                linkPlugin(),
                linkDialogPlugin(),

                // Tables
                tablePlugin(),

                // Code blocks with syntax highlighting
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

                // Images (with placeholder for now)
                imagePlugin({
                  imageUploadHandler: async () => {
                    // Return a placeholder - can be extended to support actual uploads
                    return Promise.resolve('https://via.placeholder.com/400x300')
                  },
                }),

                // Markdown shortcuts (type # for heading, * for list, etc.)
                markdownShortcutPlugin(),

                // Source mode toggle (rich-text vs raw markdown)
                diffSourcePlugin({
                  viewMode: 'rich-text',
                  diffMarkdown: shape.props.text || '',
                }),

                // Toolbar
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
              background: ${MarkdownShape.PRIMARY_COLOR}20;
              color: ${MarkdownShape.PRIMARY_COLOR};
            }

            .mdxeditor .mdxeditor-root-contenteditable {
              flex: 1;
              overflow-y: auto;
              padding: 12px 16px;
              min-height: 0;
            }

            .mdx-editor-content {
              min-height: 100%;
              height: 100%;
              outline: none;
            }

            /* Ensure the editor fills the full available height */
            .mdxeditor .mdxeditor-root-contenteditable > div {
              min-height: 100%;
            }

            .mdx-editor-content h1 {
              font-size: 1.75em;
              font-weight: 700;
              margin: 0.5em 0 0.25em;
              color: #111827;
            }

            .mdx-editor-content h2 {
              font-size: 1.5em;
              font-weight: 600;
              margin: 0.5em 0 0.25em;
              color: #1f2937;
            }

            .mdx-editor-content h3 {
              font-size: 1.25em;
              font-weight: 600;
              margin: 0.5em 0 0.25em;
              color: #374151;
            }

            .mdx-editor-content p {
              margin: 0.5em 0;
              line-height: 1.6;
            }

            .mdx-editor-content ul, .mdx-editor-content ol {
              margin: 0.5em 0;
              padding-left: 1.5em;
            }

            .mdx-editor-content li {
              margin: 0.25em 0;
            }

            .mdx-editor-content blockquote {
              border-left: 3px solid ${MarkdownShape.PRIMARY_COLOR};
              margin: 0.5em 0;
              padding: 0.5em 1em;
              background: #f3f4f6;
              border-radius: 0 4px 4px 0;
            }

            .mdx-editor-content code {
              background: #f3f4f6;
              padding: 0.15em 0.4em;
              border-radius: 3px;
              font-family: 'SF Mono', Monaco, 'Courier New', monospace;
              font-size: 0.9em;
            }

            .mdx-editor-content pre {
              background: #1e1e2e;
              color: #cdd6f4;
              padding: 12px 16px;
              border-radius: 6px;
              overflow-x: auto;
              margin: 0.5em 0;
            }

            .mdx-editor-content pre code {
              background: none;
              padding: 0;
              color: inherit;
            }

            .mdx-editor-content a {
              color: ${MarkdownShape.PRIMARY_COLOR};
              text-decoration: underline;
            }

            .mdx-editor-content table {
              border-collapse: collapse;
              width: 100%;
              margin: 0.5em 0;
            }

            .mdx-editor-content th, .mdx-editor-content td {
              border: 1px solid #e5e7eb;
              padding: 8px 12px;
              text-align: left;
            }

            .mdx-editor-content th {
              background: #f9fafb;
              font-weight: 600;
            }

            .mdx-editor-content hr {
              border: none;
              border-top: 1px solid #e5e7eb;
              margin: 1em 0;
            }

            .mdx-editor-content img {
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

            /* Diff source toggle button styling */
            .mdxeditor [role="toolbar"] select {
              padding: 4px 8px;
              border-radius: 4px;
              border: 1px solid #e5e7eb;
              background: white;
              font-size: 12px;
              cursor: pointer;
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

  indicator(shape: IMarkdownShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  override onDoubleClick = (shape: IMarkdownShape) => {
    // Focus the editor on double-click
    const editorElement = document.querySelector(`[data-shape-id="${shape.id}"] .mdxeditor [contenteditable="true"]`) as HTMLElement
    editorElement?.focus()
  }
}
