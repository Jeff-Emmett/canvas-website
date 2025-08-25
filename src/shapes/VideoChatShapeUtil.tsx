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
    enableTranscription: boolean
    isTranscribing: boolean
    transcriptionHistory: Array<{
      sender: string
      message: string
      id: string
    }>
    meetingToken: string | null
    isOwner: boolean
  }
>

export class VideoChatShape extends BaseBoxShapeUtil<IVideoChatShape> {
  static override type = "VideoChat"

  indicator(_shape: IVideoChatShape) {
    return null
  }

  getDefaultProps(): IVideoChatShape["props"] {
    const props = {
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
      isOwner: false
    };
    console.log('🔧 getDefaultProps called, returning:', props);
    return props;
  }

  async generateMeetingToken(roomName: string) {
    const workerUrl = import.meta.env.VITE_TLDRAW_WORKER_URL;
    const apiKey = import.meta.env.VITE_DAILY_API_KEY;

    if (!apiKey) {
      throw new Error('Daily.co API key not configured');
    }

    if (!workerUrl) {
      throw new Error('Worker URL is not configured');
    }

    // For now, let's skip token generation and use a simpler approach
    // We'll use the room URL directly and handle owner permissions differently
    console.log('Skipping meeting token generation for now');
    return `token_${roomName}_${Date.now()}`;
  }

