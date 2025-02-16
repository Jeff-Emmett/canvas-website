import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"
import { useEffect, useState } from "react"

interface DailyApiResponse {
  url: string;
}

interface DailyRecordingResponse {
  id: string;
}

export type IVideoChatShape = TLBaseShape<
  "VideoChat",
  {
    w: number
    h: number
    roomUrl: string | null
    allowCamera: boolean
    allowMicrophone: boolean
    enableRecording: boolean
    recordingId: string | null // Track active recording
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
      recordingId: null
    }
  }

  async ensureRoomExists(shape: IVideoChatShape) {
    const boardId = this.editor.getCurrentPageId();
    if (!boardId) {
        throw new Error('Board ID is undefined');
    }

    // Try to get existing room URL from localStorage first
    const storageKey = `videoChat_room_${boardId}`;
    const existingRoomUrl = localStorage.getItem(storageKey);

    if (existingRoomUrl && existingRoomUrl !== 'undefined') {
        console.log("Using existing room from storage:", existingRoomUrl);
        await this.editor.updateShape<IVideoChatShape>({
            id: shape.id,
            type: shape.type,
            props: {
                ...shape.props,
                roomUrl: existingRoomUrl,
            },
        });
        return;
    }

    if (shape.props.roomUrl !== null && shape.props.roomUrl !== 'undefined') {
        console.log("Room already exists:", shape.props.roomUrl);
        localStorage.setItem(storageKey, shape.props.roomUrl);
        return;
    }

    try {
        const workerUrl = import.meta.env.VITE_TLDRAW_WORKER_URL;
        const apiKey = import.meta.env.VITE_DAILY_API_KEY;

        if (!apiKey) {
            throw new Error('Daily.co API key not configured');
        }

        if (!workerUrl) {
            throw new Error('Worker URL is not configured');
        }

        // Create room name based on board ID and timestamp
        const roomName = `board_${boardId}_${Date.now()}`;

        const response = await fetch(`${workerUrl}/daily/rooms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            name: roomName,
            properties: {
              enable_chat: true,
              enable_screenshare: true,
              start_video_off: true,
              start_audio_off: true,
              enable_recording: "cloud",
              start_cloud_recording: true,
              start_cloud_recording_opts: {
                layout: {
                  preset: "active-speaker"
                },
                format: "mp4",
                mode: "audio-only"
              },
              auto_start_transcription: true,
              recordings_template: "{room_name}/audio-{epoch_time}.mp4"
            }
          })
        });

        if (!response.ok) {
          const error = await response.json()
          throw new Error(`Failed to create room (${response.status}): ${JSON.stringify(error)}`)
        }

        const data = (await response.json()) as DailyApiResponse;
        const url = data.url;

        if (!url) throw new Error("Room URL is missing")

        // Store the room URL in localStorage
        localStorage.setItem(storageKey, url);

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

  async startRecording(shape: IVideoChatShape) {
    if (!shape.props.roomUrl) return;
    
    const workerUrl = import.meta.env.VITE_TLDRAW_WORKER_URL;
    const apiKey = import.meta.env.VITE_DAILY_API_KEY;

    try {
      const response = await fetch(`${workerUrl}/daily/recordings/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          room_name: shape.id,
          layout: {
            preset: "active-speaker"
          }
        })
      });

      if (!response.ok) throw new Error('Failed to start recording');
      
      const data = await response.json() as DailyRecordingResponse;
      
      await this.editor.updateShape<IVideoChatShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          recordingId: data.id
        }
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  async stopRecording(shape: IVideoChatShape) {
    if (!shape.props.recordingId) return;

    const workerUrl = import.meta.env.VITE_TLDRAW_WORKER_URL;
    const apiKey = import.meta.env.VITE_DAILY_API_KEY;

    try {
      await fetch(`${workerUrl}/daily/recordings/${shape.props.recordingId}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      await this.editor.updateShape<IVideoChatShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          recordingId: null
        }
      });

    } catch (error) {
      console.error('Error stopping recording:', error);
      throw error;
    }
  }

  component(shape: IVideoChatShape) {
    const [hasPermissions, setHasPermissions] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [roomUrl, setRoomUrl] = useState<string | null>(shape.props.roomUrl)

    useEffect(() => {
        let mounted = true;
        
        const createRoom = async () => {
            try {
                setIsLoading(true);
                await this.ensureRoomExists(shape);
                
                // Get the updated shape after room creation
                const updatedShape = this.editor.getShape(shape.id);
                if (mounted && updatedShape) {
                    setRoomUrl((updatedShape as IVideoChatShape).props.roomUrl);
                }
            } catch (err) {
                if (mounted) {
                    console.error("Error creating room:", err);
                    setError(err as Error);
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        createRoom();

        return () => {
            mounted = false;
        };
    }, [shape.id]); // Only re-run if shape.id changes

    useEffect(() => {
      let mounted = true;
      
      const requestPermissions = async () => {
        try {
          if (shape.props.allowCamera || shape.props.allowMicrophone) {
            const constraints = {
              video: shape.props.allowCamera,
              audio: shape.props.allowMicrophone,
            }
            await navigator.mediaDevices.getUserMedia(constraints)
            if (mounted) {
              setHasPermissions(true)
            }
          }
        } catch (err) {
          console.error("Permission request failed:", err)
          if (mounted) {
            setHasPermissions(false)
          }
        }
      }

      requestPermissions()

      return () => {
        mounted = false;
      }
    }, [shape.props.allowCamera, shape.props.allowMicrophone])

    if (error) {
        return <div>Error creating room: {error.message}</div>
    }

    if (isLoading || !roomUrl || roomUrl === 'undefined') {
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
                {isLoading ? "Creating room... Please wait" : "Error: No room URL available"}
            </div>
        )
    }

    // Construct URL with permission parameters
    const roomUrlWithParams = new URL(roomUrl)
    roomUrlWithParams.searchParams.set(
      "allow_camera",
      String(shape.props.allowCamera),
    )
    roomUrlWithParams.searchParams.set(
      "allow_mic",
      String(shape.props.allowMicrophone),
    )

    console.log(roomUrl)

    return (
      <div
        style={{
          width: `${shape.props.w}px`,
          height: `${shape.props.h}px`,
          position: "relative",
          pointerEvents: "all",
          overflow: "hidden",
        }}
      >
        <iframe
          src={roomUrlWithParams.toString()}
          width="100%"
          height="100%"
          style={{ 
            border: "none",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          allow={`camera ${shape.props.allowCamera ? "self" : ""}; microphone ${
            shape.props.allowMicrophone ? "self" : ""
          }`}
        ></iframe>
        
        {shape.props.enableRecording && (
          <button
            onClick={async () => {
              try {
                if (shape.props.recordingId) {
                  await this.stopRecording(shape);
                } else {
                  await this.startRecording(shape);
                }
              } catch (err) {
                console.error('Recording error:', err);
              }
            }}
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              padding: "4px 8px",
              background: shape.props.recordingId ? "#ff4444" : "#ffffff",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              zIndex: 1,
            }}
          >
            {shape.props.recordingId ? "Stop Recording" : "Start Recording"}
          </button>
        )}

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
            zIndex: 1,
          }}
        >
          url: {roomUrl}
        </p>
      </div>
    )
  }
}
