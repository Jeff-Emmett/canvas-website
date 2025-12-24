import React, { useState, useEffect, useRef } from 'react'
import { holosphereService, HoloSphereService, HolonData, HolonLens, HOLON_ENABLED } from '@/lib/HoloSphereService'
import * as h3 from 'h3-js'

interface HolonBrowserProps {
  isOpen: boolean
  onClose: () => void
  onSelectHolon: (holonData: HolonData) => void
  shapeMode?: boolean
}

interface HolonInfo {
  id: string
  name: string
  description?: string
  latitude: number
  longitude: number
  resolution: number
  resolutionName: string
  data: Record<string, any>
  lastUpdated: number
}

export function HolonBrowser({ isOpen, onClose, onSelectHolon, shapeMode = false }: HolonBrowserProps) {
  const [holonId, setHolonId] = useState('')
  const [holonInfo, setHolonInfo] = useState<HolonInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lenses, setLenses] = useState<string[]>([])
  const [selectedLens, setSelectedLens] = useState<string>('')
  const [lensData, setLensData] = useState<any>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // If Holon functionality is disabled, show a disabled message
  if (!HOLON_ENABLED) {
    if (!isOpen) return null

    const disabledContent = (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        height: '100%',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '24px' }}>🌐</div>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
          Holon Browser Disabled
        </h2>
        <p style={{ fontSize: '14px', color: '#6b7280', maxWidth: '400px' }}>
          Holon functionality is currently disabled while awaiting Nostr integration.
          This feature will be re-enabled in a future update.
        </p>
        {!shapeMode && (
          <button
            onClick={onClose}
            style={{
              marginTop: '24px',
              padding: '8px 16px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        )}
      </div>
    )

    if (shapeMode) {
      return disabledContent
    }

    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden z-[10000]"
          onClick={(e) => e.stopPropagation()}
        >
          {disabledContent}
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSearchHolon = async () => {
    if (!holonId.trim()) {
      setError('Please enter a Holon ID')
      return
    }

    setIsLoading(true)
    setError(null)
    setHolonInfo(null)

    try {
      // Check if it's a valid H3 cell ID
      const isH3Cell = h3.isValidCell(holonId)

      // Check if it's a numeric Holon ID (workspace/group identifier)
      const isNumericId = /^\d{6,20}$/.test(holonId)

      // Check if it's an alphanumeric identifier
      const isAlphanumericId = /^[a-zA-Z0-9_-]{3,50}$/.test(holonId)

      if (!isH3Cell && !isNumericId && !isAlphanumericId) {
        throw new Error('Invalid Holon ID. Enter an H3 cell ID (e.g., 872a1070bffffff) or a numeric Holon ID (e.g., 1002848305066)')
      }

      // Get holon information based on ID type
      let resolution: number
      let lat: number
      let lng: number

      if (isH3Cell) {
        resolution = h3.getResolution(holonId)
        ;[lat, lng] = h3.cellToLatLng(holonId)
      } else {
        // For non-H3 IDs, use default values
        resolution = -1 // Indicates non-geospatial holon
        lat = 0
        lng = 0
      }
      
      // Try to get metadata from the holon
      let metadata = null
      try {
        metadata = await holosphereService.getData(holonId, 'metadata')
      } catch (error) {
      }

      // Get available lenses by trying to fetch data from common lens types
      // Use the improved categories from HolonShapeUtil
      const commonLenses = [
        'active_users', 'users', 'rankings', 'stats', 'tasks', 'progress',
        'events', 'activities', 'items', 'shopping', 'active_items',
        'proposals', 'offers', 'requests', 'checklists', 'roles',
        'general', 'metadata', 'environment', 'social', 'economic', 'cultural', 'data'
      ]
      const availableLenses: string[] = []

      for (const lens of commonLenses) {
        try {
          // Use getDataWithWait for better Gun data retrieval (shorter timeout for browser)
          const data = await holosphereService.getDataWithWait(holonId, lens, 1000)
          if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
            availableLenses.push(lens)
          }
        } catch (error) {
          // Lens doesn't exist or is empty, skip
        }
      }

      // If no lenses found, add 'general' as default
      if (availableLenses.length === 0) {
        availableLenses.push('general')
      }

      const holonData: HolonInfo = {
        id: holonId,
        name: metadata?.name || `Holon ${holonId.slice(-8)}`,
        description: metadata?.description || '',
        latitude: lat,
        longitude: lng,
        resolution: resolution,
        resolutionName: resolution >= 0
          ? HoloSphereService.getResolutionName(resolution)
          : 'Workspace / Group',
        data: {},
        lastUpdated: metadata?.lastUpdated || Date.now()
      }

      setHolonInfo(holonData)
      setLenses(availableLenses)
      setSelectedLens(availableLenses[0])
      
    } catch (error) {
      console.error('Error searching holon:', error)
      setError(`Failed to load holon: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoadLensData = async (lens: string) => {
    if (!holonInfo) return

    setIsLoadingData(true)
    try {
      // Use getDataWithWait for better Gun data retrieval
      const data = await holosphereService.getDataWithWait(holonInfo.id, lens, 2000)
      setLensData(data)
    } catch (error) {
      console.error('Error loading lens data:', error)
      setLensData(null)
    } finally {
      setIsLoadingData(false)
    }
  }

  useEffect(() => {
    if (selectedLens && holonInfo) {
      handleLoadLensData(selectedLens)
    }
  }, [selectedLens, holonInfo])

  const handleSelectHolon = () => {
    if (holonInfo) {
      const holonData: HolonData = {
        id: holonInfo.id,
        name: holonInfo.name,
        description: holonInfo.description,
        latitude: holonInfo.latitude,
        longitude: holonInfo.longitude,
        resolution: holonInfo.resolution,
        data: holonInfo.data,
        timestamp: holonInfo.lastUpdated
      }
      onSelectHolon(holonData)
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchHolon()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  const contentStyle: React.CSSProperties = shapeMode ? {
    width: '100%',
    height: '100%',
    overflow: 'auto',
    padding: '20px',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  } : {}

  const renderContent = () => (
    <>
      {!shapeMode && (
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">🌐 Holon Browser</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Enter a Holon ID (numeric like 1002848305066 or H3 cell like 872a1070bffffff) to browse its data
          </p>
        </div>
      )}

      <div style={shapeMode ? { display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflow: 'auto' } : { padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
        {/* Holon ID Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Holon ID
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={holonId}
              onChange={(e) => setHolonId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 1002848305066 or 872a1070bffffff"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 z-[10001] relative"
              disabled={isLoading}
              style={{ zIndex: 10001 }}
            />
            <button
              onClick={handleSearchHolon}
              disabled={isLoading || !holonId.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed z-[10001] relative"
              style={{ zIndex: 10001 }}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
          {error && (
            <p className="text-red-600 text-sm mt-2">{error}</p>
          )}
        </div>

        {/* Holon Information */}
        {holonInfo && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              📍 {holonInfo.name}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {holonInfo.resolution >= 0 ? (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Coordinates</p>
                    <p className="font-mono text-sm">
                      {holonInfo.latitude.toFixed(6)}, {holonInfo.longitude.toFixed(6)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Resolution</p>
                    <p className="text-sm">
                      {holonInfo.resolutionName} (Level {holonInfo.resolution})
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-sm text-gray-600">Type</p>
                  <p className="text-sm font-medium text-green-600">
                    {holonInfo.resolutionName}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Holon ID</p>
                <p className="font-mono text-xs break-all">{holonInfo.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-sm">
                  {new Date(holonInfo.lastUpdated).toLocaleString()}
                </p>
              </div>
            </div>

            {holonInfo.description && (
              <div className="mb-4">
                <p className="text-sm text-gray-600">Description</p>
                <p className="text-sm text-gray-800">{holonInfo.description}</p>
              </div>
            )}

            {/* Available Lenses */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Available Data Categories</p>
              <div className="flex flex-wrap gap-2">
                {lenses.map((lens) => (
                  <button
                    key={lens}
                    onClick={() => setSelectedLens(lens)}
                    className={`px-3 py-1 rounded-full text-sm z-[10001] relative ${
                      selectedLens === lens
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    style={{ zIndex: 10001 }}
                  >
                    {lens}
                  </button>
                ))}
              </div>
            </div>

            {/* Lens Data */}
            {selectedLens && (
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-md font-medium text-gray-900">
                    Data: {selectedLens}
                  </h4>
                  {isLoadingData && (
                    <span className="text-sm text-gray-500">Loading...</span>
                  )}
                </div>
                
                {lensData && (
                  <div className="bg-gray-50 rounded-md p-3 max-h-48 overflow-y-auto">
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                      {JSON.stringify(lensData, null, 2)}
                    </pre>
                  </div>
                )}
                
                {!lensData && !isLoadingData && (
                  <p className="text-sm text-gray-500 italic">
                    No data available for this category
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={handleSelectHolon}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 z-[10001] relative"
                style={{ zIndex: 10001 }}
              >
                Import to Canvas
              </button>
              <button
                onClick={() => {
                  setHolonInfo(null)
                  setHolonId('')
                  setError(null)
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 z-[10001] relative"
                style={{ zIndex: 10001 }}
              >
                Search Another
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )

  // If in shape mode, return content without modal overlay
  if (shapeMode) {
    return (
      <div style={contentStyle}>
        {renderContent()}
      </div>
    )
  }

  // Otherwise, return with modal overlay
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden z-[10000]"
        onClick={(e) => e.stopPropagation()}
      >
        {renderContent()}
      </div>
    </div>
  )
}
