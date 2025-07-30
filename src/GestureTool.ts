import { DEFAULT_GESTURES, ALT_GESTURES } from "@/default_gestures"
import { DollarRecognizer } from "@/gestures"
import {
	StateNode,
	TLDefaultSizeStyle,
	TLDrawShape,
	TLDrawShapeSegment,
	TLEventHandlers,
	TLHighlightShape,
	TLPointerEventInfo,
	TLShapePartial,
	TLTextShape,
	Vec,
	createShapeId,
	uniqueId,
} from "tldraw"

const STROKE_WIDTH = 10
const SHOW_LABELS = true
const PRESSURE = 0.5

export class GestureTool extends StateNode {
	static override id = "gesture"
	static override initial = "idle"
	static override children = () => [Idle, Drawing]
	static recognizer = new DollarRecognizer(DEFAULT_GESTURES)
	static recognizerAlt = new DollarRecognizer(ALT_GESTURES)

	override shapeType = "draw"

	override onExit = () => {
		const drawingState = this.children!.drawing as Drawing
		drawingState.initialShape = undefined
	}
}

export class Idle extends StateNode {
	static override id = "idle"
	
	tooltipElement?: HTMLDivElement
	tooltipTimeout?: NodeJS.Timeout
	mouseMoveHandler?: (e: MouseEvent) => void

	override onPointerDown: TLEventHandlers["onPointerDown"] = (info) => {
		this.parent.transition("drawing", info)
	}

	override onEnter = () => {
		this.editor.setCursor({ type: "cross", rotation: 0 })
		
		// Create tooltip element
		this.tooltipElement = document.createElement('div')
		this.tooltipElement.style.cssText = `
			position: fixed;
			background: rgba(0, 0, 0, 0.8);
			color: white;
			padding: 12px 16px;
			border-radius: 8px;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			font-size: 14px;
			line-height: 1.4;
			white-space: pre-line;
			z-index: 10000;
			pointer-events: none;
			max-width: 300px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
			border: 1px solid rgba(255, 255, 255, 0.1);
		`
		
		// Set tooltip content
		this.tooltipElement.innerHTML = `
			<strong>Gesture Tool Active</strong><br><br>
			<strong>Basic Gestures:</strong><br>
			• X, Rectangle, Circle, Check<br>
			• Caret, V, Delete, Pigtail<br><br>
			<strong>Shift + Draw:</strong><br>
			• Circle Layout, Triangle Layout<br><br>
			Press 'g' again or select another tool to exit
		`
		
		// Add tooltip to DOM
		document.body.appendChild(this.tooltipElement)
		
		// Function to update tooltip position
		this.mouseMoveHandler = (e: MouseEvent) => {
			if (this.tooltipElement) {
				const x = e.clientX + 20
				const y = e.clientY - 20
				
				// Keep tooltip within viewport bounds
				const rect = this.tooltipElement.getBoundingClientRect()
				const viewportWidth = window.innerWidth
				const viewportHeight = window.innerHeight
				
				let finalX = x
				let finalY = y
				
				// Adjust if tooltip would go off the right edge
				if (x + rect.width > viewportWidth) {
					finalX = e.clientX - rect.width - 20
				}
				
				// Adjust if tooltip would go off the bottom edge
				if (y + rect.height > viewportHeight) {
					finalY = e.clientY - rect.height - 20
				}
				
				// Ensure tooltip doesn't go off the top or left
				finalX = Math.max(10, finalX)
				finalY = Math.max(10, finalY)
				
				this.tooltipElement.style.left = `${finalX}px`
				this.tooltipElement.style.top = `${finalY}px`
			}
		}
		
		// Add mouse move listener
		document.addEventListener('mousemove', this.mouseMoveHandler)
		
		// Set initial position
		if (this.mouseMoveHandler) {
			this.mouseMoveHandler({ clientX: 100, clientY: 100 } as MouseEvent)
		}
		
		// Remove the tooltip after 5 seconds
		this.tooltipTimeout = setTimeout(() => {
			this.cleanupTooltip()
		}, 5000)
	}

	override onCancel = () => {
		this.editor.setCurrentTool("select")
	}
	
	override onExit = () => {
		this.cleanupTooltip()
	}
	
	private cleanupTooltip = () => {
		// Clear timeout
		if (this.tooltipTimeout) {
			clearTimeout(this.tooltipTimeout)
			this.tooltipTimeout = undefined
		}
		
		// Remove mouse move listener
		if (this.mouseMoveHandler) {
			document.removeEventListener('mousemove', this.mouseMoveHandler)
			this.mouseMoveHandler = undefined
		}
		
		// Remove tooltip element
		if (this.tooltipElement) {
			document.body.removeChild(this.tooltipElement)
			this.tooltipElement = undefined
		}
	}
}

