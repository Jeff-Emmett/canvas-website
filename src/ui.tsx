import { CSSProperties, useEffect, useRef, useState } from "react"
import {
	TLComponents,
	useEditor,
	useValue,
	stopEventPropagation,
	TLUiOverrides,
	TLUiActionsContextType,
	TLDrawShape,
	TLShapePartial,
} from "tldraw"
import { DollarRecognizer } from "@/gestures"
import { DEFAULT_GESTURES } from "@/default_gestures"

export const overrides: TLUiOverrides = {
	tools(editor, tools) {
		return {
			...tools,
			gesture: {
				id: "gesture",
				name: "Gesture",
				icon: "👆",
				label: "Gesture",
				onSelect: () => {
					editor.setCurrentTool("gesture")
				},
			},
		}
	},
	actions(editor, actions): TLUiActionsContextType {
		const R = new DollarRecognizer(DEFAULT_GESTURES)
		return {
			...actions,
			recognize: {
				id: "recognize",
				kbd: "c",
				onSelect: () => {
					const onlySelectedShape = editor.getOnlySelectedShape()
					if (!onlySelectedShape || onlySelectedShape.type !== "draw") return
					const verts = editor.getShapeGeometry(onlySelectedShape).vertices
					const result = R.recognize(verts)
				},
			},
			addGesture: {
				id: "addGesture",
				kbd: "x",
				onSelect: () => {
					const onlySelectedShape = editor.getOnlySelectedShape()
					if (!onlySelectedShape || onlySelectedShape.type !== "draw") return
					const name = onlySelectedShape.meta.name
					if (!name) return
					const points = editor.getShapeGeometry(onlySelectedShape).vertices
					R.addGesture(name as string, points)
				},
			},
			recognizeAndSnap: {
				id: "recognizeAndSnap",
				kbd: "z",
				onSelect: () => {
					const onlySelectedShape = editor.getOnlySelectedShape()
					if (!onlySelectedShape || onlySelectedShape.type !== "draw") return
					const points = editor.getShapeGeometry(onlySelectedShape).vertices
					const result = R.recognize(points)
					const newShape: TLShapePartial<TLDrawShape> = {
						...onlySelectedShape,
						type: "draw",
						props: {
							...onlySelectedShape.props,
							segments: [
								{
									points: R.unistrokes
										.find((u) => u.name === result.name)
										?.originalPoints() || [],
									type: "free",
								},
							],
						},
					}
					editor.animateShape(newShape)
				},
			},
		}
	},
}

export const components: TLComponents = {
	OnTheCanvas: () => {
		const editor = useEditor()
		const inputRef = useRef<HTMLInputElement>(null)
		const [shouldFocus, setShouldFocus] = useState(false)
		const onlySelectedShape = useValue(
			"onlySelectedShape",
			() => editor.getOnlySelectedShape(),
			[editor],
		)
		const isInSelectMode = useValue(
			"isInSelectMode",
			() => editor.isIn("select"),
			[editor],
		)

		useEffect(() => {
			if (shouldFocus) {
				inputRef.current?.focus()
				setShouldFocus(false)
			}
		}, [shouldFocus])

		if (!isInSelectMode) return null

		const shapes = editor.getRenderingShapes()
		return shapes.map((_shape, i) => {
			const shape = editor.getShape(_shape.id)
			const isSelected = editor.getOnlySelectedShapeId() === shape?.id

			const offset = 35
			const x = shape?.x! - offset * Math.sin(-shape?.rotation!)
			const y = shape?.y! - offset * Math.cos(shape?.rotation!)

			const labelStyle: CSSProperties = {
				fontFamily: "Inter, sans-serif",
				position: "absolute",
				top: 0,
				left: 0,
				transformOrigin: "top left",
				transform: `translate(${x}px, ${y}px) rotate(${shape?.rotation}rad)`,
				pointerEvents: "all",
				opacity: 0.8,
				fontSize: "1.2rem",
			}

			const inputStyle: CSSProperties = {
				fontFamily: "Inter, sans-serif",
				fontSize: "1.2rem",
				backgroundColor: "transparent",
				padding: 0,
				margin: 0,
				border: "none",
				outline: "none",
			}

			const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
				const newValue = event.target.value
				if (/^[a-z0-9]+$/i.test(newValue) || newValue === "") {
					editor.updateShape({
						...onlySelectedShape!,
						meta: {
							...onlySelectedShape!.meta,
							name: newValue,
						},
					})
				}
			}

			if (isSelected) {
				return (
					<div
						key={`${shape.id}-${i}`}
						style={labelStyle}
						onPointerDown={stopEventPropagation}
					>
						<span style={{ display: "flex", alignItems: "center" }}>
							<span>@</span>
							<input
								ref={inputRef}
								style={inputStyle}
								type="text"
								placeholder="name"
								onChange={handleNameChange}
								value={(onlySelectedShape?.meta?.name as string) ?? ""}
							/>
						</span>
					</div>
				)
			}
			return (
				<div
					onClick={() => {
						editor.setSelectedShapes([shape?.id!])
						setShouldFocus(true)
					}}
					onKeyDown={() => {}}
					style={labelStyle}
					key={`${shape?.id}-${i}`}
				>
					{shape?.meta?.name && `@${shape?.meta.name}`}
				</div>
			)
		})
	},
}