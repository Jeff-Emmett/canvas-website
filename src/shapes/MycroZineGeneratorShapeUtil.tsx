import {
  BaseBoxShapeUtil,
  Geometry2d,
  HTMLContainer,
  Rectangle2d,
  TLBaseShape,
  TLShapeId,
  createShapeId,
} from "tldraw"
import React, { useState, useRef, useEffect } from "react"
import { StandardizedToolWrapper } from "@/components/StandardizedToolWrapper"
import { usePinnedToView } from "@/hooks/usePinnedToView"
import { useMaximize } from "@/hooks/useMaximize"
// Uses zine.jeffemmett.com API for full zine generation workflow:
// - /api/outline - AI-generated 8-page outlines via Gemini
// - /api/generate-page - Individual page image generation via RunPod
// - /api/regenerate-page - Page regeneration with feedback
// - /api/print-layout - 300 DPI print-ready layout generation

const ZINE_API_BASE = 'https://zine.jeffemmett.com'

// ============================================================================
// Types
// ============================================================================

type ZinePhase = 'ideation' | 'drafts' | 'feedback' | 'finalizing' | 'complete'

type ZineStyle = 'punk-zine' | 'minimal' | 'collage' | 'retro' | 'academic'
type ZineTone = 'rebellious' | 'playful' | 'informative' | 'poetic'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface ZinePageOutline {
  pageNumber: number // 1-8
  type: 'cover' | 'content' | 'cta'
  title: string
  subtitle?: string
  keyPoints: string[]
  hashtags: string[]
  imagePrompt: string
}

interface GeneratedZinePage {
  pageNumber: number
  imageUrl: string
  shapeId?: string // Canvas shape ID if spawned
  outline: ZinePageOutline
  generationPrompt: string
  timestamp: number
  version: number // 1=draft, 2+=refined
}

interface PageFeedback {
  pageNumber: number
  feedbackText: string
  requestedChanges: string[]
  approved: boolean
}

interface ZineTemplate {
  id: string
  name: string
  topic: string
  style: ZineStyle
  tone: ZineTone
  pages: GeneratedZinePage[]
  createdAt: number
}

type IMycroZineGenerator = TLBaseShape<
  "MycroZineGenerator",
  {
    w: number
    h: number

    // Zine Identity
    zineId: string
    title: string
    topic: string
    style: ZineStyle
    tone: ZineTone

    // Phase State
    phase: ZinePhase

    // Ideation Phase
    ideationMessages: ChatMessage[]
    contentOutline: ZinePageOutline[] | null

    // Drafts Phase
    draftPages: GeneratedZinePage[]
    spawnedShapeIds: string[]
    currentGeneratingPage: number // 0 = not generating, 1-8 = generating that page

    // Feedback Phase
    pageFeedback: PageFeedback[]

    // Final Phase
    finalPages: GeneratedZinePage[]
    printLayoutUrl: string | null

    // UI State
    isLoading: boolean
    error: string | null
    tags: string[]
    pinnedToView: boolean
  }
>

// ============================================================================
// Constants
// ============================================================================

const STYLES: Record<ZineStyle, string> = {
  'punk-zine': 'Xerox texture, high contrast B&W, DIY collage, hand-drawn typography',
  'minimal': 'Clean lines, white space, modern sans-serif, subtle gradients',
  'collage': 'Layered imagery, mixed media textures, vintage photographs',
  'retro': '1970s aesthetic, earth tones, groovy typography, halftone patterns',
  'academic': 'Diagram-heavy, annotated illustrations, infographic elements',
}

const TONES: Record<ZineTone, string> = {
  'rebellious': 'Defiant, anti-establishment, punk energy',
  'playful': 'Fun, whimsical, approachable',
  'informative': 'Educational, clear, accessible',
  'poetic': 'Lyrical, metaphorical, evocative',
}

const PAGE_TEMPLATES = [
  { type: 'cover', description: 'Bold title, subtitle, visual hook' },
  { type: 'content', description: 'Key concepts with visual explanations' },
  { type: 'content', description: 'Deep dive on main topic' },
  { type: 'content', description: 'Supporting information' },
  { type: 'content', description: 'Practical applications' },
  { type: 'content', description: 'Community or movement aspect' },
  { type: 'content', description: 'Philosophy or manifesto' },
  { type: 'cta', description: 'Call-to-action with QR codes' },
]

