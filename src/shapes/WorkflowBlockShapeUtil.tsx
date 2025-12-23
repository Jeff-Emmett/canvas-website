/**
 * WorkflowBlockShapeUtil
 *
 * A visual workflow block shape with typed input/output ports.
 * Supports connection to other blocks via tldraw arrows for
 * building automation flows, data pipelines, and AI agent chains.
 */

import {
  BaseBoxShapeUtil,
  Geometry2d,
  HTMLContainer,
  Rectangle2d,
  TLBaseShape,
  Vec,
} from 'tldraw'
import React, { useState, useCallback, useMemo } from 'react'
import { StandardizedToolWrapper } from '../components/StandardizedToolWrapper'
import { usePinnedToView } from '../hooks/usePinnedToView'
import { useMaximize } from '../hooks/useMaximize'
import {
  WorkflowBlockProps,
  ExecutionState,
  getPortTypeColor,
  CATEGORY_INFO,
} from '../lib/workflow/types'
import {
  getBlockDefinition,
  hasBlockDefinition,
} from '../lib/workflow/blockRegistry'

// =============================================================================
// Shape Type Definition
// =============================================================================

export type IWorkflowBlock = TLBaseShape<'WorkflowBlock', WorkflowBlockProps>

// =============================================================================
// Constants
// =============================================================================

const PORT_SIZE = 12
const PORT_SPACING = 28
const HEADER_HEIGHT = 36
const MIN_WIDTH = 180
const MIN_HEIGHT = 100
const DEFAULT_WIDTH = 220
const DEFAULT_HEIGHT = 150

// =============================================================================
// Execution State Colors
// =============================================================================

const EXECUTION_COLORS: Record<ExecutionState, { bg: string; border: string; text: string }> = {
  idle: { bg: 'transparent', border: 'transparent', text: '#6b7280' },
  running: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  success: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
}

// =============================================================================
// Port Renderer Component
// =============================================================================

interface PortProps {
  port: { id: string; name: string; type: string; required?: boolean }
  direction: 'input' | 'output'
  index: number
  shapeWidth: number
  isConnected?: boolean
  onHover?: (portId: string | null) => void
}

const Port: React.FC<PortProps> = ({
  port,
  direction,
  index,
  shapeWidth,
  isConnected = false,
  onHover,
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const color = getPortTypeColor(port.type as any)

  const x = direction === 'input' ? -PORT_SIZE / 2 : shapeWidth - PORT_SIZE / 2
  const y = HEADER_HEIGHT + 12 + index * PORT_SPACING

  const handleMouseEnter = () => {
    setIsHovered(true)
    onHover?.(port.id)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    onHover?.(null)
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: PORT_SIZE,
        height: PORT_SIZE,
        borderRadius: '50%',
        backgroundColor: isConnected ? color : 'white',
        border: `2px solid ${color}`,
        cursor: 'crosshair',
        transform: isHovered ? 'scale(1.3)' : 'scale(1)',
        transition: 'transform 0.15s ease, background-color 0.15s ease',
        zIndex: 10,
        boxShadow: isHovered ? `0 0 8px ${color}` : 'none',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={`${port.name} (${port.type})${port.required ? ' *' : ''}`}
      data-port-id={port.id}
      data-port-direction={direction}
      data-port-type={port.type}
    />
  )
}

// =============================================================================
// Port Label Component
// =============================================================================

interface PortLabelProps {
  port: { id: string; name: string; type: string }
  direction: 'input' | 'output'
  index: number
  shapeWidth: number
}

const PortLabel: React.FC<PortLabelProps> = ({ port, direction, index, shapeWidth }) => {
  const y = HEADER_HEIGHT + 12 + index * PORT_SPACING
  const color = getPortTypeColor(port.type as any)

  return (
    <div
      style={{
        position: 'absolute',
        left: direction === 'input' ? PORT_SIZE + 4 : 'auto',
        right: direction === 'output' ? PORT_SIZE + 4 : 'auto',
        top: y - 3,
        fontSize: '11px',
        color: '#4b5563',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {direction === 'output' && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: color,
            opacity: 0.6,
          }}
        />
      )}
      <span>{port.name}</span>
      {direction === 'input' && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: color,
            opacity: 0.6,
          }}
        />
      )}
    </div>
  )
}

