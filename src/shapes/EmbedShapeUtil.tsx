import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"
import { useCallback, useState } from "react"
//import Embed from "react-embed"

export type IEmbedShape = TLBaseShape<
  "Embed",
  {
    w: number
    h: number
    url: string | null
    interactionState?: {
      scrollPosition?: { x: number; y: number }
      currentTime?: number // for videos
      // other state you want to sync
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
    // If it's already an embed URL, return as is
    if (url.includes("google.com/maps/embed")) {
      return url
    }

    // Handle directions
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

    // Extract place ID
    const placeMatch = url.match(/[?&]place_id=([^&]+)/)
    if (placeMatch) {
      return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2!2d0!3d0!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s${placeMatch[1]}!2s!5e0!3m2!1sen!2s!4v1`
    }

    // For all other map URLs
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
      // For tweets
      return `https://platform.x.com/embed/Tweet.html?id=${tweetId}`
    } else {
      // For profiles, return about:blank and handle display separately
      return "about:blank"
    }
  }

  // Medium - return about:blank to prevent iframe loading
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
  // YouTube default dimensions (16:9 ratio)
  if (url.match(/(?:youtube\.com|youtu\.be)/)) {
    return { w: 560, h: 315 }
  }

  // Twitter/X default dimensions
  if (url.match(/(?:twitter\.com|x\.com)/)) {
    if (url.match(/\/status\/|\/tweets\//)) {
      return { w: 500, h: 420 } // For individual tweets
    }
  }

  // Google Maps default dimensions
  if (url.includes("google.com/maps") || url.includes("goo.gl/maps")) {
    return { w: 600, h: 450 }
  }

  // Gather.town default dimensions
  if (url.includes("gather.town")) {
    return { w: 800, h: 600 }
  }

  // Default dimensions for other embeds
  return { w: 640, h: 480 }
}

export class EmbedShape extends BaseBoxShapeUtil<IEmbedShape> {
  static override type = "Embed"

  getDefaultProps(): IEmbedShape["props"] {
    return {
      url: null,
      w: 640,
      h: 480,
    }
  }

  indicator(shape: IEmbedShape) {
    return (
      <g>
        <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
      </g>
    )
  }

  component(shape: IEmbedShape) {
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)
    
    const [inputUrl, setInputUrl] = useState(shape.props.url || "")
    const [error, setError] = useState("")
    const [copyStatus, setCopyStatus] = useState(false)

    const handleSubmit = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault()
        let completedUrl =
          inputUrl.startsWith("http://") || inputUrl.startsWith("https://")
            ? inputUrl
            : `https://${inputUrl}`

        // Basic URL validation
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

    const wrapperStyle = {
      width: `${shape.props.w}px`,
      height: `${shape.props.h}px`,
      padding: "15px",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
      backgroundColor: "#F0F0F0",
      borderRadius: "4px",
    }

    const contentStyle = {
      pointerEvents: isSelected ? "none" as const : "all" as const,
      width: "100%",
      height: "100%",
      border: "1px solid #D3D3D3",
      backgroundColor: "#FFFFFF",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    }

    if (!shape.props.url) {
      return (
        <div style={wrapperStyle}>
          <div
            style={contentStyle}
            onClick={() => document.querySelector("input")?.focus()}
            onPointerDown={(e) => {
              e.preventDefault()
              document.querySelector("input")?.focus()
            }}
            onTouchStart={(e) => {
              e.preventDefault()
              document.querySelector("input")?.focus()
            }}
          >
            <form
              onSubmit={handleSubmit}
              style={{ width: "100%", height: "100%", padding: "10px" }}
            >
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Enter URL"
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  padding: "10px",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSubmit(e)
                  }
                }}
              />
              {error && (
                <div style={{ color: "red", marginTop: "10px" }}>{error}</div>
              )}
            </form>
          </div>
        </div>
      )
    }

    if (shape.props.url?.includes("medium.com")) {
      return (
        <div style={wrapperStyle}>
          <div
            style={{
              ...contentStyle,
              flexDirection: "column",
              gap: "12px",
              padding: "20px",
              textAlign: "center",
              pointerEvents: "all",
            }}
          >
            <p>
              Medium's content policy does not allow for embedding articles in
              iframes.
            </p>
            <a
              href={shape.props.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#1976d2",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              Open article in new tab →
            </a>
          </div>
        </div>
      )
    }

    if (
      shape.props.url &&
      shape.props.url.match(/(?:twitter\.com|x\.com)\/[^\/]+$/)
    ) {
      const username = shape.props.url.split("/").pop()
      return (
        <div style={wrapperStyle}>
          <div
            style={{
              ...contentStyle,
              flexDirection: "column",
              gap: "12px",
              padding: "20px",
              textAlign: "center",
              pointerEvents: "all",
            }}
          >
            <p>X (Twitter) does not support embedding profile timelines.</p>
            <a
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                window.top?.open(
                  shape.props.url || "",
                  "_blank",
                  "noopener,noreferrer",
                )
              }}
              href={shape.props.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#1976d2",
                textDecoration: "none",
                cursor: "pointer",
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              View @{username}'s profile in new tab →
            </a>
          </div>
        </div>
      )
    }

    return (
      <div style={wrapperStyle}>
        <div style={contentStyle}>
          <iframe
            src={transformUrl(shape.props.url)}
            width={shape.props.w}
            height={shape.props.h}
            style={{ border: "none" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={(e) => {
              // Only add listener if we have a valid iframe
              const iframe = e.currentTarget as HTMLIFrameElement
              if (!iframe) return;

              const messageHandler = (event: MessageEvent) => {
                if (event.source === iframe.contentWindow) {
                  handleIframeInteraction(event.data)
                }
              }

              window.addEventListener("message", messageHandler)
              
              // Clean up listener when iframe changes
              return () => window.removeEventListener("message", messageHandler)
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px",
            minHeight: "24px",
            fontSize: "12px",
            position: "absolute",
            bottom: "15px",
            left: "15px",
            right: "15px",
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            borderRadius: "4px",
          }}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              marginRight: "8px",
              color: "#666",
            }}
          >
            {shape.props.url}
          </span>
          <div
            style={{
              display: "flex",
              gap: "8px",
              pointerEvents: "all",
            }}
          >
            <button
              onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                try {
                  await navigator.clipboard.writeText(shape.props.url || "")
                  setCopyStatus(true)
                  setTimeout(() => setCopyStatus(false), 2000)
                } catch (err) {
                  console.error("Failed to copy:", err)
                }
              }}
              style={{
                border: "none",
                background: "transparent",
                color: "#1976d2",
                cursor: "pointer",
                padding: "0 4px",
                fontSize: "12px",
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {copyStatus ? "Copied" : "Copy link"}
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                window.top?.open(
                  shape.props.url || "",
                  "_blank",
                  "noopener,noreferrer",
                )
              }}
              style={{
                border: "none",
                background: "transparent",
                color: "#1976d2",
                cursor: "pointer",
                padding: "0 4px",
                fontSize: "12px",
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              Open in new tab ↗
            </button>
          </div>
        </div>
      </div>
    )
  }

  override onDoubleClick = (shape: IEmbedShape) => {
    // If no URL is set, focus the input field
    if (!shape.props.url) {
      const input = document.querySelector('input')
      input?.focus()
      return
    }

    // For Medium articles and Twitter profiles that show alternative content
    if (
      shape.props.url.includes('medium.com') ||
      (shape.props.url && shape.props.url.match(/(?:twitter\.com|x\.com)\/[^\/]+$/))
    ) {
      window.top?.open(shape.props.url, '_blank', 'noopener,noreferrer')
      return
    }

    // For other embeds, enable interaction by temporarily removing pointer-events: none
    const iframe = document.querySelector(`[data-shape-id="${shape.id}"] iframe`) as HTMLIFrameElement
    if (iframe) {
      iframe.style.pointerEvents = 'all'
      // Reset pointer-events after interaction
      const cleanup = () => {
        iframe.style.pointerEvents = 'none'
        window.removeEventListener('pointerdown', cleanup)
      }
      window.addEventListener('pointerdown', cleanup)
    }
  }

  // Add new method to handle all pointer interactions
  onPointerDown = (shape: IEmbedShape) => {
    if (!shape.props.url) {
      const input = document.querySelector('input')
      input?.focus()
    }
  }
}
