import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
  TLGeoShape,
  TLShape,
} from "tldraw"
import { getEdge } from "@/propagators/tlgraph"
import { llm, getApiKey } from "@/utils/llmUtils"
import { isShapeOfType } from "@/propagators/utils"
import React, { useState } from "react"

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

// Add this SVG copy icon component at the top level of the file
const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
  </svg>
)

export class PromptShape extends BaseBoxShapeUtil<IPrompt> {
  static override type = "Prompt" as const

  FIXED_HEIGHT = 500 as const
  MIN_WIDTH = 200 as const
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
      console.log("🎯 generateText called with prompt:", prompt);
      
      const conversationHistory = shape.props.value ? shape.props.value + '\n' : ''
      const escapedPrompt = prompt.replace(/[\\"]/g, '\\$&').replace(/\n/g, '\\n')
      const userMessage = `{"role": "user", "content": "${escapedPrompt}"}`
      
      console.log("💬 User message:", userMessage);
      console.log("📚 Conversation history:", conversationHistory);
      
      // Update with user message and trigger scroll
      this.editor.updateShape<IPrompt>({
        id: shape.id,
        type: "Prompt",
        props: { 
          value: conversationHistory + userMessage,
          agentBinding: "someone" 
        },
      })

      let fullResponse = ''

      console.log("🚀 Calling llm function...");
      try {
        await llm(prompt, (partial: string, done?: boolean) => {
          console.log(`📝 LLM callback received - partial: "${partial}", done: ${done}`);
          if (partial) {
            fullResponse = partial
            const escapedResponse = partial.replace(/[\\"]/g, '\\$&').replace(/\n/g, '\\n')
            const assistantMessage = `{"role": "assistant", "content": "${escapedResponse}"}`
            
            console.log("🤖 Assistant message:", assistantMessage);
            
            try {
              JSON.parse(assistantMessage)
              
              // Use requestAnimationFrame to ensure smooth scrolling during streaming
              requestAnimationFrame(() => {
                console.log("🔄 Updating shape with partial response...");
                this.editor.updateShape<IPrompt>({
                  id: shape.id,
                  type: "Prompt",
                  props: { 
                    value: conversationHistory + userMessage + '\n' + assistantMessage,
                    agentBinding: done ? null : "someone" 
                  },
                })
              })
            } catch (error) {
              console.error('❌ Invalid JSON message:', error)
            }
          }
        })
        console.log("✅ LLM function completed successfully");
      } catch (error) {
        console.error("❌ Error in LLM function:", error);
      }

      // Ensure the final message is saved after streaming is complete
      if (fullResponse) {
        console.log("💾 Saving final response:", fullResponse);
        const escapedResponse = fullResponse.replace(/[\\"]/g, '\\$&').replace(/\n/g, '\\n')
        const assistantMessage = `{"role": "assistant", "content": "${escapedResponse}"}`
        
        try {
          // Verify the final message is valid JSON before updating
          JSON.parse(assistantMessage)
          
          this.editor.updateShape<IPrompt>({
            id: shape.id,
            type: "Prompt",
            props: { 
              value: conversationHistory + userMessage + '\n' + assistantMessage,
              agentBinding: null 
            },
          })
          console.log("✅ Final response saved successfully");
        } catch (error) {
          console.error('❌ Invalid JSON in final message:', error)
        }
      }
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
              (sourceShape.meta as any)?.text || "",
            )
          }
        }
      }
      generateText(processedPrompt)
      this.editor.updateShape<IPrompt>({
        id: shape.id,
        type: "Prompt",
        props: { prompt: "" },
      })
    }

    // Add state for copy button text
    const [copyButtonText, setCopyButtonText] = React.useState("Copy Conversation")

    // In the component function, add state for tracking copy success
    const [isCopied, setIsCopied] = React.useState(false)

    // In the component function, update the state to track which message was copied
    const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null)

    // Add ref for the chat container
    const chatContainerRef = React.useRef<HTMLDivElement>(null)

