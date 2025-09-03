import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"
import { TranscribeComponent } from "../components/TranscribeComponent"

export type ITranscribeShape = TLBaseShape<
  "Transcribe",
  {
    w: number
    h: number
    isRecording: boolean
    transcript: string
    participants: Array<{
      id: string
      name: string
      isSpeaking: boolean
      lastSpoken: string
    }>
    language: string
  }
>

export class TranscribeShapeUtil extends BaseBoxShapeUtil<ITranscribeShape> {
  static override type = "Transcribe"

  override getDefaultProps(): ITranscribeShape["props"] {
    return {
      w: 400,
      h: 300,
      isRecording: false,
      transcript: "",
      participants: [],
      language: "en-US",
    }
  }

  override indicator(shape: ITranscribeShape) {
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
  }

  override component(shape: ITranscribeShape) {
    return (
      <TranscribeComponent
        shape={shape}
        util={this}
      />
    )
  }
}