type DrawableShape = TLDrawShape | TLHighlightShape

export class Drawing extends StateNode {
	static override id = "drawing"

	info = {} as TLPointerEventInfo

	initialShape?: DrawableShape

	override shapeType =
		this.parent.id === "highlight" ? ("highlight" as const) : ("draw" as const)

	util = this.editor.getShapeUtil(this.shapeType)

	isPen = false
	isPenOrStylus = false

	didJustShiftClickToExtendPreviousShapeLine = false

	pagePointWhereCurrentSegmentChanged = {} as Vec

	pagePointWhereNextSegmentChanged = null as Vec | null

	lastRecordedPoint = {} as Vec
	mergeNextPoint = false
	currentLineLength = 0

	canDraw = false

	markId = null as null | string

	override onEnter = (info: TLPointerEventInfo) => {
		this.markId = null
		this.info = info
		this.canDraw = !this.editor.getIsMenuOpen()
		this.lastRecordedPoint = this.editor.inputs.currentPagePoint.clone()
		if (this.canDraw) {
			this.startShape()
		}
	}

	onGestureEnd = () => {
		const shape = this.editor.getShape(this.initialShape?.id!) as TLDrawShape
		const ps = shape.props.segments[0].points.map((s) => ({ x: s.x, y: s.y }))
		const gesture = this.editor.inputs.shiftKey ? GestureTool.recognizerAlt.recognize(ps) : GestureTool.recognizer.recognize(ps)
		const score_pass = gesture.score > 0.2
		const score_confident = gesture.score > 0.65
		let score_color: "green" | "red" | "yellow" = "green"
		if (!score_pass) {
			score_color = "red"
		} else if (!score_confident) {
			score_color = "yellow"
		}
		if (score_pass) {
			gesture.onComplete?.(this.editor, shape)
		}
		let opacity = 1
		const labelShape: TLShapePartial<TLTextShape> = {
			id: createShapeId(),
			type: "text",
			x: this.editor.inputs.currentPagePoint.x + 20,
			y: this.editor.inputs.currentPagePoint.y,
			props: {
				size: "xl",
				text: gesture.name,
				color: score_color,
			},
		}
		if (SHOW_LABELS) {
			this.editor.createShape(labelShape)
		}
		const intervalId = setInterval(() => {
			if (opacity > 0) {
				this.editor.updateShape({
					...shape,
					opacity: opacity,
					props: {
						...shape.props,
						color: score_color,
					},
				})
				this.editor.updateShape({
					...labelShape,
					opacity: opacity,
					props: {
						...labelShape.props,
						color: score_color,
					},
				})
				opacity = Math.max(0, opacity - 0.025)
			} else {
				clearInterval(intervalId)
				this.editor.deleteShape(shape.id)
				if (SHOW_LABELS) {
					this.editor.deleteShape(labelShape.id)
				}
			}
		}, 20)
	}

	override onPointerMove: TLEventHandlers["onPointerMove"] = () => {
		const { inputs } = this.editor

		if (this.isPen && !inputs.isPen) {
			// The user made a palm gesture before starting a pen gesture;
			// ideally we'd start the new shape here but we could also just bail
			// as the next interaction will work correctly
			if (this.markId) {
				this.editor.bailToMark(this.markId)
				this.startShape()
				return
			}
		} else {
			// If we came in from a menu but have no started dragging...
			if (!this.canDraw && inputs.isDragging) {
				this.startShape()
				this.canDraw = true // bad name
			}
		}

		if (this.canDraw) {
			if (this.isPenOrStylus) {
				// Don't update the shape if we haven't moved far enough from the last time we recorded a point
				if (
					Vec.Dist(inputs.currentPagePoint, this.lastRecordedPoint) >=
					1 / this.editor.getZoomLevel()
				) {
					this.lastRecordedPoint = inputs.currentPagePoint.clone()
					this.mergeNextPoint = false
				} else {
					this.mergeNextPoint = true
				}
			} else {
				this.mergeNextPoint = false
			}

			this.updateDrawingShape()
		}
	}

	override onExit? = () => {
		this.onGestureEnd()
		this.editor.snaps.clearIndicators()
		this.pagePointWhereCurrentSegmentChanged =
			this.editor.inputs.currentPagePoint.clone()
	}

