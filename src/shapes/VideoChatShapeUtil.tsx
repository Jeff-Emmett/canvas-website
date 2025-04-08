import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"
import { useEffect, useState } from "react"

interface DailyApiResponse {
  url: string;
}

interface DailyTranscriptResponse {
  id: string;
  transcriptionId: string;
  text?: string;
  link?: string;
}

export type IVideoChatShape = TLBaseShape<
  "VideoChat",
  {
    w: number
    h: number
    roomUrl: string | null
    allowCamera: boolean
    allowMicrophone: boolean
    enableTranscription: boolean
    transcriptionId: string | null
    isTranscribing: boolean
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
      enableTranscription: true,
      transcriptionId: null,
      isTranscribing: false
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

  async startTranscription(shape: IVideoChatShape) {
    if (!shape.props.roomUrl) return;
    
    const workerUrl = import.meta.env.VITE_TLDRAW_WORKER_URL;
    const apiKey = import.meta.env.VITE_DAILY_API_KEY;

    if (!apiKey) {
      throw new Error('Daily.co API key not configured');
    }

    try {
      // Extract room name from the room URL
      const roomName = new URL(shape.props.roomUrl).pathname.split('/').pop();
      
      const response = await fetch(`${workerUrl}/daily/rooms/${roomName}/start-transcription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to start transcription: ${JSON.stringify(error)}`);
      }
      
      const data = await response.json() as DailyTranscriptResponse;
      
      await this.editor.updateShape<IVideoChatShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          transcriptionId: data.transcriptionId || data.id,
          isTranscribing: true
        }
      });

    } catch (error) {
      console.error('Error starting transcription:', error);
      throw error;
    }
  }

  async stopTranscription(shape: IVideoChatShape) {
    if (!shape.props.roomUrl) return;

    const workerUrl = import.meta.env.VITE_TLDRAW_WORKER_URL;
    const apiKey = import.meta.env.VITE_DAILY_API_KEY;

    if (!apiKey) {
      throw new Error('Daily.co API key not configured');
    }

    try {
      // Extract room name from the room URL
      const roomName = new URL(shape.props.roomUrl).pathname.split('/').pop();

      const response = await fetch(`${workerUrl}/daily/rooms/${roomName}/stop-transcription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to stop transcription: ${JSON.stringify(error)}`);
      }

      const data = await response.json() as DailyTranscriptResponse;
      console.log('Stop transcription response:', data);

      // Update both transcriptionId and isTranscribing state
      await this.editor.updateShape<IVideoChatShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          transcriptionId: data.transcriptionId || data.id || 'completed',
          isTranscribing: false
        }
      });

    } catch (error) {
      console.error('Error stopping transcription:', error);
      throw error;
    }
  }

  async getTranscriptionText(transcriptId: string): Promise<string> {
    const workerUrl = import.meta.env.VITE_TLDRAW_WORKER_URL;
    const apiKey = import.meta.env.VITE_DAILY_API_KEY;

    if (!apiKey) {
      throw new Error('Daily.co API key not configured');
    }

    console.log('Fetching transcript for ID:', transcriptId); // Debug log

    const response = await fetch(`${workerUrl}/transcript/${transcriptId}`, { // Remove 'daily' from path
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Transcript API response:', error); // Debug log
      throw new Error(`Failed to get transcription: ${JSON.stringify(error)}`);
    }

    const data = await response.json() as DailyTranscriptResponse;
    console.log('Transcript data received:', data); // Debug log
    return data.text || 'No transcription available';
  }

  async getTranscriptAccessLink(transcriptId: string): Promise<string> {
    const workerUrl = import.meta.env.VITE_TLDRAW_WORKER_URL;
    const apiKey = import.meta.env.VITE_DAILY_API_KEY;

    if (!apiKey) {
      throw new Error('Daily.co API key not configured');
    }

    console.log('Fetching transcript access link for ID:', transcriptId); // Debug log

    const response = await fetch(`${workerUrl}/transcript/${transcriptId}/access-link`, { // Remove 'daily' from path
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Transcript link API response:', error); // Debug log
      throw new Error(`Failed to get transcript access link: ${JSON.stringify(error)}`);
    }

    const data = await response.json() as DailyTranscriptResponse;
    console.log('Transcript link data received:', data); // Debug log
    return data.link || 'No transcript link available';
  }

  component(shape: IVideoChatShape) {
    const [hasPermissions, setHasPermissions] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [roomUrl, setRoomUrl] = useState<string | null>(shape.props.roomUrl)
    const [isCallActive, setIsCallActive] = useState(false)

    const handleIframeMessage = (event: MessageEvent) => {
      // Check if message is from Daily.co
      if (!event.origin.includes('daily.co')) return;

      console.log('Daily message received:', event.data);

      // Check for call state updates
      if (event.data?.action === 'daily-method-result') {
        // Handle join success
        if (event.data.method === 'join' && !event.data.error) {
          console.log('Join successful - setting call as active');
          setIsCallActive(true);
        }
      }
      
      // Also check for participant events
      if (event.data?.action === 'participant-joined') {
        console.log('Participant joined - setting call as active');
        setIsCallActive(true);
      }

      // Check for call ended
      if (event.data?.action === 'left-meeting' || 
          event.data?.action === 'participant-left') {
        console.log('Call ended - setting call as inactive');
        setIsCallActive(false);
      }
    };

    useEffect(() => {
      window.addEventListener('message', handleIframeMessage);
      return () => {
        window.removeEventListener('message', handleIframeMessage);
      };
    }, []);

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
    }, [shape.id]);

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

    const handleTranscriptionClick = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isCallActive) {
        console.log('Cannot control transcription when call is not active');
        return;
      }

      try {
        if (shape.props.isTranscribing) {
          console.log('Stopping transcription');
          await this.stopTranscription(shape);
        } else {
          console.log('Starting transcription');
          await this.startTranscription(shape);
        }
      } catch (err) {
        console.error('Transcription error:', err);
      }
    };

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

    // Debug log for render
    console.log('Current call state:', { isCallActive, roomUrl });

    // Add debug log before render
    console.log('Rendering component with states:', {
      isCallActive,
      isTranscribing: shape.props.isTranscribing,
      roomUrl
    });

    return (
      <div
        style={{
          width: `${shape.props.w}px`,
          height: `${shape.props.h}px`,
          position: "relative",
          pointerEvents: "all",
          overflow: "visible",
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
          allow="camera *; microphone *; display-capture *; clipboard-read; clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
        />
        
        {/* Add data-testid to help debug iframe messages */}
        <div data-testid="call-status">
          Call Active: {isCallActive ? 'Yes' : 'No'}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: -48,
            left: 0,
            right: 0,
            margin: "8px",
            padding: "8px 12px",
            background: "rgba(255, 255, 255, 0.95)",
            borderRadius: "6px",
            fontSize: "12px",
            pointerEvents: "all",
            touchAction: "manipulation",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 999,
            border: "1px solid #ccc",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            userSelect: "none",
          }}
        >
          <span style={{ 
            cursor: "text", 
            userSelect: "text",
            maxWidth: "60%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            pointerEvents: "all",
            touchAction: "auto"
          }}>
            url: {roomUrl}
          </span>
          <button
            onClick={handleTranscriptionClick}
            disabled={!isCallActive}
            style={{
              marginLeft: "12px",
              padding: "6px 12px",
              background: shape.props.isTranscribing ? "#ff4444" : "#ffffff",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: isCallActive ? "pointer" : "not-allowed",
              whiteSpace: "nowrap",
              flexShrink: 0,
              pointerEvents: isCallActive ? "all" : "none", // Add explicit pointer-events control
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              userSelect: "none",
              minHeight: "32px",
              minWidth: "44px",
              zIndex: 1000,
              position: "relative",
              opacity: isCallActive ? 1 : 0.5
            }}
          >
            {!isCallActive 
              ? "Join call to enable transcription"
              : shape.props.isTranscribing 
                ? "Stop Transcription" 
                : "Start Transcription"
            }
          </button>
        </div>
      </div>
    )
  }
}