    // Add function to scroll to bottom
    const scrollToBottom = () => {
      if (chatContainerRef.current) {
        // Use requestAnimationFrame for smooth scrolling
        requestAnimationFrame(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
          }
        })
      }
    }

    // Use both value and agentBinding as dependencies to catch all updates
    React.useEffect(() => {
      scrollToBottom()
    }, [shape.props.value, shape.props.agentBinding])

    const handleCopy = async () => {
      try {
        // Parse and format each message
        const messages = shape.props.value
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            try {
              const parsed = JSON.parse(line);
              return `${parsed.role}: ${parsed.content}`;
            } catch {
              return null;
            }
          })
          .filter(Boolean)
          .join('\n\n');

        await navigator.clipboard.writeText(messages);
        setCopyButtonText("Copied!");
        setTimeout(() => {
          setCopyButtonText("Copy Conversation");
        }, 2000);
      } catch (err) {
        console.error('Failed to copy text:', err);
        setCopyButtonText("Failed to copy");
        setTimeout(() => {
          setCopyButtonText("Copy Conversation");
        }, 2000);
      }
    };

    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)
    const [isHovering, setIsHovering] = useState(false)

    return (
      <HTMLContainer
        style={{
          borderRadius: 6,
          border: "1px solid lightgrey",
          padding: this.PADDING,
          height: this.FIXED_HEIGHT,
          width: shape.props.w,
          pointerEvents: isSelected || isHovering ? "all" : "none",
          backgroundColor: "#efefef",
          overflow: "visible",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "stretch",
          outline: shape.props.agentBinding ? "2px solid orange" : "none",
        }}
        //TODO: FIX SCROLL IN PROMPT CHAT WHEN HOVERING OVER ELEMENT
        onPointerEnter={() => setIsHovering(true)}
        onPointerLeave={() => setIsHovering(false)}
        onWheel={(e) => {
          if (isSelected || isHovering) {
            e.preventDefault()
            e.stopPropagation()
            
            if (chatContainerRef.current) {
              chatContainerRef.current.scrollTop += e.deltaY
            }
          }
        }}
      >
        <div
          ref={chatContainerRef}
          style={{
            padding: "4px 8px",
            flex: 1,
            backgroundColor: "white",
            borderRadius: "4px",
            marginBottom: "4px",
            fontSize: "14px",
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            pointerEvents: isSelected || isHovering ? "all" : "none",
          }}
        >
          {shape.props.value ? (
            shape.props.value.split('\n').map((message, index) => {
              if (!message.trim()) return null;
              try {
                const parsed = JSON.parse(message);
                const isUser = parsed.role === "user";
                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                      margin: '8px 0',
                      maxWidth: '100%',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 16px',
                        maxWidth: '80%',
                        backgroundColor: isUser ? '#007AFF' : '#f0f0f0',
                        color: isUser ? 'white' : 'black',
                        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      }}
                    >
                      {parsed.content}
                      <button
                        style={{
                          position: 'absolute',
                          bottom: '-20px',
                          right: isUser ? '0' : 'auto',
                          left: isUser ? 'auto' : '0',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                          color: '#666',
                          opacity: 0.7,
                          transition: 'opacity 0.2s',
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation()
                        }}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(parsed.content)
                            setCopiedIndex(index)
                            setTimeout(() => {
                              setCopiedIndex(null)
                            }, 2000)
                          } catch (err) {
                            console.error('Failed to copy text:', err)
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.7'
                        }}
                      >
                        {copiedIndex === index ? <CheckIcon /> : <CopyIcon />}
                      </button>
                    </div>
                  </div>
                );
              } catch {
                return null; // Skip invalid JSON
              }
            })
          ) : (
            "Chat history will appear here..."
          )}
        </div>
        <div style={{ 
          display: "flex", 
          flexDirection: "column",
          gap: "5px",
          marginTop: "auto",
          pointerEvents: isSelected || isHovering ? "all" : "none",
        }}>
          <div style={{ 
            display: "flex", 
            gap: "5px" 
          }}>
            <input
              style={{
                width: "100%",
                height: "40px",
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handlePrompt()
                }
              }}
            />
            <button
              style={{
                width: 100,
                height: "40px",
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
          </div>
          <button
            style={{
              width: "100%",
              height: "30px",
              pointerEvents: "all",
              backgroundColor: "#f0f0f0",
              border: "1px solid #ddd",
              borderRadius: "4px",
              cursor: "pointer",
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
            }}
            onClick={handleCopy}
          >
            {copyButtonText}
          </button>
        </div>
      </HTMLContainer>
    )
  }

  // Override the default indicator behavior
  // TODO: FIX SECOND INDICATOR UX GLITCH
  override indicator(shape: IPrompt) {
    return (
      <rect
        width={shape.props.w}
        height={this.FIXED_HEIGHT}
        rx={6}
      />
    )
  }
}
