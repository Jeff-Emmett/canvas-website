import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"
import { useEffect, useState } from "react"

export type IVideoChatShape = TLBaseShape<
  "VideoChat",
  {
    w: number
    h: number
    roomUrl: string | null
    allowCamera: boolean
    allowMicrophone: boolean
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
      w: 640,
      h: 480,
      allowCamera: false,
      allowMicrophone: false,
    }
  }

  async ensureRoomExists(shape: IVideoChatShape) {
    if (shape.props.roomUrl !== null) {
      console.log("Room already exists:", shape.props.roomUrl)
      return
    }

    try {
      const apiKey = import.meta.env["VITE_DAILY_API_KEY"]
      console.log("API Key available:", !!apiKey)
      if (!apiKey) throw new Error("Daily API key is missing")

      const response = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          properties: {
            enable_chat: true,
            start_audio_off: true,
            start_video_off: true,
          },
        }),
      })

      console.log("Response status:", response.status)
      console.log("Response data:", await response.clone().json())

      if (!response.ok)
        throw new Error(`Failed to create room (${response.status})`)

      const responseData = (await response.json()) as { url: string }
      const url = responseData.url

      if (!url) throw new Error("Room URL is missing")

      console.log("Room created successfully:", url)
      console.log("Updating shape with new URL")

      await this.editor.updateShape<IVideoChatShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          roomUrl: url,
        },
      })

      console.log("Shape updated:", this.editor.getShape(shape.id))
    } catch (error) {
      console.error("Error in ensureRoomExists:", error)
      throw error
    }
  }

  component(shape: IVideoChatShape) {
    const [hasPermissions, setHasPermissions] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
      setIsLoading(true)
      this.ensureRoomExists(shape)
        .catch(console.error)
        .finally(() => setIsLoading(false))
    }, [])

    useEffect(() => {
      // Request permissions when needed
      const requestPermissions = async () => {
        try {
          if (shape.props.allowCamera || shape.props.allowMicrophone) {
            const constraints = {
              video: shape.props.allowCamera,
              audio: shape.props.allowMicrophone,
            }
            await navigator.mediaDevices.getUserMedia(constraints)
            setHasPermissions(true)
          }
        } catch (error) {
          console.error("Permission request failed:", error)
          setHasPermissions(false)
        }
      }

      requestPermissions()
    }, [shape.props.allowCamera, shape.props.allowMicrophone])

    if (error) {
      return <div>Error creating room: {error.message}</div>
    }

    if (!shape.props.roomUrl) {
      return (
        <div
          style={{
            width: shape.props.w,
            height: shape.props.h,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f0f0f0",
            borderRadius: "4px",
          }}
        >
          {isLoading ? "Creating room... Please wait" : "Creating room..."}
        </div>
      )
    }

    // Construct URL with permission parameters
    const roomUrlWithParams = new URL(shape.props.roomUrl)
    roomUrlWithParams.searchParams.set(
      "allow_camera",
      String(shape.props.allowCamera),
    )
    roomUrlWithParams.searchParams.set(
      "allow_mic",
      String(shape.props.allowMicrophone),
    )

    console.log(shape.props.roomUrl)

    return (
      <div
        style={{
          width: `${shape.props.w}px`,
          height: `${shape.props.h}px`,
          position: "relative",
          pointerEvents: "all",
        }}
      >
        <iframe
          src={roomUrlWithParams.toString()}
          width="100%"
          height="100%"
          style={{ border: "none" }}
          allow={`camera ${shape.props.allowCamera ? "self" : ""}; microphone ${
            shape.props.allowMicrophone ? "self" : ""
          }`}
        ></iframe>
        <p
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            margin: "8px",
            padding: "4px 8px",
            background: "rgba(255, 255, 255, 0.9)",
            borderRadius: "4px",
            fontSize: "12px",
            pointerEvents: "all",
            cursor: "text",
            userSelect: "text",
          }}
        >
          url: {shape.props.roomUrl}
        </p>
      </div>
    )
  }
}
