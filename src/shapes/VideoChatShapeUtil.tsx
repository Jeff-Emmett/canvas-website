import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"
import { useEffect, useState, useRef } from "react"
import { WORKER_URL } from "../routes/Board"
import DailyIframe from "@daily-co/daily-js"

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
      // First, request a room from our worker
      const response = await fetch(`${WORKER_URL}/daily/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // You might want to pass additional configuration if needed
        body: JSON.stringify({
          name: `room-${shape.id}`, // Add a unique identifier
          properties: {
            enable_recording: true,
            max_participants: 8,
          },
        }),
      })

      if (!response.ok) {
        const errorData = (await response.json()) as { message: string }
        throw new Error(errorData.message || "Failed to create room")
      }

      const data = await response.json()

      // Update the shape with the room URL from the response
      this.editor.updateShape<IVideoChatShape>({
        id: shape.id,
        type: "VideoChat",
        props: {
          ...shape.props,
          roomUrl: (data as any).url,
        },
      })
    } catch (error) {
      console.error("Failed to create Daily room:", error)
      throw error // Re-throw to handle in the component
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
