import CommandPalette, { filterItems, getItemIndex } from "react-cmdk"
import { Fragment, useEffect, useState } from "react"
import {
	Editor,
	TLShape,
	TLShapeId,
	unwrapLabel,
	useActions,
	useEditor,
	useLocalStorageState,
	useTranslation,
	useValue,
} from "tldraw"
// import { generateText } from "@/utils/llmUtils"
import "@/css/style.css"

function toNearest(n: number, places = 2) {
	return Math.round(n * 10 ** places) / 10 ** places
}

interface SimpleShape {
	type: string
	x: number
	y: number
	rotation: string
	properties: unknown
}

function simplifiedShape(editor: Editor, shape: TLShape): SimpleShape {
	const bounds = editor.getShapePageBounds(shape.id)
	return {
		type: shape.type,
		x: toNearest(shape.x),
		y: toNearest(shape.y),
		rotation: `${toNearest(shape.rotation, 3)} radians`,
		properties: {
			...shape.props,
			w: toNearest(bounds?.width || 0),
			h: toNearest(bounds?.height || 0),
		},
	}
}

export const CmdK = () => {
	const editor = useEditor()
	const actions = useActions()
	const trans = useTranslation()

	const [inputRefs, setInputRefs] = useState<Set<string>>(new Set())
	const [response, setResponse] = useLocalStorageState("response", "")
	const [open, setOpen] = useState<boolean>(false)
	const [input, setInput] = useLocalStorageState("input", "")
	const [page, setPage] = useLocalStorageState<"search" | "llm">(
		"page",
		"search",
	)

	const availableRefs = useValue<Map<string, TLShapeId[]>>(
		"avaiable refs",
		() => {
			const nameToShapeIdMap = new Map<string, TLShapeId[]>(
				editor
					.getCurrentPageShapes()
					.filter((shape) => shape.meta.name)
					.map((shape) => [shape.meta.name as string, [shape.id]]),
			)

			const selected = editor.getSelectedShapeIds()
			let inView: TLShapeId[] = []
			try {
				inView = editor
					.getShapesAtPoint(editor.getViewportPageBounds().center, {
						margin: 1200,
					})
					.map((o) => o.id)
			} catch (e) {
				// Some shapes may have invalid geometry (e.g., zero-length arrows)
				// Fall back to getting all shapes on the current page
				console.warn('getShapesAtPoint failed, falling back to all page shapes:', e)
				inView = editor.getCurrentPageShapeIds() as unknown as TLShapeId[]
			}

			return new Map([
				...nameToShapeIdMap,
				["selected", selected],
				["here", inView],
			])
		},
		[editor],
	)

	/** Track the shapes we are referencing in the input */
	useEffect(() => {
		const namesInInput = input
			.split(" ")
			.filter((name) => name.startsWith("@"))
			.map((name) => name.slice(1).match(/^[a-zA-Z0-9]+/)?.[0])
			.filter(Boolean)

		setInputRefs(new Set(namesInInput as string[]))
	}, [input])

	/** Handle keyboard shortcuts for Opening and closing the command bar in search/llm mode */
	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === " " && (e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				e.stopPropagation()
				setPage("search")
				setOpen(true)
			}
			if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				e.stopPropagation()
				setPage("llm")
				setOpen(true)
			}
		}

		document.addEventListener("keydown", down)
		return () => document.removeEventListener("keydown", down)
	}, [setPage])

	const menuItems = filterItems(
		[
			{
				heading: "Actions",
				id: "actions",
				items: Object.entries(actions).map(([key, action]) => ({
					id: key,
					children: trans(unwrapLabel(action.label)),
					onClick: () => action.onSelect("unknown"),
					itemType: "foobar",
				})),
			},
			{
				heading: "Other",
				id: "other",
				items: [
					{
						id: "llm",
						children: "LLM",
						icon: "ArrowRightOnRectangleIcon",
						closeOnSelect: false,
						onClick: () => {
							setInput("")
							setPage("llm")
						},
					},
				],
			},
		],
		input,
	)

	type ContextItem =
		| { name: string; shape: SimpleShape; shapes?: never }
		| { name: string; shape?: never; shapes: SimpleShape[] }

	const handlePromptSubmit = () => {
		const cleanedPrompt = input.trim()
		const context: ContextItem[] = []

		for (const name of inputRefs) {
			if (!availableRefs.has(name)) continue
			const shapes = availableRefs.get(name)?.map((id) => editor.getShape(id))
			if (!shapes || shapes.length < 1) continue

			if (shapes.length === 1) {
				const contextShape: SimpleShape = simplifiedShape(editor, shapes[0]!)
				context.push({ name, shape: contextShape })
			} else {
				const contextShapes: SimpleShape[] = []
				for (const shape of shapes) {
					contextShapes.push(simplifiedShape(editor, shape!))
				}
				context.push({ name, shapes: contextShapes })
			}
		}

		const systemPrompt = `You are a helpful assistant. Respond in plaintext.
		
		Context:
		${JSON.stringify(context)}
		`

		setResponse("🤖...")
		// generateText(cleanedPrompt, systemPrompt, (partialResponse, _) => {
		// 	setResponse(partialResponse)
		// })
	}

	const ContextPrefix = ({ inputRefs }: { inputRefs: Set<string> }) => {
		return inputRefs.size > 0 ? (
			<span>Ask with: </span>
		) : (
			<span style={{ opacity: 0.5 }}>No references</span>
		)
	}

	const LLMView = () => {
		return (
			<>
				<CommandPalette.ListItem
					className="references"
					index={0}
					showType={false}
					onClick={handlePromptSubmit}
					closeOnSelect={false}
				>
					<ContextPrefix inputRefs={inputRefs} />
					{Array.from(inputRefs).map((name, index, array) => {
						const refShapeIds = availableRefs.get(name)
						if (!refShapeIds) return null
						return (
							<Fragment key={name}>
								<span
									className={refShapeIds ? "reference" : "reference-missing"}
									onKeyDown={() => {}}
									onClick={(e) => {
										e.stopPropagation()
										e.preventDefault()
										if (!refShapeIds) return
										editor.setSelectedShapes(refShapeIds)
										editor.zoomToSelection({
											animation: {
												duration: 200,
												easing: (t: number) => t * t * (3 - 2 * t),
											},
										})
									}}
								>
									{name}
								</span>
								{index < array.length - 1 && (
									<span style={{ marginLeft: "0em" }}>,</span>
								)}
							</Fragment>
						)
					})}
				</CommandPalette.ListItem>

				{response && (
					<>
						<CommandPalette.ListItem
							disabled={true}
							className="llm-response"
							index={1}
							showType={false}
						>
							{response}
						</CommandPalette.ListItem>
					</>
				)}
			</>
		)
	}

	const SearchView = () => {
		return (
			<>
				{menuItems.length ? (
					menuItems.map((list) => (
						<CommandPalette.List key={list.id} heading={list.heading}>
							{list.items.map(({ id, ...rest }) => (
								<CommandPalette.ListItem
									key={id}
									index={getItemIndex(menuItems, id)}
									{...rest}
								/>
							))}
						</CommandPalette.List>
					))
				) : (
					<CommandPalette.FreeSearchAction label="Search for" />
				)}
			</>
		)
	}

	return (
		<CommandPalette
			placeholder={page === "search" ? "Search..." : "Ask..."}
			onChangeSearch={setInput}
			onChangeOpen={setOpen}
			search={input}
			isOpen={open}
			page={page}
		>
			<CommandPalette.Page id="search">
				<SearchView />
			</CommandPalette.Page>
			<CommandPalette.Page id="llm">
				<LLMView />
			</CommandPalette.Page>
		</CommandPalette>
	)
}