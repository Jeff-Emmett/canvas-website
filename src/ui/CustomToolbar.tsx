import { TldrawUiMenuItem } from "tldraw"
import { DefaultToolbar, DefaultToolbarContent } from "tldraw"
import { useTools } from "tldraw"
import { useEditor } from "tldraw"
import { useState, useEffect, useRef } from "react"
import { useDialogs } from "tldraw"
import { SettingsDialog } from "./SettingsDialog"
import { useAuth } from "../context/AuthContext"
import LoginButton from "../components/auth/LoginButton"
import StarBoardButton from "../components/StarBoardButton"
import { ObsidianVaultBrowser } from "../components/ObsidianVaultBrowser"
import { HolonBrowser } from "../components/HolonBrowser"
import { ObsNoteShape } from "../shapes/ObsNoteShapeUtil"
import { createShapeId } from "tldraw"
import type { ObsidianObsNote } from "../lib/obsidianImporter"
import { HolonData } from "../lib/HoloSphereService"
import { FathomMeetingsPanel } from "../components/FathomMeetingsPanel"
import { getFathomApiKey, saveFathomApiKey, removeFathomApiKey, isFathomApiKeyConfigured } from "../lib/fathomApiKey"

// Dark mode utilities
const getDarkMode = (): boolean => {
  const stored = localStorage.getItem('darkMode')
  if (stored !== null) {
    return stored === 'true'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

const setDarkMode = (isDark: boolean) => {
  localStorage.setItem('darkMode', String(isDark))
  document.documentElement.classList.toggle('dark', isDark)
}

export function CustomToolbar() {
  const editor = useEditor()
  const tools = useTools()
  const [isReady, setIsReady] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const { addDialog, removeDialog } = useDialogs()

  const { session, setSession, clearSession } = useAuth()
  const [showProfilePopup, setShowProfilePopup] = useState(false)
  const [showVaultBrowser, setShowVaultBrowser] = useState(false)
  const [showHolonBrowser, setShowHolonBrowser] = useState(false)
  const [vaultBrowserMode, setVaultBrowserMode] = useState<'keyboard' | 'button'>('keyboard')
  const [showFathomPanel, setShowFathomPanel] = useState(false)
  const [showFathomApiKeyInput, setShowFathomApiKeyInput] = useState(false)
  const [fathomApiKeyInput, setFathomApiKeyInput] = useState('')
  const [hasFathomApiKey, setHasFathomApiKey] = useState(false)
  const profilePopupRef = useRef<HTMLDivElement>(null)
  const [isDarkMode, setIsDarkMode] = useState(getDarkMode())

  // Initialize dark mode on mount
  useEffect(() => {
    setDarkMode(isDarkMode)
  }, [])

  const toggleDarkMode = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    setDarkMode(newMode)
  }

  useEffect(() => {
    if (editor && tools) {
      setIsReady(true)
      // Debug: log available tools
      console.log('🔧 CustomToolbar: Available tools:', Object.keys(tools))
      console.log('🔧 CustomToolbar: VideoGen exists:', !!tools["VideoGen"])
      console.log('🔧 CustomToolbar: Multmux exists:', !!tools["Multmux"])
      console.log('🔧 CustomToolbar: ImageGen exists:', !!tools["ImageGen"])
    }
  }, [editor, tools])
 
  // Handle click outside profile popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profilePopupRef.current && !profilePopupRef.current.contains(event.target as Node)) {
        setShowProfilePopup(false)
      }
    }

    if (showProfilePopup) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfilePopup])

  // Alt+O is now handled by the tool system via overrides.tsx
  // It selects the ObsidianNote tool, which waits for canvas click before deploying

  // Listen for open-fathom-meetings event - now creates a shape instead of modal
  useEffect(() => {
    const handleOpenFathomMeetings = () => {
      console.log('🔧 Received open-fathom-meetings event')

      // Allow multiple FathomMeetingsBrowser instances - users can work with multiple meeting browsers
      console.log('🔧 Creating new FathomMeetingsBrowser shape')

      // Get the current viewport center
      const viewport = editor.getViewportPageBounds()
      const centerX = viewport.x + viewport.w / 2
      const centerY = viewport.y + viewport.h / 2

      // Position new browser shape at center
      const xPosition = centerX - 350 // Center the 700px wide shape
      const yPosition = centerY - 300 // Center the 600px tall shape

      try {
        const browserShape = editor.createShape({
          type: 'FathomMeetingsBrowser',
          x: xPosition,
          y: yPosition,
          props: {
            w: 700,
            h: 600,
          }
        })

        console.log('✅ Created FathomMeetingsBrowser shape:', browserShape.id)

        // Select the new shape and switch to select tool
        editor.setSelectedShapes([`shape:${browserShape.id}`] as any)
        editor.setCurrentTool('select')
      } catch (error) {
        console.error('❌ Error creating FathomMeetingsBrowser shape:', error)
      }
    }

    window.addEventListener('open-fathom-meetings', handleOpenFathomMeetings)

    return () => {
      window.removeEventListener('open-fathom-meetings', handleOpenFathomMeetings)
    }
  }, [editor])

  // Listen for open-obsidian-browser event - now creates a shape instead of modal
  useEffect(() => {
    const handleOpenBrowser = (event?: CustomEvent) => {
      console.log('🔧 Received open-obsidian-browser event')

      // Check if ObsidianBrowser already exists
      const allShapes = editor.getCurrentPageShapes()
      const existingBrowserShapes = allShapes.filter(shape => shape.type === 'ObsidianBrowser')
      
      if (existingBrowserShapes.length > 0) {
        // If a browser already exists, just select it
        console.log('✅ ObsidianBrowser already exists, selecting it')
        editor.setSelectedShapes([existingBrowserShapes[0].id])
        editor.setCurrentTool('hand')
        return
      }

      // No existing browser, create a new one
      console.log('🔧 Creating new ObsidianBrowser shape')

      // Try to get click position from event or use current page point
      let xPosition: number
      let yPosition: number
      
      // Check if event has click coordinates
      // Standardized size: 800x600
      const shapeWidth = 800
      const shapeHeight = 600
      
      const clickPoint = (event as any)?.detail?.point
      if (clickPoint) {
        // Use click coordinates from event
        xPosition = clickPoint.x - shapeWidth / 2 // Center the shape on click
        yPosition = clickPoint.y - shapeHeight / 2 // Center the shape on click
        console.log('📍 Positioning at event click location:', { clickPoint, xPosition, yPosition })
      } else {
        // Try to get current page point (if called from a click)
        const currentPagePoint = editor.inputs.currentPagePoint
        if (currentPagePoint && currentPagePoint.x !== undefined && currentPagePoint.y !== undefined) {
          xPosition = currentPagePoint.x - shapeWidth / 2 // Center the shape on click
          yPosition = currentPagePoint.y - shapeHeight / 2 // Center the shape on click
          console.log('📍 Positioning at current page point:', { currentPagePoint, xPosition, yPosition })
        } else {
          // Fallback to viewport center if no click coordinates available
          const viewport = editor.getViewportPageBounds()
          const centerX = viewport.x + viewport.w / 2
          const centerY = viewport.y + viewport.h / 2
          xPosition = centerX - shapeWidth / 2 // Center the shape
          yPosition = centerY - shapeHeight / 2 // Center the shape
          console.log('📍 Positioning at viewport center (fallback):', { centerX, centerY, xPosition, yPosition })
        }
      }

      try {
        const browserShape = editor.createShape({
          type: 'ObsidianBrowser',
          x: xPosition,
          y: yPosition,
          props: {
            w: shapeWidth,
            h: shapeHeight,
          }
        })

        console.log('✅ Created ObsidianBrowser shape:', browserShape.id)

        // Select the new shape and switch to hand tool
        editor.setSelectedShapes([`shape:${browserShape.id}`] as any)
        editor.setCurrentTool('hand')
      } catch (error) {
        console.error('❌ Error creating ObsidianBrowser shape:', error)
      }
    }

    window.addEventListener('open-obsidian-browser', handleOpenBrowser as EventListener)

    return () => {
      window.removeEventListener('open-obsidian-browser', handleOpenBrowser as EventListener)
    }
  }, [editor])

  // Listen for open-holon-browser event - now creates a shape instead of modal
  useEffect(() => {
    const handleOpenHolonBrowser = () => {
      console.log('🔧 Received open-holon-browser event')

      // Check if a HolonBrowser shape already exists
      const allShapes = editor.getCurrentPageShapes()
      const existingBrowserShapes = allShapes.filter(s => s.type === 'HolonBrowser')

      if (existingBrowserShapes.length > 0) {
        // If a browser already exists, just select it
        console.log('✅ HolonBrowser already exists, selecting it')
        editor.setSelectedShapes([existingBrowserShapes[0].id])
        editor.setCurrentTool('select')
        return
      }

      console.log('🔧 Creating new HolonBrowser shape')

      // Get the current viewport center
      const viewport = editor.getViewportPageBounds()
      const centerX = viewport.x + viewport.w / 2
      const centerY = viewport.y + viewport.h / 2

      // Position new browser shape at center
      const xPosition = centerX - 400 // Center the 800px wide shape
      const yPosition = centerY - 300 // Center the 600px tall shape

      try {
        const browserShape = editor.createShape({
          type: 'HolonBrowser',
          x: xPosition,
          y: yPosition,
          props: {
            w: 800,
            h: 600,
          }
        })

        console.log('✅ Created HolonBrowser shape:', browserShape.id)

        // Select the new shape and switch to hand tool
        editor.setSelectedShapes([`shape:${browserShape.id}`] as any)
        editor.setCurrentTool('hand')
      } catch (error) {
        console.error('❌ Error creating HolonBrowser shape:', error)
      }
    }

    window.addEventListener('open-holon-browser', handleOpenHolonBrowser)

    return () => {
      window.removeEventListener('open-holon-browser', handleOpenHolonBrowser)
    }
  }, [editor])

  // Handle Holon selection from browser
  const handleHolonSelect = (holonData: HolonData) => {
    console.log('🎯 Creating Holon shape from data:', holonData)
    
    try {
      // Store current camera position to prevent it from changing
      const currentCamera = editor.getCamera()
      editor.stopCameraAnimation()
      
      // Get the current viewport center
      const viewport = editor.getViewportPageBounds()
      const centerX = viewport.x + viewport.w / 2
      const centerY = viewport.y + viewport.h / 2

      // Standardized size: 700x400 (matches default props to fit ID and button)
      const shapeWidth = 700
      const shapeHeight = 400
      
      // Position new Holon shape at viewport center
      const xPosition = centerX - shapeWidth / 2
      const yPosition = centerY - shapeHeight / 2
      
      const holonShape = editor.createShape({
        type: 'Holon',
        x: xPosition,
        y: yPosition,
        props: {
          w: shapeWidth,
          h: shapeHeight,
          name: holonData.name,
          description: holonData.description || '',
          latitude: holonData.latitude,
          longitude: holonData.longitude,
          resolution: holonData.resolution,
          holonId: holonData.id,
          isConnected: true,
          isEditing: false,
          selectedLens: 'general',
          data: holonData.data,
          connections: [],
          lastUpdated: holonData.timestamp
        }
      })
      
      console.log('✅ Created Holon shape from data:', holonShape.id)
      
      // Restore camera position if it changed
      const newCamera = editor.getCamera()
      if (currentCamera.x !== newCamera.x || currentCamera.y !== newCamera.y || currentCamera.z !== newCamera.z) {
        editor.setCamera(currentCamera, { animation: { duration: 0 } })
      }
      
      // Don't select the new shape - let it be created without selection like other tools
      
    } catch (error) {
      console.error('❌ Error creating Holon shape from data:', error)
    }
  }

  // Listen for create-obsnote-shapes event from the tool
  useEffect(() => {
    const handleCreateShapes = () => {
      console.log('🎯 CustomToolbar: Received create-obsnote-shapes event')
      
      // If vault browser is open, trigger shape creation
      if (showVaultBrowser) {
        const event = new CustomEvent('trigger-obsnote-creation')
        window.dispatchEvent(event)
      } else {
        // If vault browser is not open, open it first
        console.log('🎯 Vault browser not open, opening it first')
        setVaultBrowserMode('keyboard')
        setShowVaultBrowser(true)
      }
    }

    window.addEventListener('create-obsnote-shapes', handleCreateShapes as EventListener)
    
    return () => {
      window.removeEventListener('create-obsnote-shapes', handleCreateShapes as EventListener)
    }
  }, [showVaultBrowser])


  const checkApiKeys = () => {
    const settings = localStorage.getItem("openai_api_key")
  
    try {
      if (settings) {
        try {
          const parsed = JSON.parse(settings)
          if (parsed.keys) {
            // New format with multiple providers
            const hasValidKey = Object.values(parsed.keys).some(key => 
              typeof key === 'string' && key.trim() !== ''
            )
            setHasApiKey(hasValidKey)
          } else {
            // Old format - single string
            const hasValidKey = typeof settings === 'string' && settings.trim() !== ''
            setHasApiKey(hasValidKey)
          }
        } catch (e) {
          // Fallback to old format
          const hasValidKey = typeof settings === 'string' && settings.trim() !== ''
          setHasApiKey(hasValidKey)
        }
      } else {
        setHasApiKey(false)
      }
    } catch (e) {
      setHasApiKey(false)
    }
  }

  // Initial check
  useEffect(() => {
    checkApiKeys()
  }, [])

  // Periodic check
  useEffect(() => {
    const interval = setInterval(checkApiKeys, 5000)
    return () => clearInterval(interval)
  }, [])

  // Check Fathom API key status
  useEffect(() => {
    if (session.authed && session.username) {
      const hasKey = isFathomApiKeyConfigured(session.username)
      setHasFathomApiKey(hasKey)
    } else {
      setHasFathomApiKey(false)
    }
  }, [session.authed, session.username])

  const handleLogout = () => {
    // Clear the session
    clearSession()
    
    // Close the popup
    setShowProfilePopup(false)
  }

  const openApiKeysDialog = () => {
    addDialog({
      id: "api-keys",
      component: ({ onClose }: { onClose: () => void }) => (
        <SettingsDialog
          onClose={() => {
            onClose()
            removeDialog("api-keys")
            checkApiKeys() // Refresh API key status
          }}
        />
      ),
    })
  }


  const handleObsNoteSelect = (obsNote: ObsidianObsNote) => {
    // Get current camera position to place the obs_note
    const camera = editor.getCamera()
    const viewportCenter = editor.getViewportScreenCenter()
    
    // Ensure we have valid coordinates - use camera position as fallback
    const baseX = isNaN(viewportCenter.x) ? camera.x : viewportCenter.x
    const baseY = isNaN(viewportCenter.y) ? camera.y : viewportCenter.y
    
    // Get vault information from session
    const vaultPath = session.obsidianVaultPath
    const vaultName = session.obsidianVaultName
    
    // Create a new obs_note shape with vault information
    const obsNoteShape = ObsNoteShape.createFromObsidianObsNote(obsNote, baseX, baseY, createShapeId(), vaultPath, vaultName)
    
    // Use the ObsNote shape directly - no conversion needed
    const convertedShape = obsNoteShape
    
    // Add the shape to the canvas
    try {
      // Store current camera position to prevent it from changing
      const currentCamera = editor.getCamera()
      editor.stopCameraAnimation()
      
      editor.createShapes([convertedShape])
      
      // Restore camera position if it changed
      const newCamera = editor.getCamera()
      if (currentCamera.x !== newCamera.x || currentCamera.y !== newCamera.y || currentCamera.z !== newCamera.z) {
        editor.setCamera(currentCamera, { animation: { duration: 0 } })
      }
      
      // Select the newly created shape so user can see it
      setTimeout(() => {
        // Preserve camera position when selecting
        const cameraBeforeSelect = editor.getCamera()
        editor.stopCameraAnimation()
        editor.setSelectedShapes([obsNoteShape.id])
        editor.setCurrentTool('select')
        // Restore camera if it changed during selection
        const cameraAfterSelect = editor.getCamera()
        if (cameraBeforeSelect.x !== cameraAfterSelect.x || cameraBeforeSelect.y !== cameraAfterSelect.y || cameraBeforeSelect.z !== cameraAfterSelect.z) {
          editor.setCamera(cameraBeforeSelect, { animation: { duration: 0 } })
        }
      }, 100)
    } catch (error) {
      console.error('🎯 Error adding shape to canvas:', error)
    }
    
    // Close the browser
    setShowVaultBrowser(false)
  }

  const handleObsNotesSelect = (obsNotes: ObsidianObsNote[]) => {
    // Get current camera position to place the obs_notes
    const camera = editor.getCamera()
    const viewportCenter = editor.getViewportScreenCenter()
    
    // Ensure we have valid coordinates - use camera position as fallback
    const baseX = isNaN(viewportCenter.x) ? camera.x : viewportCenter.x
    const baseY = isNaN(viewportCenter.y) ? camera.y : viewportCenter.y
    
    // Get vault information from session
    const vaultPath = session.obsidianVaultPath
    const vaultName = session.obsidianVaultName
    
    // Create obs_note shapes
    const obsNoteShapes: any[] = []
    
    for (let index = 0; index < obsNotes.length; index++) {
      const obs_note = obsNotes[index]
      
      // Use a grid-based position
      const gridCols = 3
      const gridWidth = 320
      const gridHeight = 220
      const xPosition = baseX + (index % gridCols) * gridWidth
      const yPosition = baseY + Math.floor(index / gridCols) * gridHeight
      
      const shape = ObsNoteShape.createFromObsidianObsNote(obs_note, xPosition, yPosition, createShapeId(), vaultPath, vaultName)
      obsNoteShapes.push(shape)
    }
    
    // Use the ObsNote shapes directly - no conversion needed
    const convertedShapes = obsNoteShapes
    
    // Add all shapes to the canvas
    try {
      // Store current camera position to prevent it from changing
      const currentCamera = editor.getCamera()
      editor.stopCameraAnimation()
      
      editor.createShapes(convertedShapes)
      
      // Restore camera position if it changed
      const newCamera = editor.getCamera()
      if (currentCamera.x !== newCamera.x || currentCamera.y !== newCamera.y || currentCamera.z !== newCamera.z) {
        editor.setCamera(currentCamera, { animation: { duration: 0 } })
      }
      
      // Select all newly created shapes so user can see them
      const newShapeIds = obsNoteShapes.map(shape => shape.id)
      setTimeout(() => {
        // Preserve camera position when selecting
        const cameraBeforeSelect = editor.getCamera()
        editor.stopCameraAnimation()
        editor.setSelectedShapes(newShapeIds)
        editor.setCurrentTool('select')
        // Restore camera if it changed during selection
        const cameraAfterSelect = editor.getCamera()
        if (cameraBeforeSelect.x !== cameraAfterSelect.x || cameraBeforeSelect.y !== cameraAfterSelect.y || cameraBeforeSelect.z !== cameraAfterSelect.z) {
          editor.setCamera(cameraBeforeSelect, { animation: { duration: 0 } })
        }
      }, 100)
    } catch (error) {
      console.error('🎯 Error adding shapes to canvas:', error)
    }
    
    // Close the browser
    setShowVaultBrowser(false)
  }



  if (!isReady) return null

  return (
    <div style={{ position: "relative" }}>
      <div
        className="toolbar-container"
        style={{
          position: "fixed",
          top: "4px",
          right: "40px",
          zIndex: 99999,
          pointerEvents: "auto",
          display: "flex",
          gap: "6px",
          alignItems: "center",
        }}
      >
        {/* Dark/Light Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          style={{
            padding: "4px 8px",
            borderRadius: "4px",
            background: "#6B7280",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontWeight: 500,
            transition: "background 0.2s ease",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            whiteSpace: "nowrap",
            userSelect: "none",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            height: "22px",
            minHeight: "22px",
            boxSizing: "border-box",
            fontSize: "0.75rem",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#4B5563"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#6B7280"
          }}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          <span style={{ fontSize: "14px" }}>
            {isDarkMode ? "☀️" : "🌙"}
          </span>
        </button>

        <LoginButton className="toolbar-login-button" />
        <StarBoardButton className="toolbar-star-button" />
        
        {session.authed && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowProfilePopup(!showProfilePopup)}
              style={{
                padding: "4px 8px",
                borderRadius: "4px",
                background: "#6B7280",
                color: "white",
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
                transition: "background 0.2s ease",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                whiteSpace: "nowrap",
                userSelect: "none",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                height: "22px",
                minHeight: "22px",
                boxSizing: "border-box",
                fontSize: "0.75rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#4B5563"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#6B7280"
              }}
            >
              <span style={{ fontSize: "12px" }}>
                {hasApiKey ? "🔑" : "❌"}
              </span>
              <span>CryptID: {session.username}</span>
            </button>
          
            {showProfilePopup && (
              <div 
                ref={profilePopupRef}
                style={{
                  position: "absolute",
                  top: "40px",
                  right: "0",
                  width: "250px",
                  backgroundColor: "white",
                  borderRadius: "4px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                  padding: "16px",
                  zIndex: 100000,
                }}
              >
                <div style={{ marginBottom: "12px", fontWeight: "bold" }}>
                  CryptID: {session.username}
                </div>
                
                {/* API Key Status */}
                <div style={{ 
                  marginBottom: "16px", 
                  padding: "12px",
                  backgroundColor: hasApiKey ? "#f0f9ff" : "#fef2f2",
                  borderRadius: "4px",
                  border: `1px solid ${hasApiKey ? "#0ea5e9" : "#f87171"}`
                }}>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    marginBottom: "8px"
                  }}>
                    <span style={{ fontWeight: "500" }}>AI API Keys</span>
                    <span style={{ fontSize: "14px" }}>
                      {hasApiKey ? "✅ Configured" : "❌ Not configured"}
                    </span>
                  </div>
                  <p style={{ 
                    fontSize: "12px", 
                    color: "#666",
                    margin: "0 0 8px 0"
                  }}>
                    {hasApiKey 
                      ? "Your AI models are ready to use" 
                      : "Configure API keys to use AI features"
                    }
                  </p>
                  <button
                    onClick={openApiKeysDialog}
                    style={{
                      width: "100%",
                      padding: "6px 12px",
                      backgroundColor: hasApiKey ? "#0ea5e9" : "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "500",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = hasApiKey ? "#0284c7" : "#dc2626"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = hasApiKey ? "#0ea5e9" : "#ef4444"
                    }}
                  >
                    {hasApiKey ? "Manage Keys" : "Add API Keys"}
                  </button>
                </div>
                
                {/* Obsidian Vault Settings */}
                <div style={{ 
                  marginBottom: "16px", 
                  padding: "12px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "4px",
                  border: "1px solid #e9ecef"
                }}>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    marginBottom: "8px"
                  }}>
                    <span style={{ fontWeight: "500" }}>Obsidian Vault</span>
                    <span style={{ fontSize: "14px" }}>
                      {session.obsidianVaultName ? "✅ Configured" : "❌ Not configured"}
                    </span>
                  </div>
                  
                  {session.obsidianVaultName ? (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ 
                        fontSize: "12px", 
                        color: "#007acc",
                        fontWeight: "600",
                        marginBottom: "4px"
                      }}>
                        {session.obsidianVaultName}
                      </div>
                      <div style={{ 
                        fontSize: "11px", 
                        color: "#666",
                        fontFamily: "monospace",
                        wordBreak: "break-all"
                      }}>
                        {session.obsidianVaultPath === 'folder-selected' 
                          ? 'Folder selected (path not available)' 
                          : session.obsidianVaultPath}
                      </div>
                    </div>
                  ) : (
                    <p style={{ 
                      fontSize: "12px", 
                      color: "#666",
                      margin: "0 0 8px 0"
                    }}>
                      No Obsidian vault configured
                    </p>
                  )}
                  
                  <button
                    onClick={() => {
                      console.log('🔧 Set Vault button clicked, opening folder picker')
                      setVaultBrowserMode('button')
                      setShowVaultBrowser(true)
                    }}
                    style={{
                      width: "100%",
                      padding: "6px 12px",
                      backgroundColor: session.obsidianVaultName ? "#007acc" : "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "500",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = session.obsidianVaultName ? "#005a9e" : "#218838"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = session.obsidianVaultName ? "#007acc" : "#28a745"
                    }}
                  >
                    {session.obsidianVaultName ? "Change Vault" : "Set Vault"}
                  </button>
                </div>
                
                {/* Fathom API Key Settings */}
                <div style={{ 
                  marginBottom: "16px", 
                  padding: "12px",
                  backgroundColor: hasFathomApiKey ? "#f0f9ff" : "#fef2f2",
                  borderRadius: "4px",
                  border: `1px solid ${hasFathomApiKey ? "#0ea5e9" : "#f87171"}`
                }}>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    marginBottom: "8px"
                  }}>
                    <span style={{ fontWeight: "500" }}>Fathom API</span>
                    <span style={{ fontSize: "14px" }}>
                      {hasFathomApiKey ? "✅ Connected" : "❌ Not connected"}
                    </span>
                  </div>
                  
                  {showFathomApiKeyInput ? (
                    <div>
                      <input
                        type="password"
                        value={fathomApiKeyInput}
                        onChange={(e) => setFathomApiKeyInput(e.target.value)}
                        placeholder="Enter Fathom API key..."
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          marginBottom: "8px",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "12px",
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (fathomApiKeyInput.trim()) {
                              saveFathomApiKey(fathomApiKeyInput.trim(), session.username)
                              setHasFathomApiKey(true)
                              setShowFathomApiKeyInput(false)
                              setFathomApiKeyInput('')
                            }
                          } else if (e.key === 'Escape') {
                            setShowFathomApiKeyInput(false)
                            setFathomApiKeyInput('')
                          }
                        }}
                        autoFocus
                      />
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          onClick={() => {
                            if (fathomApiKeyInput.trim()) {
                              saveFathomApiKey(fathomApiKeyInput.trim(), session.username)
                              setHasFathomApiKey(true)
                              setShowFathomApiKeyInput(false)
                              setFathomApiKeyInput('')
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: "4px 8px",
                            backgroundColor: "#0ea5e9",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "11px",
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setShowFathomApiKeyInput(false)
                            setFathomApiKeyInput('')
                          }}
                          style={{
                            flex: 1,
                            padding: "4px 8px",
                            backgroundColor: "#6b7280",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "11px",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p style={{ 
                        fontSize: "12px", 
                        color: "#666",
                        margin: "0 0 8px 0"
                      }}>
                        {hasFathomApiKey 
                          ? "Your Fathom account is connected" 
                          : "Connect your Fathom account to import meetings"}
                      </p>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          onClick={() => {
                            setShowFathomApiKeyInput(true)
                            const currentKey = getFathomApiKey(session.username)
                            if (currentKey) {
                              setFathomApiKeyInput(currentKey)
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: "6px 12px",
                            backgroundColor: hasFathomApiKey ? "#0ea5e9" : "#ef4444",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "500",
                          }}
                        >
                          {hasFathomApiKey ? "Change Key" : "Add API Key"}
                        </button>
                        {hasFathomApiKey && (
                          <button
                            onClick={() => {
                              removeFathomApiKey(session.username)
                              setHasFathomApiKey(false)
                            }}
                            style={{
                              padding: "6px 12px",
                              backgroundColor: "#6b7280",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: "500",
                            }}
                          >
                            Disconnect
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
                
                <a
                  href="/dashboard/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "8px 12px",
                    backgroundColor: "#3B82F6",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "500",
                    textDecoration: "none",
                    textAlign: "center",
                    marginBottom: "8px",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#2563EB"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#3B82F6"
                  }}
                >
                  My Dashboard
                </a>
                
                {!session.backupCreated && (
                  <div style={{ 
                    marginBottom: "12px", 
                    fontSize: "12px", 
                    color: "#666",
                    padding: "8px",
                    backgroundColor: "#f8f8f8",
                    borderRadius: "4px"
                  }}>
                    Remember to back up your encryption keys to prevent data loss!
                  </div>
                )}
                
                <button
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    backgroundColor: "#EF4444",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "500",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#DC2626"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#EF4444"
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <DefaultToolbar>
        <DefaultToolbarContent />
        {tools["VideoChat"] && (
          <TldrawUiMenuItem
            {...tools["VideoChat"]}
            icon="video"
            label="Video Chat"
            isSelected={tools["VideoChat"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["ChatBox"] && (
          <TldrawUiMenuItem
            {...tools["ChatBox"]}
            icon="chat"
            label="Chat"
            isSelected={tools["ChatBox"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["Embed"] && (
          <TldrawUiMenuItem
            {...tools["Embed"]}
            icon="embed"
            label="Embed"
            isSelected={tools["Embed"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["SlideShape"] && (
          <TldrawUiMenuItem
            {...tools["SlideShape"]}
            icon="slides"
            label="Slide"
            isSelected={tools["SlideShape"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["Markdown"] && (
          <TldrawUiMenuItem
            {...tools["Markdown"]}
            icon="markdown"
            label="Markdown"
            isSelected={tools["Markdown"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["MycrozineTemplate"] && (
          <TldrawUiMenuItem
            {...tools["MycrozineTemplate"]}
            icon="mycrozinetemplate"
            label="MycrozineTemplate"
            isSelected={
              tools["MycrozineTemplate"].id === editor.getCurrentToolId()
            }
          />
        )}
        {tools["Prompt"] && (
          <TldrawUiMenuItem
            {...tools["Prompt"]}
            icon="prompt"
            label="LLM Prompt"
            isSelected={tools["Prompt"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["ObsidianNote"] && (
          <TldrawUiMenuItem
            {...tools["ObsidianNote"]}
            icon="file-text"
            label="Obsidian Note"
            isSelected={tools["ObsidianNote"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["Transcription"] && (
          <TldrawUiMenuItem
            {...tools["Transcription"]}
            icon="microphone"
            label="Transcription"
            isSelected={tools["Transcription"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["Holon"] && (
          <TldrawUiMenuItem
            {...tools["Holon"]}
            icon="globe"
            label="Holon"
            isSelected={tools["Holon"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["ImageGen"] && (
          <TldrawUiMenuItem
            {...tools["ImageGen"]}
            icon="image"
            label="Image Generation"
            isSelected={tools["ImageGen"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["VideoGen"] && (
          <TldrawUiMenuItem
            {...tools["VideoGen"]}
            icon="video"
            label="Video Generation"
            isSelected={tools["VideoGen"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["Multmux"] && (
          <TldrawUiMenuItem
            {...tools["Multmux"]}
            icon="terminal"
            label="Terminal"
            isSelected={tools["Multmux"].id === editor.getCurrentToolId()}
          />
        )}
        {/* Share Location tool removed for now */}
        {/* Refresh All ObsNotes Button */}
        {(() => {
          const allShapes = editor.getCurrentPageShapes()
          const obsNoteShapes = allShapes.filter(shape => shape.type === 'ObsNote')
          return obsNoteShapes.length > 0 && (
            <TldrawUiMenuItem
              id="refresh-all-obsnotes"
              icon="refresh-cw"
              label="Refresh All Notes"
              onSelect={() => {
                const event = new CustomEvent('refresh-all-obsnotes')
                window.dispatchEvent(event)
              }}
            />
          )
        })()}
      </DefaultToolbar>
      
      {/* Fathom Meetings Panel */}
      {showFathomPanel && (
        <FathomMeetingsPanel
          onClose={() => setShowFathomPanel(false)}
        />
      )}
      
    </div>
  )
}
