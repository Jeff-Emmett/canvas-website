import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
  RecordProps,
  T
} from "tldraw"
import { ShareLocation } from "@/components/location/ShareLocation"

export type ILocationShare = TLBaseShape<
  "LocationShare",
  {
    w: number
    h: number
  }
>

export class LocationShareShape extends BaseBoxShapeUtil<ILocationShare> {
  static override type = "LocationShare" as const

  static override props: RecordProps<ILocationShare> = {
    w: T.number,
    h: T.number
  }

  getDefaultProps(): ILocationShare["props"] {
    return {
      w: 800,
      h: 600
    }
  }

  component(shape: ILocationShare) {
    return (
      <HTMLContainer
        id={shape.id}
        style={{
          overflow: "auto",
          pointerEvents: "all",
          backgroundColor: "var(--color-panel)",
          borderRadius: "8px",
          border: "1px solid var(--color-panel-contrast)"
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            padding: "0"
          }}
        >
          <ShareLocation />
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: ILocationShare) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
