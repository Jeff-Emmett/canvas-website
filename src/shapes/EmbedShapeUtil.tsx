import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer } from "tldraw"
import { useCallback, useState } from "react"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"
import { usePinnedToView } from "../hooks/usePinnedToView"

export type IEmbedShape = TLBaseShape<
  "Embed",
  {
    w: number
    h: number
    url: string | null
    pinnedToView: boolean
    tags: string[]
    interactionState?: {
      scrollPosition?: { x: number; y: number }
      currentTime?: number
    }
  }
>

const transformUrl = (url: string): string => {
  // YouTube
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
  )
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`
  }

  // Google Maps
  if (url.includes("google.com/maps") || url.includes("goo.gl/maps")) {
    if (url.includes("google.com/maps/embed")) {
      return url
    }

    const directionsMatch = url.match(/dir\/([^\/]+)\/([^\/]+)/)
    if (directionsMatch || url.includes("/dir/")) {
      const origin = url.match(/origin=([^&]+)/)?.[1] || directionsMatch?.[1]
      const destination =
        url.match(/destination=([^&]+)/)?.[1] || directionsMatch?.[2]

      if (origin && destination) {
        return `https://www.google.com/maps/embed/v1/directions?key=${
          import.meta.env["VITE_GOOGLE_MAPS_API_KEY"]
        }&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(
          destination,
        )}&mode=driving`
      }
    }

    const placeMatch = url.match(/[?&]place_id=([^&]+)/)
    if (placeMatch) {
      return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2!2d0!3d0!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s${placeMatch[1]}!2s!5e0!3m2!1sen!2s!4v1`
    }

    return `https://www.google.com/maps/embed/v1/place?key=${
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    }&q=${encodeURIComponent(url)}`
  }

  // Twitter/X
  const xMatch = url.match(
    /(?:twitter\.com|x\.com)\/([^\/\s?]+)(?:\/(?:status|tweets)\/(\d+)|$)/,
  )
  if (xMatch) {
    const [, username, tweetId] = xMatch
    if (tweetId) {
      return `https://platform.x.com/embed/Tweet.html?id=${tweetId}`
    } else {
      return "about:blank"
    }
  }

  // Medium - return about:blank
  if (url.includes("medium.com")) {
    return "about:blank"
  }

  // Gather.town
  if (url.includes("app.gather.town")) {
    return url.replace("app.gather.town", "gather.town/embed")
  }

  return url
}

