import { EASINGS, Editor, atom, useEditor, useValue } from 'tldraw'
import { ISlideShape } from '@/shapes/SlideShapeUtil'

export const $currentSlide = atom<ISlideShape | null>('current slide', null)

export function moveToSlide(editor: Editor, slide: ISlideShape) {
	const bounds = editor.getShapePageBounds(slide.id)
	if (!bounds) return
	$currentSlide.set(slide)
	editor.selectNone()
	editor.zoomToBounds(bounds, {
		animation: { duration: 500, easing: EASINGS.easeInOutCubic },
		inset: 0,
	})
}

export function useSlides() {
	const editor = useEditor()
	return useValue<ISlideShape[]>('slide shapes', () => getSlides(editor), [editor])
}

export function useCurrentSlide() {
	return useValue($currentSlide)
}

export function getSlides(editor: Editor) {
	return editor
		.getSortedChildIdsForParent(editor.getCurrentPageId())
		.map((id) => editor.getShape(id))
		.filter((s) => s?.type === 'Slide') as ISlideShape[]
}