// =============================================================================
// Main Shape Util Class
// =============================================================================

export class WorkflowBlockShapeUtil extends BaseBoxShapeUtil<IWorkflowBlock> {
  static override type = 'WorkflowBlock' as const

  // Workflow blocks use indigo as base, but category determines actual color
  static readonly PRIMARY_COLOR = '#6366f1'

  getDefaultProps(): IWorkflowBlock['props'] {
    return {
      w: DEFAULT_WIDTH,
      h: DEFAULT_HEIGHT,
      blockType: 'trigger.manual',
      blockConfig: {},
      inputValues: {},
      outputValues: {},
      executionState: 'idle',
      tags: ['workflow'],
      pinnedToView: false,
    }
  }

  getGeometry(shape: IWorkflowBlock): Geometry2d {
    return new Rectangle2d({
      width: Math.max(shape.props.w, MIN_WIDTH),
      height: Math.max(shape.props.h, MIN_HEIGHT),
      isFilled: true,
    })
  }

  /**
   * Get the position of a port in shape-local coordinates.
   * Used for arrow snapping.
   */
  getPortPosition(shape: IWorkflowBlock, portId: string, direction: 'input' | 'output'): Vec {
    if (!hasBlockDefinition(shape.props.blockType)) {
      return new Vec(0, HEADER_HEIGHT + 20)
    }

    const definition = getBlockDefinition(shape.props.blockType)
    const ports = direction === 'input' ? definition.inputs : definition.outputs
    const portIndex = ports.findIndex(p => p.id === portId)

    if (portIndex === -1) {
      return new Vec(0, HEADER_HEIGHT + 20)
    }

    const x = direction === 'input' ? 0 : shape.props.w
    const y = HEADER_HEIGHT + 12 + portIndex * PORT_SPACING + PORT_SIZE / 2

    return new Vec(x, y)
  }

  component(shape: IWorkflowBlock) {
    const { blockType, executionState, executionError, blockConfig } = shape.props

    // Get block definition
    const definition = useMemo(() => {
      if (!hasBlockDefinition(blockType)) {
        return null
      }
      return getBlockDefinition(blockType)
    }, [blockType])

    // Determine colors based on category
    const categoryColor = definition
      ? CATEGORY_INFO[definition.category].color
      : WorkflowBlockShapeUtil.PRIMARY_COLOR

    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)
    const [hoveredPort, setHoveredPort] = useState<string | null>(null)

