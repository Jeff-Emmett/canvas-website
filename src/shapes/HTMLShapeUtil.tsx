import {
  TLBaseShape,
  TLResizeHandle,
  BaseBoxShapeUtil,
  //TLShapeUtilFlag,
  resizeBox,
  VecModel,
  Box,
  TLResizeMode,
  Rectangle2d,
} from "tldraw"

export interface HTMLShape
  extends TLBaseShape<"html", { w: number; h: number; html: string }> {
  props: {
    w: number
    h: number
    html: string
  }
}

export class HTMLShapeUtil extends BaseBoxShapeUtil<HTMLShape> {
  static override type = "html" as const
  override canBind = () => true
  override canEdit = () => false
  override canResize = () => true
  override isAspectRatioLocked = () => false

  getDefaultProps(): HTMLShape["props"] {
    return {
      w: 100,
      h: 100,
      html: "<div></div>",
    }
  }

  override onBeforeUpdate = (prev: HTMLShape, next: HTMLShape): void => {
    if (prev.x !== next.x || prev.y !== next.y) {
      this.editor.bringToFront([next.id])
    }
  }

  override onResize = (
    shape: HTMLShape,
    info: {
      handle: TLResizeHandle
      mode: TLResizeMode
      initialBounds: Box
      initialShape: HTMLShape
      newPoint: VecModel
      scaleX: number
      scaleY: number
    },
  ) => {
    const element = document.getElementById(shape.id)
    if (!element || !element.parentElement) return resizeBox(shape, info)
    const { width, height } = element.parentElement.getBoundingClientRect()
    if (element) {
      const isOverflowing =
        element.scrollWidth > width || element.scrollHeight > height
      if (isOverflowing) {
        element.parentElement?.classList.add("overflowing")
      } else {
        element.parentElement?.classList.remove("overflowing")
      }
    }
    return resizeBox(shape, info)
  }

  getGeometry(shape: HTMLShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override component(shape: HTMLShape): JSX.Element {
    return (
      <div
        id={shape.id}
        dangerouslySetInnerHTML={{ __html: shape.props.html }}
      />
    )
  }

  override indicator(shape: HTMLShape): JSX.Element {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
