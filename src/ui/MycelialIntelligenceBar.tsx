import React, { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useEditor } from "tldraw"
import { canvasAI, useCanvasAI } from "@/lib/canvasAI"
import { useWebSpeechTranscription } from "@/hooks/useWebSpeechTranscription"
import { ToolSchema } from "@/lib/toolSchema"
import { spawnTools, spawnTool } from "@/utils/toolSpawner"
import { TransformCommand } from "@/utils/selectionTransforms"
import { useConnectionStatus } from "@/context/ConnectionContext"

// Copy icon component
const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

// Check icon for copy confirmation
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

// Simple markdown-like renderer for code blocks and basic formatting
function renderMessageContent(content: string): React.ReactNode {
  // Split by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g)

  return parts.map((part, i) => {
    // Code block
    if (part.startsWith('```') && part.endsWith('```')) {
      const lines = part.slice(3, -3).split('\n')
      const language = lines[0]?.trim() || ''
      const code = language ? lines.slice(1).join('\n') : lines.join('\n')

      return (
        <CodeBlock key={i} code={code.trim()} language={language} />
      )
    }

    // Regular text - handle inline code and basic formatting
    return (
      <span key={i}>
        {part.split(/(`[^`]+`)/g).map((segment, j) => {
          if (segment.startsWith('`') && segment.endsWith('`')) {
            return (
              <code
                key={j}
                className="mi-inline-code"
                style={{
                  padding: '1px 4px',
                  borderRadius: '3px',
                  fontSize: '0.9em',
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                }}
              >
                {segment.slice(1, -1)}
              </code>
            )
          }
          return segment
        })}
      </span>
    )
  })
}

// Code block component with copy button
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        margin: '8px 0',
        borderRadius: '6px',
        overflow: 'hidden',
        background: 'rgba(0, 0, 0, 0.04)',
        border: '1px solid rgba(0, 0, 0, 0.08)',
      }}
    >
      {language && (
        <div
          style={{
            padding: '4px 10px',
            fontSize: '10px',
            fontWeight: 500,
            color: '#666',
            background: 'rgba(0, 0, 0, 0.03)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{language}</span>
          <button
            onClick={handleCopy}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '4px',
              color: copied ? '#10b981' : '#666',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              transition: 'all 0.2s',
            }}
            title="Copy code"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      <pre
        style={{
          margin: 0,
          padding: '10px 12px',
          overflow: 'auto',
          fontSize: '12px',
          lineHeight: '1.5',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          maxHeight: '200px',
        }}
      >
        <code>{code}</code>
      </pre>
      {!language && (
        <button
          onClick={handleCopy}
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(0,0,0,0.1)',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
            color: copied ? '#10b981' : '#666',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            transition: 'all 0.2s',
          }}
          title="Copy code"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      )}
    </div>
  )
}

// Message bubble component with copy functionality
interface MessageBubbleProps {
  content: string
  role: 'user' | 'assistant'
  colors: {
    userBubble: string
    assistantBubble: string
    border: string
    text: string
    textMuted: string
  }
}

function MessageBubble({ content, role, colors }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [showCopy, setShowCopy] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const renderedContent = useMemo(() => renderMessageContent(content), [content])

  return (
    <div
      style={{
        position: 'relative',
        alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
      }}
      onMouseEnter={() => setShowCopy(true)}
      onMouseLeave={() => setShowCopy(false)}
    >
      <div
        style={{
          padding: '8px 12px',
          borderRadius: role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          backgroundColor: role === 'user' ? colors.userBubble : colors.assistantBubble,
          border: `1px solid ${role === 'user' ? 'rgba(16, 185, 129, 0.2)' : colors.border}`,
          color: colors.text,
          fontSize: '13px',
          lineHeight: '1.5',
          wordBreak: 'break-word',
          userSelect: 'text',
          cursor: 'text',
        }}
      >
        {renderedContent}
      </div>

      {/* Copy button on hover */}
      {showCopy && role === 'assistant' && content.length > 20 && (
        <button
          onClick={handleCopy}
          style={{
            position: 'absolute',
            top: '4px',
            right: '-28px',
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: '4px',
            padding: '4px',
            cursor: 'pointer',
            color: copied ? '#10b981' : colors.textMuted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
          title={copied ? 'Copied!' : 'Copy message'}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      )}
    </div>
  )
}

// Microphone icon component
const MicrophoneIcon = ({ isListening }: { isListening: boolean }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill={isListening ? "#10b981" : "currentColor"}
    style={{
      filter: isListening ? 'drop-shadow(0 0 8px #10b981)' : 'none',
      transition: 'all 0.3s ease'
    }}
  >
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
  </svg>
)

// Send icon component
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
)

// Expand/collapse icon
const ExpandIcon = ({ isExpanded }: { isExpanded: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{
      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 0.3s ease'
    }}
  >
    <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
  </svg>
)

// Tool suggestion card component
interface ToolCardProps {
  tool: ToolSchema
  onSpawn: (tool: ToolSchema) => void
  isSpawned: boolean
}

const ToolCard = ({ tool, onSpawn, isSpawned }: ToolCardProps) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        if (!isSpawned) onSpawn(tool)
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={isSpawned}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderRadius: '12px',
        border: `1px solid ${isSpawned ? 'rgba(16, 185, 129, 0.3)' : isHovered ? tool.primaryColor : 'rgba(229, 231, 235, 0.8)'}`,
        background: isSpawned
          ? 'rgba(16, 185, 129, 0.1)'
          : isHovered
            ? `${tool.primaryColor}15`
            : 'rgba(255, 255, 255, 0.8)',
        cursor: isSpawned ? 'default' : 'pointer',
        transition: 'all 0.2s ease',
        transform: isHovered && !isSpawned ? 'translateY(-1px)' : 'none',
        boxShadow: isHovered && !isSpawned
          ? `0 4px 12px ${tool.primaryColor}25`
          : '0 1px 3px rgba(0,0,0,0.08)',
        opacity: isSpawned ? 0.7 : 1,
      }}
      title={isSpawned ? `${tool.displayName} already spawned` : `Spawn ${tool.displayName} on canvas`}
    >
      <span style={{ fontSize: '16px' }}>{tool.icon}</span>
      <span style={{
        fontSize: '12px',
        fontWeight: 500,
        color: isSpawned ? '#10b981' : isHovered ? tool.primaryColor : '#374151',
        whiteSpace: 'nowrap',
      }}>
        {tool.displayName}
      </span>
      {isSpawned && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#10b981">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      )}
    </button>
  )
}

// Prompt suggestion chip for selection transforms
interface PromptSuggestionProps {
  label: string
  onClick: () => void
}

const PromptSuggestion = ({ label, onClick }: PromptSuggestionProps) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '14px',
        border: '1px solid rgba(139, 92, 246, 0.25)',
        background: isHovered
          ? 'rgba(139, 92, 246, 0.12)'
          : 'rgba(139, 92, 246, 0.06)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        fontSize: '11px',
        fontWeight: 500,
        color: isHovered ? '#7c3aed' : '#8b5cf6',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// Follow-up suggestion chip with category-based styling
interface FollowUpChipProps {
  suggestion: FollowUpSuggestion
  onClick: () => void
}

const CATEGORY_COLORS = {
  organize: { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.25)', text: '#3b82f6', hover: 'rgba(59, 130, 246, 0.15)' },
  expand: { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.25)', text: '#10b981', hover: 'rgba(16, 185, 129, 0.15)' },
  refine: { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.25)', text: '#f59e0b', hover: 'rgba(245, 158, 11, 0.15)' },
  connect: { bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.25)', text: '#8b5cf6', hover: 'rgba(139, 92, 246, 0.15)' },
  create: { bg: 'rgba(236, 72, 153, 0.08)', border: 'rgba(236, 72, 153, 0.25)', text: '#ec4899', hover: 'rgba(236, 72, 153, 0.15)' },
}

const FollowUpChip = ({ suggestion, onClick }: FollowUpChipProps) => {
  const [isHovered, setIsHovered] = useState(false)
  const colors = CATEGORY_COLORS[suggestion.category]

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '5px 10px',
        borderRadius: '14px',
        border: `1px solid ${colors.border}`,
        background: isHovered ? colors.hover : colors.bg,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        fontSize: '11px',
        fontWeight: 500,
        color: colors.text,
        whiteSpace: 'nowrap',
        transform: isHovered ? 'translateY(-1px)' : 'none',
        boxShadow: isHovered ? `0 2px 8px ${colors.border}` : 'none',
      }}
      title={suggestion.prompt}
    >
      {suggestion.icon && <span style={{ fontSize: '12px' }}>{suggestion.icon}</span>}
      {suggestion.label}
    </button>
  )
}

// Selection transform suggestions that appear when shapes are selected
const SELECTION_SUGGESTIONS = [
  { label: 'arrange in a row', prompt: 'arrange in a row' },
  { label: 'arrange in a column', prompt: 'arrange in a column' },
  { label: 'arrange in a grid', prompt: 'arrange in a grid' },
  { label: 'make same size', prompt: 'make these the same size' },
  { label: 'align left', prompt: 'align left' },
  { label: 'distribute evenly', prompt: 'distribute horizontally' },
  { label: 'group by topic', prompt: 'cluster by semantic content' },
]

// Follow-up suggestions that appear after an action to guide the next step
interface FollowUpSuggestion {
  label: string
  prompt: string
  icon?: string
  category: 'organize' | 'expand' | 'refine' | 'connect' | 'create'
}

// Context-aware follow-up suggestions based on what just happened
type FollowUpContext =
  | { type: 'transform'; command: TransformCommand; shapeCount: number }
  | { type: 'tool_spawned'; toolId: string; toolName: string }
  | { type: 'ai_response'; hadSelection: boolean; topicKeywords: string[] }
  | { type: 'selection'; count: number; shapeTypes: Record<string, number> }

// Follow-up suggestions after transform commands
// NOTE: Arrow/connection drawing is not yet implemented, so those suggestions are removed
const TRANSFORM_FOLLOWUPS: Record<string, FollowUpSuggestion[]> = {
  // After arranging in a row
  'arrange-row': [
    { label: 'make same size', prompt: 'make these the same size', icon: '📐', category: 'refine' },
    { label: 'add labels', prompt: 'add a label above each shape', icon: '🏷️', category: 'expand' },
    { label: 'group these', prompt: 'create a frame around these shapes', icon: '📦', category: 'organize' },
  ],
  // After arranging in a column
  'arrange-column': [
    { label: 'make same width', prompt: 'make these the same width', icon: '↔️', category: 'refine' },
    { label: 'number them', prompt: 'add numbers before each item', icon: '🔢', category: 'expand' },
    { label: 'add header', prompt: 'create a title above this column', icon: '📝', category: 'expand' },
  ],
  // After arranging in a grid
  'arrange-grid': [
    { label: 'make uniform', prompt: 'make all shapes the same size', icon: '⊞', category: 'refine' },
    { label: 'add row labels', prompt: 'label each row', icon: '🏷️', category: 'expand' },
    { label: 'color by type', prompt: 'color code these by their content type', icon: '🎨', category: 'refine' },
    { label: 'create matrix', prompt: 'add column and row headers to make a matrix', icon: '📊', category: 'expand' },
  ],
  // After arranging in a circle
  'arrange-circle': [
    { label: 'add center node', prompt: 'add a central connecting node', icon: '⭕', category: 'expand' },
    { label: 'label the cycle', prompt: 'add a title for this cycle diagram', icon: '📝', category: 'expand' },
  ],
  // After aligning
  'align-left': [
    { label: 'distribute vertically', prompt: 'distribute these evenly vertically', icon: '↕️', category: 'refine' },
    { label: 'make same width', prompt: 'make these the same width', icon: '↔️', category: 'refine' },
  ],
  'align-right': [
    { label: 'distribute vertically', prompt: 'distribute these evenly vertically', icon: '↕️', category: 'refine' },
  ],
  'align-center': [
    { label: 'stack vertically', prompt: 'arrange these in a column', icon: '⬇️', category: 'organize' },
  ],
  'align-top': [
    { label: 'distribute horizontally', prompt: 'distribute these evenly horizontally', icon: '↔️', category: 'refine' },
  ],
  'align-bottom': [
    { label: 'distribute horizontally', prompt: 'distribute these evenly horizontally', icon: '↔️', category: 'refine' },
  ],
  // After distributing
  'distribute-horizontal': [
    { label: 'align tops', prompt: 'align these to the top', icon: '⬆️', category: 'refine' },
    { label: 'make same size', prompt: 'make these the same size', icon: '📐', category: 'refine' },
  ],
  'distribute-vertical': [
    { label: 'align left', prompt: 'align these to the left', icon: '⬅️', category: 'refine' },
    { label: 'make same size', prompt: 'make these the same size', icon: '📐', category: 'refine' },
  ],
  // After size normalization
  'size-match-both': [
    { label: 'arrange in grid', prompt: 'arrange in a grid', icon: '⊞', category: 'organize' },
    { label: 'align centers', prompt: 'align horizontally centered', icon: '↔️', category: 'refine' },
  ],
  'size-match-width': [
    { label: 'arrange in column', prompt: 'arrange in a column', icon: '⬇️', category: 'organize' },
  ],
  'size-match-height': [
    { label: 'arrange in row', prompt: 'arrange in a row', icon: '➡️', category: 'organize' },
  ],
  // After merging content
  'merge-content': [
    { label: 'summarize merged', prompt: 'summarize this combined content', icon: '📝', category: 'refine' },
    { label: 'extract themes', prompt: 'identify the main themes in this content', icon: '🎯', category: 'expand' },
    { label: 'create outline', prompt: 'organize this into an outline', icon: '📋', category: 'organize' },
  ],
  // After semantic clustering
  'cluster-semantic': [
    { label: 'label clusters', prompt: 'add a label to each cluster', icon: '🏷️', category: 'expand' },
    { label: 'create overview', prompt: 'create a summary of all clusters', icon: '📊', category: 'expand' },
    { label: 'color by group', prompt: 'color code each cluster differently', icon: '🎨', category: 'refine' },
  ],
}

// Follow-up suggestions after spawning tools
const TOOL_SPAWN_FOLLOWUPS: Record<string, FollowUpSuggestion[]> = {
  Prompt: [
    { label: 'what should I ask?', prompt: 'suggest good prompts for my current canvas content', icon: '💡', category: 'expand' },
    { label: 'use my notes', prompt: 'use content from my notes as context', icon: '📝', category: 'connect' },
  ],
  ImageGen: [
    { label: 'style suggestions', prompt: 'what visual styles would work well with my content?', icon: '🎨', category: 'expand' },
    { label: 'from my notes', prompt: 'suggest an image based on my notes', icon: '📝', category: 'connect' },
  ],
  VideoGen: [
    { label: 'from image', prompt: 'which of my images would make a good video?', icon: '🖼️', category: 'connect' },
    { label: 'motion ideas', prompt: 'suggest motion effects for my content', icon: '✨', category: 'expand' },
  ],
  Markdown: [
    { label: 'summarize canvas', prompt: 'summarize what\'s on my canvas into this note', icon: '📋', category: 'connect' },
    { label: 'create outline', prompt: 'create an outline from my current shapes', icon: '📝', category: 'organize' },
  ],
  ChatBox: [
    { label: 'discuss canvas', prompt: 'what would be good to discuss about my canvas content?', icon: '💬', category: 'expand' },
  ],
  Transcription: [
    { label: 'start recording', prompt: 'what should I talk about based on my canvas?', icon: '🎤', category: 'expand' },
  ],
}

// Generic follow-ups based on canvas state
// NOTE: Connection/arrow drawing is not yet implemented, so we use different suggestions
const CANVAS_STATE_FOLLOWUPS = {
  manyShapes: [
    { label: 'organize all', prompt: 'help me organize everything on this canvas', icon: '🗂️', category: 'organize' as const },
    { label: 'find patterns', prompt: 'what patterns do you see in my content?', icon: '🔍', category: 'expand' as const },
    { label: 'identify themes', prompt: 'what are the main themes across my shapes?', icon: '🎯', category: 'expand' as const },
  ],
  hasText: [
    { label: 'summarize all', prompt: 'create a summary of all text content', icon: '📝', category: 'organize' as const },
    { label: 'find themes', prompt: 'what themes exist across my notes?', icon: '🎯', category: 'expand' as const },
  ],
  hasImages: [
    { label: 'describe images', prompt: 'what themes are in my images?', icon: '🖼️', category: 'expand' as const },
    { label: 'animate one', prompt: 'which image should I animate?', icon: '🎬', category: 'create' as const },
  ],
  hasAI: [
    { label: 'continue creating', prompt: 'what should I create next?', icon: '✨', category: 'create' as const },
  ],
}

// Tool-specific helpful prompts when a single tool is selected
interface ToolPromptInfo {
  placeholder: string
  helpPrompt: string
  canDirectInput: boolean
  inputLabel?: string
}

const TOOL_PROMPTS: Record<string, ToolPromptInfo> = {
  Prompt: {
    placeholder: 'Type here to send to your AI Prompt...',
    helpPrompt: 'What should I ask this AI prompt about?',
    canDirectInput: true,
    inputLabel: 'Send to Prompt',
  },
  ImageGen: {
    placeholder: 'Describe the image you want to generate...',
    helpPrompt: 'Describe your desired image based on my canvas content',
    canDirectInput: true,
    inputLabel: 'Generate Image',
  },
  VideoGen: {
    placeholder: 'Describe the motion/animation you want...',
    helpPrompt: 'What kind of motion should this video have?',
    canDirectInput: true,
    inputLabel: 'Generate Video',
  },
  ChatBox: {
    placeholder: 'Send a message to this chat...',
    helpPrompt: 'What topic should we discuss in this chat?',
    canDirectInput: true,
    inputLabel: 'Send to Chat',
  },
  Markdown: {
    placeholder: 'Add content to this note...',
    helpPrompt: 'What should I write in this note based on my canvas?',
    canDirectInput: true,
    inputLabel: 'Add to Note',
  },
  ObsNote: {
    placeholder: 'Add to this observation...',
    helpPrompt: 'What observation should I add here?',
    canDirectInput: true,
    inputLabel: 'Add Note',
  },
  Transcription: {
    placeholder: 'Ask about transcription...',
    helpPrompt: 'What should I record or transcribe?',
    canDirectInput: false,
  },
  Embed: {
    placeholder: 'Enter a URL to embed...',
    helpPrompt: 'What should I embed here?',
    canDirectInput: true,
    inputLabel: 'Embed URL',
  },
  Holon: {
    placeholder: 'Enter a Holon ID...',
    helpPrompt: 'Which Holon should I connect to?',
    canDirectInput: true,
    inputLabel: 'Connect Holon',
  },
}

// Helper to get selected tool info
function getSelectedToolInfo(
  selectionInfo: { count: number; types: Record<string, number> } | null
): { toolType: string; promptInfo: ToolPromptInfo } | null {
  if (!selectionInfo || selectionInfo.count !== 1) return null

  const types = Object.keys(selectionInfo.types)
  if (types.length !== 1) return null

  const toolType = types[0]
  const promptInfo = TOOL_PROMPTS[toolType]
  if (!promptInfo) return null

  return { toolType, promptInfo }
}

// Generate follow-up suggestions based on context
function getFollowUpSuggestions(context: FollowUpContext): FollowUpSuggestion[] {
  switch (context.type) {
    case 'transform': {
      const commandFollowups = TRANSFORM_FOLLOWUPS[context.command] || []
      // Add generic suggestions if we have few specific ones
      if (commandFollowups.length < 2 && context.shapeCount > 1) {
        return [
          ...commandFollowups,
          { label: 'create summary', prompt: 'summarize these shapes', icon: '📝', category: 'expand' },
          { label: 'find similar', prompt: 'find other shapes related to these', icon: '🔍', category: 'connect' },
        ]
      }
      return commandFollowups
    }

    case 'tool_spawned': {
      return TOOL_SPAWN_FOLLOWUPS[context.toolId] || [
        { label: 'how to use', prompt: `how do I best use ${context.toolName}?`, icon: '❓', category: 'expand' },
      ]
    }

    case 'ai_response': {
      const suggestions: FollowUpSuggestion[] = []

      // Context-aware follow-ups
      if (context.hadSelection) {
        suggestions.push(
          { label: 'do more with these', prompt: 'what else can I do with these selected shapes?', icon: '✨', category: 'expand' },
          { label: 'find related', prompt: 'find shapes related to my selection', icon: '🔍', category: 'connect' }
        )
      }

      // Topic-based suggestions
      if (context.topicKeywords.length > 0) {
        suggestions.push(
          { label: 'expand on this', prompt: `tell me more about ${context.topicKeywords[0]}`, icon: '📖', category: 'expand' },
          { label: 'create visual', prompt: `create an image about ${context.topicKeywords[0]}`, icon: '🎨', category: 'create' }
        )
      }

      // Default suggestions
      if (suggestions.length < 2) {
        suggestions.push(
          { label: 'what next?', prompt: 'what should I work on next?', icon: '➡️', category: 'expand' },
          { label: 'organize ideas', prompt: 'help me organize my ideas', icon: '🗂️', category: 'organize' }
        )
      }

      return suggestions.slice(0, 4)
    }

    case 'selection': {
      // For selections, show arrangement options based on count and types
      if (context.count >= 3) {
        return [
          { label: 'arrange in grid', prompt: 'arrange in a grid', icon: '⊞', category: 'organize' },
          { label: 'cluster by topic', prompt: 'cluster by semantic content', icon: '🎯', category: 'organize' },
        ]
      }
      return []
    }

    default:
      return []
  }
}

// Extract likely topic keywords from AI response
function extractTopicKeywords(response: string): string[] {
  // Simple extraction - look for quoted terms or capitalized phrases
  const keywords: string[] = []

  // Find quoted phrases
  const quoted = response.match(/"([^"]+)"/g)
  if (quoted) {
    keywords.push(...quoted.map(q => q.replace(/"/g, '')).slice(0, 2))
  }

  // Find terms after "about", "regarding", "for"
  const aboutMatch = response.match(/(?:about|regarding|for)\s+([A-Za-z][A-Za-z\s]{2,20}?)(?:[,.]|\s(?:and|or|in|on|to))/gi)
  if (aboutMatch) {
    keywords.push(...aboutMatch.map(m => m.replace(/^(?:about|regarding|for)\s+/i, '').replace(/[,.\s]+$/, '')).slice(0, 2))
  }

  return [...new Set(keywords)].slice(0, 3)
}

// Hook to detect dark mode
const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'))
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  return isDark
}

const ACCENT_COLOR = "#10b981" // Emerald green

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  suggestedTools?: ToolSchema[]
  followUpSuggestions?: FollowUpSuggestion[]
  /** If this was a transform command result */
  executedTransform?: TransformCommand
}

// Connection status indicator component - unobtrusive inline display
interface ConnectionStatusProps {
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  isNetworkOnline: boolean
  isDark: boolean
}

function ConnectionStatusBadge({ connectionState, isNetworkOnline, isDark }: ConnectionStatusProps) {
  // Don't show anything when fully connected and online
  if (connectionState === 'connected' && isNetworkOnline) {
    return null
  }

  const getStatusConfig = () => {
    if (!isNetworkOnline) {
      return {
        icon: '📴',
        label: 'Offline',
        color: isDark ? '#a78bfa' : '#8b5cf6',
        pulse: false,
      }
    }

    switch (connectionState) {
      case 'connecting':
        return {
          icon: '🌱',
          label: 'Connecting',
          color: '#f59e0b',
          pulse: true,
        }
      case 'reconnecting':
        return {
          icon: '🔄',
          label: 'Reconnecting',
          color: '#f59e0b',
          pulse: true,
        }
      case 'disconnected':
        return {
          icon: '🍄',
          label: 'Local',
          color: isDark ? '#a78bfa' : '#8b5cf6',
          pulse: false,
        }
      default:
        return null
    }
  }

  const config = getStatusConfig()
  if (!config) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '12px',
        backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
        border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)'}`,
        fontSize: '10px',
        fontWeight: 500,
        color: config.color,
        animation: config.pulse ? 'connectionPulse 2s infinite' : undefined,
        flexShrink: 0,
      }}
      title={!isNetworkOnline
        ? 'Working offline - changes saved locally and will sync when reconnected'
        : connectionState === 'reconnecting'
          ? 'Reconnecting to server - your changes are safe'
          : 'Connecting to server...'
      }
    >
      <span style={{ fontSize: '11px' }}>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  )
}

export function MycelialIntelligenceBar() {
  const editor = useEditor()
  const isDark = useDarkMode()
  const { connectionState, isNetworkOnline } = useConnectionStatus()
  const inputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [prompt, setPrompt] = useState("")
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([])
  const [streamingResponse, setStreamingResponse] = useState("")
  const [indexingProgress, setIndexingProgress] = useState(0)
  const [isIndexing, setIsIndexing] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [suggestedTools, setSuggestedTools] = useState<ToolSchema[]>([])
  const [spawnedToolIds, setSpawnedToolIds] = useState<Set<string>>(new Set())
  const [selectionInfo, setSelectionInfo] = useState<{
    count: number
    types: Record<string, number>
  } | null>(null)
  const [followUpSuggestions, setFollowUpSuggestions] = useState<FollowUpSuggestion[]>([])
  const [lastTransform, setLastTransform] = useState<TransformCommand | null>(null)
  const [toolInputMode, setToolInputMode] = useState<{ toolType: string; shapeId: string } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Detect when modals/dialogs are open to fade the bar
  useEffect(() => {
    const checkForModals = () => {
      // Check for common modal/dialog overlays
      const hasSettingsModal = document.querySelector('.settings-modal-overlay') !== null
      const hasTldrawDialog = document.querySelector('[data-state="open"][role="dialog"]') !== null
      const hasAuthModal = document.querySelector('.auth-modal-overlay') !== null
      const hasPopup = document.querySelector('.profile-popup') !== null
      const hasCryptIDModal = document.querySelector('.cryptid-modal-overlay') !== null
      const hasMiroModal = document.querySelector('.miro-modal-overlay') !== null
      const hasObsidianModal = document.querySelector('.obsidian-browser') !== null

      setIsModalOpen(hasSettingsModal || hasTldrawDialog || hasAuthModal || hasPopup || hasCryptIDModal || hasMiroModal || hasObsidianModal)
    }

    // Initial check
    checkForModals()

    // Use MutationObserver to detect DOM changes
    const observer = new MutationObserver(checkForModals)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-state']
    })

    return () => observer.disconnect()
  }, [])

  // Derived state: get selected tool info
  const selectedToolInfo = getSelectedToolInfo(selectionInfo)

  // Initialize canvas AI with editor
  useCanvasAI(editor)

  // Track selection changes - use direct selection query for reliability
  useEffect(() => {
    if (!editor) return

    const updateSelection = () => {
      const selectedShapes = editor.getSelectedShapes()
      if (selectedShapes.length > 0) {
        // Count shape types
        const types: Record<string, number> = {}
        for (const shape of selectedShapes) {
          types[shape.type] = (types[shape.type] || 0) + 1
        }
        setSelectionInfo({
          count: selectedShapes.length,
          types,
        })

        // If single tool selected, track it for direct input mode
        if (selectedShapes.length === 1) {
          const shape = selectedShapes[0]
          if (TOOL_PROMPTS[shape.type]) {
            setToolInputMode({ toolType: shape.type, shapeId: shape.id as string })
          } else {
            setToolInputMode(null)
          }
        } else {
          setToolInputMode(null)
        }
      } else {
        setSelectionInfo(null)
        setToolInputMode(null)
      }
    }

    // Initial check
    updateSelection()

    // Subscribe to all store changes and filter for selection
    const unsubscribe = editor.store.listen(updateSelection, { scope: 'all' })

    return () => {
      unsubscribe()
    }
  }, [editor])

  // Handle prompt suggestion click - fills in the prompt and submits
  const handleSuggestionClick = useCallback((suggestionPrompt: string) => {
    setPrompt(suggestionPrompt)
    // Use setTimeout to allow state to update, then submit
    setTimeout(() => {
      // Trigger submit with the suggestion
      const submitPrompt = async () => {
        if (!suggestionPrompt.trim()) return

        const newHistory: ConversationMessage[] = [
          ...conversationHistory,
          { role: 'user', content: suggestionPrompt }
        ]

        setConversationHistory(newHistory)
        setIsLoading(true)
        setIsExpanded(true)
        setStreamingResponse("")
        setPrompt('')
        setFollowUpSuggestions([]) // Clear previous follow-ups

        try {
          const { isIndexing: currentlyIndexing } = canvasAI.getIndexingStatus()
          if (!currentlyIndexing) {
            setIsIndexing(true)
            await canvasAI.indexCanvas((progress) => {
              setIndexingProgress(progress)
            })
            setIsIndexing(false)
            setIndexingProgress(100)
          }

          let fullResponse = ''
          let tools: ToolSchema[] = []

          const result = await canvasAI.query(
            suggestionPrompt,
            (partial, done) => {
              fullResponse = partial
              setStreamingResponse(partial)
              if (done) {
                setIsLoading(false)
              }
            }
          )

          tools = result.suggestedTools || []
          setSuggestedTools(tools)
          setSpawnedToolIds(new Set())

          // Generate follow-up suggestions based on result
          let newFollowUps: FollowUpSuggestion[] = []
          if (result.executedTransform) {
            // Transform was executed - suggest next steps
            setLastTransform(result.executedTransform)
            newFollowUps = getFollowUpSuggestions({
              type: 'transform',
              command: result.executedTransform,
              shapeCount: result.selectionCount,
            })
          } else {
            // Regular AI response - suggest based on content
            const keywords = extractTopicKeywords(fullResponse)
            newFollowUps = getFollowUpSuggestions({
              type: 'ai_response',
              hadSelection: result.hadSelection,
              topicKeywords: keywords,
            })
          }
          setFollowUpSuggestions(newFollowUps)

          const updatedHistory: ConversationMessage[] = [
            ...newHistory,
            {
              role: 'assistant',
              content: fullResponse,
              suggestedTools: tools,
              followUpSuggestions: newFollowUps,
              executedTransform: result.executedTransform,
            }
          ]

          setConversationHistory(updatedHistory)
          setStreamingResponse("")
          setIsLoading(false)
        } catch (error) {
          console.error('Mycelial Intelligence query error:', error)
          const errorMessage = error instanceof Error ? error.message : 'An error occurred'
          setConversationHistory([
            ...newHistory,
            { role: 'assistant', content: `Error: ${errorMessage}` }
          ])
          setStreamingResponse("")
          setIsLoading(false)
          setFollowUpSuggestions([])
        }
      }
      submitPrompt()
    }, 0)
  }, [conversationHistory])

  // Theme-aware colors
  const colors = isDark ? {
    background: 'rgba(30, 30, 30, 0.98)',
    backgroundHover: 'rgba(40, 40, 40, 1)',
    border: 'rgba(70, 70, 70, 0.8)',
    borderHover: 'rgba(90, 90, 90, 1)',
    text: '#e4e4e4',
    textMuted: '#a1a1aa',
    inputBg: 'rgba(50, 50, 50, 0.8)',
    inputBorder: 'rgba(70, 70, 70, 1)',
    inputText: '#e4e4e4',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.3)',
    shadowHover: '0 12px 40px rgba(0, 0, 0, 0.5), 0 6px 20px rgba(0, 0, 0, 0.4)',
    userBubble: 'rgba(16, 185, 129, 0.2)',
    assistantBubble: 'rgba(50, 50, 50, 0.9)',
  } : {
    background: 'rgba(255, 255, 255, 0.98)',
    backgroundHover: 'rgba(255, 255, 255, 1)',
    border: 'rgba(229, 231, 235, 0.8)',
    borderHover: 'rgba(209, 213, 219, 1)',
    text: '#18181b',
    textMuted: '#71717a',
    inputBg: 'rgba(244, 244, 245, 0.8)',
    inputBorder: 'rgba(228, 228, 231, 1)',
    inputText: '#18181b',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08)',
    shadowHover: '0 12px 40px rgba(0, 0, 0, 0.15), 0 6px 20px rgba(0, 0, 0, 0.1)',
    userBubble: 'rgba(16, 185, 129, 0.1)',
    assistantBubble: 'rgba(244, 244, 245, 0.8)',
  }

  // Voice transcription
  const handleTranscriptUpdate = useCallback((text: string) => {
    setPrompt(prev => (prev + text).trim())
  }, [])

  const {
    isRecording,
    isSupported: isVoiceSupported,
    startRecording,
    stopRecording,
  } = useWebSpeechTranscription({
    onTranscriptUpdate: handleTranscriptUpdate,
    continuous: false,
    interimResults: true,
  })

  // Update isListening state when recording changes
  useEffect(() => {
    setIsListening(isRecording)
  }, [isRecording])

  // Scroll to bottom when conversation updates
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [conversationHistory, streamingResponse])

  // Click outside to collapse - detects clicks on canvas or outside the MI bar
  useEffect(() => {
    if (!isExpanded) return

    const handleClickOutside = (event: MouseEvent | PointerEvent) => {
      // Check if click is outside the MI bar container
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
      }
    }

    // Use pointerdown to catch clicks before they reach canvas
    document.addEventListener('pointerdown', handleClickOutside, true)

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, true)
    }
  }, [isExpanded])

  // Handle voice toggle
  const toggleVoice = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  // Handle submit
  const handleSubmit = useCallback(async () => {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt || isLoading) return

    // Clear prompt immediately
    setPrompt('')
    setFollowUpSuggestions([]) // Clear previous follow-ups

    const newHistory: ConversationMessage[] = [
      ...conversationHistory,
      { role: 'user', content: trimmedPrompt }
    ]

    setConversationHistory(newHistory)
    setIsLoading(true)
    setIsExpanded(true)
    setStreamingResponse("")

    try {
      const { isIndexing: currentlyIndexing } = canvasAI.getIndexingStatus()
      if (!currentlyIndexing) {
        setIsIndexing(true)

        await canvasAI.indexCanvas((progress) => {
          setIndexingProgress(progress)
        })

        setIsIndexing(false)
        setIndexingProgress(100)
      }

      let fullResponse = ''
      let tools: ToolSchema[] = []

      const result = await canvasAI.query(
        trimmedPrompt,
        (partial, done) => {
          fullResponse = partial
          setStreamingResponse(partial)
          if (done) {
            setIsLoading(false)
          }
        }
      )

      // Capture suggested tools from the result
      tools = result.suggestedTools || []
      setSuggestedTools(tools)
      // Reset spawned tracking for new suggestions
      setSpawnedToolIds(new Set())

      // Generate follow-up suggestions based on result
      let newFollowUps: FollowUpSuggestion[] = []
      if (result.executedTransform) {
        // Transform was executed - suggest next steps
        setLastTransform(result.executedTransform)
        newFollowUps = getFollowUpSuggestions({
          type: 'transform',
          command: result.executedTransform,
          shapeCount: result.selectionCount,
        })
      } else {
        // Regular AI response - suggest based on content
        const keywords = extractTopicKeywords(fullResponse)
        newFollowUps = getFollowUpSuggestions({
          type: 'ai_response',
          hadSelection: result.hadSelection,
          topicKeywords: keywords,
        })
      }
      setFollowUpSuggestions(newFollowUps)

      const updatedHistory: ConversationMessage[] = [
        ...newHistory,
        {
          role: 'assistant',
          content: fullResponse,
          suggestedTools: tools,
          followUpSuggestions: newFollowUps,
          executedTransform: result.executedTransform,
        }
      ]

      setConversationHistory(updatedHistory)
      setStreamingResponse("")
      setIsLoading(false)

    } catch (error) {
      console.error('Mycelial Intelligence query error:', error)
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'

      const errorHistory: ConversationMessage[] = [
        ...newHistory,
        { role: 'assistant', content: `Error: ${errorMessage}` }
      ]

      setConversationHistory(errorHistory)
      setStreamingResponse("")
      setIsLoading(false)
      setFollowUpSuggestions([])
    }
  }, [prompt, isLoading, conversationHistory])

  // Toggle expanded state
  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  // Handle sending input directly to a selected tool
  const handleDirectToolInput = useCallback((input: string) => {
    if (!editor || !toolInputMode) return

    const shape = editor.getShape(toolInputMode.shapeId as any)
    if (!shape) return

    const toolType = toolInputMode.toolType

    // Update the shape's content based on tool type
    switch (toolType) {
      case 'Prompt':
      case 'ChatBox':
        // For AI tools, set the prompt/message
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          props: { ...shape.props as any, prompt: input },
        })
        break

      case 'ImageGen':
        // For image generation, set the prompt
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          props: { ...shape.props as any, prompt: input },
        })
        break

      case 'VideoGen':
        // For video generation, set the motion prompt
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          props: { ...shape.props as any, motionPrompt: input },
        })
        break

      case 'Markdown':
      case 'ObsNote':
        // For notes, append to or set content
        const currentContent = (shape.props as any).content || ''
        const newContent = currentContent
          ? `${currentContent}\n\n${input}`
          : input
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          props: { ...shape.props as any, content: newContent },
        })
        break

      case 'Embed':
        // For embed, set the URL
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          props: { ...shape.props as any, url: input },
        })
        break

      case 'Holon':
        // For Holon, set the holon ID
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          props: { ...shape.props as any, holonId: input },
        })
        break

      default:
        console.log(`Direct input not implemented for ${toolType}`)
    }

    // Clear the prompt
    setPrompt('')

    // Show confirmation in conversation
    setConversationHistory(prev => [
      ...prev,
      { role: 'user', content: `[Sent to ${TOOL_PROMPTS[toolType]?.inputLabel || toolType}]: ${input}` },
      { role: 'assistant', content: `I've added that to your ${toolType}. You can see it updated on the canvas.` }
    ])
  }, [editor, toolInputMode])

  // Handle spawning a single tool
  const handleSpawnTool = useCallback((tool: ToolSchema) => {
    if (!editor) return

    // Get viewport center for spawn position
    const viewportBounds = editor.getViewportPageBounds()
    const centerX = viewportBounds.x + viewportBounds.w / 2
    const centerY = viewportBounds.y + viewportBounds.h / 2 + 50 // Offset below MI bar

    const shapeId = spawnTool(editor, tool.id, { x: centerX, y: centerY }, {
      selectAfterSpawn: true,
    })

    if (shapeId) {
      // Track that this tool was spawned
      setSpawnedToolIds(prev => new Set([...prev, tool.id]))

      // Generate follow-up suggestions for the spawned tool
      const newFollowUps = getFollowUpSuggestions({
        type: 'tool_spawned',
        toolId: tool.id,
        toolName: tool.displayName,
      })
      setFollowUpSuggestions(newFollowUps)

      console.log(`Spawned ${tool.displayName} on canvas`)
    }
  }, [editor])

  // Handle spawning all suggested tools
  const handleSpawnAllTools = useCallback(() => {
    if (!editor || suggestedTools.length === 0) return

    const toolsToSpawn = suggestedTools.filter(t => !spawnedToolIds.has(t.id))
    if (toolsToSpawn.length === 0) return

    const ids = spawnTools(editor, toolsToSpawn, {
      arrangement: toolsToSpawn.length <= 2 ? 'horizontal' : 'grid',
      selectAfterSpawn: true,
      zoomToFit: toolsToSpawn.length > 2,
    })

    if (ids.length > 0) {
      setSpawnedToolIds(prev => new Set([...prev, ...toolsToSpawn.map(t => t.id)]))
      console.log(`Spawned ${ids.length} tools on canvas`)
    }
  }, [editor, suggestedTools, spawnedToolIds])

  // Responsive layout - detect window width and calculate available space
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const isMobile = windowWidth < 640
  const isNarrow = windowWidth < 768

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate available width between left and right menus
  // Left menu (hamburger, page menu): ~140px
  // Right menu (share, CryptID, settings): ~280px
  // Add padding: 20px on each side
  const leftMenuWidth = 140
  const rightMenuWidth = 280
  const menuPadding = 40 // 20px padding on each side
  const availableWidth = windowWidth - leftMenuWidth - rightMenuWidth - menuPadding
  const maxBarWidth = Math.max(200, Math.min(520, availableWidth)) // Clamp between 200-520px

  // Height: taller when showing suggestion chips (single tool or 2+ selected)
  // Base height matches the top-right menu (~40px) for visual alignment
  const showSuggestions = selectedToolInfo || (selectionInfo && selectionInfo.count > 1)
  const collapsedHeight = showSuggestions ? 68 : 40
  const maxExpandedHeight = isMobile ? 300 : 400
  // Responsive width: dynamically sized to fit between left and right menus
  const barWidth = isMobile ? 'calc(100% - 20px)' : maxBarWidth

  // Calculate dynamic height when expanded based on content
  // Header: ~45px, Input area: ~56px, padding: ~24px = ~125px fixed
  // Each message is roughly 50-80px, we'll let CSS handle the actual sizing
  const hasContent = conversationHistory.length > 0 || streamingResponse
  // Minimum expanded height when there's no content (just empty state)
  const minExpandedHeight = 180
  // Use auto height with max constraint when expanded
  const height = isExpanded ? 'auto' : collapsedHeight

  return (
    <div
      ref={containerRef}
      className="mycelial-intelligence-bar"
      style={{
        position: 'fixed',
        // On mobile: bottom of screen, on desktop: top center
        top: isMobile ? 'auto' : '10px',
        bottom: isMobile ? '70px' : 'auto', // Above bottom toolbar on mobile
        left: '50%',
        transform: 'translateX(-50%)',
        width: barWidth,
        maxWidth: isMobile ? 'none' : `${maxBarWidth}px`,
        height: isExpanded ? 'auto' : collapsedHeight,
        minHeight: isExpanded ? minExpandedHeight : collapsedHeight,
        maxHeight: isExpanded ? maxExpandedHeight : collapsedHeight,
        zIndex: isModalOpen ? 1 : 99999, // Lower z-index when modals are open
        pointerEvents: isModalOpen ? 'none' : 'auto', // Disable interactions when modal is open
        opacity: isModalOpen ? 0.3 : 1, // Fade when modal is open
        transition: 'opacity 0.2s ease, z-index 0s, top 0.3s ease, bottom 0.3s ease, width 0.3s ease',
      }}
      onPointerEnter={() => setIsHovering(true)}
      onPointerLeave={() => setIsHovering(false)}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          minHeight: isExpanded ? minExpandedHeight : collapsedHeight,
          maxHeight: isExpanded ? maxExpandedHeight : collapsedHeight,
          background: isHovering ? colors.backgroundHover : colors.background,
          borderRadius: isExpanded ? '20px' : '24px',
          border: `1px solid ${isHovering ? colors.borderHover : colors.border}`,
          boxShadow: isHovering ? colors.shadowHover : colors.shadow,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
          transition: 'all 0.3s ease',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {/* Collapsed: Single-line prompt bar with optional suggestions */}
        {!isExpanded && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: '4px 8px 4px 12px',
            height: '100%',
            justifyContent: 'center',
          }}>
            {/* Main input row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              {/* Mushroom + Brain icon with selection count badge */}
              <div style={{
                position: 'relative',
                flexShrink: 0,
              }}>
                <span style={{
                  fontSize: '14px',
                  opacity: 0.9,
                }}>
                  🍄🧠
                </span>
                {selectionInfo && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-8px',
                    background: '#8b5cf6',
                    color: 'white',
                    fontSize: '9px',
                    fontWeight: 600,
                    padding: '1px 4px',
                    borderRadius: '8px',
                    minWidth: '14px',
                    textAlign: 'center',
                  }}>
                    {selectionInfo.count}
                  </span>
                )}
              </div>

              {/* Input field - context-aware placeholder */}
              <input
                ref={inputRef}
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    // Direct tool input mode if single tool selected
                    if (selectedToolInfo?.promptInfo.canDirectInput && prompt.trim()) {
                      handleDirectToolInput(prompt.trim())
                    } else {
                      handleSubmit()
                    }
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                placeholder={
                  selectedToolInfo
                    ? selectedToolInfo.promptInfo.placeholder
                    : selectionInfo && selectionInfo.count > 1
                      ? `${selectionInfo.count} selected — try a suggestion below...`
                      : "Ask mi anything about this workspace..."
                }
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 4px',
                  fontSize: '13px',
                  color: colors.inputText,
                  outline: 'none',
                }}
              />

            {/* Connection status indicator - unobtrusive */}
            <ConnectionStatusBadge
              connectionState={connectionState}
              isNetworkOnline={isNetworkOnline}
              isDark={isDark}
            />

            {/* Indexing indicator */}
            {isIndexing && (
              <span style={{
                color: ACCENT_COLOR,
                fontSize: '11px',
                whiteSpace: 'nowrap',
                opacity: 0.8,
              }}>
                {Math.round(indexingProgress)}%
              </span>
            )}

            {/* Voice button (compact) */}
            {isVoiceSupported && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleVoice()
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: 'none',
                  background: isRecording
                    ? `rgba(16, 185, 129, 0.15)`
                    : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isRecording ? ACCENT_COLOR : colors.textMuted,
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                }}
                title={isRecording ? "Stop recording" : "Voice input"}
              >
                <MicrophoneIcon isListening={isRecording} />
              </button>
            )}

            {/* Send button - shows tool-specific label when tool selected */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (selectedToolInfo?.promptInfo.canDirectInput && prompt.trim()) {
                  handleDirectToolInput(prompt.trim())
                } else {
                  handleSubmit()
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={!prompt.trim() || isLoading}
              style={{
                height: '28px',
                padding: selectedToolInfo ? '0 10px' : '0 12px',
                borderRadius: '14px',
                border: 'none',
                background: prompt.trim() && !isLoading
                  ? selectedToolInfo ? '#6366f1' : ACCENT_COLOR
                  : colors.inputBg,
                cursor: prompt.trim() && !isLoading ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                color: prompt.trim() && !isLoading ? 'white' : colors.textMuted,
                transition: 'all 0.2s ease',
                flexShrink: 0,
                opacity: prompt.trim() && !isLoading ? 1 : 0.5,
                fontSize: '11px',
                fontWeight: 500,
              }}
              title={selectedToolInfo?.promptInfo.inputLabel || "Send"}
            >
              {selectedToolInfo && prompt.trim() ? (
                <>
                  <span style={{ fontSize: '12px' }}>→</span>
                  {selectedToolInfo.promptInfo.inputLabel}
                </>
              ) : (
                <SendIcon />
              )}
            </button>

            {/* Expand button if there's history */}
            {conversationHistory.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpand()
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: ACCENT_COLOR,
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
                title="View conversation"
              >
                <ExpandIcon isExpanded={false} />
              </button>
            )}
            </div>

            {/* Prompt suggestions row - context-aware */}
            {/* Show tool-specific help when single tool selected */}
            {selectedToolInfo && (
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  paddingTop: '2px',
                  paddingLeft: '28px',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <PromptSuggestion
                  label={`💡 ${selectedToolInfo.toolType} ideas`}
                  onClick={() => handleSuggestionClick(selectedToolInfo.promptInfo.helpPrompt)}
                />
                <PromptSuggestion
                  label="use canvas context"
                  onClick={() => handleSuggestionClick(`Use content from my canvas to help fill this ${selectedToolInfo.toolType}`)}
                />
              </div>
            )}

            {/* Show transform suggestions when multiple shapes selected */}
            {!selectedToolInfo && selectionInfo && selectionInfo.count > 1 && (
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  paddingTop: '2px',
                  paddingLeft: '28px', // Align with input field
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {SELECTION_SUGGESTIONS.slice(0, 5).map((suggestion) => (
                  <PromptSuggestion
                    key={suggestion.label}
                    label={suggestion.label}
                    onClick={() => handleSuggestionClick(suggestion.prompt)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Expanded: Header + Conversation + Input */}
        {isExpanded && (
          <>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: `1px solid ${colors.border}`,
              flexShrink: 0,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <span style={{ fontSize: '16px' }}>🍄🧠</span>
                <span style={{
                  color: colors.text,
                  fontSize: '13px',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                }}>
                  <span style={{ fontStyle: 'italic', opacity: 0.85 }}>ask your mycelial intelligence anything about this workspace</span>
                </span>
                {/* Connection status in expanded header */}
                <ConnectionStatusBadge
                  connectionState={connectionState}
                  isNetworkOnline={isNetworkOnline}
                  isDark={isDark}
                />
                {isIndexing && (
                  <span style={{
                    color: colors.textMuted,
                    fontSize: '11px',
                    marginLeft: '4px',
                  }}>
                    Indexing... {Math.round(indexingProgress)}%
                  </span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpand()
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.textMuted,
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                }}
                title="Collapse"
              >
                <ExpandIcon isExpanded={true} />
              </button>
            </div>

            {/* Conversation area */}
            <div
              ref={chatContainerRef}
              style={{
                flex: '1 1 auto',
                minHeight: 0, // Allow flex shrinking below content size
                overflowY: 'auto',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
              onWheel={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {conversationHistory.length === 0 && !streamingResponse && (
                <div style={{
                  color: colors.textMuted,
                  fontSize: '13px',
                  textAlign: 'center',
                  padding: '20px 16px',
                  lineHeight: '1.6',
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    I'm your Mycelial Intelligence — the awareness connecting all shapes and ideas in your workspace.
                  </div>
                  <div style={{ opacity: 0.8, fontSize: '12px' }}>
                    Ask me about what's on your canvas, how to use the tools, or what connections I perceive between your ideas.
                  </div>
                </div>
              )}

              {conversationHistory.map((msg, idx) => (
                <React.Fragment key={idx}>
                  <MessageBubble
                    content={msg.content}
                    role={msg.role}
                    colors={colors}
                  />

                  {/* Tool suggestions for assistant messages */}
                  {msg.role === 'assistant' && msg.suggestedTools && msg.suggestedTools.length > 0 && (
                    <div
                      style={{
                        alignSelf: 'flex-start',
                        maxWidth: '100%',
                        padding: '10px',
                        marginTop: '6px',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%)',
                        borderRadius: '12px',
                        border: '1px solid rgba(16, 185, 129, 0.15)',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                      }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: ACCENT_COLOR,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}>
                          Suggested Tools
                        </span>
                        {msg.suggestedTools.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSpawnAllTools()
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            style={{
                              fontSize: '11px',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              border: `1px solid ${ACCENT_COLOR}`,
                              background: 'transparent',
                              color: ACCENT_COLOR,
                              cursor: 'pointer',
                              fontWeight: 500,
                              transition: 'all 0.2s ease',
                            }}
                            title="Spawn all suggested tools on canvas"
                          >
                            Spawn All
                          </button>
                        )}
                      </div>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}>
                        {msg.suggestedTools.map((tool) => (
                          <ToolCard
                            key={tool.id}
                            tool={tool}
                            onSpawn={handleSpawnTool}
                            isSpawned={spawnedToolIds.has(tool.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                </React.Fragment>
              ))}

              {/* Streaming response */}
              {streamingResponse && (
                <>
                  <div style={{
                    alignSelf: 'flex-start',
                    maxWidth: '85%',
                    padding: '8px 12px',
                    borderRadius: '14px 14px 14px 4px',
                    backgroundColor: colors.assistantBubble,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                    fontSize: '13px',
                    lineHeight: '1.5',
                    wordBreak: 'break-word',
                    userSelect: 'text',
                    cursor: 'text',
                  }}>
                    {renderMessageContent(streamingResponse)}
                    {isLoading && (
                      <span style={{
                        display: 'inline-block',
                        width: '2px',
                        height: '14px',
                        backgroundColor: ACCENT_COLOR,
                        marginLeft: '2px',
                        animation: 'blink 1s infinite',
                      }} />
                    )}
                  </div>

                </>
              )}

              {/* Loading indicator */}
              {isLoading && !streamingResponse && (
                <div style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  gap: '5px',
                  padding: '8px 12px',
                }}>
                  <span className="loading-dot" style={{ backgroundColor: ACCENT_COLOR }} />
                  <span className="loading-dot" style={{ backgroundColor: ACCENT_COLOR, animationDelay: '0.2s' }} />
                  <span className="loading-dot" style={{ backgroundColor: ACCENT_COLOR, animationDelay: '0.4s' }} />
                </div>
              )}

              {/* Combined "Try next" section - tools + follow-up suggestions in one scrollable row */}
              {!isLoading && (followUpSuggestions.length > 0 || suggestedTools.length > 0) && (
                <div
                  style={{
                    alignSelf: 'flex-start',
                    maxWidth: '100%',
                    padding: '10px',
                    marginTop: '4px',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(16, 185, 129, 0.04) 100%)',
                    borderRadius: '12px',
                    border: '1px solid rgba(99, 102, 241, 0.1)',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: '#6366f1',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <span>✨</span>
                      Try next
                    </div>
                    {suggestedTools.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSpawnAllTools()
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{
                          fontSize: '10px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${ACCENT_COLOR}`,
                          background: 'transparent',
                          color: ACCENT_COLOR,
                          cursor: 'pointer',
                          fontWeight: 500,
                          transition: 'all 0.2s ease',
                        }}
                        title="Spawn all suggested tools on canvas"
                      >
                        Spawn All
                      </button>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    paddingBottom: '4px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(99, 102, 241, 0.3) transparent',
                  }}>
                    {/* Suggested tools first */}
                    {suggestedTools.map((tool) => (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        onSpawn={handleSpawnTool}
                        isSpawned={spawnedToolIds.has(tool.id)}
                      />
                    ))}
                    {/* Then follow-up prompts */}
                    {followUpSuggestions.map((suggestion, i) => (
                      <FollowUpChip
                        key={`current-${suggestion.label}-${i}`}
                        suggestion={suggestion}
                        onClick={() => handleSuggestionClick(suggestion.prompt)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input area (expanded) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderTop: `1px solid ${colors.border}`,
              flexShrink: 0,
            }}>
              <input
                ref={inputRef}
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                placeholder="Ask a follow-up..."
                style={{
                  flex: 1,
                  background: colors.inputBg,
                  border: `1px solid ${colors.inputBorder}`,
                  borderRadius: '18px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  color: colors.inputText,
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}
              />

              {/* Voice input button */}
              {isVoiceSupported && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleVoice()
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    border: `1px solid ${isRecording ? ACCENT_COLOR : colors.inputBorder}`,
                    background: isRecording
                      ? `rgba(16, 185, 129, 0.1)`
                      : colors.inputBg,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isRecording ? ACCENT_COLOR : colors.textMuted,
                    transition: 'all 0.2s ease',
                    boxShadow: isRecording ? `0 0 12px rgba(16, 185, 129, 0.3)` : 'none',
                    flexShrink: 0,
                  }}
                  title={isRecording ? "Stop recording" : "Start voice input"}
                >
                  <MicrophoneIcon isListening={isRecording} />
                </button>
              )}

              {/* Send button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleSubmit()
                }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={!prompt.trim() || isLoading}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: 'none',
                  background: prompt.trim() && !isLoading
                    ? ACCENT_COLOR
                    : colors.inputBg,
                  cursor: prompt.trim() && !isLoading ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: prompt.trim() && !isLoading ? 'white' : colors.textMuted,
                  transition: 'all 0.2s ease',
                  boxShadow: prompt.trim() && !isLoading
                    ? '0 2px 8px rgba(16, 185, 129, 0.3)'
                    : 'none',
                  flexShrink: 0,
                }}
                title="Send message"
              >
                <SendIcon />
              </button>
            </div>
          </>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .loading-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out;
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        @keyframes connectionPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
