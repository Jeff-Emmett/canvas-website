import { BaseBoxShapeUtil, TLBaseShape, TLResizeInfo} from "@tldraw/tldraw"

export type IMycrozineTemplateShape = TLBaseShape<
  "MycrozineTemplate",
  {
    w: number
    h: number
  }
>

export class MycrozineTemplateShape extends BaseBoxShapeUtil<IMycrozineTemplateShape> {
  static override type = "MycrozineTemplate"
 
  getDefaultProps(): IMycrozineTemplateShape["props"] {
    // 8.5" × 11" at 300 DPI = 2550 × 3300 pixels
    const props = {
      w: 2550,
      h: 3300,
    }
    console.log('MycrozineTemplate - Default props:', props)
    return props
  }

  indicator(shape: IMycrozineTemplateShape) {
    return (
      <g>
        <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
      </g>
    )
  }

  containerStyle = {
    position: 'relative' as const,
    backgroundColor: 'transparent',
    border: '1px solid #666',
    borderRadius: '2px',
  }

  verticalGuideStyle = {
    position: 'absolute' as const,
    left: '50%',
    top: 0,
    bottom: 0,
    borderLeft: '1px dashed #666',
  }

  horizontalGuideStyle = {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    borderTop: '1px dashed #666',
  }

  component(shape: IMycrozineTemplateShape) {
    const { w, h } = shape.props
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)
    
    return ( 
      <div
        style={{
          ...this.containerStyle,
          width: `${w}px`,
          height: `${h}px`,
          pointerEvents: isSelected ? 'none' : 'all'
        }}
      >
        <div style={this.verticalGuideStyle} />
        {[0.25, 0.5, 0.75].map((ratio, index) => (
          <div
            key={index}
            style={{
              ...this.horizontalGuideStyle,
              top: `${ratio * 100}%`,
            }}
          />
        ))}
      </div>
    )
  }
  
} 