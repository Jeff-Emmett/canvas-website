import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
  TLGeoShape,
  TLShape,
} from "tldraw"
import { getEdge } from "@/propagators/tlgraph"
import { llm } from "@/utils/llmUtils"
import { isShapeOfType } from "@/propagators/utils"

type IPrompt = TLBaseShape<
  "Prompt",
  {
    w: number
    h: number
    prompt: string
    value: string
    agentBinding: string | null
  }
>

export class PromptShape extends BaseBoxShapeUtil<IPrompt> {
  static override type = "Prompt" as const

  FIXED_HEIGHT = 50 as const
  MIN_WIDTH = 150 as const
  PADDING = 4 as const

  getDefaultProps(): IPrompt["props"] {
    return {
      w: 300,
      h: 50,
      prompt: "",
      value: "",
      agentBinding: null,
    }
  }

  // override onResize: TLResizeHandle<IPrompt> = (
  // 	shape,
  // 	{ scaleX, initialShape },
  // ) => {
  // 	const { x, y } = shape
  // 	const w = initialShape.props.w * scaleX
  // 	return {
  // 		x,
  // 		y,
  // 		props: {
  // 			...shape.props,
  // 			w: Math.max(Math.abs(w), this.MIN_WIDTH),
  // 			h: this.FIXED_HEIGHT,
  // 		},
  // 	}
  // }

  component(shape: IPrompt) {
    const arrowBindings = this.editor.getBindingsInvolvingShape(
      shape.id,
      "arrow",
    )
    const arrows = arrowBindings.map((binding) =>
      this.editor.getShape(binding.fromId),
    )

    const inputMap = arrows.reduce((acc, arrow) => {
      const edge = getEdge(arrow, this.editor)
      if (edge) {
        const sourceShape = this.editor.getShape(edge.from)
        if (sourceShape && edge.text) {
          acc[edge.text] = sourceShape
        }
      }
      return acc
    }, {} as Record<string, TLShape>)

     const generateText = async (prompt: string) => {
      await llm(prompt, (partial: string, done: boolean) => {
        console.log("DONE??", done)
        this.editor.updateShape<IPrompt>({
          id: shape.id,
          type: "Prompt",
          props: { value: partial, agentBinding: done ? null : "someone" },
        })
      })
    }

    const handlePrompt = () => {
      if (shape.props.agentBinding) {
        return
      }
      let processedPrompt = shape.props.prompt
      for (const [key, sourceShape] of Object.entries(inputMap)) {
        const pattern = `{${key}}`
        if (processedPrompt.includes(pattern)) {
          if (isShapeOfType<TLGeoShape>(sourceShape, "geo")) {
            processedPrompt = processedPrompt.replace(
              pattern,
              sourceShape.props.text,
            )
          }
        }
      }
      //console.log(processedPrompt)
      generateText(processedPrompt)
    }

    return (
      <HTMLContainer
        style={{
          borderRadius: 6,
          border: "1px solid lightgrey",
          padding: this.PADDING,
          height: this.FIXED_HEIGHT,
          width: shape.props.w,
          pointerEvents: "all",
          backgroundColor: "#efefef",
          overflow: "visible",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          outline: shape.props.agentBinding ? "2px solid orange" : "none",
        }}
      >
        <input
          style={{
            width: "100%",
            height: "100%",
            overflow: "visible",
            backgroundColor: "rgba(0, 0, 0, 0.05)",
            border: "1px solid rgba(0, 0, 0, 0.05)",
            borderRadius: 6 - this.PADDING,
            fontSize: 16,
          }}
          type="text"
          placeholder="Enter prompt..."
          value={shape.props.prompt}
          onChange={(text) => {
            this.editor.updateShape<IPrompt>({
              id: shape.id,
              type: "Prompt",
              props: { prompt: text.target.value },
            })
          }}
        />
        <button
          style={{
            width: 100,
            height: "100%",
            marginLeft: 5,
            pointerEvents: "all",
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
          }}
          type="button"
          onClick={handlePrompt}
        >
          Prompt
        </button>
      </HTMLContainer>
    )
  }

  indicator(shape: IPrompt) {
    return <rect width={shape.props.w} height={shape.props.h} rx={5} />
  }
}