const getDefaultDimensions = (url: string): { w: number; h: number } => {
  if (url.match(/(?:youtube\.com|youtu\.be)/)) {
    return { w: 800, h: 450 }
  }

  if (url.match(/(?:twitter\.com|x\.com)/)) {
    if (url.match(/\/status\/|\/tweets\//)) {
      return { w: 800, h: 600 }
    }
  }

  if (url.includes("google.com/maps") || url.includes("goo.gl/maps")) {
    return { w: 800, h: 600 }
  }

  if (url.includes("gather.town")) {
    return { w: 800, h: 600 }
  }

  return { w: 800, h: 600 }
}

const getFaviconUrl = (url: string): string => {
  try {
    const urlObj = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`
  } catch {
    return ''
  }
}

const getDisplayTitle = (url: string): string => {
  try {
    const urlObj = new URL(url)
    if (urlObj.hostname.includes('youtube.com')) {
      return 'YouTube'
    }
    if (urlObj.hostname.includes('twitter.com') || urlObj.hostname.includes('x.com')) {
      return 'Twitter/X'
    }
    if (urlObj.hostname.includes('google.com/maps')) {
      return 'Google Maps'
    }
    return urlObj.hostname.replace('www.', '')
  } catch {
    return url
  }
}

export class EmbedShape extends BaseBoxShapeUtil<IEmbedShape> {
  static override type = "Embed"

  // Embed theme color: Yellow (Rainbow)
  static readonly PRIMARY_COLOR = "#eab308"

  getDefaultProps(): IEmbedShape["props"] {
    return {
      url: null,
      w: 800,
      h: 600,
      pinnedToView: false,
      tags: ['embed'],
    }
  }

  indicator(shape: IEmbedShape) {
    return (
      <rect
        x={0}
        y={0}
        width={shape.props.w}
        height={shape.props.h}
        fill="none"
      />
    )
  }

  component(shape: IEmbedShape) {
    const props = shape.props || {}
    const url = props.url || ""
    const [isMinimized, setIsMinimized] = useState(false)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    const [inputUrl, setInputUrl] = useState(url)
    const [error, setError] = useState("")

    // Use the pinning hook
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    const handleClose = () => {
      this.editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<IEmbedShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    const handleSubmit = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault()
        let completedUrl =
          inputUrl.startsWith("http://") || inputUrl.startsWith("https://")
            ? inputUrl
            : `https://${inputUrl}`

        const isValidUrl = completedUrl.match(/(^\w+:|^)\/\//)
        if (!isValidUrl) {
          setError("Invalid URL")
          return
        }

        this.editor.updateShape<IEmbedShape>({
          id: shape.id,
          type: "Embed",
          props: { ...shape.props, url: completedUrl },
        })
        setError("")
      },
      [inputUrl],
    )

    const handleIframeInteraction = (
      newState: typeof shape.props.interactionState,
    ) => {
      this.editor.updateShape<IEmbedShape>({
        id: shape.id,
        type: "Embed",
        props: {
          ...shape.props,
          interactionState: newState,
        },
      })
    }

    // Custom header content with URL info
    const headerContent = url ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
        <img
          src={getFaviconUrl(url)}
          alt=""
          style={{
            width: "16px",
            height: "16px",
            flexShrink: 0,
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: '13px',
          fontWeight: 600
        }}>
          {getDisplayTitle(url)}
        </span>
      </div>
    ) : (
      <span>Embed</span>
    )

    // For empty state - URL input form
    if (!url) {
      return (
        <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
          <StandardizedToolWrapper
            title="Embed"
            primaryColor={EmbedShape.PRIMARY_COLOR}
            isSelected={isSelected}
            width={shape.props.w}
            height={shape.props.h}
            onClose={handleClose}
            onMinimize={handleMinimize}
            isMinimized={isMinimized}
            editor={this.editor}
            shapeId={shape.id}
            isPinnedToView={shape.props.pinnedToView}
            onPinToggle={handlePinToggle}
            tags={shape.props.tags}
            onTagsChange={(newTags) => {
              this.editor.updateShape<IEmbedShape>({
                id: shape.id,
                type: 'Embed',
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
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                padding: '20px',
                cursor: 'text',
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const input = e.currentTarget.querySelector('input')
                input?.focus()
              }}
            >
              <form
                onSubmit={handleSubmit}
                style={{
                  width: "100%",
                  maxWidth: "500px",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="Enter URL to embed..."
                  style={{
                    width: "100%",
                    padding: "15px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "16px",
                    touchAction: 'manipulation',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSubmit(e)
                    }
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    e.currentTarget.focus()
                  }}
                />
                {error && (
                  <div style={{ color: "red", marginTop: "10px", textAlign: 'center' }}>{error}</div>
                )}
              </form>
            </div>
          </StandardizedToolWrapper>
        </HTMLContainer>
      )
    }

    // For medium.com and twitter profile views
    if (url.includes("medium.com") ||
        (url && url.match(/(?:twitter\.com|x\.com)\/[^\/]+$/))) {
      return (
        <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
          <StandardizedToolWrapper
            title="Embed"
            headerContent={headerContent}
            primaryColor={EmbedShape.PRIMARY_COLOR}
            isSelected={isSelected}
            width={shape.props.w}
            height={shape.props.h}
            onClose={handleClose}
            onMinimize={handleMinimize}
            isMinimized={isMinimized}
            editor={this.editor}
            shapeId={shape.id}
            isPinnedToView={shape.props.pinnedToView}
            onPinToggle={handlePinToggle}
            tags={shape.props.tags}
            onTagsChange={(newTags) => {
              this.editor.updateShape<IEmbedShape>({
                id: shape.id,
                type: 'Embed',
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
                display: 'flex',
                flexDirection: "column",
                gap: "12px",
                padding: "20px",
                textAlign: "center",
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <p>
                This content cannot be embedded in an iframe.
              </p>
              <button
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: EmbedShape.PRIMARY_COLOR,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  touchAction: 'manipulation',
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                Open in new tab →
              </button>
            </div>
          </StandardizedToolWrapper>
        </HTMLContainer>
      )
    }

    // For normal embed view
    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
        <StandardizedToolWrapper
          title="Embed"
          headerContent={headerContent}
          primaryColor={EmbedShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={shape.props.w}
          height={shape.props.h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          editor={this.editor}
          shapeId={shape.id}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          tags={shape.props.tags}
          onTagsChange={(newTags) => {
            this.editor.updateShape<IEmbedShape>({
              id: shape.id,
              type: 'Embed',
              props: {
                ...shape.props,
                tags: newTags,
              }
            })
          }}
          tagsEditable={true}
        >
          <div style={{
            height: '100%',
            overflow: 'hidden',
            backgroundColor: '#fff',
          }}>
            <iframe
              src={transformUrl(url)}
              width="100%"
              height="100%"
              style={{
                border: "none",
                display: 'block',
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={(e) => {
                const iframe = e.currentTarget as HTMLIFrameElement
                if (!iframe) return;

                const messageHandler = (event: MessageEvent) => {
                  if (event.source === iframe.contentWindow) {
                    handleIframeInteraction(event.data)
                  }
                }

                window.addEventListener("message", messageHandler)

                return () => window.removeEventListener("message", messageHandler)
              }}
            />
          </div>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  override onDoubleClick = (shape: IEmbedShape) => {
    if (!shape.props.url) {
      const input = document.querySelector('input')
      input?.focus()
      return
    }

    if (
      shape.props.url.includes('medium.com') ||
      (shape.props.url && shape.props.url.match(/(?:twitter\.com|x\.com)\/[^\/]+$/))
    ) {
      window.top?.open(shape.props.url, '_blank', 'noopener,noreferrer')
      return
    }

    const iframe = document.querySelector(`[data-shape-id="${shape.id}"] iframe`) as HTMLIFrameElement
    if (iframe) {
      iframe.style.pointerEvents = 'all'
      const cleanup = () => {
        iframe.style.pointerEvents = 'none'
        window.removeEventListener('pointerdown', cleanup)
      }
      window.addEventListener('pointerdown', cleanup)
    }
  }

  onPointerDown = (shape: IEmbedShape) => {
    if (!shape.props.url) {
      const input = document.querySelector('input')
      input?.focus()
    }
  }

  override onBeforeCreate = (shape: IEmbedShape) => {
    if (shape.props.url) {
      const dimensions = getDefaultDimensions(shape.props.url)
      return {
        ...shape,
        props: {
          ...shape.props,
          w: dimensions.w,
          h: dimensions.h,
        },
      }
    }
    return shape
  }

  override onBeforeUpdate = (prev: IEmbedShape, next: IEmbedShape) => {
    if (next.props.url && prev.props.url !== next.props.url) {
      const dimensions = getDefaultDimensions(next.props.url)
      return {
        ...next,
        props: {
          ...next.props,
          w: dimensions.w,
          h: dimensions.h,
        },
      }
    }
    return next
  }
}
