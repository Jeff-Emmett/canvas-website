import React, { useState, useEffect, useMemo } from 'react'
import { Editor, createShapeId } from 'tldraw'
import { ioChipTemplateService, IOChipTemplate, IOChipCategory } from '@/lib/IOChipTemplateService'
import { PIN_TYPE_ICONS, PIN_TYPE_COLORS, IOPinType } from '@/shapes/IOChipShapeUtil'

interface ChipTemplateBrowserProps {
  editor: Editor
  onClose: () => void
  position?: { x: number; y: number }
}

export function ChipTemplateBrowser({ editor, onClose, position }: ChipTemplateBrowserProps) {
  const [templates, setTemplates] = useState<IOChipTemplate[]>([])
  const [categories, setCategories] = useState<IOChipCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<IOChipTemplate | null>(null)

  // Load templates and subscribe to changes
  useEffect(() => {
    const loadData = () => {
      setTemplates(ioChipTemplateService.getAllTemplates())
      setCategories(ioChipTemplateService.getCategories())
    }

    loadData()
    const unsubscribe = ioChipTemplateService.subscribe(loadData)
    return unsubscribe
  }, [])

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    let result = templates

    if (selectedCategory) {
      result = result.filter(t => t.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      result = ioChipTemplateService.searchTemplates(searchQuery)
      if (selectedCategory) {
        result = result.filter(t => t.category === selectedCategory)
      }
    }

    return result
  }, [templates, selectedCategory, searchQuery])

  // Create chip from template
  const handleCreateFromTemplate = (template: IOChipTemplate) => {
    const viewport = editor.getViewportPageBounds()
    const x = position?.x ?? (viewport.x + viewport.w / 2 - template.width / 2)
    const y = position?.y ?? (viewport.y + viewport.h / 2 - template.height / 2)

    // Create the IO chip shape from template
    editor.createShape({
      id: createShapeId(),
      type: 'IOChip',
      x,
      y,
      props: {
        w: template.width,
        h: template.height,
        name: template.name,
        description: template.description,
        inputPins: template.inputPins,
        outputPins: template.outputPins,
        wires: template.wires,
        containedShapeIds: [],
        isAnalyzing: false,
        lastAnalyzed: Date.now(),
        pinnedToView: false,
        tags: template.tags,
        autoAnalyze: true,
        showPinLabels: true,
        templateId: template.id,
        category: template.category,
      },
    })

    // TODO: Recreate contained shapes from template
    // This would require storing and restoring shape definitions

    onClose()
  }

  // Delete template
  const handleDeleteTemplate = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this template?')) {
      ioChipTemplateService.deleteTemplate(templateId)
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null)
      }
    }
  }

  // Export template
  const handleExportTemplate = (template: IOChipTemplate, e: React.MouseEvent) => {
    e.stopPropagation()
    const json = ioChipTemplateService.exportTemplate(template.id)
    if (json) {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${template.name.toLowerCase().replace(/\s+/g, '-')}.iochip.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // Render pin preview
  const renderPinPreview = (pins: { type: IOPinType }[], direction: 'input' | 'output') => {
    return (
      <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
        {pins.slice(0, 5).map((pin, i) => (
          <span
            key={i}
            style={{
              fontSize: '10px',
              padding: '1px 4px',
              backgroundColor: `${PIN_TYPE_COLORS[pin.type]}20`,
              color: PIN_TYPE_COLORS[pin.type],
              borderRadius: '3px',
            }}
            title={pin.type}
          >
            {PIN_TYPE_ICONS[pin.type]}
          </span>
        ))}
        {pins.length > 5 && (
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>+{pins.length - 5}</span>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        maxHeight: '80vh',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>
            🔌 IO Chip Templates
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
            Select a template to create a new IO chip
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#f1f5f9',
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>

      {/* Search and filters */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates..."
          style={{
            width: '100%',
            padding: '10px 14px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '14px',
            marginBottom: '12px',
          }}
        />

        {/* Category filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedCategory(null)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: selectedCategory === null ? '#3b82f6' : '#f1f5f9',
              color: selectedCategory === null ? 'white' : '#64748b',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: selectedCategory === cat.id ? '#3b82f6' : '#f1f5f9',
                color: selectedCategory === cat.id ? 'white' : '#64748b',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Template grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
        }}
      >
        {filteredTemplates.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px',
              color: '#94a3b8',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
            <div style={{ fontSize: '14px' }}>
              {searchQuery ? 'No templates match your search' : 'No templates yet'}
            </div>
            <div style={{ fontSize: '12px', marginTop: '8px' }}>
              Create an IO chip and save it as a template
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
            }}
          >
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  border: selectedTemplate?.id === template.id
                    ? '2px solid #3b82f6'
                    : '1px solid #e2e8f0',
                  backgroundColor: selectedTemplate?.id === template.id
                    ? '#eff6ff'
                    : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (selectedTemplate?.id !== template.id) {
                    e.currentTarget.style.borderColor = '#94a3b8'
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTemplate?.id !== template.id) {
                    e.currentTarget.style.borderColor = '#e2e8f0'
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                    {template.icon || '🔌'} {template.name}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={(e) => handleExportTemplate(template, e)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor: '#f1f5f9',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                      title="Export template"
                    >
                      📤
                    </button>
                    <button
                      onClick={(e) => handleDeleteTemplate(template.id, e)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor: '#fef2f2',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                      title="Delete template"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {template.description && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#64748b',
                      marginBottom: '10px',
                      lineHeight: 1.4,
                    }}
                  >
                    {template.description.slice(0, 80)}
                    {template.description.length > 80 ? '...' : ''}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>
                      Inputs
                    </div>
                    {renderPinPreview(template.inputPins, 'input')}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>
                      Outputs
                    </div>
                    {renderPinPreview(template.outputPins, 'output')}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {template.tags.slice(0, 3).map((tag, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        backgroundColor: '#f1f5f9',
                        borderRadius: '4px',
                        color: '#64748b',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with actions */}
      {selectedTemplate && (
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Selected: <strong>{selectedTemplate.name}</strong>
            <span style={{ marginLeft: '8px', fontSize: '11px' }}>
              ({selectedTemplate.inputPins.length} inputs, {selectedTemplate.outputPins.length} outputs)
            </span>
          </div>
          <button
            onClick={() => handleCreateFromTemplate(selectedTemplate)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Create IO Chip
          </button>
        </div>
      )}
    </div>
  )
}

// Hook to manage template browser visibility
export function useChipTemplateBrowser() {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | undefined>()

  const open = (pos?: { x: number; y: number }) => {
    setPosition(pos)
    setIsOpen(true)
  }

  const close = () => {
    setIsOpen(false)
    setPosition(undefined)
  }

  return { isOpen, position, open, close }
}