// ============================================================================
// Shape Util
// ============================================================================

export class MycroZineGeneratorShape extends BaseBoxShapeUtil<IMycroZineGenerator> {
  static override type = "MycroZineGenerator" as const

  // Mycro-zine theme color: Punk green
  static readonly PRIMARY_COLOR = "#00ff00"
  static readonly SECONDARY_COLOR = "#1a1a1a"

  MIN_WIDTH = 400 as const
  MIN_HEIGHT = 500 as const
  DEFAULT_WIDTH = 450 as const
  DEFAULT_HEIGHT = 600 as const

  getDefaultProps(): IMycroZineGenerator["props"] {
    return {
      w: this.DEFAULT_WIDTH,
      h: this.DEFAULT_HEIGHT,

      zineId: `zine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: '',
      topic: '',
      style: 'punk-zine',
      tone: 'rebellious',

      phase: 'ideation',

      ideationMessages: [],
      contentOutline: null,

      draftPages: [],
      spawnedShapeIds: [],
      currentGeneratingPage: 0,

      pageFeedback: [],

      finalPages: [],
      printLayoutUrl: null,

      isLoading: false,
      error: null,
      tags: ['zine', 'mycrozine', 'print'],
      pinnedToView: false,
    }
  }

  getGeometry(shape: IMycroZineGenerator): Geometry2d {
    return new Rectangle2d({
      width: Math.max(shape.props.w, 1),
      height: Math.max(shape.props.h, 1),
      isFilled: true,
    })
  }

  component(shape: IMycroZineGenerator) {
    const editor = this.editor
    const isSelected = editor.getSelectedShapeIds().includes(shape.id)

    usePinnedToView(editor, shape.id, shape.props.pinnedToView)

    const { isMaximized, toggleMaximize } = useMaximize({
      editor: editor,
      shapeId: shape.id,
      currentW: shape.props.w,
      currentH: shape.props.h,
      shapeType: 'MycroZineGenerator',
    })

    const [isMinimized, setIsMinimized] = useState(false)
    const [inputValue, setInputValue] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Scroll to bottom of messages
    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [shape.props.ideationMessages])

    const handlePinToggle = () => {
      editor.updateShape<IMycroZineGenerator>({
        id: shape.id,
        type: "MycroZineGenerator",
        props: { pinnedToView: !shape.props.pinnedToView },
      })
    }

    const handleClose = () => {
      editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handleTagsChange = (newTags: string[]) => {
      editor.updateShape<IMycroZineGenerator>({
        id: shape.id,
        type: "MycroZineGenerator",
        props: { tags: newTags },
      })
    }

    // Update shape props helper
    const updateProps = (updates: Partial<IMycroZineGenerator["props"]>) => {
      editor.updateShape<IMycroZineGenerator>({
        id: shape.id,
        type: "MycroZineGenerator",
        props: updates,
      })
    }

    // Add a chat message
    const addMessage = (role: 'user' | 'assistant', content: string) => {
      const newMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role,
        content,
        timestamp: Date.now(),
      }
      updateProps({
        ideationMessages: [...shape.props.ideationMessages, newMessage],
      })
      return newMessage
    }

    // Generate content outline from ideation using AI API
    const generateOutline = async () => {
      if (!shape.props.topic) {
        updateProps({ error: 'Please enter a topic first' })
        return
      }

      updateProps({ isLoading: true, error: null })

      try {
        // Call the standalone zine API for AI-generated outline
        const response = await fetch(`${ZINE_API_BASE}/api/outline`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: shape.props.topic,
            style: shape.props.style,
            tone: shape.props.tone,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as { error?: string }
          throw new Error(errorData.error || `API error: ${response.status}`)
        }

        const data = await response.json() as {
          id: string
          outline: Array<{
            pageNumber: number
            type: string
            title: string
            keyPoints: string[]
            imagePrompt: string
          }>
        }

        // Convert API response to our outline format
        const outline: ZinePageOutline[] = data.outline.map((page) => ({
          pageNumber: page.pageNumber,
          type: page.type as 'cover' | 'content' | 'cta',
          title: page.title,
          subtitle: undefined,
          keyPoints: page.keyPoints,
          hashtags: [],
          imagePrompt: page.imagePrompt,
        }))

        // Store the zine ID from the API for later use
        const newZineId = data.id

        // Add assistant message with outline summary
        addMessage('assistant', `Great! I've created an AI-generated outline for your "${shape.props.topic}" zine:\n\n${outline.map(p => `Page ${p.pageNumber}: ${p.title}\n  • ${p.keyPoints.slice(0, 2).join('\n  • ')}`).join('\n\n')}\n\nClick "Generate Drafts" when you're ready to create the pages!`)

        updateProps({
          zineId: newZineId,
          contentOutline: outline,
          title: outline[0]?.title || shape.props.topic.toUpperCase(),
          isLoading: false,
        })
      } catch (err) {
        console.error('Outline generation error:', err)
        updateProps({
          isLoading: false,
          error: `Failed to generate outline: ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    }

    // Handle user message in ideation phase
    const handleSendMessage = async () => {
      const message = inputValue.trim()
      if (!message) return

      setInputValue('')
      addMessage('user', message)

      // If this is the first message and no topic set, use it as topic
      if (!shape.props.topic && shape.props.ideationMessages.length === 0) {
        updateProps({ topic: message })

        // Auto-respond
        setTimeout(() => {
          addMessage('assistant', `Let's create an 8-page zine about "${message}"!\n\nI'll use the ${shape.props.style} style with a ${shape.props.tone} tone.\n\nFeel free to:\n• Add more details about what to cover\n• Specify any key points or themes\n• Change the style/tone using the dropdowns\n\nOr click "Generate Outline" to proceed!`)
        }, 500)
      } else {
        // Continue conversation
        setTimeout(() => {
          addMessage('assistant', `Got it! I'll incorporate that into the zine. ${shape.props.contentOutline ? 'Ready to generate drafts!' : 'Click "Generate Outline" when ready.'}`)
        }, 500)
      }
    }

    // Generate draft pages using the standalone zine API
    const generateDrafts = async () => {
      if (!shape.props.contentOutline) {
        await generateOutline()
        if (!shape.props.contentOutline) return
      }

      updateProps({
        phase: 'drafts',
        isLoading: true,
        error: null,
        currentGeneratingPage: 1,
      })

      const outline = shape.props.contentOutline!
      const zineId = shape.props.zineId
      const generatedPages: GeneratedZinePage[] = []

      for (let i = 0; i < outline.length; i++) {
        const pageOutline = outline[i]
        updateProps({ currentGeneratingPage: i + 1 })

        try {
          // Call the standalone zine API for page generation
          const response = await fetch(`${ZINE_API_BASE}/api/generate-page`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              zineId: zineId,
              pageNumber: i + 1,
              outline: pageOutline,
              style: shape.props.style,
              tone: shape.props.tone,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({})) as { error?: string }
            throw new Error(errorData.error || `API error: ${response.status}`)
          }

          const data = await response.json() as { pageNumber: number; imageUrl: string; success: boolean }

          // Use the API-returned image URL
          const imageUrl = `${ZINE_API_BASE}${data.imageUrl}`

          generatedPages.push({
            pageNumber: i + 1,
            imageUrl,
            outline: pageOutline,
            generationPrompt: pageOutline.imagePrompt,
            timestamp: Date.now(),
            version: 1,
          })

          // Spawn image on canvas
          const spawnedId = await spawnPageOnCanvas(editor, imageUrl, i, shape)
          if (spawnedId) {
            generatedPages[generatedPages.length - 1].shapeId = spawnedId
          }

          updateProps({ draftPages: [...generatedPages] })
        } catch (err) {
          console.error(`Failed to generate page ${i + 1}:`, err)
          updateProps({
            error: `Failed to generate page ${i + 1}: ${err instanceof Error ? err.message : String(err)}`,
          })
          // Continue with remaining pages even if one fails
        }
      }

      // Initialize feedback for all pages
      const initialFeedback: PageFeedback[] = outline.map((_, i) => ({
        pageNumber: i + 1,
        feedbackText: '',
        requestedChanges: [],
        approved: false,
      }))

      updateProps({
        draftPages: generatedPages,
        pageFeedback: initialFeedback,
        spawnedShapeIds: generatedPages.map(p => p.shapeId).filter(Boolean) as string[],
        isLoading: false,
        currentGeneratingPage: 0,
        phase: generatedPages.length === 8 ? 'feedback' : 'drafts',
      })
    }

