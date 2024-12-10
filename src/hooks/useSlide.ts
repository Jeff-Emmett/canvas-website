import { EASINGS, Editor, atom, useEditor, useValue } from "tldraw"
import { TLFrameShape } from "tldraw"

// Create an atom for current slide state
export const $currentSlide = atom<TLFrameShape | null>("current slide", null)

// Function to move to a specific slide
export function moveToSlide(editor: Editor, frame: TLFrameShape) {
  const bounds = editor.getShapePageBounds(frame.id)
  if (!bounds) return

  $currentSlide.set(frame)
  editor.selectNone()
  editor.zoomToBounds(bounds, {
    animation: { duration: 500, easing: EASINGS.easeInOutCubic },
    inset: 0,
  })
}

// Hook to get all slides (frames)
export function useSlides() {
  const editor = useEditor()
  return useValue<TLFrameShape[]>("frame shapes", () => getSlides(editor), [
    editor,
  ])
}

// Hook to get current slide
export function useCurrentSlide() {
  return useValue($currentSlide)
}

// Helper to get all slides
export function getSlides(editor: Editor) {
  return editor
    .getSortedChildIdsForParent(editor.getCurrentPageId())
    .map((id) => editor.getShape(id))
    .filter((s): s is TLFrameShape => s?.type === "frame")
}
