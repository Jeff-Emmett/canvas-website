import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
} from "tldraw"
import React, { useState, useRef, useEffect, useCallback } from "react"
import { holosphereService, HoloSphereService, HolonConnection, HOLON_ENABLED } from "@/lib/HoloSphereService"
import * as h3 from 'h3-js'
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"
import { usePinnedToView } from "../hooks/usePinnedToView"
import { useMaximize } from "../hooks/useMaximize"

type IHolon = TLBaseShape<
  "Holon",
  {
    w: number
    h: number
    name: string
    description?: string
    latitude: number
    longitude: number
    resolution: number
    holonId: string
    isConnected: boolean
    isEditing?: boolean
    editingName?: string
    editingDescription?: string
    selectedLens?: string
    data: Record<string, any>
    connections: HolonConnection[]
    lastUpdated: number
    pinnedToView: boolean
    tags: string[]
  }
>

// Auto-resizing textarea component for editing
const AutoResizeTextarea: React.FC<{
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  style: React.CSSProperties
  placeholder?: string
  onPointerDown?: (e: React.PointerEvent) => void
  onWheel?: (e: React.WheelEvent) => void
}> = ({ value, onChange, onBlur, onKeyDown, style, placeholder, onPointerDown, onWheel }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Removed auto-focus - textarea will only focus when user explicitly clicks on it
  // This prevents text boxes from being selected when shapes are created/recreated

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
      style={style}
      placeholder={placeholder}
    />
  )
}

export class HolonShape extends BaseBoxShapeUtil<IHolon> {
  static override type = "Holon" as const

  // Holon theme color: Green (same as HolonBrowser)
  static readonly PRIMARY_COLOR = "#22c55e"

  getDefaultProps(): IHolon["props"] {
    return {
      w: 700, // Width to accommodate "Connect to the Holosphere" button and ID display
      h: 400, // Increased height to ensure all elements fit comfortably
      name: "New Holon",
      description: "",
      latitude: 40.7128, // Default to NYC
      longitude: -74.0060,
      resolution: 7, // City level
      holonId: "",
      isConnected: false,
      isEditing: false,
      selectedLens: "general",
      data: {},
      connections: [],
      lastUpdated: Date.now(),
      pinnedToView: false,
      tags: ['holon'],
    }
  }

