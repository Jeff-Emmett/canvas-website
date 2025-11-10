import React from 'react'
import MDEditor from '@uiw/react-md-editor'
import { BaseBoxShapeUtil, TLBaseShape } from '@tldraw/tldraw'

export type IMarkdownShape = TLBaseShape<
  'Markdown',
  {
    w: number
    h: number
    text: string
  }
>

export class MarkdownShape extends BaseBoxShapeUtil<IMarkdownShape> {
  static type = 'Markdown' as const

  getDefaultProps(): IMarkdownShape['props'] {
    return {
      w: 500,
      h: 400,
      text: '',
    }
  }

  component(shape: IMarkdownShape) {
    // Hooks must be at the top level
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)
    const markdownRef = React.useRef<HTMLDivElement>(null)
    
    // Handler function defined before useEffect
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
    
    // Single useEffect hook that handles checkbox interactivity
    React.useEffect(() => {
      if (!isSelected && markdownRef.current) {
        const checkboxes = markdownRef.current.querySelectorAll('input[type="checkbox"]')
        checkboxes.forEach((checkbox) => {
          checkbox.removeAttribute('disabled')
          checkbox.addEventListener('click', handleCheckboxClick)
        })
        
        // Cleanup function
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

    const wrapperStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      backgroundColor: 'white',
      border: '1px solid #ddd',
      borderRadius: '4px',
      overflow: 'hidden',
    }

    // Simplified contentStyle - removed padding and center alignment
    const contentStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      backgroundColor: '#FFFFFF',
      cursor: isSelected ? 'text' : 'default',
      pointerEvents: 'all',
    }

    // Show MDEditor when selected
    if (isSelected) {
      return (
        <div style={wrapperStyle}>
          <div style={contentStyle}>
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
                height: 'auto',
                minHeight: '100%',
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
                  height: 'auto',
                  minHeight: '100%',
                  resize: 'none',
                  backgroundColor: 'transparent',
                }
              }}
              onPointerDown={(e) => {
                e.stopPropagation()
              }}
            />
          </div>
        </div>
      )
    }

    // Show rendered markdown when not selected
    return (
      <div style={wrapperStyle}>
        <div style={contentStyle}>
          <div ref={markdownRef} style={{ width: '100%', height: '100%', padding: '12px' }}>
            {shape.props.text ? (
              <MDEditor.Markdown source={shape.props.text} />
            ) : (
              <span style={{ opacity: 0.5 }}>Click to edit markdown...</span>
            )}
          </div>
        </div>
      </div>
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
