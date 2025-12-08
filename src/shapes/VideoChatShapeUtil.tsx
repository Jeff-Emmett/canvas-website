import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer } from "tldraw"
import { useEffect, useState } from "react"
import { WORKER_URL } from "../constants/workerUrl"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"
import { usePinnedToView } from "../hooks/usePinnedToView"
import { useMaximize } from "../hooks/useMaximize"

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
    meetingToken: string | null
    isOwner: boolean
    pinnedToView: boolean
    tags: string[]
  }
>

export class VideoChatShape extends BaseBoxShapeUtil<IVideoChatShape> {
  static override type = "VideoChat"

  // VideoChat theme color: Red (Rainbow)
  static readonly PRIMARY_COLOR = "#ef4444"

  indicator(shape: IVideoChatShape) {
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
  }

  getDefaultProps(): IVideoChatShape["props"] {
    const props = {
      roomUrl: null,
      w: 800,
      h: 560, // Reduced from 600 to account for header (40px) and avoid scrollbars
      allowCamera: false,
      allowMicrophone: false,
      enableRecording: true,
      recordingId: null,
      meetingToken: null,
      isOwner: false,
      pinnedToView: false,
      tags: ['video-chat']
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
    // Try to get the actual room ID from the URL or use a fallback
    let roomId = 'default-room';
    
    // Try to extract room ID from the current URL
    const currentUrl = window.location.pathname;
    const roomMatch = currentUrl.match(/\/board\/([^\/]+)/);
    if (roomMatch) {
      roomId = roomMatch[1];
    } else {
      // Fallback: try to get from localStorage or use a default
      roomId = localStorage.getItem('currentRoomId') || 'default-room';
    }

    console.log('🔧 Using room ID:', roomId);

    // Clear old storage entries that use the old boardId format
    // This ensures we don't load old rooms with the wrong naming convention
    const oldStorageKeys = [
      'videoChat_room_page_page',
      'videoChat_room_page:page',
      'videoChat_room_board_page_page'
    ];
    
    oldStorageKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log(`Clearing old storage entry: ${key}`);
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}_token`);
      }
    });

    // Try to get existing room URL from localStorage first
    const storageKey = `videoChat_room_${roomId}`;
    const existingRoomUrl = localStorage.getItem(storageKey);
    const existingToken = localStorage.getItem(`${storageKey}_token`);

    if (existingRoomUrl && existingRoomUrl !== 'undefined' && existingToken) {
        // Check if the existing room URL uses the old naming pattern
        if (existingRoomUrl.includes('board_page_page_') || existingRoomUrl.includes('page_page')) {
            console.log("Found old room URL format, clearing and creating new room:", existingRoomUrl);
            localStorage.removeItem(storageKey);
            localStorage.removeItem(`${storageKey}_token`);
        } else {
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
    }

    if (shape.props.roomUrl !== null && shape.props.roomUrl !== 'undefined' && shape.props.meetingToken) {
        // Check if the shape's room URL uses the old naming pattern
        if (shape.props.roomUrl.includes('board_page_page_') || shape.props.roomUrl.includes('page_page')) {
            console.log("Shape has old room URL format, will create new room:", shape.props.roomUrl);
        } else {
            console.log("Room already exists:", shape.props.roomUrl);
            localStorage.setItem(storageKey, shape.props.roomUrl);
            localStorage.setItem(`${storageKey}_token`, shape.props.meetingToken);
            return;
        }
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

        // Create a simple, clean room name
        // Use a short hash of the room ID to keep URLs readable
        const shortId = roomId.length > 8 ? roomId.substring(0, 8) : roomId;
        const cleanId = shortId.replace(/[^A-Za-z0-9]/g, '');
        const roomName = `canvas-${cleanId}`;
        
        console.log('🔧 Room name generation:');
        console.log('Original roomId:', roomId);
        console.log('Short ID:', shortId);
        console.log('Clean ID:', cleanId);
        console.log('Final roomName:', roomName);

        console.log('🔧 Creating Daily.co room with:', {
          name: roomName,
          properties: {
            enable_chat: true,
            enable_screenshare: true,
            start_video_off: true,
            start_audio_off: true
          }
        });

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

        console.log('🔧 Daily.co API response status:', response.status);
        console.log('🔧 Daily.co API response ok:', response.ok);

        let url: string;
        let isNewRoom: boolean = false;

        if (!response.ok) {
          const error = await response.json() as any
          console.error('🔧 Daily.co API error:', error);
          
          // Check if the room already exists
          if (response.status === 400 && error.info && error.info.includes('already exists')) {
            console.log('🔧 Room already exists, connecting to existing room:', roomName);
            isNewRoom = false;
            
            // Try to get the existing room info from Daily.co API
            try {
              const getRoomResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${apiKey}`
                }
              });
              
              if (getRoomResponse.ok) {
                const roomData = await getRoomResponse.json() as any;
                url = roomData.url;
                console.log('🔧 Retrieved existing room URL:', url);
              } else {
                // If we can't get room info, construct the URL
                // This is a fallback - ideally we'd get it from the API
                console.warn('🔧 Could not get room info, constructing URL (this may not work)');
                // We'll need to construct it, but we don't have the domain
                // For now, throw an error and let the user know
                throw new Error(`Room ${roomName} already exists but could not retrieve room URL. Please contact support.`);
              }
            } catch (getRoomError) {
              console.error('🔧 Error getting existing room:', getRoomError);
              throw new Error(`Room ${roomName} already exists but could not connect to it: ${(getRoomError as Error).message}`);
            }
          } else {
            // Some other error occurred
            throw new Error(`Failed to create room (${response.status}): ${JSON.stringify(error)}`)
          }
        } else {
          // Room was created successfully
          isNewRoom = true;
          const data = (await response.json()) as DailyApiResponse;
          console.log('🔧 Daily.co API response data:', data);
          url = data.url;
        }

        if (!url) {
          console.error('🔧 Room URL is missing');
          throw new Error("Room URL is missing")
        }

        console.log('🔧 Room URL from API:', url);
        
        // Generate meeting token for the owner
        // First ensure the room exists, then generate token
        const meetingToken = await this.generateMeetingToken(roomName);

        // Store the room URL and token in localStorage
        localStorage.setItem(storageKey, url);
        localStorage.setItem(`${storageKey}_token`, meetingToken);

        if (isNewRoom) {
          console.log("Room created successfully:", url)
        } else {
          console.log("Connected to existing room:", url)
        }
        console.log("Meeting token generated:", meetingToken)
        console.log("Updating shape with new URL and token")
        // Set isOwner to true only if we created the room, false if we connected to existing
        console.log("Setting isOwner to", isNewRoom)

        await this.editor.updateShape<IVideoChatShape>({
          id: shape.id,
          type: shape.type,
          props: {
            ...shape.props,
            roomUrl: url,
            meetingToken: meetingToken,
            isOwner: isNewRoom, // Only owner if we created the room
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


  component(shape: IVideoChatShape) {
    // Ensure shape props exist with defaults
    const props = shape.props || {}
    const roomUrl = props.roomUrl || ""
    
    const [hasPermissions, setHasPermissions] = useState(false)
    const [forceRender, setForceRender] = useState(0)
    const [isMinimized, setIsMinimized] = useState(false)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)
    
    // Force re-render function
    const forceComponentUpdate = () => {
      setForceRender(prev => prev + 1)
    }

    const [error, setError] = useState<Error | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [currentRoomUrl, setCurrentRoomUrl] = useState<string | null>(roomUrl)
    const [iframeError, setIframeError] = useState(false)
    const [retryCount, setRetryCount] = useState(0)
    const [useFallback, setUseFallback] = useState(false)

    useEffect(() => {
        let mounted = true;
        
        const createRoom = async () => {
            try {
                setIsLoading(true);
                await this.ensureRoomExists(shape);
                
                // Get the updated shape after room creation
                const updatedShape = this.editor.getShape(shape.id);
                if (mounted && updatedShape) {
                    setCurrentRoomUrl((updatedShape as IVideoChatShape).props.roomUrl);
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

    // CRITICAL: Hooks must be called before any conditional returns
    // Use the pinning hook to keep the shape fixed to viewport when pinned
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    // Use the maximize hook for fullscreen functionality
    const { isMaximized, toggleMaximize } = useMaximize({
      editor: this.editor,
      shapeId: shape.id,
      currentW: shape.props.w,
      currentH: shape.props.h,
      shapeType: 'VideoChat',
    })

    if (error) {
        return <div>Error creating room: {error.message}</div>
    }

    if (isLoading || !currentRoomUrl || currentRoomUrl === 'undefined') {
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

    // Validate room URL format
    if (!currentRoomUrl || !currentRoomUrl.startsWith('http')) {
      console.error('Invalid room URL format:', currentRoomUrl);
      return <div>Error: Invalid room URL format</div>;
    }

    // Check if we're running on a network IP (which can cause WebRTC/CORS issues)
    const isNonLocalhost = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const isNetworkIP = window.location.hostname.startsWith('172.') || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.');

    // Try the original URL first, then add parameters if needed
    let roomUrlWithParams;
    try {
      roomUrlWithParams = new URL(currentRoomUrl)
      roomUrlWithParams.searchParams.set(
        "allow_camera",
        String(shape.props.allowCamera),
      )
      roomUrlWithParams.searchParams.set(
        "allow_mic",
        String(shape.props.allowMicrophone),
      )
      
      // Add parameters for better network access
      if (isNetworkIP) {
        roomUrlWithParams.searchParams.set("embed", "true")
        roomUrlWithParams.searchParams.set("iframe", "true")
        roomUrlWithParams.searchParams.set("show_leave_button", "false")
        roomUrlWithParams.searchParams.set("show_fullscreen_button", "false")
        roomUrlWithParams.searchParams.set("show_participants_bar", "true")
        roomUrlWithParams.searchParams.set("show_local_video", "true")
        roomUrlWithParams.searchParams.set("show_remote_video", "true")
      }
      
      // Only add embed parameters if the original URL doesn't work
      if (retryCount > 0) {
        roomUrlWithParams.searchParams.set("embed", "true")
        roomUrlWithParams.searchParams.set("iframe", "true")
      }
    } catch (e) {
      console.error('Error constructing URL:', e);
      roomUrlWithParams = new URL(currentRoomUrl);
    }

    // Note: Removed HEAD request test due to CORS issues with non-localhost IPs

    const handleClose = () => {
      this.editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<IVideoChatShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h + 40 }}>
        <StandardizedToolWrapper
          title="Video Chat"
          primaryColor={VideoChatShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={shape.props.w}
          height={shape.props.h + 40}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          onMaximize={toggleMaximize}
          isMaximized={isMaximized}
          editor={this.editor}
          shapeId={shape.id}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          tags={shape.props.tags}
          onTagsChange={(newTags) => {
            this.editor.updateShape<IVideoChatShape>({
              id: shape.id,
              type: 'VideoChat',
              props: {
                ...shape.props,
                tags: newTags,
              }
            })
          }}
          tagsEditable={true}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              position: "relative",
              pointerEvents: "all",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >

        {/* Video Container */}
        <div
          style={{
            width: '100%',
            flex: 1,
            position: "relative",
            overflow: "hidden",
            minHeight: 0, // Allow flex item to shrink below content size
          }}
        >
        {!useFallback ? (
          <iframe
            key={`iframe-${retryCount}`}
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
            allow={isNetworkIP ? "*" : "camera; microphone; fullscreen; display-capture; autoplay; encrypted-media; geolocation; web-share"}
            referrerPolicy={isNetworkIP ? "unsafe-url" : "no-referrer-when-downgrade"}
            sandbox={isNetworkIP ? "allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation" : undefined}
            title="Daily.co Video Chat"
            loading="lazy"
            onError={(e) => {
              console.error('Iframe loading error:', e);
              setIframeError(true);
              if (retryCount < 2) {
                console.log(`Retrying iframe load (attempt ${retryCount + 1})`);
                setTimeout(() => {
                  setRetryCount(prev => prev + 1);
                  setIframeError(false);
                }, 2000);
              } else {
                console.log('Switching to fallback iframe configuration');
                setUseFallback(true);
                setIframeError(false);
                setRetryCount(0);
              }
            }}
            onLoad={() => {
              console.log('Iframe loaded successfully');
              setIframeError(false);
              setRetryCount(0);
            }}
          ></iframe>
        ) : (
          <iframe
            key={`fallback-iframe-${retryCount}`}
            src={currentRoomUrl}
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
            allow="*"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
            title="Daily.co Video Chat (Fallback)"
            onError={(e) => {
              console.error('Fallback iframe loading error:', e);
              setIframeError(true);
              if (retryCount < 3) {
                console.log(`Retrying fallback iframe load (attempt ${retryCount + 1})`);
                setTimeout(() => {
                  setRetryCount(prev => prev + 1);
                  setIframeError(false);
                }, 2000);
              } else {
                setError(new Error('Failed to load video chat room after multiple attempts'));
              }
            }}
            onLoad={() => {
              console.log('Fallback iframe loaded successfully');
              setIframeError(false);
              setRetryCount(0);
            }}
          ></iframe>
        )}
        
        {/* Loading indicator */}
        {iframeError && retryCount < 3 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '5px',
            zIndex: 10
          }}>
            Retrying connection... (Attempt {retryCount + 1}/3)
          </div>
        )}
        
        
        {/* Fallback button if iframe fails */}
        {iframeError && retryCount >= 3 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '20px',
            borderRadius: '10px',
            textAlign: 'center',
            zIndex: 10
          }}>
            <p>Video chat failed to load in iframe</p>
            {isNetworkIP && (
              <p style={{fontSize: '12px', margin: '10px 0', color: '#ffc107'}}>
                ⚠️ Network access issue detected: Video chat may not work on {window.location.hostname}:5173 due to WebRTC/CORS restrictions. Try accessing via localhost:5173 or use the "Open in New Tab" button below.
              </p>
            )}
            {isNonLocalhost && !isNetworkIP && (
              <p style={{fontSize: '12px', margin: '10px 0', color: '#ffc107'}}>
                ⚠️ CORS issue detected: Try accessing via localhost:5173 instead of {window.location.hostname}:5173
              </p>
            )}
            <p style={{fontSize: '12px', margin: '10px 0'}}>
              URL: {roomUrlWithParams.toString()}
            </p>
            <button
              onClick={() => window.open(roomUrlWithParams.toString(), '_blank')}
              style={{
                background: '#007bff',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              Open in New Tab
            </button>
            <button
              onClick={() => {
                setUseFallback(!useFallback);
                setRetryCount(0);
                setIframeError(false);
              }}
              style={{
                background: '#28a745',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
                marginTop: '10px',
                marginLeft: '10px'
              }}
            >
              Try {useFallback ? 'Normal' : 'Fallback'} Mode
            </button>
          </div>
        )}
        


        </div>

        {/* URL Bubble - Overlay on bottom of video */}
        <p
          style={{
            position: "absolute",
            bottom: "8px",
            left: "8px",
            margin: 0,
            padding: "4px 8px",
            background: "rgba(255, 255, 255, 0.9)",
            borderRadius: "4px",
            fontSize: "12px",
            pointerEvents: "all",
            cursor: "text",
            userSelect: "text",
            zIndex: 1,
            maxWidth: "calc(100% - 16px)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          url: {currentRoomUrl}
          {shape.props.isOwner && " (Owner)"}
        </p>
      </div>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }
}