    // Approve a page
    const approvePage = (pageNumber: number) => {
      const newFeedback = shape.props.pageFeedback.map(f =>
        f.pageNumber === pageNumber ? { ...f, approved: true } : f
      )
      updateProps({ pageFeedback: newFeedback })
    }

    // Add feedback to a page
    const addPageFeedback = (pageNumber: number, feedback: string) => {
      const newFeedback = shape.props.pageFeedback.map(f =>
        f.pageNumber === pageNumber
          ? { ...f, feedbackText: feedback, requestedChanges: [feedback] }
          : f
      )
      updateProps({ pageFeedback: newFeedback })
    }

    // Check if all pages are approved or have feedback
    const allPagesReviewed = shape.props.pageFeedback.every(
      f => f.approved || f.feedbackText.length > 0
    )

    // Move to finalization - regenerate pages with feedback using API
    const startFinalization = async () => {
      const pagesNeedingUpdate = shape.props.pageFeedback.filter(f => !f.approved && f.feedbackText)

      if (pagesNeedingUpdate.length === 0) {
        // All approved, skip to complete
        updateProps({
          phase: 'complete',
          finalPages: shape.props.draftPages,
        })
        return
      }

      updateProps({
        phase: 'finalizing',
        isLoading: true,
        error: null,
      })

      const finalPages = [...shape.props.draftPages]
      const zineId = shape.props.zineId

      for (const feedback of pagesNeedingUpdate) {
        updateProps({ currentGeneratingPage: feedback.pageNumber })

        try {
          const originalPage = shape.props.draftPages.find(p => p.pageNumber === feedback.pageNumber)
          if (!originalPage) continue

          // Call the standalone API to regenerate with feedback
          const response = await fetch(`${ZINE_API_BASE}/api/regenerate-page`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              zineId: zineId,
              pageNumber: feedback.pageNumber,
              currentOutline: originalPage.outline,
              feedback: feedback.feedbackText,
              style: shape.props.style,
              tone: shape.props.tone,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({})) as { error?: string }
            throw new Error(errorData.error || `API error: ${response.status}`)
          }

          const data = await response.json() as {
            imageUrl: string
            updatedOutline: ZinePageOutline
          }

          const imageUrl = `${ZINE_API_BASE}${data.imageUrl}`

          finalPages[feedback.pageNumber - 1] = {
            ...originalPage,
            imageUrl,
            outline: data.updatedOutline || originalPage.outline,
            generationPrompt: data.updatedOutline?.imagePrompt || originalPage.generationPrompt,
            timestamp: Date.now(),
            version: originalPage.version + 1,
          }
        } catch (err) {
          console.error(`Failed to regenerate page ${feedback.pageNumber}:`, err)
          updateProps({
            error: `Failed to regenerate page ${feedback.pageNumber}: ${err instanceof Error ? err.message : String(err)}`,
          })
        }
      }

