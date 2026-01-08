import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer } from "tldraw"
import { useEffect, useState, useRef } from "react"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"
import { usePinnedToView } from "../hooks/usePinnedToView"
import { useMaximize } from "../hooks/useMaximize"

// Jeffsi Meet domain (self-hosted Jitsi)
const JITSI_DOMAIN = "meet.jeffemmett.com"

export type IVideoChatShape = TLBaseShape<
  "VideoChat",
  {
    w: number
    h: number
    roomName: string | null
    allowCamera: boolean
    allowMicrophone: boolean
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
    return {
      roomName: null,
      w: 800,
      h: 560,
      allowCamera: true,
      allowMicrophone: true,
      pinnedToView: false,
      tags: ['video-chat']
    };
  }

  generateRoomName(shapeId: string): string {
    // Extract board ID from URL
    let boardId = 'default';
    const currentUrl = window.location.pathname;
    const boardMatch = currentUrl.match(/\/board\/([^\/]+)/);
    if (boardMatch) {
      boardId = boardMatch[1].substring(0, 8); // First 8 chars
    }

    // Clean the shape ID (remove 'shape:' prefix and special chars)
    const cleanShapeId = shapeId.replace(/^shape:/, '').replace(/[^A-Za-z0-9]/g, '').substring(0, 8);

    // Create a readable room name
    return `canvas-${boardId}-${cleanShapeId}`;
  }

  component(shape: IVideoChatShape) {
    const props = shape.props || {}
    const [isMinimized, setIsMinimized] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)
    const [roomName, setRoomName] = useState<string | null>(props.roomName)
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    // Initialize room name if not set
    useEffect(() => {
      if (!roomName) {
        const newRoomName = this.generateRoomName(shape.id);
        setRoomName(newRoomName);

        // Update shape props with room name
        this.editor.updateShape<IVideoChatShape>({
          id: shape.id,
          type: shape.type,
          props: {
            ...shape.props,
            roomName: newRoomName,
          },
        });
      }
      setIsLoading(false);
    }, [shape.id]);

    // Use the pinning hook
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    // Use the maximize hook
    const { isMaximized, toggleMaximize } = useMaximize({
      editor: this.editor,
      shapeId: shape.id,
      currentW: shape.props.w,
      currentH: shape.props.h,
      shapeType: 'VideoChat',
    })

    if (error) {
      return <div>Error: {error.message}</div>
    }

    if (isLoading || !roomName) {
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
          Initializing Jeffsi Meet...
        </div>
      )
    }

    // Construct Jitsi Meet URL with configuration
    const jitsiUrl = new URL(`https://${JITSI_DOMAIN}/${roomName}`)

    // Add configuration via URL params (Jitsi supports this)
    const config = {
      // UI Configuration
      'config.prejoinPageEnabled': 'false',
      'config.startWithAudioMuted': props.allowMicrophone ? 'false' : 'true',
      'config.startWithVideoMuted': props.allowCamera ? 'false' : 'true',
      'config.disableModeratorIndicator': 'true',
      'config.enableWelcomePage': 'false',
      // Interface configuration
      'interfaceConfig.SHOW_JITSI_WATERMARK': 'false',
      'interfaceConfig.SHOW_BRAND_WATERMARK': 'false',
      'interfaceConfig.SHOW_POWERED_BY': 'false',
      'interfaceConfig.HIDE_INVITE_MORE_HEADER': 'true',
      'interfaceConfig.MOBILE_APP_PROMO': 'false',
    }

    // Add config params to URL
    Object.entries(config).forEach(([key, value]) => {
      jitsiUrl.hash = `${jitsiUrl.hash}${jitsiUrl.hash ? '&' : ''}${key}=${value}`
    })

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

    const handleCopyLink = () => {
      const shareUrl = `https://${JITSI_DOMAIN}/${roomName}`
      navigator.clipboard.writeText(shareUrl)
    }

    const handleOpenInNewTab = () => {
      window.open(`https://${JITSI_DOMAIN}/${roomName}`, '_blank')
    }

    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h + 40 }}>
        <StandardizedToolWrapper
          title="Jeffsi Meet"
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
                minHeight: 0,
              }}
            >
              <iframe
                ref={iframeRef}
                src={jitsiUrl.toString()}
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
                allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
                referrerPolicy="no-referrer-when-downgrade"
                title="Jeffsi Meet Video Chat"
                loading="lazy"
                onError={(e) => {
                  console.error('Iframe loading error:', e);
                  setError(new Error('Failed to load video chat'));
                }}
              />
            </div>

            {/* Bottom Bar with Room Info and Actions */}
            <div
              style={{
                position: "absolute",
                bottom: "8px",
                left: "8px",
                right: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                zIndex: 1,
              }}
            >
              {/* Room Name */}
              <p
                style={{
                  margin: 0,
                  padding: "4px 8px",
                  background: "rgba(255, 255, 255, 0.9)",
                  borderRadius: "4px",
                  fontSize: "12px",
                  pointerEvents: "all",
                  cursor: "text",
                  userSelect: "text",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "60%",
                }}
              >
                Room: {roomName}
              </p>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  onClick={handleCopyLink}
                  style={{
                    padding: "4px 8px",
                    background: "rgba(255, 255, 255, 0.9)",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "11px",
                    cursor: "pointer",
                    pointerEvents: "all",
                  }}
                  title="Copy invite link"
                >
                  Copy Link
                </button>
                <button
                  onClick={handleOpenInNewTab}
                  style={{
                    padding: "4px 8px",
                    background: "rgba(255, 255, 255, 0.9)",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "11px",
                    cursor: "pointer",
                    pointerEvents: "all",
                  }}
                  title="Open in new tab"
                >
                  Pop Out
                </button>
              </div>
            </div>
          </div>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }
}
