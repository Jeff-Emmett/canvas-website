import { useCallback } from "react"
import {
  BaseBoxShapeUtil,
  Geometry2d,
  RecordProps,
  Rectangle2d,
  SVGContainer,
  ShapeUtil,
  T,
  TLBaseShape,
  getPerfectDashProps,
  resizeBox,
  useValue,
} from "tldraw"
import { moveToSlide, useSlides } from "@/slides/useSlides"

export type ISlideShape = TLBaseShape<
  "Slide",
  {
    w: number
    h: number
  }
>

export class SlideShape extends BaseBoxShapeUtil<ISlideShape> {
  static override type = "Slide"

  // static override props = {
  // 	w: T.number,
  // 	h: T.number,
  // }

  override canBind = () => false
  override hideRotateHandle = () => true

  getDefaultProps(): ISlideShape["props"] {
    return {
      w: 720,
      h: 480,
    }
  }

  getGeometry(shape: ISlideShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: false,
    })
  }

  override onRotate = (initial: ISlideShape) => initial
  override onResize(shape: ISlideShape, info: any) {
    return resizeBox(shape, info)
  }

  override onDoubleClick = (shape: ISlideShape) => {
    moveToSlide(this.editor, shape)
    this.editor.selectNone()
  }

  override onDoubleClickEdge = (shape: ISlideShape) => {
    moveToSlide(this.editor, shape)
    this.editor.selectNone()
  }

  component(shape: ISlideShape) {
    const bounds = this.editor.getShapeGeometry(shape).bounds

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const zoomLevel = useValue("zoom level", () => this.editor.getZoomLevel(), [
      this.editor,
    ])

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const slides = useSlides()
    const index = Array.isArray(slides) ? slides.findIndex((s) => s.id === shape.id) : -1

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const handleLabelPointerDown = useCallback(
      () => this.editor.select(shape.id),
      [shape.id],
    )

    if (!bounds) return null

    return (
      <>
        <div
          onPointerDown={handleLabelPointerDown}
          className="slide-shape-label"
        >
          {`Slide ${index + 1}`}
        </div>
        <SVGContainer>
          <g
            style={{
              stroke: "var(--color-text)",
              strokeWidth: "calc(1px * var(--tl-scale))",
              opacity: 0.25,
            }}
            pointerEvents="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {bounds.sides.map((side, i) => {
              const { strokeDasharray, strokeDashoffset } = getPerfectDashProps(
                side[0].dist(side[1]),
                1 / zoomLevel,
                {
                  style: "dashed",
                  lengthRatio: 6,
                },
              )

              return (
                <line
                  key={i}
                  x1={side[0].x}
                  y1={side[0].y}
                  x2={side[1].x}
                  y2={side[1].y}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                />
              )
            })}
          </g>
        </SVGContainer>
      </>
    )
  }

  indicator(shape: ISlideShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
