import {
  BaseBoxShapeUtil,
  Geometry2d,
  HTMLContainer,
  Rectangle2d,
  TLBaseShape,
  TLGeoShape,
  TLShape,
  createShapeId,
} from "tldraw"
import { getEdge } from "@/propagators/tlgraph"
import { llm, getApiKey } from "@/utils/llmUtils"
import { AI_PERSONALITIES } from "@/lib/settings"
import { isShapeOfType } from "@/propagators/utils"
import { findNonOverlappingPosition } from "@/utils/shapeCollisionUtils"
import React, { useState } from "react"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"
import { usePinnedToView } from "../hooks/usePinnedToView"
import { useMaximize } from "../hooks/useMaximize"

type IPrompt = TLBaseShape<
  "Prompt",
  {
    w: number
    h: number
    prompt: string
    value: string
    agentBinding: string | null
    personality?: string
    error?: string | null
    pinnedToView: boolean
    tags: string[]
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

  // LLM Prompt theme color: Pink/Magenta (Rainbow)
  static readonly PRIMARY_COLOR = "#ec4899"

  FIXED_HEIGHT = 500 as const
  MIN_WIDTH = 200 as const
  PADDING = 4 as const

  getDefaultProps(): IPrompt["props"] {
    return {
      w: 300,
      h: this.FIXED_HEIGHT,
      prompt: "",
      value: "",
      agentBinding: null,
      pinnedToView: false,
      tags: ['llm', 'prompt'],
    }
  }

  // Override getGeometry to ensure the selector box always matches the rendered component height
  getGeometry(shape: IPrompt): Geometry2d {
    // isFilled must be true for proper hit testing and nearestPoint calculation
    return new Rectangle2d({
      width: Math.max(shape.props.w, 1),
      height: Math.max(shape.props.h, this.FIXED_HEIGHT, 1),
      isFilled: true,
    })
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
    // Ensure shape props exist with defaults
    const props = shape.props || {}
    const prompt = props.prompt || ""
    const value = props.value || ""
    const agentBinding = props.agentBinding || ""
    
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
      
      // Clear any previous errors
      this.editor.updateShape<IPrompt>({
        id: shape.id,
        type: "Prompt",
        props: { 
          error: null
        },
      })
      
      const conversationHistory = shape.props.value ? shape.props.value + '\n' : ''
      const escapedPrompt = prompt.replace(/[\\"]/g, '\\$&').replace(/\n/g, '\\n')
      const userMessage = `{"role": "user", "content": "${escapedPrompt}"}`
      
      
      // Update with user message and trigger scroll
      this.editor.updateShape<IPrompt>({
        id: shape.id,
        type: "Prompt",
        props: { 
          value: conversationHistory + userMessage,
          agentBinding: "someone",
          error: null
        },
      })

      let fullResponse = ''

      try {
        await llm(prompt, (partial: string, done?: boolean) => {
          if (partial) {
            fullResponse = partial
            const escapedResponse = partial.replace(/[\\"]/g, '\\$&').replace(/\n/g, '\\n')
            const assistantMessage = `{"role": "assistant", "content": "${escapedResponse}"}`
            
            
            try {
              JSON.parse(assistantMessage)
              
              // Use requestAnimationFrame to ensure smooth scrolling during streaming
              requestAnimationFrame(() => {
                this.editor.updateShape<IPrompt>({
                  id: shape.id,
                  type: "Prompt",
                  props: { 
                    value: conversationHistory + userMessage + '\n' + assistantMessage,
                    agentBinding: done ? null : "someone",
                    error: null
                  },
                })
              })
            } catch (error) {
              console.error('❌ Invalid JSON message:', error)
            }
          }
        }, shape.props.personality)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("❌ Error in LLM function:", errorMessage);
        
        // Display error to user
        const userFriendlyError = errorMessage.includes('No valid API key') 
          ? '❌ No valid API key found. Please configure your API keys in settings.'
          : errorMessage.includes('All AI providers failed')
          ? '❌ All API keys failed. Please check your API keys in settings.'
          : errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('Unauthorized')
          ? '❌ API key authentication failed. Your API key may be expired or invalid. Please check your API keys in settings.'
          : `❌ Error: ${errorMessage}`;
        
        this.editor.updateShape<IPrompt>({
          id: shape.id,
          type: "Prompt",
          props: { 
            agentBinding: null,
            error: userFriendlyError
          },
        })
      }

      // Ensure the final message is saved after streaming is complete
      if (fullResponse) {
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
              agentBinding: null,
              error: null // Clear any errors on success
            },
          })
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
    const [copyButtonText, setCopyButtonText] = React.useState("Copy Conversation to Knowledge Object")

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
              return `**${parsed.role === 'user' ? 'User' : 'Assistant'}:**\n${parsed.content}`;
            } catch {
              return null;
            }
          })
          .filter(Boolean)
          .join('\n\n---\n\n');

        // Format the conversation as markdown content
        const conversationContent = `# Conversation History\n\n${messages}`;

        // Get the prompt shape's position to place the new shape nearby
        const promptShapeBounds = this.editor.getShapePageBounds(shape.id);
        const baseX = promptShapeBounds ? promptShapeBounds.x + promptShapeBounds.w + 20 : shape.x + shape.props.w + 20;
        const baseY = promptShapeBounds ? promptShapeBounds.y : shape.y;

        // Find a non-overlapping position for the new ObsNote shape
        const shapeWidth = 300;
        const shapeHeight = 200;
        const position = findNonOverlappingPosition(
          this.editor,
          baseX,
          baseY,
          shapeWidth,
          shapeHeight
        );

        // Create a new ObsNote shape with the conversation content
        const obsNoteShape = this.editor.createShape({
          type: 'ObsNote',
          x: position.x,
          y: position.y,
          props: {
            w: shapeWidth,
            h: shapeHeight,
            color: 'black',
            size: 'm',
            font: 'sans',
            textAlign: 'start',
            scale: 1,
            noteId: createShapeId(),
            title: 'Conversation History',
            content: conversationContent,
            tags: ['#conversation', '#llm'],
            showPreview: true,
            backgroundColor: '#ffffff',
            textColor: '#000000',
            isEditing: false,
            editingContent: '',
            isModified: false,
            originalContent: conversationContent,
          }
        });

        // Select the newly created shape
        this.editor.setSelectedShapes([`shape:${obsNoteShape.id}`] as any);

        setCopyButtonText("Created!");
        setTimeout(() => {
          setCopyButtonText("Copy Conversation to Knowledge Object");
        }, 2000);
      } catch (err) {
        console.error('Failed to create knowledge object:', err);
        setCopyButtonText("Failed to create");
        setTimeout(() => {
          setCopyButtonText("Copy Conversation to Knowledge Object");
        }, 2000);
      }
    };

    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)
    const [isHovering, setIsHovering] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)

    // Use the pinning hook
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    // Use the maximize hook for fullscreen functionality
    const { isMaximized, toggleMaximize } = useMaximize({
      editor: this.editor,
      shapeId: shape.id,
      currentW: shape.props.w,
      currentH: shape.props.h,
      shapeType: 'Prompt',
    })

    const handleClose = () => {
      this.editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<IPrompt>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
        <StandardizedToolWrapper
          title="LLM Prompt"
          primaryColor={PromptShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={shape.props.w}
          height={shape.props.h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          onMaximize={toggleMaximize}
          isMaximized={isMaximized}
          editor={this.editor}
          shapeId={shape.id}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          tags={shape.props.tags}
          onTagsChange={(newTags) => {
            this.editor.updateShape<IPrompt>({
              id: shape.id,
              type: 'Prompt',
              props: {
                ...shape.props,
                tags: newTags,
              }
            })
          }}
          tagsEditable={true}
        >
          <div
            style={{
              height: '100%',
              width: '100%',
              padding: this.PADDING,
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
          {shape.props.error && (
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "#fee",
                border: "1px solid #fcc",
                borderRadius: "8px",
                color: "#c33",
                marginBottom: "8px",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "18px" }}>⚠️</span>
              <span>{shape.props.error}</span>
              <button
                onClick={() => {
                  this.editor.updateShape<IPrompt>({
                    id: shape.id,
                    type: "Prompt",
                    props: { error: null },
                  })
                }}
                style={{
                  marginLeft: "auto",
                  padding: "4px 8px",
                  backgroundColor: "#fcc",
                  border: "1px solid #c99",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "11px",
                }}
              >
                Dismiss
              </button>
            </div>
          )}
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
          {/* AI Personality Selector */}
          <div style={{ 
            display: "flex", 
            flexDirection: "column",
            gap: "3px",
            marginBottom: "5px"
          }}>
            <label style={{ 
              fontSize: "12px", 
              fontWeight: "500", 
              color: "#666",
              marginBottom: "2px"
            }}>
              AI Personality:
            </label>
            <select
              value={shape.props.personality || 'web-developer'}
              onChange={(e) => {
                this.editor.updateShape<IPrompt>({
                  id: shape.id,
                  type: "Prompt",
                  props: { personality: e.target.value },
                })
              }}
              style={{
                padding: "4px 8px",
                border: "1px solid rgba(0, 0, 0, 0.1)",
                borderRadius: "4px",
                fontSize: "12px",
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                cursor: "pointer",
                height: "28px"
              }}
            >
              {AI_PERSONALITIES.map((personality) => (
                <option key={personality.id} value={personality.id}>
                  {personality.name}
                </option>
              ))}
            </select>
          </div>
          
          <div style={{ 
            display: "flex", 
            gap: "5px",
            position: "relative",
            zIndex: 1000,
            pointerEvents: "all",
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
                padding: "0 8px",
                position: "relative",
                zIndex: 1000,
                pointerEvents: "all",
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
                e.stopPropagation()
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (shape.props.prompt.trim() && !shape.props.agentBinding) {
                    handlePrompt()
                  }
                }
              }}
              onPointerDown={(e) => {
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.stopPropagation()
              }}
              onFocus={(e) => {
                e.stopPropagation()
              }}
            />
            <button
              style={{
                width: 100,
                height: "40px",
                pointerEvents: "all",
                cursor: shape.props.prompt.trim() && !shape.props.agentBinding ? "pointer" : "not-allowed",
                backgroundColor: shape.props.prompt.trim() && !shape.props.agentBinding ? "#007AFF" : "#ccc",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontWeight: "500",
                position: "relative",
                zIndex: 1000,
                opacity: shape.props.prompt.trim() && !shape.props.agentBinding ? 1 : 0.6,
              }}
              onPointerDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                if (shape.props.prompt.trim() && !shape.props.agentBinding) {
                  handlePrompt()
                }
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (shape.props.prompt.trim() && !shape.props.agentBinding) {
                  handlePrompt()
                }
              }}
              type="button"
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
        </div>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  // Override the default indicator behavior to match the actual rendered size
  override indicator(shape: IPrompt) {
    // Use Math.max to ensure the indicator covers the full component height
    // This handles both new shapes (h = FIXED_HEIGHT) and old shapes (h might be smaller)
    return (
      <rect
        width={shape.props.w}
        height={Math.max(shape.props.h, this.FIXED_HEIGHT)}
        rx={6}
      />
    )
  }
}
