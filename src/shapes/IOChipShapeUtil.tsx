import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
  TLShapeId,
  Box,
  TLShape,
} from "tldraw"
import React, { useState, useEffect, useCallback, useMemo } from "react"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"
import { usePinnedToView } from "../hooks/usePinnedToView"
import { ioChipTemplateService, IOWireConnection, ContainedShapeRef, IOChipTemplate } from "@/lib/IOChipTemplateService"

// Pin types that can be detected or defined
export type IOPinType =
  | 'text'       // Text input/output
  | 'image'      // Image data
  | 'video'      // Video data
  | 'url'        // URL/link
  | 'file'       // File upload
  | 'identity'   // User identity/auth
  | 'api'        // API endpoint
  | 'shape'      // Shape reference
  | 'data'       // Generic data
  | 'prompt'     // AI prompt
  | 'embedding'  // Vector embedding
  | 'stream'     // Streaming data

export interface IOPin {
  id: string
  name: string
  type: IOPinType
  direction: 'input' | 'output'
  description?: string
  required?: boolean
  connected?: boolean
  connectedTo?: string // Pin ID it's connected to
  connectedToShape?: TLShapeId // Shape the connected pin belongs to
  value?: any
  sourceShapeId?: TLShapeId // The shape this pin was derived from
}

type IIOChip = TLBaseShape<
  "IOChip",
  {
    w: number
    h: number
    name: string
    description?: string
    inputPins: IOPin[]
    outputPins: IOPin[]
    wires: IOWireConnection[]  // Internal wiring between contained shapes
    containedShapeIds: TLShapeId[]
    isAnalyzing: boolean
    lastAnalyzed: number
    pinnedToView: boolean
    tags: string[]
    autoAnalyze: boolean
    showPinLabels: boolean
    templateId?: string  // Reference to saved template
    category?: string
  }
>

// Shape type to I/O mapping - defines what inputs/outputs each shape type has
const SHAPE_IO_MAPPINGS: Record<string, { inputs: Partial<IOPin>[]; outputs: Partial<IOPin>[] }> = {
  'ImageGen': {
    inputs: [
      { name: 'Prompt', type: 'prompt', required: true },
      { name: 'Endpoint', type: 'api', required: false },
    ],
    outputs: [
      { name: 'Image', type: 'image' },
    ],
  },
  'VideoGen': {
    inputs: [
      { name: 'Prompt', type: 'prompt', required: true },
      { name: 'Source Image', type: 'image', required: false },
    ],
    outputs: [
      { name: 'Video', type: 'video' },
    ],
  },
  'ChatBox': {
    inputs: [
      { name: 'Message', type: 'text', required: true },
      { name: 'Context', type: 'text', required: false },
    ],
    outputs: [
      { name: 'Response', type: 'text' },
    ],
  },
  'Prompt': {
    inputs: [
      { name: 'Prompt Text', type: 'prompt', required: true },
      { name: 'Context', type: 'text', required: false },
    ],
    outputs: [
      { name: 'LLM Response', type: 'text' },
    ],
  },
  'Transcription': {
    inputs: [
      { name: 'Audio', type: 'file', required: true },
    ],
    outputs: [
      { name: 'Transcript', type: 'text' },
    ],
  },
  'Embed': {
    inputs: [
      { name: 'URL', type: 'url', required: true },
    ],
    outputs: [
      { name: 'Embed', type: 'shape' },
    ],
  },
  'Markdown': {
    inputs: [
      { name: 'Markdown', type: 'text', required: true },
    ],
    outputs: [
      { name: 'Rendered', type: 'shape' },
    ],
  },
  'Holon': {
    inputs: [
      { name: 'Holon ID', type: 'text', required: true },
    ],
    outputs: [
      { name: 'Data', type: 'data' },
    ],
  },
  'Multmux': {
    inputs: [
      { name: 'Command', type: 'text', required: true },
    ],
    outputs: [
      { name: 'Output', type: 'text' },
      { name: 'Exit Code', type: 'data' },
    ],
  },
  'MycelialIntelligence': {
    inputs: [
      { name: 'Query', type: 'prompt', required: true },
      { name: 'Context', type: 'data', required: false },
    ],
    outputs: [
      { name: 'Response', type: 'text' },
      { name: 'Actions', type: 'data' },
    ],
  },
  'IOChip': {
    inputs: [
      { name: 'Input', type: 'data', required: false },
    ],
    outputs: [
      { name: 'Output', type: 'data' },
    ],
  },
  // Default for unknown shapes
  'default': {
    inputs: [
      { name: 'Input', type: 'data' },
    ],
    outputs: [
      { name: 'Output', type: 'data' },
    ],
  },
}

