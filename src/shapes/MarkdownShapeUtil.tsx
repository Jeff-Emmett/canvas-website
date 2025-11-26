import React, { useState } from 'react'
import MDEditor from '@uiw/react-md-editor'
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

  // Markdown theme color: Cyan/Teal (Rainbow)
  static readonly PRIMARY_COLOR = "#06b6d4"

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
    const markdownRef = React.useRef<HTMLDivElement>(null)
    const [isMinimized, setIsMinimized] = useState(false)

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

    // Handler function for checkbox interactivity
    const handleCheckboxClick = React.useCallback((event: Event) => {
      event.stopPropagation()
      const target = event.target as HTMLInputElement
      const checked = target.checked

      const text = shape.props.text
      const lines = text.split('\n')
      const checkboxRegex = /^\s*[-*+]\s+\[([ x])\]/

      const newText = lines.map(line => {
        if (line.includes(target.parentElement?.textContent || '')) {
          return line.replace(checkboxRegex, `- [${checked ? 'x' : ' '}]`)
        }
        return line
      }).join('\n')

      this.editor.updateShape<IMarkdownShape>({
        id: shape.id,
        type: 'Markdown',
        props: {
          ...shape.props,
          text: newText,
        },
      })
    }, [shape.id, shape.props.text])

    // Effect hook that handles checkbox interactivity
    React.useEffect(() => {
      if (!isSelected && markdownRef.current) {
        const checkboxes = markdownRef.current.querySelectorAll('input[type="checkbox"]')
        checkboxes.forEach((checkbox) => {
          checkbox.removeAttribute('disabled')
          checkbox.addEventListener('click', handleCheckboxClick)
        })

        return () => {
          if (markdownRef.current) {
            const checkboxes = markdownRef.current.querySelectorAll('input[type="checkbox"]')
            checkboxes.forEach((checkbox) => {
              checkbox.removeEventListener('click', handleCheckboxClick)
            })
          }
        }
      }
    }, [isSelected, shape.props.text, handleCheckboxClick])

    // Show MDEditor when selected
    if (isSelected) {
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
            <div style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#FFFFFF',
              pointerEvents: 'all',
              overflow: 'hidden',
            }}>
              <MDEditor
                value={shape.props.text}
                onChange={(value = '') => {
                  this.editor.updateShape<IMarkdownShape>({
                    id: shape.id,
                    type: 'Markdown',
                    props: {
                      ...shape.props,
                      text: value,
                    },
                  })
                }}
                preview='live'
                visibleDragbar={false}
                style={{
                  height: '100%',
                  border: 'none',
                  backgroundColor: 'transparent',
                }}
                previewOptions={{
                  style: {
                    padding: '8px',
                    backgroundColor: 'transparent',
                  }
                }}
                textareaProps={{
                  style: {
                    padding: '8px',
                    lineHeight: '1.5',
                    height: '100%',
                    resize: 'none',
                    backgroundColor: 'transparent',
                  }
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                }}
              />
            </div>
          </StandardizedToolWrapper>
        </HTMLContainer>
      )
    }

    // Show rendered markdown when not selected
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
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#FFFFFF',
            pointerEvents: 'all',
            overflow: 'auto',
          }}>
            <div ref={markdownRef} style={{ width: '100%', height: '100%', padding: '12px' }}>
              {shape.props.text ? (
                <MDEditor.Markdown source={shape.props.text} />
              ) : (
                <span style={{ opacity: 0.5 }}>Click to edit markdown...</span>
              )}
            </div>
          </div>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  indicator(shape: IMarkdownShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  // Add handlers for better interaction
  override onDoubleClick = (shape: IMarkdownShape) => {
    const textarea = document.querySelector(`[data-shape-id="${shape.id}"] textarea`) as HTMLTextAreaElement
    textarea?.focus()
  }

  onPointerDown = (shape: IMarkdownShape) => {
    if (!shape.props.text) {
      const textarea = document.querySelector(`[data-shape-id="${shape.id}"] textarea`) as HTMLTextAreaElement
      textarea?.focus()
    }
  }
}