  async ensureRoomExists(shape: IVideoChatShape) {
    const boardId = this.editor.getCurrentPageId();
    if (!boardId) {
        throw new Error('Board ID is undefined');
    }

    // Try to get existing room URL from localStorage first
    const storageKey = `videoChat_room_${boardId}`;
    const existingRoomUrl = localStorage.getItem(storageKey);
    const existingToken = localStorage.getItem(`${storageKey}_token`);

    if (existingRoomUrl && existingRoomUrl !== 'undefined' && existingToken) {
        console.log("Using existing room from storage:", existingRoomUrl);
        await this.editor.updateShape<IVideoChatShape>({
            id: shape.id,
            type: shape.type,
            props: {
                ...shape.props,
                roomUrl: existingRoomUrl,
                meetingToken: existingToken,
                isOwner: true, // Assume the creator is the owner
            },
        });
        return;
    }

    if (shape.props.roomUrl !== null && shape.props.roomUrl !== 'undefined' && shape.props.meetingToken) {
        console.log("Room already exists:", shape.props.roomUrl);
        localStorage.setItem(storageKey, shape.props.roomUrl);
        localStorage.setItem(`${storageKey}_token`, shape.props.meetingToken);
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
              // Transcription settings
              transcription: {
                enabled: true,
                auto_start: false
              },
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

        // Generate meeting token for the owner
        // First ensure the room exists, then generate token
        const meetingToken = await this.generateMeetingToken(roomName);

        // Store the room URL and token in localStorage
        localStorage.setItem(storageKey, url);
        localStorage.setItem(`${storageKey}_token`, meetingToken);

        console.log("Room created successfully:", url)
        console.log("Meeting token generated:", meetingToken)
        console.log("Updating shape with new URL and token")
        console.log("Setting isOwner to true")

        await this.editor.updateShape<IVideoChatShape>({
          id: shape.id,
          type: shape.type,
          props: {
            ...shape.props,
            roomUrl: url,
            meetingToken: meetingToken,
            isOwner: true,
          },
        })

        console.log("Shape updated:", this.editor.getShape(shape.id))
        const updatedShape = this.editor.getShape(shape.id) as IVideoChatShape;
        console.log("Updated shape isOwner:", updatedShape?.props.isOwner)
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

  async startTranscription(shape: IVideoChatShape) {
    console.log('🎤 startTranscription method called');
    console.log('Shape props:', shape.props);
    console.log('Room URL:', shape.props.roomUrl);
    console.log('Is owner:', shape.props.isOwner);
    
    if (!shape.props.roomUrl || !shape.props.isOwner) {
      console.log('❌ Early return - missing roomUrl or not owner');
      console.log('roomUrl exists:', !!shape.props.roomUrl);
      console.log('isOwner:', shape.props.isOwner);
      return;
    }
    
    try {
      const workerUrl = import.meta.env.VITE_TLDRAW_WORKER_URL;
      const apiKey = import.meta.env.VITE_DAILY_API_KEY;
      
      console.log('🔧 Environment variables:');
      console.log('Worker URL:', workerUrl);
      console.log('API Key exists:', !!apiKey);
      
      // Extract room name from URL
      const roomName = shape.props.roomUrl.split('/').pop();
      console.log('📝 Extracted room name:', roomName);
      
      if (!roomName) {
        throw new Error('Could not extract room name from URL');
      }

      console.log('🌐 Making API request to start transcription...');
      console.log('Request URL:', `${workerUrl}/daily/rooms/${roomName}/start-transcription`);

      const response = await fetch(`${workerUrl}/daily/rooms/${roomName}/start-transcription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ API error response:', error);
        throw new Error(`Failed to start transcription: ${JSON.stringify(error)}`);
      }

      console.log('✅ API call successful, updating shape...');
      await this.editor.updateShape<IVideoChatShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          isTranscribing: true,
        }
      });
      console.log('✅ Shape updated with isTranscribing: true');
    } catch (error) {
      console.error('❌ Error starting transcription:', error);
      throw error;
    }
  }

  async stopTranscription(shape: IVideoChatShape) {
    console.log('🛑 stopTranscription method called');
    console.log('Shape props:', shape.props);
    
    if (!shape.props.roomUrl || !shape.props.isOwner) {
      console.log('❌ Early return - missing roomUrl or not owner');
      return;
    }
    
    try {
      const workerUrl = import.meta.env.VITE_TLDRAW_WORKER_URL;
      const apiKey = import.meta.env.VITE_DAILY_API_KEY;
      
      // Extract room name from URL
      const roomName = shape.props.roomUrl.split('/').pop();
      console.log('📝 Extracted room name:', roomName);
      
      if (!roomName) {
        throw new Error('Could not extract room name from URL');
      }

      console.log('🌐 Making API request to stop transcription...');
      const response = await fetch(`${workerUrl}/daily/rooms/${roomName}/stop-transcription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ API error response:', error);
        throw new Error(`Failed to stop transcription: ${JSON.stringify(error)}`);
      }

      console.log('✅ API call successful, updating shape...');
      await this.editor.updateShape<IVideoChatShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          isTranscribing: false,
        }
      });
      console.log('✅ Shape updated with isTranscribing: false');
    } catch (error) {
      console.error('❌ Error stopping transcription:', error);
      throw error;
    }
  }

  addTranscriptionMessage(shape: IVideoChatShape, sender: string, message: string) {
    console.log('📝 addTranscriptionMessage called');
    console.log('Sender:', sender);
    console.log('Message:', message);
    console.log('Current transcription history length:', shape.props.transcriptionHistory.length);
    
    const newMessage = {
      sender,
      message,
      id: `${Date.now()}_${Math.random()}`
    };

    console.log('📝 Adding new message:', newMessage);

    this.editor.updateShape<IVideoChatShape>({
      id: shape.id,
      type: shape.type,
      props: {
        ...shape.props,
        transcriptionHistory: [...shape.props.transcriptionHistory, newMessage]
      }
    });
    
    console.log('✅ Transcription message added to shape');
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
        
        {/* Recording Button */}
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

        {/* Test Button - Always visible for debugging */}
        <button
          onClick={() => {
            console.log('🧪 Test button clicked!');
            console.log('Shape props:', shape.props);
            alert('Test button clicked! Check console for details.');
          }}
          style={{
            position: "absolute",
            top: "8px",
            left: "8px",
            padding: "4px 8px",
            background: "#ffff00",
            border: "1px solid #000",
            borderRadius: "4px",
            cursor: "pointer",
            zIndex: 1000,
            fontSize: "10px",
          }}
        >
          TEST
        </button>

        {/* Transcription Button - Only for owners */}
        {(() => {
          console.log('🔍 Checking transcription button conditions:');
          console.log('enableTranscription:', shape.props.enableTranscription);
          console.log('isOwner:', shape.props.isOwner);
          console.log('Button should render:', shape.props.enableTranscription && shape.props.isOwner);
          return shape.props.enableTranscription && shape.props.isOwner;
        })() && (
          <button
            onClick={async () => {
              console.log('🚀 Transcription button clicked!');
              console.log('Current transcription state:', shape.props.isTranscribing);
              console.log('Shape props:', shape.props);
              
              try {
                if (shape.props.isTranscribing) {
                  console.log('🛑 Stopping transcription...');
                  await this.stopTranscription(shape);
                  console.log('✅ Transcription stopped successfully');
                } else {
                  console.log('🎤 Starting transcription...');
                  await this.startTranscription(shape);
                  console.log('✅ Transcription started successfully');
                }
              } catch (err) {
                console.error('❌ Transcription error:', err);
              }
            }}
            style={{
              position: "absolute",
              top: "8px",
              right: shape.props.enableRecording ? "120px" : "8px",
              padding: "4px 8px",
              background: shape.props.isTranscribing ? "#44ff44" : "#ffffff",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              zIndex: 1,
            }}
          >
            {shape.props.isTranscribing ? "Stop Transcription" : "Start Transcription"}
          </button>
        )}

        {/* Transcription History */}
        {shape.props.transcriptionHistory.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: "40px",
              left: "8px",
              right: "8px",
              maxHeight: "200px",
              overflowY: "auto",
              background: "rgba(255, 255, 255, 0.95)",
              borderRadius: "4px",
              padding: "8px",
              fontSize: "12px",
              zIndex: 1,
              border: "1px solid #ccc",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
              Live Transcription:
            </div>
            {shape.props.transcriptionHistory.slice(-10).map((msg) => (
              <div key={msg.id} style={{ marginBottom: "2px" }}>
                <span style={{ fontWeight: "bold", color: "#666" }}>
                  {msg.sender}:
                </span>{" "}
                <span>{msg.message}</span>
              </div>
            ))}
          </div>
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
          {shape.props.isOwner && " (Owner)"}
        </p>
      </div>
    )
  }
}
