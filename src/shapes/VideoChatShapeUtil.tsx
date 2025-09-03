import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"
import { useEffect, useState } from "react"
import { WORKER_URL } from "../routes/Board"

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
    const workerUrl = WORKER_URL;
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
        const workerUrl = WORKER_URL;
        const apiKey = import.meta.env.VITE_DAILY_API_KEY;

        // Debug logging
        console.log('🔧 VideoChat Debug:');
        console.log('WORKER_URL:', WORKER_URL);
        console.log('workerUrl:', workerUrl);
        console.log('apiKey exists:', !!apiKey);

        if (!apiKey) {
            throw new Error('Daily.co API key not configured');
        }

        if (!workerUrl) {
            throw new Error('Worker URL is not configured');
        }

        // Create room name based on board ID and timestamp
        // Sanitize boardId to only use valid Daily.co characters (A-Z, a-z, 0-9, '-', '_')
        const sanitizedBoardId = boardId.replace(/[^A-Za-z0-9\-_]/g, '_');
        const roomName = `board_${sanitizedBoardId}_${Date.now()}`;
        
        console.log('🔧 Room name generation:');
        console.log('Original boardId:', boardId);
        console.log('Sanitized boardId:', sanitizedBoardId);
        console.log('Final roomName:', roomName);

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
              start_audio_off: true
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
    
          const workerUrl = WORKER_URL;
      const apiKey = import.meta.env.VITE_DAILY_API_KEY;

    try {
      // Extract room name from URL (same as transcription methods)
      const roomName = shape.props.roomUrl.split('/').pop();
      if (!roomName) {
        throw new Error('Could not extract room name from URL');
      }

      const response = await fetch(`${workerUrl}/daily/recordings/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          room_name: roomName,
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

    const workerUrl = WORKER_URL;
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

  async startTranscription(shape: IVideoChatShape): Promise<boolean> {
    console.log('🎤 Starting Web Speech API transcription...');
    
    try {
      // Request microphone permission for transcription
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Update shape to indicate transcription is active
      await this.editor.updateShape<IVideoChatShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          isTranscribing: true,
        }
      });
      
      console.log('✅ Web Speech API transcription started');
      return true;
    } catch (error) {
      console.error('❌ Error starting Web Speech API transcription:', error);
      return false;
    }
  }

  async stopTranscription(shape: IVideoChatShape) {
    console.log('🛑 Stopping Web Speech API transcription...');
    
    try {
      // Update shape to indicate transcription is stopped
      await this.editor.updateShape<IVideoChatShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          isTranscribing: false,
        }
      });
      
      console.log('✅ Web Speech API transcription stopped');
    } catch (error) {
      console.error('❌ Error stopping Web Speech API transcription:', error);
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

  createTranscriptionTool(shape: IVideoChatShape) {
    console.log('🎤 Creating transcription tool element...');
    
    // Position the transcribe tool beneath the video chat shape
    const videoShape = this.editor.getShape(shape.id) as IVideoChatShape;
    if (!videoShape) return;
    
    // Calculate position beneath the video
    const x = videoShape.x; // Same x position as video
    const y = videoShape.y + videoShape.props.h + 20; // Below video with 20px gap
    const width = videoShape.props.w; // Same width as video
    
    // Create transcription tool shape
    this.editor.createShape({
      type: 'Transcribe',
      x: x,
      y: y,
      props: {
        w: width,
        h: 200, // Fixed height for transcript box
        isRecording: true, // Auto-start recording
        transcript: "",
        participants: [],
        language: "en-US",
        autoScroll: true,
      }
    });
    
    console.log('✅ Transcription tool created successfully beneath video');
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
          display: "flex",
          flexDirection: "column",
          pointerEvents: "all",
          overflow: "hidden",
        }}
      >
        {/* Transcription Button - Above video */}
        <button
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
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
                const success = await this.startTranscription(shape);
                if (success) {
                  // Create the transcription tool for Web Speech API
                  this.createTranscriptionTool(shape);
                  console.log('✅ Transcription tool created');
                } else {
                  console.log('❌ Failed to start transcription');
                }
              }
            } catch (err) {
              console.error('❌ Transcription error:', err);
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            padding: "8px 16px",
            background: shape.props.isTranscribing ? "#44ff44" : "#ffffff",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
            marginBottom: "8px",
            fontSize: "14px",
            fontWeight: "500",
            pointerEvents: "all",
            zIndex: 1000,
            position: "relative",
          }}
        >
          {shape.props.isTranscribing ? "Stop Transcription" : "Start Transcription"}
        </button>

        {/* Video Container */}
        <div
          style={{
            flex: 1,
            position: "relative",
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
        </div>

        {/* URL Link - Below video */}
        <div style={{ position: "relative" }}>
          <p
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (roomUrl) {
                try {
                  await navigator.clipboard.writeText(roomUrl);
                  console.log('✅ Link copied to clipboard:', roomUrl);
                  
                  // Show temporary "link copied" message
                  const messageEl = document.getElementById(`copy-message-${shape.id}`);
                  if (messageEl) {
                    messageEl.style.opacity = "1";
                    setTimeout(() => {
                      messageEl.style.opacity = "0";
                    }, 2000);
                  }
                } catch (err) {
                  console.error('❌ Failed to copy link:', err);
                  // Fallback for older browsers
                  const textArea = document.createElement('textarea');
                  textArea.value = roomUrl;
                  document.body.appendChild(textArea);
                  textArea.select();
                  document.execCommand('copy');
                  document.body.removeChild(textArea);
                }
              }
            }}
            style={{
              margin: "8px 0 0 0",
              padding: "4px 8px",
              background: "rgba(255, 255, 255, 0.9)",
              borderRadius: "4px",
              fontSize: "12px",
              pointerEvents: "all",
              cursor: "pointer",
              userSelect: "none",
              border: "1px solid #e0e0e0",
              transition: "background-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(240, 240, 240, 0.9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
            }}
          >
            url: {roomUrl}
            {shape.props.isOwner && " (Owner)"}
          </p>
          
          {/* "Link Copied" message */}
          <div
            id={`copy-message-${shape.id}`}
            style={{
              position: "absolute",
              bottom: "0",
              right: "0",
              background: "#4CAF50",
              color: "white",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: "500",
              opacity: "0",
              transition: "opacity 0.3s ease",
              pointerEvents: "none",
              zIndex: 1001,
            }}
          >
            Link Copied!
          </div>
        </div>
      </div>
    )
  }
}
