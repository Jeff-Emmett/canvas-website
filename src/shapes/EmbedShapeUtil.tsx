import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"
import { useCallback, useState } from "react"
//import Embed from "react-embed"

export type IEmbedShape = TLBaseShape<
  "Embed",
  {
    w: number
    h: number
    url: string | null
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
  const tweetMatch = url.match(/(?:twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/)
  if (tweetMatch) {
    return `https://platform.x.com/embed/Tweet.html?id=${tweetMatch[1]}`
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

    const wrapperStyle = {
      width: `${shape.props.w}px`,
      height: `${shape.props.h}px`,
      padding: "15px",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
      backgroundColor: "#F0F0F0",
      borderRadius: "4px",
    }

    const contentStyle = {
      pointerEvents: "all" as const,
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
}
