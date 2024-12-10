import { useCallback, useEffect } from "react"
import { useEditor } from "tldraw"
import { useSlides, useCurrentSlide, moveToSlide } from "../hooks/useSlide"

export function SlideControls() {
  const editor = useEditor()
  const slides = useSlides()
  const currentSlide = useCurrentSlide()

  const currentIndex = currentSlide ? slides.indexOf(currentSlide) : -1

  const nextSlide = useCallback(() => {
    if (currentIndex < slides.length - 1) {
      moveToSlide(editor, slides[currentIndex + 1])
    }
  }, [editor, slides, currentIndex])

  const previousSlide = useCallback(() => {
    if (currentIndex > 0) {
      moveToSlide(editor, slides[currentIndex - 1])
    }
  }, [editor, slides, currentIndex])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextSlide()
      if (e.key === "ArrowLeft") previousSlide()
    },
    [nextSlide, previousSlide],
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  if (slides.length === 0) return null

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        background: "white",
        padding: "8px 16px",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        display: "flex",
        gap: "8px",
        alignItems: "center",
      }}
    >
      <button onClick={previousSlide} disabled={currentIndex === 0}>
        ←
      </button>
      <div>
        {currentIndex + 1} / {slides.length}
      </div>
      <button onClick={nextSlide} disabled={currentIndex === slides.length - 1}>
        →
      </button>
    </div>
  )
}
