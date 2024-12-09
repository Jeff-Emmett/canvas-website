import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"
import { useEffect, useState, useRef } from "react"
import { WORKER_URL } from "../routes/Board"
import DailyIframe from "@daily-co/daily-js"

// Add these constants at the top of the file
const DAILY_DOMAIN = import.meta.env.VITE_DAILY_DOMAIN as string
const DAILY_API_KEY = import.meta.env.VITE_DAILY_API_KEY as string

export type IVideoChatShape = TLBaseShape<
  "VideoChat",
  {
    w: number
    h: number
    roomUrl: string | null
    userName: string
  }
>

// Simplified component using Daily Prebuilt
const VideoChatComponent = ({ roomUrl }: { roomUrl: string }) => {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const callFrameRef = useRef<ReturnType<
    typeof DailyIframe.createFrame
  > | null>(null)

  useEffect(() => {
    if (!wrapperRef.current || !roomUrl) return

    // Create and configure the Daily call frame
    callFrameRef.current = DailyIframe.createFrame(wrapperRef.current, {
      iframeStyle: {
        width: "100%",
        height: "100%",
        border: "0",
        borderRadius: "4px",
      },
      showLeaveButton: true,
      showFullscreenButton: true,
    })

    // Join the room
    callFrameRef.current.join({ url: roomUrl })

    // Cleanup
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy()
      }
    }
  }, [roomUrl])

  return (
    <div
      ref={wrapperRef}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#f0f0f0",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    />
  )
}

export class VideoChatShape extends BaseBoxShapeUtil<IVideoChatShape> {
  static override type = "VideoChat"

  indicator(_shape: IVideoChatShape) {
    return null
  }

  getDefaultProps(): IVideoChatShape["props"] {
    return {
      roomUrl: null,
      w: 640,
      h: 480,
      userName: "",
    }
  }

  async ensureRoomExists(shape: IVideoChatShape) {
    if (shape.props.roomUrl !== null) {
      return
    }

    try {
      // Create room using the worker endpoint
      const response = await fetch(`${WORKER_URL}/daily/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          name: `canvas-room-${shape.id}`,
          privacy: "public",
          properties: {
            enable_chat: true,
            start_audio_off: true,
            start_video_off: true,
            enable_screenshare: true,
            enable_recording: "cloud",
            max_participants: 8,
            enable_network_ui: true,
            enable_prejoin_ui: true,
            enable_people_ui: true,
            enable_pip_ui: true,
            enable_emoji_reactions: true,
            enable_hand_raising: true,
            enable_noise_cancellation_ui: true,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Failed to create room: ${JSON.stringify(error)}`)
      }

      const data = await response.json()
      const roomUrl = `https://${DAILY_DOMAIN}/${(data as any).name}`

      // Update the shape with the room URL
      this.editor.updateShape<IVideoChatShape>({
        id: shape.id,
        type: "VideoChat",
        props: {
          ...shape.props,
          roomUrl: roomUrl,
        },
      })
    } catch (error) {
      console.error("Failed to create Daily room:", error)
      throw error
    }
  }

  component(shape: IVideoChatShape) {
    const [isInRoom, setIsInRoom] = useState(false)
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
      setIsLoading(true)
      this.ensureRoomExists(shape)
        .catch((err) => setError(err.message))
        .finally(() => setIsLoading(false))
    }, [])

    if (isLoading) {
      return (
        <div
          style={{
            width: `${shape.props.w}px`,
            height: `${shape.props.h}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f0f0f0",
            borderRadius: "4px",
          }}
        >
          <div>Initializing video chat...</div>
        </div>
      )
    }

    if (!shape.props.roomUrl) {
      return (
        <div
          style={{
            width: `${shape.props.w}px`,
            height: `${shape.props.h}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f0f0f0",
            borderRadius: "4px",
          }}
        >
          Creating room...
        </div>
      )
    }

    return (
      <div
        style={{
          width: `${shape.props.w}px`,
          height: `${shape.props.h}px`,
          position: "relative",
        }}
      >
        {!isInRoom ? (
          <button
            onClick={() => setIsInRoom(true)}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              padding: "12px 24px",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Join Video Chat
          </button>
        ) : (
          <VideoChatComponent roomUrl={shape.props.roomUrl} />
        )}
        {error && (
          <div
            style={{
              position: "absolute",
              bottom: 10,
              left: 10,
              right: 10,
              color: "red",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
      </div>
    )
  }
}
