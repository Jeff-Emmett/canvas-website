import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"
import { useEffect, useState, useRef } from "react"
import { useParticipantCounts, DailyProvider, useDaily, useTranscription } from '@daily-co/daily-react';

interface DailyApiResponse {
  url: string;
}

interface DailyRecordingResponse {
  id: string;
}

interface TranscriptResponse {
  data: TranscriptItem[];
}

interface TranscriptItem {
  user_name?: string;
  text: string;
  transcriptId: string;
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
    recordingId: string | null
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
      enableRecording: true,
      recordingId: null,
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
                  preset: "audio-only"
                },
                format: "mp4",
                mode: "audio-only"
              },
              auto_start_transcription: true,
              recordings_template: "{room_name}/audio-{epoch_time}.mp4",
              permissions: {
                hasPresence: true,
                canSend: true,
                canAdmin: false
              },
              enable_transcription: true,
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
      const url = new URL(shape.props.roomUrl);
      const roomName = url.pathname.substring(1);
      
      // Get the board name and timestamp
      const boardName = this.editor.getCurrentPage().name || 'untitled';
      const timestamp = new Date().toISOString()
        .replace('T', '_')
        .replace(/:/g, '-')
        .slice(0, 16);

      console.log('Starting recording for room:', roomName);
      console.log('Recording access URL will be available at:', 
        `https://api.daily.co/v1/recordings?room=${roomName}`);
      console.log('Making request to:', `${workerUrl}/daily/recordings/${roomName}/start`);

      const response = await fetch(`${workerUrl}/daily/recordings/${roomName}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          layout: {
            preset: "audio-only"
          },
          recording_name: `${boardName}_${timestamp}_audio`
        })
      });

      console.log('Recording start response status:', response.status);
      const responseData = await response.json();
      console.log('Recording start response data:', responseData);

      if (!response.ok) {
        throw new Error(`Failed to start recording: ${response.statusText} (${JSON.stringify(responseData)})`);
      }
      
      const data = responseData as DailyRecordingResponse;
      
      await this.editor.updateShape<IVideoChatShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          recordingId: data.id || null
        }
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  async stopRecording(shape: IVideoChatShape) {
    if (!shape.props.roomUrl) return;
    
    const workerUrl = import.meta.env.VITE_TLDRAW_WORKER_URL;
    const apiKey = import.meta.env.VITE_DAILY_API_KEY;

    try {
      // Parse the URL to get just the room name
      const url = new URL(shape.props.roomUrl);
      const roomName = url.pathname.substring(1); // Remove leading slash
      
      // Verify we have a room name
      if (!roomName) {
        throw new Error('Room name not found in URL');
      }

      const response = await fetch(`${workerUrl}/daily/recordings/${roomName}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to stop recording: ${response.statusText}`);
      }

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
    // Get room URL directly from shape props
    const roomUrl = shape.props.roomUrl;
    if (!roomUrl) {
      console.log('Cannot start transcription: no room URL');
      return;
    }
    
    const workerUrl = import.meta.env.VITE_TLDRAW_WORKER_URL;
    const apiKey = import.meta.env.VITE_DAILY_API_KEY;

    try {
      // Ensure we have a valid URL and extract the room name
      const url = new URL(roomUrl);  // Use roomUrl from props
      const roomName = url.pathname.substring(1);
      
      console.log('Starting transcription for room:', roomName);

      console.log('Making request to:', `${workerUrl}/daily/transcription/${roomName}/start`);
      const response = await fetch(`${workerUrl}/daily/transcription/${roomName}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          language: 'en',
          punctuate: true,
          profanity_filter: true
        })
      });

      console.log('Transcription start response status:', response.status);
      const responseData = await response.json();
      console.log('Transcription start response data:', responseData);

      if (!response.ok) {
        throw new Error(`Failed to start transcription: ${response.statusText} (${JSON.stringify(responseData)})`);
      }

      console.log('Updating shape with transcription status');
      await this.editor.updateShape<IVideoChatShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          isTranscribing: true
        }
      });
      console.log('Transcription started successfully');

    } catch (error) {
      console.error('Error starting transcription:', error);
      throw error;
    }
  }

  async stopTranscription(shape: IVideoChatShape) {
    const roomUrl = shape.props.roomUrl;
    if (!roomUrl) {
      console.log('Cannot stop transcription: no room URL');
      return;
    }
    
    const workerUrl = import.meta.env.VITE_TLDRAW_WORKER_URL;
    const apiKey = import.meta.env.VITE_DAILY_API_KEY;

    try {
      const url = new URL(roomUrl);
      const roomName = url.pathname.substring(1);
      
      console.log('Stopping transcription for room:', roomName);

      // First, stop the transcription
      const stopResponse = await fetch(`${workerUrl}/daily/transcription/${roomName}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!stopResponse.ok) {
        throw new Error(`Failed to stop transcription: ${stopResponse.statusText}`);
      }

      console.log('Transcription stopped, waiting for processing...');
      // Increase wait time for processing
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Get list of transcripts
      console.log('Fetching transcripts list...');
      const transcriptsResponse = await fetch(`${workerUrl}/daily/transcription/${roomName}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!transcriptsResponse.ok) {
        console.error('Transcripts list response:', await transcriptsResponse.text());
        throw new Error(`Failed to fetch transcripts list: ${transcriptsResponse.statusText}`);
      }

      const transcriptsData = await transcriptsResponse.json() as TranscriptResponse;
      console.log('Transcripts list:', transcriptsData);

      // Get the most recent transcript ID
      if (!transcriptsData.data || transcriptsData.data.length === 0) {
        console.warn('No transcripts found in response');
        throw new Error('No transcripts found');
      }

      // Sort by most recent and get the first one
      const latestTranscript = transcriptsData.data
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
      
      const transcriptId = latestTranscript.transcriptId;
      console.log('Latest transcript ID:', transcriptId);
      
      // Fetch the actual transcript content
      console.log('Fetching transcript content...');
      const contentResponse = await fetch(`${workerUrl}/daily/transcription/${roomName}/${transcriptId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!contentResponse.ok) {
        console.error('Content response:', await contentResponse.text());
        throw new Error(`Failed to fetch transcript content: ${contentResponse.statusText}`);
      }

      const contentData = await contentResponse.json() as TranscriptResponse;
      console.log('Transcript content:', contentData);

      // Create a text note with the transcript
      if (contentData.data && contentData.data.length > 0) {
        const transcriptText = contentData.data
          .filter((item: any) => item.text) // Filter out items with no text
          .map((item: any) => {
            const speaker = item.user_name || 'Speaker';
            const text = item.text.trim();
            return `${speaker}: ${text}`;
          })
          .join('\n');

        if (!transcriptText) {
          console.warn('Transcript text is empty after processing');
          return;
        }

        // Get the current shape's position
        const currentShape = this.editor.getShape(shape.id) as IVideoChatShape;
        if (!currentShape) {
          console.error('Failed to find current shape for positioning transcript');
          throw new Error('Shape not found');
        }

        console.log('Creating transcript note at position:', {
          x: currentShape.x,
          y: currentShape.y + currentShape.props.h + 20
        });
        console.log('Transcript text to be added:', transcriptText);

        try {
          const newShape = await this.editor.createShape({
            type: 'note',
            x: currentShape.x,
            y: currentShape.y + currentShape.props.h + 20,
            props: {
              text: `Transcript from ${new Date().toLocaleString()}\n\n${transcriptText}`,
              color: 'blue',
              size: 'l',
            },
          });

          console.log('Successfully created transcript note:', newShape);
        } catch (error) {
          console.error('Failed to create transcript shape:', error);
          throw new Error('Failed to create transcript shape');
        }

      } else {
        console.warn('No valid transcript content found in response:', contentData);
      }

      // Update shape transcription status
      await this.editor.updateShape<IVideoChatShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          isTranscribing: false
        }
      });
      console.log('Transcription stopped successfully');

    } catch (error) {
      console.error('Error stopping transcription:', error);
      throw error;
    }
  }

  component(shape: IVideoChatShape) {
    const [roomUrl, setRoomUrl] = useState<string | null>(shape.props.roomUrl)
    const daily = useDaily()
    const { present, hidden } = useParticipantCounts()
    const [hasPermissions, setHasPermissions] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isRecording, setIsRecording] = useState(!!shape.props.recordingId)
    const [isTranscribing, setIsTranscribing] = useState(shape.props.isTranscribing)
    // Add loading states for buttons
    const [isRecordingLoading, setIsRecordingLoading] = useState(false)
    const [isTranscribingLoading, setIsTranscribingLoading] = useState(false)
    
    // Add timeout ref to handle stuck states
    const transcriptionTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (transcriptionTimeoutRef.current) {
          clearTimeout(transcriptionTimeoutRef.current)
        }
      }
    }, [])

    // Updated recording toggle handler
    const handleRecordingToggle = async () => {
      if (isRecordingLoading) return; // Prevent multiple clicks
      try {
        setIsRecordingLoading(true);
        if (isRecording) {
          await this.stopRecording(shape);
          setIsRecording(false);
        } else {
          await this.startRecording(shape);
          setIsRecording(true);
        }
      } catch (err) {
        console.error("Recording toggle failed:", err);
      } finally {
        setIsRecordingLoading(false);
      }
    };

    // Add useTranscription hook with callbacks
    const {
      isTranscribing: dailyTranscribing,
      transcriptions,
      error: transcriptionError,
      startTranscription: dailyStartTranscription,
      stopTranscription: dailyStopTranscription
    } = useTranscription({
      onTranscriptionStarted: () => {
        console.log('Transcription started');
      },
      onTranscriptionStopped: async () => {
        console.log('Transcription stopped, transcriptions:', transcriptions);
        if (transcriptions && transcriptions.length > 0) {
          // Create transcript text from the transcriptions array
          const transcriptText = transcriptions
            .map((t: any) => `${t.user_name || 'Speaker'}: ${t.text}`)
            .join('\n');

          // Get the current shape for positioning
          const currentShape = this.editor.getShape(shape.id) as IVideoChatShape;
          if (!currentShape) throw new Error('Shape not found');

          try {
            const newShape = await this.editor.createShape({
              type: 'note',
              x: currentShape.x,
              y: currentShape.y + currentShape.props.h + 20,
              props: {
                text: `Transcript from ${new Date().toLocaleString()}\n\n${transcriptText}`,
                color: 'blue',
                size: 'l',
              },
            });
            console.log('Created transcript note:', newShape);
          } catch (error) {
            console.error('Failed to create transcript shape:', error);
          }
        }
      },
      onTranscriptionError: (error) => {
        console.error('Transcription error:', error);
      }
    });

    // Update the transcription toggle handler
    const handleTranscriptionToggle = async () => {
      if (isTranscribingLoading) return;
      
      try {
        setIsTranscribingLoading(true);
        if (isTranscribing) {
          await dailyStopTranscription();
        } else {
          await dailyStartTranscription({
            language: 'en',
            punctuate: true,
            profanity_filter: true
          });
        }
        setIsTranscribing(!isTranscribing);
      } catch (err) {
        console.error("Transcription toggle failed:", err);
      } finally {
        setIsTranscribingLoading(false);
      }
    };

    // Add a useEffect to monitor and reset stuck states
    useEffect(() => {
      if (isTranscribingLoading) {
        const timeout = setTimeout(() => {
          console.warn('Forcing reset of transcription loading state');
          setIsTranscribingLoading(false);
        }, 15000); // 15 second failsafe
        
        return () => clearTimeout(timeout);
      }
    }, [isTranscribingLoading]);

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

    // Add effect to log participant counts
    useEffect(() => {
      console.log('Participant counts:', { present, hidden })
      console.log('Daily instance:', daily)
      console.log('Current participants:', daily?.participants())
    }, [present, hidden, daily])

    // Add effect to join the room when Daily is ready
    useEffect(() => {
      if (daily && roomUrl) {
        console.log('Attempting to join room:', roomUrl);
        daily.join({ url: roomUrl }).then(() => {
          console.log('Successfully joined room');
          console.log('Initial participants:', daily.participants());
        }).catch(error => {
          console.error('Failed to join room:', error);
        });
      }
      
      // Cleanup: leave the room when component unmounts
      return () => {
        if (daily) {
          console.log('Leaving room');
          daily.leave();
        }
      };
    }, [daily, roomUrl]);

    // Add effect to track participant changes
    useEffect(() => {
      if (!daily) return;

      const handleParticipantJoined = (event: any) => {
        console.log('Participant joined:', event.participant);
        console.log('All participants:', daily.participants());
      };

      const handleParticipantLeft = (event: any) => {
        console.log('Participant left:', event.participant);
        console.log('All participants:', daily.participants());
      };

      daily.on('participant-joined', handleParticipantJoined);
      daily.on('participant-left', handleParticipantLeft);

      return () => {
        daily.off('participant-joined', handleParticipantJoined);
        daily.off('participant-left', handleParticipantLeft);
      };
    }, [daily]);

    if (error || isLoading || !roomUrl) {
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

    // Add recording UI parameter to the URL
    const roomUrlWithParams = new URL(roomUrl)
    roomUrlWithParams.searchParams.set("show_record_button", "true")
    roomUrlWithParams.searchParams.set("allow_camera", String(shape.props.allowCamera))
    roomUrlWithParams.searchParams.set("allow_mic", String(shape.props.allowMicrophone))

    return (
      <DailyProvider>
        <div
          style={{
            width: `${shape.props.w}px`,
            display: "flex",
            flexDirection: "column",
            pointerEvents: "all",
          }}
        >
          {/* Video container */}
          <div
            style={{
              width: "100%",
              height: `${shape.props.h}px`,
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
          </div>

          {/* Controls container below video */}
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px",
              background: "#ffffff",
              borderTop: "1px solid #eee",
              marginTop: "4px",
            }}
          >
            <p
              style={{
                margin: 0,
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                userSelect: "text",
              }}
            >
              url: {roomUrl}
            </p>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              {shape.props.enableRecording && (
                <button
                  onClick={handleRecordingToggle}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={isRecordingLoading}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    background: isRecording ? "#ff4444" : "#ffffff",
                    cursor: isRecordingLoading ? "not-allowed" : "pointer",
                    fontSize: "12px",
                    pointerEvents: "auto",
                    opacity: isRecordingLoading ? 0.7 : 1,
                  }}
                >
                  {isRecordingLoading 
                    ? (isRecording ? "Stopping..." : "Starting...") 
                    : (isRecording ? "Stop Recording" : "Start Recording")}
                </button>
              )}
              <button
                onClick={handleTranscriptionToggle}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isTranscribingLoading}
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  background: isTranscribing ? "#ff4444" : "#ffffff",
                  cursor: isTranscribingLoading ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  pointerEvents: "auto",
                  opacity: isTranscribingLoading ? 0.7 : 1,
                }}
              >
                {isTranscribingLoading 
                  ? (isTranscribing ? "Stopping..." : "Starting...") 
                  : (isTranscribing ? "Stop Transcription" : "Start Transcription")}
              </button>
            </div>
          </div>
        </div>
      </DailyProvider>
    )
  }
}