    // Pin to view functionality
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView, { position: 'current' })

    // Maximize functionality
    const { isMaximized, toggleMaximize } = useMaximize({
      editor: this.editor,
      shapeId: shape.id,
      currentW: shape.props.w,
      currentH: shape.props.h,
      shapeType: 'WorkflowBlock',
      padding: 40,
    })

    // Handlers
    const handleClose = useCallback(() => {
      this.editor.deleteShapes([shape.id])
    }, [shape.id])

    const handlePinToggle = useCallback(() => {
      this.editor.updateShape<IWorkflowBlock>({
        id: shape.id,
        type: 'WorkflowBlock',
        props: { pinnedToView: !shape.props.pinnedToView },
      })
    }, [shape.id, shape.props.pinnedToView])

    const handleTagsChange = useCallback((newTags: string[]) => {
      this.editor.updateShape<IWorkflowBlock>({
        id: shape.id,
        type: 'WorkflowBlock',
        props: { tags: newTags },
      })
    }, [shape.id])

    const handleRunBlock = useCallback(() => {
      // Trigger manual execution (will be handled by executor)
      this.editor.updateShape<IWorkflowBlock>({
        id: shape.id,
        type: 'WorkflowBlock',
        props: { executionState: 'running' },
      })

      // Dispatch custom event for executor to pick up
      window.dispatchEvent(new CustomEvent('workflow:execute-block', {
        detail: { blockId: shape.id },
      }))
    }, [shape.id])

    // If block type is unknown, show error state
    if (!definition) {
      return (
        <HTMLContainer
          style={{
            width: shape.props.w,
            height: shape.props.h,
            pointerEvents: 'all',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#fee2e2',
              border: '2px solid #ef4444',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#991b1b',
              fontSize: 12,
              padding: 16,
              textAlign: 'center',
            }}
          >
            Unknown block type: {blockType}
          </div>
        </HTMLContainer>
      )
    }

    const executionColors = EXECUTION_COLORS[executionState]

    // Calculate minimum height based on ports
    const maxPorts = Math.max(definition.inputs.length, definition.outputs.length)
    const calculatedHeight = Math.max(
      shape.props.h,
      HEADER_HEIGHT + 24 + maxPorts * PORT_SPACING + 40
    )

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: calculatedHeight,
          pointerEvents: 'all',
        }}
      >
        <StandardizedToolWrapper
          title={definition.name}
          primaryColor={categoryColor}
          isSelected={isSelected}
          width={shape.props.w}
          height={calculatedHeight}
          onClose={handleClose}
          onMaximize={toggleMaximize}
          isMaximized={isMaximized}
          editor={this.editor}
          shapeId={shape.id}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          tags={shape.props.tags}
          onTagsChange={handleTagsChange}
          tagsEditable={true}
          headerContent={
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 14 }}>{definition.icon}</span>
            </div>
          }
        >
          {/* Execution state indicator */}
          {executionState !== 'idle' && (
            <div
              style={{
                position: 'absolute',
                top: HEADER_HEIGHT + 4,
                right: 8,
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: executionColors.bg,
                border: `1px solid ${executionColors.border}`,
                color: executionColors.text,
                fontSize: 10,
                fontWeight: 500,
                textTransform: 'uppercase',
              }}
            >
              {executionState === 'running' && '⏳ Running'}
              {executionState === 'success' && '✓ Done'}
              {executionState === 'error' && '✕ Error'}
            </div>
          )}

          {/* Block description */}
          <div
            style={{
              padding: '8px 12px',
              fontSize: 11,
              color: '#6b7280',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            {definition.description}
          </div>

          {/* Ports container */}
          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: maxPorts * PORT_SPACING + 24,
            }}
          >
            {/* Input ports */}
            {definition.inputs.map((port, index) => (
              <React.Fragment key={`input-${port.id}`}>
                <Port
                  port={port}
                  direction="input"
                  index={index}
                  shapeWidth={shape.props.w}
                  onHover={setHoveredPort}
                />
                <PortLabel
                  port={port}
                  direction="input"
                  index={index}
                  shapeWidth={shape.props.w}
                />
              </React.Fragment>
            ))}

            {/* Output ports */}
            {definition.outputs.map((port, index) => (
              <React.Fragment key={`output-${port.id}`}>
                <Port
                  port={port}
                  direction="output"
                  index={index}
                  shapeWidth={shape.props.w}
                  onHover={setHoveredPort}
                />
                <PortLabel
                  port={port}
                  direction="output"
                  index={index}
                  shapeWidth={shape.props.w}
                />
              </React.Fragment>
            ))}
          </div>

          {/* Error message */}
          {executionError && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                fontSize: 11,
                borderTop: '1px solid #fecaca',
              }}
            >
              {executionError}
            </div>
          )}

          {/* Run button for trigger blocks */}
          {definition.category === 'trigger' && (
            <div
              style={{
                padding: '8px 12px',
                borderTop: '1px solid #e5e7eb',
              }}
            >
              <button
                onClick={handleRunBlock}
                disabled={executionState === 'running'}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  backgroundColor: executionState === 'running' ? '#9ca3af' : categoryColor,
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: executionState === 'running' ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (executionState !== 'running') {
                    e.currentTarget.style.opacity = '0.9'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1'
                }}
              >
                {executionState === 'running' ? 'Running...' : '▶ Run'}
              </button>
            </div>
          )}
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  indicator(shape: IWorkflowBlock) {
    // Calculate height same as component
    const definition = hasBlockDefinition(shape.props.blockType)
      ? getBlockDefinition(shape.props.blockType)
      : null

    const maxPorts = definition
      ? Math.max(definition.inputs.length, definition.outputs.length)
      : 0
    const calculatedHeight = Math.max(
      shape.props.h,
      HEADER_HEIGHT + 24 + maxPorts * PORT_SPACING + 40
    )

    return (
      <rect
        width={Math.max(shape.props.w, MIN_WIDTH)}
        height={calculatedHeight}
        rx={8}
      />
    )
  }
}

// Export the shape for registration
export const WorkflowBlockShape = WorkflowBlockShapeUtil
