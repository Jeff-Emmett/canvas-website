import { useEditor } from "tldraw"
import { useSlides, useCurrentSlide, moveToSlide } from "../hooks/useSlide"

export function SlidesPanel() {
  const editor = useEditor()
  const slides = useSlides()
  const currentSlide = useCurrentSlide()

  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        height: "100%",
        width: "240px",
        background: "white",
        boxShadow: "-1px 0 0 rgba(0,0,0,.1)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "8px",
        overflowY: "auto",
      }}
    >
      <div style={{ fontWeight: "bold", padding: "8px" }}>
        Slides ({slides.length})
      </div>
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          style={{
            padding: "8px",
            cursor: "pointer",
            background: currentSlide === slide ? "#e0e0e0" : "transparent",
            borderRadius: "4px",
          }}
          onClick={() => moveToSlide(editor, slide)}
        >
          Slide {i + 1}
        </div>
      ))}
    </div>
  )
}
