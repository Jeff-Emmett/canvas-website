/** TODO: build this */

import { BaseBoxShapeUtil, TLBaseBoxShape, TLBaseShape, StyleProp, T, DefaultSizeStyle, DefaultFontStyle, DefaultColorStyle } from "tldraw"
import { useEffect, useRef, useState } from "react"
import { marked } from "marked"

// Uncomment and use these style definitions
const MarkdownColor = StyleProp.defineEnum('markdown:color', {
  defaultValue: 'black',
  values: ['black', 'blue', 'green', 'grey', 'light-blue', 'light-green', 'light-red', 'light-violet', 'orange', 'red', 'violet', 'yellow'],
})

const MarkdownSize = StyleProp.defineEnum('markdown:size', {
  defaultValue: 'medium',
  values: ['small', 'medium', 'large'],
})

const MarkdownFont = StyleProp.defineEnum('markdown:font', {
  defaultValue: 'draw',
  values: ['draw', 'sans', 'serif', 'mono'],
})

//const MarkdownHorizontalAlign = StyleProp.define('markdown:horizontalalign', { defaultValue: 'start' })
//const MarkdownVerticalAlign = StyleProp.define('markdown:verticalalign', { defaultValue: 'start' })

export type IMarkdownShape = TLBaseShape<
  "MarkdownTool",
  {
    content: string
    isPreview: boolean
    w: number
    h: number
    color: string
    size: string
    font: string    
  }
>

export class MarkdownShape extends BaseBoxShapeUtil<
  IMarkdownShape & TLBaseBoxShape
> {
  static override type = "MarkdownTool"

  styles = {
    color: MarkdownColor,
    size: MarkdownSize,
    font: MarkdownFont,
  }

  getDefaultProps(): IMarkdownShape["props"] & { w: number; h: number } {
    console.log('getDefaultProps called');
    const props = {
      content: "",
      isPreview: false,
      w: 400,
      h: 300,
      color: 'black',
      size: 'medium',
      font: 'draw'
    };
    console.log('Default props:', props);
    return props;
  }

  indicator(shape: IMarkdownShape) {
    return (
    <g>
    <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
  </g>
  )
  }

  component(shape: IMarkdownShape) {
    console.log('Component rendering with shape:', shape);
    console.log('Available styles:', this.styles);
    const editor = this.editor
    return <MarkdownEditor shape={shape} editor={editor} />
  }
}

function MarkdownEditor({ shape, editor }: { shape: IMarkdownShape; editor: any }) {
  console.log('MarkdownEditor mounted with shape:', shape);
  console.log('Editor instance:', editor);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isPreview, setIsPreview] = useState(shape.props.isPreview)
  const [renderedContent, setRenderedContent] = useState("")

  useEffect(() => {
    if (textareaRef.current && textareaRef.current.value !== shape.props.content) {
      textareaRef.current.value = shape.props.content
    }
  }, [shape.props.content])

  useEffect(() => {
    const html = marked.parse(shape.props.content, { breaks: true }) as string
    setRenderedContent(html)
  }, [shape.props.content])

  const togglePreview = () => {
    const newPreviewState = !isPreview
    setIsPreview(newPreviewState)
    editor.updateShape(shape.id, {
      props: {
        ...shape.props,
        isPreview: newPreviewState
      }
    })
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'white',
      border: '1px solid #e0e0e0',
      borderRadius: '4px',
      overflow: 'hidden'
    }}>
      {/* Toolbar */}
      <div style={{
        padding: '4px 8px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#f5f5f5',
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      }}>
        <button
          onClick={togglePreview}
          style={{
            padding: '4px 8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: 'white',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          {isPreview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {/* Editor/Preview Area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        position: 'relative'
      }}>
        {isPreview ? (
          <div
            style={{
              padding: '8px',
              height: '100%',
              overflow: 'auto'
            }}
            dangerouslySetInnerHTML={{
              __html: marked(shape.props.content, { breaks: true }) as string
            }}
          />
        ) : (
          <textarea
            ref={textareaRef}
            defaultValue={shape.props.content}
            style={{
              width: '100%',
              height: '100%',
              resize: 'none',
              border: 'none',
              padding: '8px',
              fontFamily: 'inherit',
            }}
            onChange={(e) => {
              editor.updateShape(shape.id, {
                props: {
                  ...shape.props,
                  content: e.target.value
                }
              })
            }}
          />
        )}
      </div>
    </div>
  )
}
