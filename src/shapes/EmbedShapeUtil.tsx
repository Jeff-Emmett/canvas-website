import { BaseBoxShapeUtil, TLBaseShape } from "tldraw"
import { useCallback, useState } from "react"

export type IEmbedShape = TLBaseShape<
  "Embed",
  {
    w: number
    h: number
    url: string | null
  }
>

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

    const handleSubmit = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault()
        let completedUrl =
          inputUrl.startsWith("http://") || inputUrl.startsWith("https://")
            ? inputUrl
            : `https://${inputUrl}`

        // Handle YouTube links
        if (
          completedUrl.includes("youtube.com") ||
          completedUrl.includes("youtu.be")
        ) {
          const videoId = extractYouTubeVideoId(completedUrl)
          if (videoId) {
            completedUrl = `https://www.youtube.com/embed/${videoId}`
          } else {
            setError("Invalid YouTube URL")
            return
          }
        }

        // Handle Google Docs links
        if (completedUrl.includes("docs.google.com")) {
          const docId = completedUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1]
          if (docId) {
            completedUrl = `https://docs.google.com/document/d/${docId}/preview`
          } else {
            setError("Invalid Google Docs URL")
            return
          }
        }

        this.editor.updateShape<IEmbedShape>({
          id: shape.id,
          type: "Embed",
          props: { ...shape.props, url: completedUrl },
        })

        // Check if the URL is valid
        const isValidUrl = completedUrl.match(/(^\w+:|^)\/\//)
        if (!isValidUrl) {
          setError("Invalid website URL")
        } else {
          setError("")
        }
      },
      [inputUrl],
    )

    const extractYouTubeVideoId = (url: string): string | null => {
      const regExp =
        /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
      const match = url.match(regExp)
      return match && match[2].length === 11 ? match[2] : null
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

    return (
      <div style={wrapperStyle}>
        <div style={contentStyle}>
          <iframe
            src={shape.props.url}
            width="100%"
            height="100%"
            style={{ border: "none" }}
            allowFullScreen
          />
        </div>
      </div>
    )
  }
}
