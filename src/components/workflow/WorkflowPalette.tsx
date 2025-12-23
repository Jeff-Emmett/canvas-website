/**
 * WorkflowPalette
 *
 * A sidebar panel displaying available workflow blocks organized by category.
 * Users can click on blocks to enter placement mode or drag them onto the canvas.
 */

import React, { useState, useCallback, useMemo } from 'react'
import { useEditor } from 'tldraw'
import {
  getAllBlockDefinitions,
  getBlocksByCategory,
} from '@/lib/workflow/blockRegistry'
import {
  BlockCategory,
  BlockDefinition,
  CATEGORY_INFO,
} from '@/lib/workflow/types'
import { setWorkflowBlockType } from '@/tools/WorkflowBlockTool'
import { executeWorkflow, resetWorkflow } from '@/lib/workflow/executor'
import { setAutoExecute, isAutoExecuteEnabled } from '@/propagators/WorkflowPropagator'

// =============================================================================
// Types
// =============================================================================

interface WorkflowPaletteProps {
  isOpen: boolean
  onClose: () => void
}

// =============================================================================
// Block Card Component
// =============================================================================

interface BlockCardProps {
  definition: BlockDefinition
  onSelect: (blockType: string) => void
}

const BlockCard: React.FC<BlockCardProps> = ({ definition, onSelect }) => {
  const [isHovered, setIsHovered] = useState(false)
  const categoryInfo = CATEGORY_INFO[definition.category]

  return (
    <div
      onClick={() => onSelect(definition.type)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '10px 12px',
        backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        borderLeft: `3px solid ${categoryInfo.color}`,
        marginBottom: 4,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{definition.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#1f2937',
            marginBottom: 2,
          }}
        >
          {definition.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#6b7280',
            lineHeight: 1.4,
          }}
        >
          {definition.description}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 6,
            fontSize: 10,
            color: '#9ca3af',
          }}
        >
          <span>{definition.inputs.length} inputs</span>
          <span>{definition.outputs.length} outputs</span>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Category Section Component
// =============================================================================

interface CategorySectionProps {
  category: BlockCategory
  blocks: BlockDefinition[]
  isExpanded: boolean
  onToggle: () => void
  onSelectBlock: (blockType: string) => void
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  blocks,
  isExpanded,
  onToggle,
  onSelectBlock,
}) => {
  const categoryInfo = CATEGORY_INFO[category]

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={onToggle}
        style={{
          padding: '8px 12px',
          backgroundColor: 'rgba(0, 0, 0, 0.02)',
          borderRadius: 6,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          userSelect: 'none',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: categoryInfo.color,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#374151',
            flex: 1,
          }}
        >
          {categoryInfo.label}
        </span>
        <span
          style={{
            fontSize: 10,
            color: '#9ca3af',
            marginRight: 4,
          }}
        >
          {blocks.length}
        </span>
        <span
          style={{
            fontSize: 12,
            color: '#9ca3af',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          ▶
        </span>
      </div>

      {isExpanded && (
        <div style={{ marginTop: 4, paddingLeft: 4 }}>
          {blocks.map((block) => (
            <BlockCard
              key={block.type}
              definition={block}
              onSelect={onSelectBlock}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Main Palette Component
// =============================================================================

export const WorkflowPalette: React.FC<WorkflowPaletteProps> = ({
  isOpen,
  onClose,
}) => {
  const editor = useEditor()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<BlockCategory>>(
    new Set(['trigger', 'action'])
  )
  const [autoExecute, setAutoExecuteState] = useState(isAutoExecuteEnabled())
  const [isExecuting, setIsExecuting] = useState(false)

  // Get all blocks grouped by category
  const blocksByCategory = useMemo(() => {
    const categories: BlockCategory[] = ['trigger', 'action', 'condition', 'transformer', 'ai', 'output']
    const result: Record<BlockCategory, BlockDefinition[]> = {} as any

    for (const category of categories) {
      const blocks = getBlocksByCategory(category)

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        result[category] = blocks.filter(
          (b) =>
            b.name.toLowerCase().includes(query) ||
            b.description.toLowerCase().includes(query) ||
            b.type.toLowerCase().includes(query)
        )
      } else {
        result[category] = blocks
      }
    }

    return result
  }, [searchQuery])

  // Toggle category expansion
  const toggleCategory = useCallback((category: BlockCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  // Handle block selection
  const handleSelectBlock = useCallback(
    (blockType: string) => {
      setWorkflowBlockType(blockType)
      editor.setCurrentTool('WorkflowBlock')
    },
    [editor]
  )

  // Handle run workflow
  const handleRunWorkflow = useCallback(async () => {
    setIsExecuting(true)
    try {
      await executeWorkflow(editor, {
        onProgress: (completed, total) => {
          console.log(`Workflow progress: ${completed}/${total}`)
        },
      })
    } finally {
      setIsExecuting(false)
    }
  }, [editor])

  // Handle reset workflow
  const handleResetWorkflow = useCallback(() => {
    resetWorkflow(editor)
  }, [editor])

  // Toggle auto-execute
  const handleToggleAutoExecute = useCallback(() => {
    const newValue = !autoExecute
    setAutoExecuteState(newValue)
    setAutoExecute(newValue)
  }, [autoExecute])

  if (!isOpen) return null

  const categories: BlockCategory[] = ['trigger', 'action', 'condition', 'transformer', 'ai', 'output']

  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        left: 10,
        width: 280,
        maxHeight: 'calc(100vh - 120px)',
        backgroundColor: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        border: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#1f2937',
            }}
          >
            Workflow Blocks
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 18,
            color: '#9ca3af',
            cursor: 'pointer',
            padding: 4,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>
        <input
          type="text"
          placeholder="Search blocks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 13,
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            outline: 'none',
            backgroundColor: '#f9fafb',
          }}
        />
      </div>

      {/* Execution Controls */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          onClick={handleRunWorkflow}
          disabled={isExecuting}
          style={{
            flex: 1,
            padding: '8px 12px',
            backgroundColor: isExecuting ? '#9ca3af' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            cursor: isExecuting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {isExecuting ? (
            <>
              <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
              Running...
            </>
          ) : (
            <>▶ Run Workflow</>
          )}
        </button>
        <button
          onClick={handleResetWorkflow}
          style={{
            padding: '8px 12px',
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
          title="Reset all blocks"
        >
          ↺
        </button>
      </div>

      {/* Auto-execute Toggle */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          Real-time propagation
        </span>
        <button
          onClick={handleToggleAutoExecute}
          style={{
            width: 40,
            height: 22,
            borderRadius: 11,
            border: 'none',
            backgroundColor: autoExecute ? '#10b981' : '#d1d5db',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background-color 0.15s ease',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: autoExecute ? 20 : 2,
              width: 18,
              height: 18,
              borderRadius: '50%',
              backgroundColor: 'white',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
              transition: 'left 0.15s ease',
            }}
          />
        </button>
      </div>

      {/* Block Categories */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
        }}
      >
        {categories.map((category) => {
          const blocks = blocksByCategory[category]
          if (blocks.length === 0 && searchQuery) return null

          return (
            <CategorySection
              key={category}
              category={category}
              blocks={blocks}
              isExpanded={expandedCategories.has(category)}
              onToggle={() => toggleCategory(category)}
              onSelectBlock={handleSelectBlock}
            />
          )
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid #e5e7eb',
          fontSize: 11,
          color: '#9ca3af',
          textAlign: 'center',
        }}
      >
        Click a block, then click on canvas to place
      </div>
    </div>
  )
}

export default WorkflowPalette
