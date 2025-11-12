import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"

export type IVideoChatShape = TLBaseShape<
  "VideoChat",
  {
    w: number
    h: number
    roomUrl: string | null
    allowCamera: boolean
    allowMicrophone: boolean
    enableRecording: boolean
    recordingId: string | null
    enableTranscription: boolean
    isTranscribing: boolean
    transcriptionHistory: Array<{
      sender: string
      message: string
      id: string
    }>
    meetingToken: string | null
    isOwner: boolean
    pinnedToView: boolean
  }
>

export class VideoChatShape extends BaseBoxShapeUtil<IVideoChatShape> {
  static override type = "VideoChat"

  indicator(_shape: IVideoChatShape) {
    return null
  }

  getDefaultProps(): IVideoChatShape["props"] {
    return {
      roomUrl: null,
      w: 800,
      h: 600,
      allowCamera: false,
      allowMicrophone: false,
      enableRecording: true,
      recordingId: null,
      enableTranscription: true,
      isTranscribing: false,
      transcriptionHistory: [],
      meetingToken: null,
      isOwner: false,
      pinnedToView: false
    }
  }

  component(_shape: IVideoChatShape) {
    return null // No React components in worker
  }
}