  component(shape: IHolon) {
    const {
      w, h, name, description, latitude, longitude, resolution, holonId,
      isConnected, isEditing, editingName, editingDescription, selectedLens,
      data, connections, lastUpdated
    } = shape.props

    // If Holon functionality is disabled, show a disabled message
    if (!HOLON_ENABLED) {
      return (
        <HTMLContainer style={{ width: w, height: h }}>
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#f3f4f6',
            border: '2px solid #d1d5db',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            boxSizing: 'border-box',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌐</div>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px',
              textAlign: 'center'
            }}>
              Holon Feature Disabled
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              textAlign: 'center',
              maxWidth: '300px'
            }}>
              Holon functionality is currently disabled. It will be re-enabled when Nostr integration is available.
            </div>
          </div>
        </HTMLContainer>
      )
    }

    const [isHovering, setIsHovering] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const [currentData, setCurrentData] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)
    const isMountedRef = useRef(true)

    // Use the pinning hook to keep the shape fixed to viewport when pinned
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    // Use the maximize hook for fullscreen functionality
    const { isMaximized, toggleMaximize } = useMaximize({
      editor: this.editor,
      shapeId: shape.id,
      currentW: shape.props.w,
      currentH: shape.props.h,
      shapeType: 'Holon',
    })

    // Note: Auto-initialization is disabled. Users must manually enter Holon IDs.
    // This prevents the shape from auto-generating IDs based on coordinates.

    const loadHolonData = useCallback(async () => {

      if (!holonId) {
        return
      }

      try {
        setIsLoading(true)
        setError(null)


        // Load data from specific categories
        const lensesToCheck = [
          'active_users',
          'users',
          'rankings',
          'stats',
          'tasks',
          'progress',
          'events',
          'activities',
          'items',
          'shopping',
          'active_items',
          'proposals',
          'offers',
          'requests',
          'checklists',
          'roles'
        ]

        const allData: Record<string, any> = {}

        // Load data from each lens using the new getDataWithWait method
        // This properly waits for Gun data to load from the network
        for (const lens of lensesToCheck) {
          try {
            // Use getDataWithWait which subscribes and waits for Gun data (5 second timeout for network sync)
            const lensData = await holosphereService.getDataWithWait(holonId, lens, 5000)
            if (lensData && Object.keys(lensData).length > 0) {
              allData[lens] = lensData
            } else {
            }
          } catch (err) {
          }
        }

        
        // If no data was loaded, check for connection issues
        if (Object.keys(allData).length === 0) {
          console.error(`❌ No data loaded from any lens. This may indicate a WebSocket connection issue.`)
          console.error(`💡 Check browser console for errors like: "WebSocket connection to 'wss://gun.holons.io/gun' failed"`)
          setError('Unable to load data. Check browser console for WebSocket connection errors to gun.holons.io')
        }

        // Update current data for selected lens
        const currentLensData = allData[selectedLens || 'users']
        setCurrentData(currentLensData)

        // Update the shape with all data
        this.editor.updateShape<IHolon>({
          id: shape.id,
          type: 'Holon',
          props: {
            ...shape.props,
            data: allData,
            lastUpdated: Date.now()
          }
        })

      } catch (error) {
        console.error('❌ Error loading holon data:', error)
        setError('Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }, [holonId, selectedLens, shape.id, shape.props, this.editor])

    // Load data when holon is connected
    useEffect(() => {

      if (holonId && isConnected) {
        loadHolonData()
      } else {
        if (!holonId) {}
        if (!isConnected) {}
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [holonId, isConnected, selectedLens])

    const handleStartEdit = () => {
      this.editor.updateShape<IHolon>({
        id: shape.id,
        type: "Holon",
        props: {
          ...shape.props,
          isEditing: true,
          editingName: name,
          editingDescription: description || '',
        },
      })
    }

    const handleHolonIdChange = (newHolonId: string) => {
      this.editor.updateShape<IHolon>({
        id: shape.id,
        type: "Holon",
        props: {
          ...shape.props,
          holonId: newHolonId,
        },
      })
    }

    // Validate if input is a valid Holon ID
    // Accepts both H3 cell IDs (hexagonal geospatial identifiers like 872a1070bffffff)
    // and numeric Holon IDs (workspace/group identifiers like 1002848305066)
    const isValidHolonId = (id: string): boolean => {
      if (!id || id.trim() === '') return false
      const trimmedId = id.trim()

      // Check if it's a valid H3 cell ID
      try {
        if (h3.isValidCell(trimmedId)) {
          return true
        }
      } catch {
        // Not an H3 cell, continue to check other formats
      }

      // Check if it's a numeric Holon ID (workspace/group identifier)
      // These are typically 10-15 digit numbers
      if (/^\d{6,20}$/.test(trimmedId)) {
        return true
      }

      // Check if it's an alphanumeric identifier (some holons use these)
      if (/^[a-zA-Z0-9_-]{3,50}$/.test(trimmedId)) {
        return true
      }

      return false
    }

    // Check if the ID is an H3 cell (for coordinate extraction)
    const isH3CellId = (id: string): boolean => {
      if (!id || id.trim() === '') return false
      try {
        return h3.isValidCell(id.trim())
      } catch {
        return false
      }
    }

    const handleConnect = async () => {
      const trimmedHolonId = holonId?.trim() || ''
      if (!trimmedHolonId) {
        setError('Please enter a Holon ID')
        return
      }

      // Validate Holon ID (accepts H3 cells, numeric IDs, and alphanumeric identifiers)
      if (!isValidHolonId(trimmedHolonId)) {
        setError('Invalid Holon ID. Enter an H3 cell ID (e.g., 872a1070bffffff) or a numeric Holon ID (e.g., 1002848305066)')
        return
      }

      setError(null)

      // Extract H3 cell info if applicable (coordinates and resolution)
      let cellLatitude = latitude
      let cellLongitude = longitude
      let cellResolution = resolution
      const isH3 = isH3CellId(trimmedHolonId)

      if (isH3) {
        try {
          const [lat, lng] = h3.cellToLatLng(trimmedHolonId)
          cellLatitude = lat
          cellLongitude = lng
          cellResolution = h3.getResolution(trimmedHolonId)
        } catch (e) {
          console.warn('Could not extract H3 cell coordinates:', e)
        }
      } else {
        // For numeric/alphanumeric Holon IDs, use default coordinates
        // The holon is not geospatially indexed
        cellResolution = -1 // Indicate non-H3 holon
      }

      // Update the shape to mark as connected with trimmed ID and H3 info
      this.editor.updateShape<IHolon>({
        id: shape.id,
        type: "Holon",
        props: {
          ...shape.props,
          isConnected: true,
          holonId: trimmedHolonId,
          latitude: cellLatitude,
          longitude: cellLongitude,
          resolution: cellResolution,
        },
      })

      // Try to load metadata from the holon
      try {
        const metadataData = await holosphereService.getDataWithWait(trimmedHolonId, 'metadata', 2000)
        if (metadataData && typeof metadataData === 'object') {
          // metadataData might be a dictionary of items, or a single object
          let metadata: any = null
          
          // Check if it's a dictionary with items
          const entries = Object.entries(metadataData)
          if (entries.length > 0) {
            // Try to find a metadata object with name property
            for (const [key, value] of entries) {
              if (value && typeof value === 'object' && 'name' in value) {
                metadata = value
                break
              }
            }
            // If no object with name found, use the first entry
            if (!metadata && entries.length > 0) {
              metadata = entries[0][1]
            }
          } else if (metadataData && typeof metadataData === 'object' && 'name' in metadataData) {
            metadata = metadataData
          }

          if (metadata && metadata.name) {
            this.editor.updateShape<IHolon>({
              id: shape.id,
              type: "Holon",
              props: {
                ...shape.props,
                name: metadata.name,
                description: metadata.description || description || '',
                isConnected: true,
                holonId: trimmedHolonId,
              },
            })
          }
        }
      } catch (error) {
      }

      // Explicitly load holon data after connecting
      // We need to wait a bit for the state to update, then trigger data loading
      // The useEffect will also trigger, but we call this explicitly to ensure data loads
      setTimeout(async () => {
        // Load data using the trimmed holonId we just set
        try {
          setIsLoading(true)
          setError(null)


          // Load data from specific categories
          const lensesToCheck = [
            'active_users',
            'users',
            'rankings',
            'stats',
            'tasks',
            'progress',
            'events',
            'activities',
            'items',
            'shopping',
            'active_items',
            'proposals',
            'offers',
            'requests',
            'checklists',
            'roles'
          ]

          const allData: Record<string, any> = {}

          // Load data from each lens
          for (const lens of lensesToCheck) {
            try {
              const lensData = await holosphereService.getDataWithWait(trimmedHolonId, lens, 2000)
              if (lensData && Object.keys(lensData).length > 0) {
                allData[lens] = lensData
              } else {
              }
            } catch (err) {
            }
          }


          // Update current data for selected lens
          const currentLensData = allData[shape.props.selectedLens || 'users']
          setCurrentData(currentLensData)

          // Update the shape with all data
          this.editor.updateShape<IHolon>({
            id: shape.id,
            type: 'Holon',
            props: {
              ...shape.props,
              data: allData,
              lastUpdated: Date.now(),
              isConnected: true,
              holonId: trimmedHolonId,
            },
          })

        } catch (error) {
          console.error('❌ Error loading holon data:', error)
          setError('Failed to load data')
        } finally {
          setIsLoading(false)
        }
      }, 100)
    }

    const handleSaveEdit = async () => {
      const newName = editingName || name
      const newDescription = editingDescription || description || ''

      // If holonId is provided, mark as connected
      const shouldConnect = !!(holonId && holonId.trim() !== '')


      // Create new props without the editing fields
      const { editingName: _editingName, editingDescription: _editingDescription, ...restProps } = shape.props

      const newProps = {
        ...restProps,
        isEditing: false,
        name: newName,
        description: newDescription,
        isConnected: shouldConnect,
        holonId: holonId, // Explicitly set holonId
      }


      // Update the shape
      this.editor.updateShape<IHolon>({
        id: shape.id,
        type: "Holon",
        props: newProps,
      })


      // If we have a connected holon, store the metadata
      if (holonId && shouldConnect) {
        try {
          await holosphereService.putData(holonId, 'metadata', {
            name: newName,
            description: newDescription,
            lastUpdated: Date.now()
          })
        } catch (error) {
          console.error('❌ Error saving metadata:', error)
        }
      }
    }

    const handleCancelEdit = () => {
      // Create new props without the editing fields
      const { editingName: _editingName, editingDescription: _editingDescription, ...restProps } = shape.props

      this.editor.updateShape<IHolon>({
        id: shape.id,
        type: "Holon",
        props: {
          ...restProps,
          isEditing: false,
        },
      })
    }

    const handleNameChange = (newName: string) => {
      this.editor.updateShape<IHolon>({
        id: shape.id,
        type: "Holon",
        props: {
          ...shape.props,
          editingName: newName,
        },
      })
    }

    const handleDescriptionChange = (newDescription: string) => {
      this.editor.updateShape<IHolon>({
        id: shape.id,
        type: "Holon",
        props: {
          ...shape.props,
          editingDescription: newDescription,
        },
      })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelEdit()
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleSaveEdit()
      }
    }

    const handleWheel = (e: React.WheelEvent) => {
      e.stopPropagation()
    }

    const handleRefreshData = async () => {
      await loadHolonData()
    }

    const handleAddData = async () => {
      if (!holonId || !isConnected) return
      
      const newData = {
        id: `data-${Date.now()}`,
        content: 'New data entry',
        timestamp: Date.now(),
        type: 'manual'
      }
      
      try {
        const success = await holosphereService.putData(holonId, selectedLens || 'general', newData)
        if (success) {
          await loadHolonData()
        }
      } catch (error) {
        console.error('❌ Error adding data:', error)
        setError('Failed to add data')
      }
    }

    const getResolutionInfo = () => {
      const resolutionName = HoloSphereService.getResolutionName(resolution)
      const resolutionDescription = HoloSphereService.getResolutionDescription(resolution)
      return { name: resolutionName, description: resolutionDescription }
    }

    const getCategoryDisplayName = (lensName: string): string => {
      const categoryMap: Record<string, string> = {
        'active_users': 'Active Users',
        'users': 'Users',
        'rankings': 'View Rankings & Stats',
        'stats': 'Statistics',
        'tasks': 'Tasks',
        'progress': 'Progress',
        'events': 'Events',
        'activities': 'Recent Activities',
        'items': 'Items',
        'shopping': 'Shopping',
        'active_items': 'Active Items',
        'proposals': 'Proposals',
        'offers': 'Offers & Requests',
        'requests': 'Requests',
        'checklists': 'Checklists',
        'roles': 'Roles'
      }
      return categoryMap[lensName] || lensName
    }

    const getCategoryIcon = (lensName: string): string => {
      const iconMap: Record<string, string> = {
        'active_users': '👥',
        'users': '👤',
        'rankings': '📊',
        'stats': '📈',
        'tasks': '✅',
        'progress': '📈',
        'events': '📅',
        'activities': '🔔',
        'items': '📦',
        'shopping': '🛒',
        'active_items': '🏷️',
        'proposals': '💡',
        'offers': '🤝',
        'requests': '📬',
        'checklists': '☑️',
        'roles': '🎭'
      }
      return iconMap[lensName] || '🔍'
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handleClose = () => {
      this.editor.deleteShape(shape.id)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<IHolon>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    const contentStyle: React.CSSProperties = {
      padding: '12px',
      flex: 1,
      overflow: 'hidden',
      color: 'black',
      fontSize: '12px',
      lineHeight: '1.4',
      cursor: isEditing ? 'text' : 'pointer',
      transition: 'background-color 0.2s ease',
      display: 'flex',
      flexDirection: 'column',
    }

    const textareaStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      border: 'none',
      outline: 'none',
      resize: 'none',
      fontFamily: 'inherit',
      fontSize: '12px',
      lineHeight: '1.4',
      color: 'black',
      backgroundColor: 'transparent',
      padding: '4px',
      margin: 0,
      position: 'relative',
      boxSizing: 'border-box',
      overflowY: 'auto',
      overflowX: 'hidden',
      zIndex: 1000,
      pointerEvents: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      cursor: 'text',
    }

    const buttonStyle: React.CSSProperties = {
      padding: '4px 8px',
      fontSize: '10px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      backgroundColor: 'white',
      cursor: 'pointer',
      zIndex: 1000,
      position: 'relative',
      pointerEvents: 'auto',
    }

    // Custom header content with holon info and action buttons
    const headerContent = (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
        <span>
          🌐 Holon: {holonId || 'Not Connected'}
          {isLoading && <span style={{color: '#ffa500', fontSize: '8px'}}>(Loading...)</span>}
          {error && <span style={{color: '#ff4444', fontSize: '8px'}}>({error})</span>}
          {isConnected && <span style={{color: '#4CAF50', fontSize: '8px'}}>(Connected)</span>}
        </span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {!isEditing && (
            <>
              <button
                style={{
                  ...buttonStyle,
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: '1px solid #45a049'
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleRefreshData()
                }}
                onPointerDown={(e) => e.stopPropagation()}
                title="Refresh data"
              >
                🔄
              </button>
              <button
                style={{
                  ...buttonStyle,
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: '1px solid #1976D2'
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleAddData()
                }}
                onPointerDown={(e) => e.stopPropagation()}
                title="Add data"
              >
                ➕
              </button>
            </>
          )}
        </div>
      </div>
    )

    const resolutionInfo = getResolutionInfo()

    return (
      <HTMLContainer style={{ width: w, height: h }}>
        <StandardizedToolWrapper
          title="Holon"
          primaryColor={HolonShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={w}
          height={h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          onMaximize={toggleMaximize}
          isMaximized={isMaximized}
          headerContent={headerContent}
          editor={this.editor}
          shapeId={shape.id}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          tags={shape.props.tags}
          onTagsChange={(newTags) => {
            this.editor.updateShape<IHolon>({
              id: shape.id,
              type: 'Holon',
              props: {
                ...shape.props,
                tags: newTags,
              }
            })
          }}
          tagsEditable={true}
        >
        
        <div style={contentStyle}>
          {!isConnected ? (
            // Initial state: Show clear HolonID input interface (shown until user connects)
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px', 
              height: '100%',
              justifyContent: 'center',
              alignItems: 'stretch',
              padding: '20px',
              boxSizing: 'border-box',
              minHeight: 0
            }}>
              <div style={{
                fontSize: '16px',
                color: '#333',
                marginBottom: '8px',
                fontWeight: '600',
                textAlign: 'center',
                lineHeight: '1.5',
                width: '100%'
              }}>
                Enter a Holon ID to connect to the Holosphere
              </div>
              <div style={{
                fontSize: '11px',
                color: '#666',
                textAlign: 'center',
                marginBottom: '8px'
              }}>
                Supports numeric IDs (e.g., 1002848305066) or H3 cell IDs (e.g., 872a1070bffffff)
              </div>
              {/* Quick generate button */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '8px'
              }}>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    // Generate H3 cell from default coordinates
                    try {
                      const newCellId = h3.latLngToCell(latitude, longitude, resolution)
                      handleHolonIdChange(newCellId)
                      setError(null)
                    } catch (err) {
                      setError('Failed to generate H3 cell ID')
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    color: '#4b5563',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e5e7eb'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6'
                  }}
                >
                  Generate H3 Cell for current location (NYC)
                </button>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '12px',
                width: '100%',
                alignItems: 'center'
              }}>
                <input
                  type="text"
                  value={holonId}
                  onChange={(e) => handleHolonIdChange(e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onWheel={handleWheel}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && holonId.trim() !== '') {
                      e.preventDefault()
                      handleConnect()
                    }
                  }}
                  placeholder="1002848305066 or 872a1070bffffff"
                  style={{
                    flex: 1,
                    height: '48px',
                    fontSize: '15px',
                    fontFamily: 'monospace',
                    padding: '12px 16px',
                    border: '2px solid #22c55e',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    boxShadow: '0 2px 8px rgba(34, 197, 94, 0.15)',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    color: '#333',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#16a34a'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.25)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#22c55e'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(34, 197, 94, 0.15)'
                  }}
                />
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (holonId.trim() !== '') {
                      handleConnect()
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={!holonId || holonId.trim() === ''}
                  style={{
                    height: '48px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: '600',
                    fontFamily: 'inherit',
                    color: 'white',
                    backgroundColor: holonId && holonId.trim() !== '' ? '#22c55e' : '#9ca3af',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: holonId && holonId.trim() !== '' ? 'pointer' : 'not-allowed',
                    boxShadow: holonId && holonId.trim() !== '' ? '0 2px 8px rgba(34, 197, 94, 0.25)' : 'none',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (holonId && holonId.trim() !== '') {
                      e.currentTarget.style.backgroundColor = '#16a34a'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.35)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (holonId && holonId.trim() !== '') {
                      e.currentTarget.style.backgroundColor = '#22c55e'
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(34, 197, 94, 0.25)'
                    }
                  }}
                >
                  Connect to the Holosphere
                </button>
              </div>
              {error && (
                <div style={{
                  fontSize: '12px',
                  color: '#dc2626',
                  textAlign: 'center',
                  padding: '8px 12px',
                  backgroundColor: '#fef2f2',
                  borderRadius: '6px',
                  border: '1px solid #fecaca'
                }}>
                  {error}
                </div>
              )}
              <div style={{
                fontSize: '11px',
                color: '#666',
                textAlign: 'center',
                fontStyle: 'italic',
                width: '100%'
              }}>
                Press Enter or click the button to connect
              </div>
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                cursor: "text",
                overflowY: "auto",
                overflowX: "hidden",
                padding: "8px",
                boxSizing: "border-box",
                position: "relative",
                pointerEvents: "auto"
              }}
              onWheel={handleWheel}
            >
              {/* Holon Information Header */}
              {isConnected && (
                <div style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: resolution >= 0 ? 'repeat(2, 1fr)' : '1fr',
                    gap: '8px',
                    fontSize: '11px'
                  }}>
                    {resolution >= 0 ? (
                      <>
                        <div>
                          <span style={{ color: '#666', fontWeight: '500' }}>Resolution:</span>{' '}
                          <span style={{ color: '#15803d', fontWeight: '600' }}>
                            {resolutionInfo.name} (Level {resolution})
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#666', fontWeight: '500' }}>Coordinates:</span>{' '}
                          <span style={{ fontFamily: 'monospace', color: '#333' }}>
                            {latitude.toFixed(4)}, {longitude.toFixed(4)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div>
                        <span style={{ color: '#666', fontWeight: '500' }}>Type:</span>{' '}
                        <span style={{ color: '#15803d', fontWeight: '600' }}>
                          Workspace / Group Holon
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: '#666', marginTop: '6px' }}>
                    {resolution >= 0
                      ? resolutionInfo.description
                      : 'This holon represents a workspace, organization, or group (not geospatially indexed)'}
                  </div>
                </div>
              )}

              {/* Display all data from all lenses */}
              {isConnected && data && Object.keys(data).length > 0 && (
                <div>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#333',
                    marginBottom: '8px',
                    borderBottom: '2px solid #22c55e',
                    paddingBottom: '4px'
                  }}>
                    Data Lenses ({Object.keys(data).length} categor{Object.keys(data).length !== 1 ? 'ies' : 'y'})
                  </div>

                  {Object.entries(data).map(([lensName, lensData]) => (
                    <div key={lensName} style={{ marginBottom: '12px' }}>
                      <div style={{
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: '#2196F3',
                        marginBottom: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>{getCategoryIcon(lensName)}</span>
                        <span>{getCategoryDisplayName(lensName)}</span>
                        {lensData && typeof lensData === 'object' && (
                          <span style={{ color: '#888', fontWeight: 'normal' }}>
                            ({Object.keys(lensData).length} items)
                          </span>
                        )}
                      </div>
                      <div style={{
                        backgroundColor: '#f9f9f9',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #e0e0e0',
                        fontSize: '9px',
                        maxHeight: '150px',
                        overflowY: 'auto'
                      }}>
                        {lensData && typeof lensData === 'object' ? (
                          Object.entries(lensData).length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {Object.entries(lensData).map(([key, value]) => {
                                // Render items - HoloSphere items have an 'id' field
                                const item = value as Record<string, any>
                                const isHolonItem = item && typeof item === 'object' && 'id' in item

                                return (
                                  <div key={key} style={{
                                    backgroundColor: '#fff',
                                    padding: '6px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid #e5e7eb'
                                  }}>
                                    {isHolonItem ? (
                                      // Render as a holon item with structured display
                                      <div>
                                        <div style={{
                                          fontWeight: '600',
                                          color: '#1f2937',
                                          marginBottom: '4px',
                                          display: 'flex',
                                          justifyContent: 'space-between'
                                        }}>
                                          <span>{item.name || item.title || item.id}</span>
                                          {item.timestamp && (
                                            <span style={{ fontSize: '8px', color: '#9ca3af', fontWeight: 'normal' }}>
                                              {new Date(item.timestamp).toLocaleDateString()}
                                            </span>
                                          )}
                                        </div>
                                        {item.description && (
                                          <div style={{ color: '#6b7280', fontSize: '9px' }}>
                                            {item.description}
                                          </div>
                                        )}
                                        {item.content && (
                                          <div style={{ color: '#374151', fontSize: '9px', marginTop: '2px' }}>
                                            {String(item.content).slice(0, 100)}
                                            {String(item.content).length > 100 && '...'}
                                          </div>
                                        )}
                                        {/* Show other relevant fields */}
                                        {Object.entries(item)
                                          .filter(([k]) => !['id', 'name', 'title', 'description', 'content', 'timestamp', '_'].includes(k))
                                          .slice(0, 3)
                                          .map(([k, v]) => (
                                            <div key={k} style={{ fontSize: '8px', color: '#9ca3af', marginTop: '2px' }}>
                                              <span style={{ fontWeight: '500' }}>{k}:</span> {String(v).slice(0, 50)}
                                            </div>
                                          ))
                                        }
                                      </div>
                                    ) : (
                                      // Render as key-value pair
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                        <span style={{
                                          fontWeight: 'bold',
                                          color: '#666',
                                          minWidth: '60px',
                                          fontFamily: 'monospace',
                                          fontSize: '8px'
                                        }}>
                                          {key}:
                                        </span>
                                        <span style={{
                                          flex: 1,
                                          color: '#333',
                                          wordBreak: 'break-word'
                                        }}>
                                          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div style={{ color: '#999', fontStyle: 'italic' }}>No data in this lens</div>
                          )
                        ) : (
                          <div style={{ color: '#333' }}>{String(lensData)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isConnected && (!data || Object.keys(data).length === 0) && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#fefce8',
                  borderRadius: '8px',
                  border: '1px solid #fde047',
                  color: '#854d0e',
                  fontSize: '11px',
                  textAlign: 'center'
                }}>
                  <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: '500' }}>
                    No data found in this holon
                  </div>
                  <div style={{ fontSize: '10px', color: '#a16207' }}>
                    This H3 cell may not have any data stored yet. You can add data using the + button above.
                  </div>
                  {isLoading && (
                    <div style={{ marginTop: '8px', color: '#ca8a04' }}>
                      Loading data from GunDB...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  indicator(shape: IHolon) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