// Pin type icons - exported for use in other components
export const PIN_TYPE_ICONS: Record<IOPinType, string> = {
  'text': '📝',
  'image': '🖼️',
  'video': '🎬',
  'url': '🔗',
  'file': '📁',
  'identity': '👤',
  'api': '🔌',
  'shape': '⬡',
  'data': '📊',
  'prompt': '💭',
  'embedding': '🧬',
  'stream': '🌊',
}

// Pin type colors - exported for use in other components
export const PIN_TYPE_COLORS: Record<IOPinType, string> = {
  'text': '#3b82f6',      // blue
  'image': '#8b5cf6',     // purple
  'video': '#ec4899',     // pink
  'url': '#06b6d4',       // cyan
  'file': '#f59e0b',      // amber
  'identity': '#10b981',  // emerald
  'api': '#ef4444',       // red
  'shape': '#6366f1',     // indigo
  'data': '#84cc16',      // lime
  'prompt': '#f97316',    // orange
  'embedding': '#14b8a6', // teal
  'stream': '#0ea5e9',    // sky
}

// Check if two pin types are compatible for connection
export function arePinTypesCompatible(type1: IOPinType, type2: IOPinType): boolean {
  if (type1 === type2) return true

  // Define compatible type pairs
  const compatibilityMap: Record<IOPinType, IOPinType[]> = {
    'text': ['prompt', 'data'],
    'prompt': ['text', 'data'],
    'data': ['text', 'prompt', 'url', 'file', 'image', 'video', 'shape', 'embedding', 'stream'],
    'url': ['text', 'data'],
    'file': ['data'],
    'image': ['data', 'file'],
    'video': ['data', 'file'],
    'identity': ['data'],
    'api': ['data', 'url'],
    'shape': ['data'],
    'embedding': ['data'],
    'stream': ['data', 'text'],
  }

  return compatibilityMap[type1]?.includes(type2) || compatibilityMap[type2]?.includes(type1)
}

export class IOChipShape extends BaseBoxShapeUtil<IIOChip> {
  static override type = "IOChip" as const

  // IO Chip theme color: Electric blue
  static readonly PRIMARY_COLOR = "#3b82f6"

  getDefaultProps(): IIOChip["props"] {
    return {
      w: 400,
      h: 300,
      name: "IO Chip",
      description: "Drag shapes into this chip to automatically analyze their I/O",
      inputPins: [],
      outputPins: [],
      wires: [],
      containedShapeIds: [],
      isAnalyzing: false,
      lastAnalyzed: 0,
      pinnedToView: false,
      tags: ['io-chip'],
      autoAnalyze: true,
      showPinLabels: true,
    }
  }

  // Override canReceiveNewChildrenOfType to allow shapes to be parented to this shape
  override canReceiveNewChildrenOfType(_shape: IIOChip, _type: string): boolean {
    return true
  }

