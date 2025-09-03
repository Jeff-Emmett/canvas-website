import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"

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

export class TranscribeShape extends BaseBoxShapeUtil<ITranscribeShape> {
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

  override indicator(_shape: ITranscribeShape) {
    return null // Simplified for worker
  }

  override component(_shape: ITranscribeShape) {
    return null // No React components in worker
  }
}