      updateProps({
        finalPages,
        isLoading: false,
        currentGeneratingPage: 0,
        phase: 'complete',
      })
    }

    // Generate print layout using the standalone API (300 DPI, proper folding order)
    const generatePrintLayout = async () => {
      updateProps({ isLoading: true, error: null })

      try {
        const zineId = shape.props.zineId
        const zineName = (shape.props.title || shape.props.topic).slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')

        // Call the standalone API for print layout generation
        const response = await fetch(`${ZINE_API_BASE}/api/print-layout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zineId: zineId,
            zineName: zineName,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as { error?: string }
          throw new Error(errorData.error || `API error: ${response.status}`)
        }

        const data = await response.json() as {
          success: boolean
          printLayoutUrl: string
          filename: string
        }

        const printUrl = `${ZINE_API_BASE}${data.printLayoutUrl}`

        updateProps({
          printLayoutUrl: printUrl,
          isLoading: false,
        })

        addMessage('assistant', `🖨️ Print layout generated at 300 DPI!\n\nDownload and print on 8.5" × 11" paper (landscape).\n\nFolding instructions:\n1. Fold in half lengthwise (hotdog fold)\n2. Fold in half again\n3. Fold once more to create booklet\n4. Unfold and cut center slit\n5. Refold and push ends together\n6. Pages should now be in order 1-8!`)
      } catch (err) {
        console.error('Print layout error:', err)
        updateProps({
          isLoading: false,
          error: `Failed to generate print layout: ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    }

    // Save as template
    const saveAsTemplate = () => {
      const template: ZineTemplate = {
        id: shape.props.zineId,
        name: shape.props.title || shape.props.topic,
        topic: shape.props.topic,
        style: shape.props.style,
        tone: shape.props.tone,
        pages: shape.props.finalPages.length > 0 ? shape.props.finalPages : shape.props.draftPages,
        createdAt: Date.now(),
      }

      // Save to localStorage
      const templates = JSON.parse(localStorage.getItem('mycrozine_templates') || '[]')
      templates.push(template)
      localStorage.setItem('mycrozine_templates', JSON.stringify(templates))

      addMessage('assistant', `Template "${template.name}" saved! You can reprint it anytime from the template library.`)
    }

    // Render phase-specific content
    const renderPhaseContent = () => {
      switch (shape.props.phase) {
        case 'ideation':
          return renderIdeationPhase()
        case 'drafts':
          return renderDraftsPhase()
        case 'feedback':
          return renderFeedbackPhase()
        case 'finalizing':
          return renderFinalizingPhase()
        case 'complete':
          return renderCompletePhase()
        default:
          return null
      }
    }

    // ========== IDEATION PHASE ==========
    const renderIdeationPhase = () => (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
        {/* Style/Tone selectors */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <select
            value={shape.props.style}
            onChange={(e) => updateProps({ style: e.target.value as ZineStyle })}
            onPointerDown={(e) => e.stopPropagation()}
            style={selectStyle}
          >
            {Object.keys(STYLES).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={shape.props.tone}
            onChange={(e) => updateProps({ tone: e.target.value as ZineTone })}
            onPointerDown={(e) => e.stopPropagation()}
            style={selectStyle}
          >
            {Object.keys(TONES).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Chat messages */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '8px',
          backgroundColor: '#1a1a1a',
          borderRadius: '6px',
        }}>
          {shape.props.ideationMessages.length === 0 && (
            <div style={{ color: '#666', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
              What topic would you like to make a zine about?
            </div>
          )}
          {shape.props.ideationMessages.map((msg) => (
            <div
              key={msg.id}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                maxWidth: '85%',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.role === 'user' ? MycroZineGeneratorShape.PRIMARY_COLOR : '#333',
                color: msg.role === 'user' ? '#000' : '#fff',
                fontSize: '13px',
                lineHeight: '1.4',
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder={shape.props.topic ? "Add details or feedback..." : "Enter your zine topic..."}
            style={inputStyle}
          />
          <button
            onClick={handleSendMessage}
            onPointerDown={(e) => e.stopPropagation()}
            style={buttonStyle}
            disabled={!inputValue.trim()}
          >
            Send
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {!shape.props.contentOutline && shape.props.topic && (
            <button
              onClick={generateOutline}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ ...buttonStyle, flex: 1, backgroundColor: '#333' }}
              disabled={shape.props.isLoading}
            >
              Generate Outline
            </button>
          )}
          {shape.props.contentOutline && (
            <button
              onClick={generateDrafts}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ ...buttonStyle, flex: 1 }}
              disabled={shape.props.isLoading}
            >
              {shape.props.isLoading ? 'Generating...' : 'Generate 8 Draft Pages →'}
            </button>
          )}
        </div>
      </div>
    )

    // ========== DRAFTS PHASE ==========
    const renderDraftsPhase = () => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
        <div style={{ fontSize: '48px' }}>🍄</div>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>Generating Drafts...</div>

        {/* Progress bar */}
        <div style={{ width: '80%', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            width: `${(shape.props.currentGeneratingPage / 8) * 100}%`,
            height: '8px',
            backgroundColor: MycroZineGeneratorShape.PRIMARY_COLOR,
            transition: 'width 0.3s ease',
          }} />
        </div>

        <div style={{ color: '#999', fontSize: '14px' }}>
          Page {shape.props.currentGeneratingPage}/8
        </div>

        {/* Page status list */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {Array.from({ length: 8 }, (_, i) => i + 1).map(pageNum => {
            const isComplete = shape.props.draftPages.some(p => p.pageNumber === pageNum)
            const isGenerating = shape.props.currentGeneratingPage === pageNum
            return (
              <div
                key={pageNum}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  backgroundColor: isComplete ? MycroZineGeneratorShape.PRIMARY_COLOR : isGenerating ? '#555' : '#333',
                  color: isComplete ? '#000' : '#fff',
                  border: isGenerating ? `2px solid ${MycroZineGeneratorShape.PRIMARY_COLOR}` : 'none',
                }}
              >
                {isComplete ? '✓' : pageNum}
              </div>
            )
          })}
        </div>
      </div>
    )

    // ========== FEEDBACK PHASE ==========
    const renderFeedbackPhase = () => {
      const [selectedPage, setSelectedPage] = useState<number | null>(null)
      const [feedbackInput, setFeedbackInput] = useState('')

      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
          <div style={{ color: '#999', fontSize: '13px', textAlign: 'center' }}>
            Review your drafts. Approve pages or add feedback for revision.
          </div>

          {/* Page grid */}
          <div style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            overflow: 'auto',
            padding: '4px',
          }}>
            {shape.props.draftPages.map((page) => {
              const feedback = shape.props.pageFeedback.find(f => f.pageNumber === page.pageNumber)
              const isApproved = feedback?.approved
              const hasFeedback = feedback?.feedbackText

              return (
                <div
                  key={page.pageNumber}
                  onClick={() => setSelectedPage(page.pageNumber)}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'relative',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: selectedPage === page.pageNumber
                      ? `2px solid ${MycroZineGeneratorShape.PRIMARY_COLOR}`
                      : isApproved
                        ? '2px solid #4ade80'
                        : hasFeedback
                          ? '2px solid #fbbf24'
                          : '2px solid #333',
                  }}
                >
                  <img
                    src={page.imageUrl}
                    alt={`Page ${page.pageNumber}`}
                    style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '4px',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    fontSize: '10px',
                    color: '#fff',
                    textAlign: 'center',
                  }}>
                    {page.pageNumber} {isApproved ? '✓' : hasFeedback ? '✎' : ''}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Selected page actions */}
          {selectedPage && (
            <div style={{
              padding: '12px',
              backgroundColor: '#1a1a1a',
              borderRadius: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ fontSize: '13px', color: '#fff' }}>Page {selectedPage}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    approvePage(selectedPage)
                    setSelectedPage(null)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{ ...buttonStyle, flex: 1, backgroundColor: '#4ade80', color: '#000' }}
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => {
                    // Toggle feedback input
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{ ...buttonStyle, flex: 1, backgroundColor: '#fbbf24', color: '#000' }}
                >
                  ✎ Add Feedback
                </button>
              </div>
              <input
                type="text"
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="Describe changes needed..."
                style={inputStyle}
              />
              {feedbackInput && (
                <button
                  onClick={() => {
                    addPageFeedback(selectedPage, feedbackInput)
                    setFeedbackInput('')
                    setSelectedPage(null)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={buttonStyle}
                >
                  Save Feedback
                </button>
              )}
            </div>
          )}

          {/* Continue button */}
          <button
            onClick={startFinalization}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              ...buttonStyle,
              opacity: allPagesReviewed ? 1 : 0.5,
            }}
            disabled={!allPagesReviewed}
          >
            {shape.props.pageFeedback.some(f => !f.approved && f.feedbackText)
              ? 'Apply Feedback & Finalize →'
              : 'Finalize Zine →'}
          </button>
        </div>
      )
    }

    // ========== FINALIZING PHASE ==========
    const renderFinalizingPhase = () => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
        <div style={{ fontSize: '48px' }}>🔄</div>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>Applying Feedback...</div>

        <div style={{ color: '#999', fontSize: '14px' }}>
          Regenerating {shape.props.pageFeedback.filter(f => !f.approved && f.feedbackText).length} pages
        </div>

        {shape.props.currentGeneratingPage > 0 && (
          <div style={{ color: MycroZineGeneratorShape.PRIMARY_COLOR, fontSize: '14px' }}>
            Currently updating page {shape.props.currentGeneratingPage}...
          </div>
        )}
      </div>
    )

    // ========== COMPLETE PHASE ==========
    const renderCompletePhase = () => {
      const pages = shape.props.finalPages.length > 0 ? shape.props.finalPages : shape.props.draftPages

      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>🍄</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: MycroZineGeneratorShape.PRIMARY_COLOR }}>
              Zine Complete!
            </div>
            <div style={{ color: '#999', fontSize: '13px' }}>
              "{shape.props.title || shape.props.topic}"
            </div>
          </div>

          {/* Print preview - 2x4 grid */}
          <div style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
            gap: '2px',
            backgroundColor: '#fff',
            padding: '4px',
            borderRadius: '4px',
          }}>
            {pages.map((page) => (
              <img
                key={page.pageNumber}
                src={page.imageUrl}
                alt={`Page ${page.pageNumber}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={generatePrintLayout}
              onPointerDown={(e) => e.stopPropagation()}
              style={buttonStyle}
              disabled={shape.props.isLoading}
            >
              📥 Download Print-Ready PNG
            </button>
            <button
              onClick={saveAsTemplate}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ ...buttonStyle, backgroundColor: '#333' }}
            >
              💾 Save as Template
            </button>
            <button
              onClick={() => updateProps({
                phase: 'ideation',
                topic: '',
                title: '',
                contentOutline: null,
                ideationMessages: [],
                draftPages: [],
                pageFeedback: [],
                finalPages: [],
                printLayoutUrl: null,
                zineId: `zine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              })}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ ...buttonStyle, backgroundColor: '#1a1a1a', color: '#999' }}
            >
              🔄 Start New Zine
            </button>
          </div>
        </div>
      )
    }

    // Phase indicator
    const phaseLabels: Record<ZinePhase, string> = {
      ideation: '1. Ideation',
      drafts: '2. Drafts',
      feedback: '3. Feedback',
      finalizing: '4. Finalizing',
      complete: '5. Complete',
    }

    return (
      <HTMLContainer id={shape.id}>
        <StandardizedToolWrapper
          title="🍄 MycroZine Generator"
          primaryColor={MycroZineGeneratorShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={shape.props.w}
          height={shape.props.h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          onMaximize={toggleMaximize}
          isMaximized={isMaximized}
          editor={editor}
          shapeId={shape.id}
          tags={shape.props.tags || []}
          onTagsChange={handleTagsChange}
          tagsEditable={true}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          headerContent={
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              🍄 MycroZine
              <span style={{
                fontSize: '10px',
                backgroundColor: MycroZineGeneratorShape.SECONDARY_COLOR,
                padding: '2px 6px',
                borderRadius: '10px',
                color: MycroZineGeneratorShape.PRIMARY_COLOR,
              }}>
                {phaseLabels[shape.props.phase]}
              </span>
            </span>
          }
        >
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
            backgroundColor: '#0a0a0a',
            color: '#fff',
            overflow: 'hidden',
          }}>
            {/* Error display */}
            {shape.props.error && (
              <div style={{
                padding: '8px 12px',
                backgroundColor: '#331111',
                border: '1px solid #663333',
                borderRadius: '6px',
                color: '#ff6666',
                fontSize: '12px',
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span>{shape.props.error}</span>
                <button
                  onClick={() => updateProps({ error: null })}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{ background: 'none', border: 'none', color: '#ff6666', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            )}

            {renderPhaseContent()}
          </div>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  override indicator(shape: IMycroZineGenerator) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={6}
      />
    )
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

// Spawn page images on the canvas in a 4x2 grid
async function spawnPageOnCanvas(
  editor: any,
  imageUrl: string,
  index: number,
  parentShape: IMycroZineGenerator
): Promise<string | undefined> {
  try {
    // Calculate position in a 4x2 grid to the right of the generator
    const col = index % 4
    const row = Math.floor(index / 4)
    const spacing = 20
    const pageWidth = 200
    const pageHeight = 300

    const x = parentShape.props.w + 50 + col * (pageWidth + spacing)
    const y = row * (pageHeight + spacing)

    // Get parent shape position
    const parentBounds = editor.getShapePageBounds(parentShape.id)
    if (!parentBounds) return undefined

    const shapeId = createShapeId()

    // Create an image shape on the canvas
    editor.createShape({
      id: shapeId,
      type: 'image',
      x: parentBounds.x + x,
      y: parentBounds.y + y,
      props: {
        w: pageWidth,
        h: pageHeight,
        url: imageUrl,
      },
    })

    return shapeId
  } catch (err) {
    console.error('Failed to spawn page on canvas:', err)
    return undefined
  }
}

// ============================================================================
// Styles
// ============================================================================

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 12px',
  backgroundColor: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '13px',
  outline: 'none',
}

const buttonStyle: React.CSSProperties = {
  padding: '10px 16px',
  backgroundColor: '#00ff00',
  border: 'none',
  borderRadius: '6px',
  color: '#000',
  fontSize: '13px',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: 'opacity 0.15s',
}

const selectStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  backgroundColor: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '12px',
  cursor: 'pointer',
}
