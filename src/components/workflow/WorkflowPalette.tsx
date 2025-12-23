/**
 * WorkflowPalette
 *
 * Sidebar palette showing available workflow blocks organized by category.
 * Supports click-to-place and displays block descriptions.
 */

import React, { useState, useCallback, useMemo } from 'react'
import { Editor } from 'tldraw'
import {
  getAllBlockDefinitions,
  getBlocksByCategory,
} from '@/lib/workflow/blockRegistry'
import {
  BlockCategory,
  BlockDefinition,
  CATEGORY_INFO,
} from '@/lib/workflow/types'
import {
  setWorkflowBlockType,
} from '@/tools/WorkflowBlockTool'

// =============================================================================
// Types
// =============================================================================

interface WorkflowPaletteProps {
  editor: Editor
  isOpen: boolean
  onClose: () => void
}

// =============================================================================
// Category Section Component
// =============================================================================

interface CategorySectionProps {
  category: BlockCategory
  blocks: BlockDefinition[]
  isExpanded: boolean
  onToggle: () => void
  onBlockClick: (blockType: string) => void
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  blocks,
  isExpanded,
  onToggle,
  onBlockClick,
}) => {
  const info = CATEGORY_INFO[category]

  return (
    <div className="workflow-palette-category">
      <button
        className="workflow-palette-category-header"
        onClick={onToggle}
        style={{ borderLeftColor: info.color }}
      >
        <span className="workflow-palette-category-icon">{info.icon}</span>
        <span className="workflow-palette-category-label">{info.label}</span>
        <span className="workflow-palette-category-count">{blocks.length}</span>
        <span className={`workflow-palette-chevron ${isExpanded ? 'expanded' : ''}`}>
          ▶
        </span>
      </button>

      {isExpanded && (
        <div className="workflow-palette-blocks">
          {blocks.map((block) => (
            <BlockCard
              key={block.type}
              block={block}
              categoryColor={info.color}
              onClick={() => onBlockClick(block.type)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Block Card Component
// =============================================================================

interface BlockCardProps {
  block: BlockDefinition
  categoryColor: string
  onClick: () => void
}

const BlockCard: React.FC<BlockCardProps> = ({ block, categoryColor, onClick }) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <button
      className="workflow-palette-block"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderLeftColor: isHovered ? categoryColor : 'transparent',
      }}
    >
      <span className="workflow-palette-block-icon">{block.icon}</span>
      <div className="workflow-palette-block-content">
        <span className="workflow-palette-block-name">{block.name}</span>
        <span className="workflow-palette-block-description">
          {block.description}
        </span>
      </div>
      <div className="workflow-palette-block-ports">
        <span className="workflow-palette-port-count" title="Inputs">
          ← {block.inputs.length}
        </span>
        <span className="workflow-palette-port-count" title="Outputs">
          {block.outputs.length} →
        </span>
      </div>
    </button>
  )
}

// =============================================================================
// Search Bar Component
// =============================================================================

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => {
  return (
    <div className="workflow-palette-search">
      <input
        type="text"
        placeholder="Search blocks..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="workflow-palette-search-input"
      />
      {value && (
        <button
          className="workflow-palette-search-clear"
          onClick={() => onChange('')}
        >
          ×
        </button>
      )}
    </div>
  )
}

// =============================================================================
// Main Palette Component
// =============================================================================

const WorkflowPalette: React.FC<WorkflowPaletteProps> = ({
  editor,
  isOpen,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<BlockCategory>>(
    new Set(['trigger', 'action'])
  )

  const allBlocks = useMemo(() => getAllBlockDefinitions(), [])

  const categories: BlockCategory[] = [
    'trigger',
    'action',
    'condition',
    'transformer',
    'ai',
    'output',
  ]

  const filteredBlocksByCategory = useMemo(() => {
    const result: Record<BlockCategory, BlockDefinition[]> = {
      trigger: [],
      action: [],
      condition: [],
      transformer: [],
      ai: [],
      output: [],
    }

    const query = searchQuery.toLowerCase()

    for (const block of allBlocks) {
      const matches =
        !query ||
        block.name.toLowerCase().includes(query) ||
        block.description.toLowerCase().includes(query) ||
        block.type.toLowerCase().includes(query)

      if (matches) {
        result[block.category].push(block)
      }
    }

    return result
  }, [allBlocks, searchQuery])

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

  const handleBlockClick = useCallback(
    (blockType: string) => {
      // Set the block type for the tool
      setWorkflowBlockType(blockType)

      // Switch to the WorkflowBlock tool
      editor.setCurrentTool('WorkflowBlock')
    },
    [editor]
  )

  if (!isOpen) return null

  return (
    <div className="workflow-palette">
      <div className="workflow-palette-header">
        <h3 className="workflow-palette-title">Workflow Blocks</h3>
        <button className="workflow-palette-close" onClick={onClose}>
          ×
        </button>
      </div>

      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      <div className="workflow-palette-content">
        {categories.map((category) => {
          const blocks = filteredBlocksByCategory[category]
          if (blocks.length === 0 && searchQuery) return null

          return (
            <CategorySection
              key={category}
              category={category}
              blocks={blocks}
              isExpanded={expandedCategories.has(category) || !!searchQuery}
              onToggle={() => toggleCategory(category)}
              onBlockClick={handleBlockClick}
            />
          )
        })}
      </div>

      <div className="workflow-palette-footer">
        <div className="workflow-palette-hint">
          Click a block to place it on the canvas
        </div>
      </div>
    </div>
  )
}

export default WorkflowPalette