  component(shape: IIOChip) {
    const {
      w, h, name, description, inputPins, outputPins, wires,
      containedShapeIds, isAnalyzing, autoAnalyze, showPinLabels
    } = shape.props

    const [isHovering, setIsHovering] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const [selectedPin, setSelectedPin] = useState<IOPin | null>(null)
    const [hoveredPin, setHoveredPin] = useState<string | null>(null)
    const [showSaveDialog, setShowSaveDialog] = useState(false)
    const [saveName, setSaveName] = useState(name)
    const [saveDescription, setSaveDescription] = useState(description || '')
    const [saveCategory, setSaveCategory] = useState('custom')
    const [wiringMode, setWiringMode] = useState(false)
    const [wireStartPin, setWireStartPin] = useState<IOPin | null>(null)

    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    // Use the pinning hook
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    // Get shapes contained within this IO chip's bounds
    const getContainedShapes = useCallback(() => {
      const chipBounds = new Box(shape.x, shape.y, w, h)
      const allShapes = this.editor.getCurrentPageShapes()

      return allShapes.filter(s => {
        if (s.id === shape.id) return false
        if (s.type === 'IOWire') return false // Don't include wire shapes

        const shapeBounds = this.editor.getShapePageBounds(s.id)
        if (!shapeBounds) return false

        // Check if shape is fully contained within the chip
        return chipBounds.contains(shapeBounds)
      })
    }, [shape.id, shape.x, shape.y, w, h, this.editor])

    // Analyze contained shapes and generate pins
    const analyzeContainedShapes = useCallback(async () => {
      const containedShapes = getContainedShapes()
      const newInputPins: IOPin[] = []
      const newOutputPins: IOPin[] = []
      const newContainedIds: TLShapeId[] = []

      for (const containedShape of containedShapes) {
        newContainedIds.push(containedShape.id)

        // Get I/O mapping for this shape type
        const mapping = SHAPE_IO_MAPPINGS[containedShape.type] || SHAPE_IO_MAPPINGS['default']

        // Create input pins for this shape
        mapping.inputs.forEach((inputDef, idx) => {
          const existingPin = inputPins.find(p => p.id === `${containedShape.id}-input-${idx}`)
          newInputPins.push({
            id: `${containedShape.id}-input-${idx}`,
            name: `${containedShape.type}: ${inputDef.name}`,
            type: inputDef.type || 'data',
            direction: 'input',
            description: inputDef.description || `Input for ${containedShape.type}`,
            required: inputDef.required,
            sourceShapeId: containedShape.id,
            // Preserve existing connection state
            connected: existingPin?.connected,
            connectedTo: existingPin?.connectedTo,
            connectedToShape: existingPin?.connectedToShape,
          })
        })

        // Create output pins for this shape
        mapping.outputs.forEach((outputDef, idx) => {
          const existingPin = outputPins.find(p => p.id === `${containedShape.id}-output-${idx}`)
          newOutputPins.push({
            id: `${containedShape.id}-output-${idx}`,
            name: `${containedShape.type}: ${outputDef.name}`,
            type: outputDef.type || 'data',
            direction: 'output',
            description: outputDef.description || `Output from ${containedShape.type}`,
            sourceShapeId: containedShape.id,
            // Preserve existing connection state
            connected: existingPin?.connected,
            connectedTo: existingPin?.connectedTo,
            connectedToShape: existingPin?.connectedToShape,
          })
        })
      }

      // Update the shape with new pins
      this.editor.updateShape<IIOChip>({
        id: shape.id,
        type: 'IOChip',
        props: {
          ...shape.props,
          inputPins: newInputPins,
          outputPins: newOutputPins,
          containedShapeIds: newContainedIds,
          lastAnalyzed: Date.now(),
          isAnalyzing: false,
        },
      })
    }, [getContainedShapes, shape.id, shape.props, inputPins, outputPins, this.editor])

    // Auto-analyze when shapes change (if enabled)
    useEffect(() => {
      if (autoAnalyze) {
        const currentShapes = getContainedShapes()
        const currentIds = currentShapes.map(s => s.id)
        const storedIds = containedShapeIds

        // Check if shapes have changed
        const hasChanged =
          currentIds.length !== storedIds.length ||
          currentIds.some(id => !storedIds.includes(id))

        if (hasChanged) {
          analyzeContainedShapes()
        }
      }
    }, [autoAnalyze, getContainedShapes, containedShapeIds, analyzeContainedShapes])

    const handleClose = () => {
      this.editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<IIOChip>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    const handlePinClick = (pin: IOPin) => {
      if (wiringMode) {
        // Handle wire creation
        if (!wireStartPin) {
          // Start wire from this pin
          setWireStartPin(pin)
        } else {
          // Complete wire to this pin
          if (wireStartPin.id !== pin.id && wireStartPin.direction !== pin.direction) {
            // Check type compatibility
            if (arePinTypesCompatible(wireStartPin.type, pin.type)) {
              const fromPin = wireStartPin.direction === 'output' ? wireStartPin : pin
              const toPin = wireStartPin.direction === 'input' ? wireStartPin : pin

              // Create wire connection
              const newWire: IOWireConnection = {
                id: `wire-${Date.now()}`,
                fromPinId: fromPin.id,
                toPinId: toPin.id,
                fromShapeId: fromPin.sourceShapeId!,
                toShapeId: toPin.sourceShapeId!,
                pinType: fromPin.type,
              }

              // Update pins with connection info
              const updatedInputPins = inputPins.map(p => {
                if (p.id === toPin.id) {
                  return { ...p, connected: true, connectedTo: fromPin.id, connectedToShape: fromPin.sourceShapeId }
                }
                return p
              })

              const updatedOutputPins = outputPins.map(p => {
                if (p.id === fromPin.id) {
                  return { ...p, connected: true, connectedTo: toPin.id, connectedToShape: toPin.sourceShapeId }
                }
                return p
              })

              this.editor.updateShape<IIOChip>({
                id: shape.id,
                type: 'IOChip',
                props: {
                  ...shape.props,
                  inputPins: updatedInputPins,
                  outputPins: updatedOutputPins,
                  wires: [...wires, newWire],
                },
              })
            }
          }
          setWireStartPin(null)
        }
      } else {
        setSelectedPin(pin)
        // Emit event for pin interaction
        const event = new CustomEvent('io-chip-pin-click', {
          detail: { pin, chipId: shape.id }
        })
        window.dispatchEvent(event)
      }
    }

    const handleAnalyze = () => {
      this.editor.updateShape<IIOChip>({
        id: shape.id,
        type: 'IOChip',
        props: {
          ...shape.props,
          isAnalyzing: true,
        },
      })
      analyzeContainedShapes()
    }

    // Save chip as template
    const handleSaveAsTemplate = () => {
      const containedShapes = getContainedShapes()

      // Create contained shape references with relative positions
      const containedShapeRefs: ContainedShapeRef[] = containedShapes.map(s => ({
        originalId: s.id,
        type: s.type,
        relativeX: s.x - shape.x,
        relativeY: s.y - shape.y,
        props: { ...s.props },
      }))

      const template = ioChipTemplateService.saveTemplate({
        name: saveName,
        description: saveDescription,
        category: saveCategory,
        width: w,
        height: h,
        inputPins: inputPins,
        outputPins: outputPins,
        containedShapes: containedShapeRefs,
        wires: wires,
        tags: shape.props.tags,
      })

      // Update shape with template reference
      this.editor.updateShape<IIOChip>({
        id: shape.id,
        type: 'IOChip',
        props: {
          ...shape.props,
          templateId: template.id,
          name: saveName,
          description: saveDescription,
          category: saveCategory,
        },
      })

      setShowSaveDialog(false)
    }

    // Delete a wire connection
    const handleDeleteWire = (wireId: string) => {
      const wire = wires.find(w => w.id === wireId)
      if (!wire) return

      // Update pins to remove connection
      const updatedInputPins = inputPins.map(p => {
        if (p.id === wire.toPinId) {
          return { ...p, connected: false, connectedTo: undefined, connectedToShape: undefined }
        }
        return p
      })

      const updatedOutputPins = outputPins.map(p => {
        if (p.id === wire.fromPinId) {
          return { ...p, connected: false, connectedTo: undefined, connectedToShape: undefined }
        }
        return p
      })

      this.editor.updateShape<IIOChip>({
        id: shape.id,
        type: 'IOChip',
        props: {
          ...shape.props,
          inputPins: updatedInputPins,
          outputPins: updatedOutputPins,
          wires: wires.filter(w => w.id !== wireId),
        },
      })
    }

    // Calculate pin positions
    const pinHeight = 28
    const pinSpacing = 8
    const headerHeight = 40
    const contentPadding = 12

    // Get pin position for wire rendering
    const getPinPosition = (pin: IOPin, index: number, isInput: boolean) => {
      const yOffset = headerHeight + contentPadding + index * (pinHeight + pinSpacing) + pinHeight / 2
      const xOffset = isInput ? 0 : w
      return { x: xOffset, y: yOffset }
    }

    // Render a single pin
    const renderPin = (pin: IOPin, index: number, isInput: boolean) => {
      const yOffset = headerHeight + contentPadding + index * (pinHeight + pinSpacing)
      const isHovered = hoveredPin === pin.id
      const isSelectedPin = selectedPin?.id === pin.id
      const isWireStart = wireStartPin?.id === pin.id
      const color = PIN_TYPE_COLORS[pin.type]
      const icon = PIN_TYPE_ICONS[pin.type]

      return (
        <div
          key={pin.id}
          data-pin-id={pin.id}
          style={{
            position: 'absolute',
            [isInput ? 'left' : 'right']: -12,
            top: yOffset,
            display: 'flex',
            alignItems: 'center',
            flexDirection: isInput ? 'row' : 'row-reverse',
            cursor: wiringMode ? 'crosshair' : 'pointer',
            zIndex: 100,
          }}
          onMouseEnter={() => setHoveredPin(pin.id)}
          onMouseLeave={() => setHoveredPin(null)}
          onPointerDown={(e) => {
            e.stopPropagation()
            handlePinClick(pin)
          }}
        >
          {/* Pin connector */}
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: isWireStart ? color : isSelectedPin ? color : isHovered ? `${color}cc` : pin.connected ? `${color}ee` : `${color}88`,
              border: `2px solid ${color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              transition: 'all 0.15s ease',
              boxShadow: isWireStart ? `0 0 12px ${color}` : isHovered || isSelectedPin ? `0 0 8px ${color}66` : pin.connected ? `0 0 4px ${color}44` : 'none',
            }}
            title={`${pin.name} (${pin.type})${pin.description ? `\n${pin.description}` : ''}${pin.connected ? '\n✓ Connected' : ''}`}
          >
            {icon}
          </div>

          {/* Pin label */}
          {showPinLabels && (
            <div
              style={{
                [isInput ? 'marginLeft' : 'marginRight']: '8px',
                padding: '2px 8px',
                backgroundColor: isHovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.85)',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 500,
                color: '#333',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                border: pin.connected ? `1px solid ${color}44` : 'none',
              }}
            >
              {pin.connected && <span style={{ marginRight: '4px' }}>✓</span>}
              {pin.name}
              {pin.required && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
            </div>
          )}
        </div>
      )
    }

    // Render internal wire connections as SVG lines
    const renderWires = () => {
      return wires.map(wire => {
        const fromPinIndex = outputPins.findIndex(p => p.id === wire.fromPinId)
        const toPinIndex = inputPins.findIndex(p => p.id === wire.toPinId)

        if (fromPinIndex === -1 || toPinIndex === -1) return null

        const fromPos = getPinPosition(outputPins[fromPinIndex], fromPinIndex, false)
        const toPos = getPinPosition(inputPins[toPinIndex], toPinIndex, true)

        const color = PIN_TYPE_COLORS[wire.pinType]

        // Calculate control points for curved wire
        const midX = (fromPos.x + toPos.x) / 2
        const curve = `M ${fromPos.x - 12} ${fromPos.y} C ${midX} ${fromPos.y}, ${midX} ${toPos.y}, ${toPos.x + 12} ${toPos.y}`

        return (
          <g key={wire.id} style={{ cursor: 'pointer' }} onClick={() => handleDeleteWire(wire.id)}>
            {/* Wire shadow/glow */}
            <path
              d={curve}
              fill="none"
              stroke={`${color}33`}
              strokeWidth={6}
              strokeLinecap="round"
            />
            {/* Main wire */}
            <path
              d={curve}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={wiringMode ? "4 4" : "none"}
            />
            {/* Delete indicator on hover */}
            <title>Click to delete wire</title>
          </g>
        )
      })
    }

    // Header content with shape count and actions
    const containedCount = containedShapeIds.length
    const headerContent = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          🔌 {name}
          <span style={{
            fontSize: '10px',
            marginLeft: '6px',
            opacity: 0.7
          }}>
            ({containedCount} tool{containedCount !== 1 ? 's' : ''}, {wires.length} wire{wires.length !== 1 ? 's' : ''})
          </span>
        </span>
        <button
          style={{
            padding: '2px 6px',
            fontSize: '10px',
            backgroundColor: wiringMode ? '#10b981' : '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
          onClick={(e) => {
            e.stopPropagation()
            setWiringMode(!wiringMode)
            setWireStartPin(null)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title={wiringMode ? 'Exit wiring mode' : 'Enter wiring mode to connect pins'}
        >
          {wiringMode ? '✓ Wiring' : '🔗 Wire'}
        </button>
        <button
          style={{
            padding: '2px 6px',
            fontSize: '10px',
            backgroundColor: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
          onClick={(e) => {
            e.stopPropagation()
            setSaveName(name)
            setSaveDescription(description || '')
            setShowSaveDialog(true)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Save as template"
        >
          💾 Save
        </button>
        <button
          style={{
            padding: '2px 6px',
            fontSize: '10px',
            backgroundColor: isAnalyzing ? '#f59e0b' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isAnalyzing ? 'wait' : 'pointer',
            pointerEvents: 'auto',
          }}
          onClick={(e) => {
            e.stopPropagation()
            handleAnalyze()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? '⏳' : '🔄'}
        </button>
      </div>
    )

    return (
      <HTMLContainer style={{ width: w, height: h }}>
        <StandardizedToolWrapper
          title="IO Chip"
          primaryColor={IOChipShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={w}
          height={h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          headerContent={headerContent}
          editor={this.editor}
          shapeId={shape.id}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          tags={shape.props.tags}
          onTagsChange={(newTags) => {
            this.editor.updateShape<IIOChip>({
              id: shape.id,
              type: 'IOChip',
              props: {
                ...shape.props,
                tags: newTags,
              }
            })
          }}
          tagsEditable={true}
        >
          {/* Main content area with visual frame border */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              backgroundColor: wiringMode ? '#f0fdf4' : '#f8fafc',
              borderRadius: '0 0 6px 6px',
              overflow: 'visible',
              transition: 'background-color 0.2s ease',
            }}
            onPointerEnter={() => setIsHovering(true)}
            onPointerLeave={() => setIsHovering(false)}
          >
            {/* SVG layer for wire rendering */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: wiringMode ? 'auto' : 'none',
                zIndex: 50,
              }}
            >
              {renderWires()}
            </svg>

            {/* Dashed border to indicate drop zone */}
            <div
              style={{
                position: 'absolute',
                inset: '12px',
                border: wiringMode ? '2px solid #10b981' : '2px dashed #cbd5e1',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                transition: 'border-color 0.2s ease',
              }}
            >
              {containedCount === 0 && !wiringMode && (
                <div style={{
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '12px',
                  padding: '20px',
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📥</div>
                  <div>{description || 'Drag tools here to analyze their I/O'}</div>
                </div>
              )}
              {wiringMode && (
                <div style={{
                  textAlign: 'center',
                  color: '#10b981',
                  fontSize: '12px',
                  padding: '20px',
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔗</div>
                  <div>
                    {wireStartPin
                      ? `Click a ${wireStartPin.direction === 'output' ? 'input' : 'output'} pin to complete connection`
                      : 'Click a pin to start wiring'
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Input pins (left side) */}
            {inputPins.map((pin, index) => renderPin(pin, index, true))}

            {/* Output pins (right side) */}
            {outputPins.map((pin, index) => renderPin(pin, index, false))}

            {/* Selected pin details panel */}
            {selectedPin && !wiringMode && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: 'white',
                  border: `2px solid ${PIN_TYPE_COLORS[selectedPin.type]}`,
                  borderRadius: '8px',
                  padding: '8px 12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 200,
                  minWidth: '200px',
                  maxWidth: '300px',
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '16px' }}>{PIN_TYPE_ICONS[selectedPin.type]}</span>
                  <span style={{ fontWeight: 600, fontSize: '12px' }}>{selectedPin.name}</span>
                  <span
                    style={{
                      fontSize: '9px',
                      padding: '2px 6px',
                      backgroundColor: `${PIN_TYPE_COLORS[selectedPin.type]}20`,
                      color: PIN_TYPE_COLORS[selectedPin.type],
                      borderRadius: '4px',
                      fontWeight: 500,
                    }}
                  >
                    {selectedPin.type}
                  </span>
                </div>
                {selectedPin.description && (
                  <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>
                    {selectedPin.description}
                  </div>
                )}
                <div style={{ fontSize: '10px', color: '#999' }}>
                  Direction: {selectedPin.direction === 'input' ? '⬅️ Input' : '➡️ Output'}
                  {selectedPin.required && <span style={{ color: '#ef4444', marginLeft: '8px' }}>Required</span>}
                  {selectedPin.connected && <span style={{ color: '#10b981', marginLeft: '8px' }}>✓ Connected</span>}
                </div>
                <button
                  style={{
                    marginTop: '8px',
                    padding: '4px 8px',
                    fontSize: '10px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                  onClick={() => setSelectedPin(null)}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  Close
                </button>
              </div>
            )}

            {/* Save Template Dialog */}
            {showSaveDialog && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'white',
                  border: '2px solid #3b82f6',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  zIndex: 300,
                  minWidth: '280px',
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#1e293b' }}>
                  💾 Save as Template
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                    placeholder="My Custom Chip"
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Description
                  </label>
                  <textarea
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '12px',
                      minHeight: '60px',
                      resize: 'vertical',
                    }}
                    placeholder="Describe what this chip does..."
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Category
                  </label>
                  <select
                    value={saveCategory}
                    onChange={(e) => setSaveCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '12px',
                      backgroundColor: 'white',
                    }}
                  >
                    {ioChipTemplateService.getCategories().map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAsTemplate}
                    disabled={!saveName.trim()}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: saveName.trim() ? '#3b82f6' : '#94a3b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: saveName.trim() ? 'pointer' : 'not-allowed',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    Save Template
                  </button>
                </div>
              </div>
            )}
          </div>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  indicator(shape: IIOChip) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />
  }
}
