/**
 * DEPRECATED: MycelialIntelligence shape is no longer used as a canvas tool.
 * The functionality has been moved to the permanent UI bar (MycelialIntelligenceBar.tsx).
 *
 * This shape util is kept ONLY for backwards compatibility with existing boards
 * that may have MycelialIntelligence shapes saved. It renders a placeholder message.
 */

import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer } from '@tldraw/tldraw'

export type IMycelialIntelligenceShape = TLBaseShape<
  'MycelialIntelligence',
  {
    w: number
    h: number
    // Keep old props for migration compatibility
    prompt?: string
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  }
>

export class MycelialIntelligenceShape extends BaseBoxShapeUtil<IMycelialIntelligenceShape> {
  static override type = 'MycelialIntelligence' as const

  getDefaultProps(): IMycelialIntelligenceShape['props'] {
    return {
      w: 400,
      h: 300,
    }
  }

  component(shape: IMycelialIntelligenceShape) {
    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '2px dashed rgba(16, 185, 129, 0.5)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            fontFamily: 'Inter, sans-serif',
            color: '#666',
          }}
        >
          <span style={{ fontSize: '32px', marginBottom: '12px' }}>🍄🧠</span>
          <span style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
            Mycelial Intelligence
          </span>
          <span style={{ fontSize: '12px', textAlign: 'center', opacity: 0.8 }}>
            This tool has moved to the floating bar at the top of the screen.
          </span>
          <span style={{ fontSize: '11px', textAlign: 'center', opacity: 0.6, marginTop: '8px' }}>
            You can delete this shape - it's no longer needed.
          </span>
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: IMycelialIntelligenceShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