	canClose() {
		return this.shapeType !== "highlight"
	}

	getIsClosed(segments: TLDrawShapeSegment[]) {
		if (!this.canClose()) return false

		const strokeWidth = STROKE_WIDTH
		const firstPoint = segments[0].points[0]
		const lastSegment = segments[segments.length - 1]
		const lastPoint = lastSegment.points[lastSegment.points.length - 1]

		return (
			firstPoint !== lastPoint &&
			this.currentLineLength > strokeWidth * 4 &&
			Vec.DistMin(firstPoint, lastPoint, strokeWidth * 2)
		)
	}

	private startShape() {
		const {
			inputs: { originPagePoint },
		} = this.editor

		this.markId = this.editor.markHistoryStoppingPoint()

		this.didJustShiftClickToExtendPreviousShapeLine = false

		this.lastRecordedPoint = originPagePoint.clone()

		this.pagePointWhereCurrentSegmentChanged = originPagePoint.clone()
		const id = createShapeId()

		this.editor.createShapes<DrawableShape>([
			{
				id,
				type: this.shapeType,
				x: originPagePoint.x,
				y: originPagePoint.y,
				opacity: 0.5,
				props: {
					isPen: this.isPenOrStylus,
					segments: [
						{
							type: "free",
							points: [
								{
									x: 0,
									y: 0,
									z: PRESSURE,
								},
							],
						},
					],
				},
			},
		])
		this.currentLineLength = 0
		this.initialShape = this.editor.getShape<DrawableShape>(id)
	}

	private updateDrawingShape() {
		const { initialShape } = this
		const { inputs } = this.editor

		if (!initialShape) return

		const {
			id,
		} = initialShape

		const shape = this.editor.getShape<DrawableShape>(id)!

		if (!shape) return

		const { segments } = shape.props

		const { x, y, z } = this.editor
			.getPointInShapeSpace(shape, inputs.currentPagePoint)
			.toFixed()

		const newPoint = {
			x,
			y,
			z: this.isPenOrStylus ? +(z! * 1.25).toFixed(2) : 0.5,
		}

		const newSegments = segments.slice()
		const newSegment = newSegments[newSegments.length - 1]
		const newPoints = [...newSegment.points]

		if (newPoints.length && this.mergeNextPoint) {
			const { z } = newPoints[newPoints.length - 1]
			newPoints[newPoints.length - 1] = {
				x: newPoint.x,
				y: newPoint.y,
				z: z ? Math.max(z, newPoint.z) : newPoint.z,
			}
		} else {
			this.currentLineLength += Vec.Dist(
				newPoints[newPoints.length - 1],
				newPoint,
			)
			newPoints.push(newPoint)
		}

		newSegments[newSegments.length - 1] = {
			...newSegment,
			points: newPoints,
		}

		if (this.currentLineLength < STROKE_WIDTH * 4) {
			this.currentLineLength = this.getLineLength(newSegments)
		}

		const shapePartial: TLShapePartial<DrawableShape> = {
			id,
			type: this.shapeType,
			props: {
				segments: newSegments,
			},
		}

		if (this.canClose()) {
			; (shapePartial as TLShapePartial<TLDrawShape>).props!.isClosed =
				this.getIsClosed(newSegments)
		}

		this.editor.updateShapes([shapePartial])
	}

	private getLineLength(segments: TLDrawShapeSegment[]) {
		let length = 0

		for (const segment of segments) {
			for (let i = 0; i < segment.points.length - 1; i++) {
				const A = segment.points[i]
				const B = segment.points[i + 1]
				length += Vec.Dist2(B, A)
			}
		}

		return Math.sqrt(length)
	}

	override onPointerUp: TLEventHandlers["onPointerUp"] = () => {
		this.complete()
	}

	override onCancel: TLEventHandlers["onCancel"] = () => {
		this.cancel()
	}

	override onComplete: TLEventHandlers["onComplete"] = () => {
		this.complete()
	}

	override onInterrupt: TLEventHandlers["onInterrupt"] = () => {
		if (this.editor.inputs.isDragging) {
			return
		}

		if (this.markId) {
			this.editor.bailToMark(this.markId)
		}
		this.cancel()
	}

	complete() {
		if (!this.canDraw) {
			this.cancel()
			return
		}

		const { initialShape } = this
		if (!initialShape) return
		this.editor.updateShapes([
			{
				id: initialShape.id,
				type: initialShape.type,
				props: { isComplete: true },
			},
		])

		this.parent.transition("idle")
	}

	cancel() {
		this.parent.transition("idle", this.info)
	}
}