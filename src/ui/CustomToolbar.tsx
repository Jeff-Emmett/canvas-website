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

// AI tool model configurations for the dropdown
const AI_TOOLS = [
  { id: 'chat', name: 'Chat', icon: '💬', model: 'llama3.1:8b', provider: 'Ollama', type: 'local' },
  { id: 'make-real', name: 'Make Real', icon: '🔧', model: 'claude-sonnet-4-5', provider: 'Anthropic', type: 'cloud' },
  { id: 'image-gen', name: 'Image Gen', icon: '🎨', model: 'SDXL', provider: 'RunPod', type: 'gpu' },
  { id: 'video-gen', name: 'Video Gen', icon: '🎬', model: 'Wan2.1', provider: 'RunPod', type: 'gpu' },
  { id: 'transcription', name: 'Transcribe', icon: '🎤', model: 'Web Speech', provider: 'Browser', type: 'local' },
  { id: 'mycelial', name: 'Mycelial', icon: '🍄', model: 'llama3.1:70b', provider: 'Ollama', type: 'local' },
]

// Dark mode utilities
const getDarkMode = (): boolean => {
  const stored = localStorage.getItem('darkMode')
  if (stored !== null) {
    return stored === 'true'
  }
  // Default to light mode instead of system preference
  return false
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
  const profilePopupRef = useRef<HTMLDivElement>(null)
  const [isDarkMode, setIsDarkMode] = useState(getDarkMode())

  // Dropdown section states
  const [expandedSection, setExpandedSection] = useState<'none' | 'ai' | 'integrations'>('none')
  const [hasFathomApiKey, setHasFathomApiKey] = useState(false)
  const [showFathomInput, setShowFathomInput] = useState(false)
  const [fathomKeyInput, setFathomKeyInput] = useState('')

  // Initialize dark mode on mount
  useEffect(() => {
    setDarkMode(isDarkMode)
  }, [])

  // Check Fathom API key status
  useEffect(() => {
    if (session.authed && session.username) {
      setHasFathomApiKey(isFathomApiKeyConfigured(session.username))
    }
  }, [session.authed, session.username])

  const toggleDarkMode = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    setDarkMode(newMode)
  }

  useEffect(() => {
    if (editor && tools) {
      setIsReady(true)
      // Tools are ready
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
      // Allow multiple FathomMeetingsBrowser instances

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
      // Check if ObsidianBrowser already exists
      const allShapes = editor.getCurrentPageShapes()
      const existingBrowserShapes = allShapes.filter(shape => shape.type === 'ObsidianBrowser')

      if (existingBrowserShapes.length > 0) {
        // If a browser already exists, just select it
        editor.setSelectedShapes([existingBrowserShapes[0].id])
        editor.setCurrentTool('hand')
        return
      }

      // No existing browser, create a new one

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
        xPosition = clickPoint.x - shapeWidth / 2
        yPosition = clickPoint.y - shapeHeight / 2
      } else {
        // Try to get current page point (if called from a click)
        const currentPagePoint = editor.inputs.currentPagePoint
        if (currentPagePoint && currentPagePoint.x !== undefined && currentPagePoint.y !== undefined) {
          xPosition = currentPagePoint.x - shapeWidth / 2
          yPosition = currentPagePoint.y - shapeHeight / 2
        } else {
          // Fallback to viewport center if no click coordinates available
          const viewport = editor.getViewportPageBounds()
          const centerX = viewport.x + viewport.w / 2
          const centerY = viewport.y + viewport.h / 2
          xPosition = centerX - shapeWidth / 2
          yPosition = centerY - shapeHeight / 2
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
      // Check if a HolonBrowser shape already exists
      const allShapes = editor.getCurrentPageShapes()
      const existingBrowserShapes = allShapes.filter(s => s.type === 'HolonBrowser')

      if (existingBrowserShapes.length > 0) {
        // If a browser already exists, just select it
        editor.setSelectedShapes([existingBrowserShapes[0].id])
        editor.setCurrentTool('select')
        return
      }

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
      // If vault browser is open, trigger shape creation
      if (showVaultBrowser) {
        const event = new CustomEvent('trigger-obsnote-creation')
        window.dispatchEvent(event)
      } else {
        // If vault browser is not open, open it first
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

  const handleLogout = () => {
    // Clear the session
    clearSession()

    // Close the popup
    setShowProfilePopup(false)
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
          pointerEvents: "auto",
        }}
      >
        <LoginButton className="toolbar-btn" />
        <StarBoardButton className="toolbar-btn" />

        {session.authed && (
          <div style={{ position: "relative" }}>
            <button
              className="toolbar-btn profile-btn"
              onClick={() => setShowProfilePopup(!showProfilePopup)}
              title={`Signed in as ${session.username}`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
              </svg>
              <span className="profile-username">{session.username}</span>
            </button>

            {showProfilePopup && (
              <div ref={profilePopupRef} className="profile-dropdown" style={{ width: '280px', maxHeight: '80vh', overflowY: 'auto' }}>
                <div className="profile-dropdown-header">
                  <div className="profile-avatar">
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
                    </svg>
                  </div>
                  <div className="profile-info">
                    <span className="profile-name">{session.username}</span>
                    <span className="profile-label">CryptID Account</span>
                  </div>
                </div>

                <div className="profile-dropdown-divider" />

                <a href="/dashboard/" className="profile-dropdown-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.251.068a.5.5 0 0 1 .227.58L9.677 6.5H13a.5.5 0 0 1 .364.843l-8 8.5a.5.5 0 0 1-.842-.49L6.323 9.5H3a.5.5 0 0 1-.364-.843l8-8.5a.5.5 0 0 1 .615-.09z"/>
                  </svg>
                  <span>My Saved Boards</span>
                </a>

                <div className="profile-dropdown-divider" />

                {/* General Settings */}
                <button className="profile-dropdown-item" onClick={toggleDarkMode}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    {isDarkMode ? (
                      <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm.5-9.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm0 11a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm5-5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm-11 0a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm9.743-4.036a.5.5 0 1 1-.707-.707.5.5 0 0 1 .707.707zm-7.779 7.779a.5.5 0 1 1-.707-.707.5.5 0 0 1 .707.707zm7.072 0a.5.5 0 1 1 .707-.707.5.5 0 0 1-.707.707zM3.757 4.464a.5.5 0 1 1 .707-.707.5.5 0 0 1-.707.707z"/>
                    ) : (
                      <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/>
                    )}
                  </svg>
                  <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                </button>

                <div className="profile-dropdown-divider" />

                {/* AI Models Section */}
                <button
                  className="profile-dropdown-item"
                  onClick={() => setExpandedSection(expandedSection === 'ai' ? 'none' : 'ai')}
                  style={{ justifyContent: 'space-between' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>🤖</span>
                    <span>AI Models</span>
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    style={{ transform: expandedSection === 'ai' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                  >
                    <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                  </svg>
                </button>

                {expandedSection === 'ai' && (
                  <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-muted-2, #f5f5f5)' }}>
                    <p style={{ fontSize: '10px', color: 'var(--color-text-2, #666)', marginBottom: '8px' }}>
                      Local models are free. Cloud models require API keys.
                    </p>
                    {AI_TOOLS.map((tool) => (
                      <div
                        key={tool.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 0',
                          borderBottom: '1px solid var(--color-muted-1, #eee)',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                          <span>{tool.icon}</span>
                          <span>{tool.name}</span>
                        </span>
                        <span
                          style={{
                            fontSize: '9px',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            backgroundColor: tool.type === 'local' ? '#d1fae5' : tool.type === 'gpu' ? '#e0e7ff' : '#fef3c7',
                            color: tool.type === 'local' ? '#065f46' : tool.type === 'gpu' ? '#3730a3' : '#92400e',
                            fontWeight: 500,
                          }}
                        >
                          {tool.model}
                        </span>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        addDialog({
                          id: "api-keys",
                          component: ({ onClose: dialogClose }: { onClose: () => void }) => (
                            <SettingsDialog
                              onClose={() => {
                                dialogClose()
                                removeDialog("api-keys")
                                checkApiKeys()
                              }}
                            />
                          ),
                        })
                      }}
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: 500,
                        backgroundColor: 'var(--color-primary, #3b82f6)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      {hasApiKey ? 'Manage API Keys' : 'Add API Keys'}
                    </button>
                  </div>
                )}

                {/* Integrations Section */}
                <button
                  className="profile-dropdown-item"
                  onClick={() => setExpandedSection(expandedSection === 'integrations' ? 'none' : 'integrations')}
                  style={{ justifyContent: 'space-between' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>🔗</span>
                    <span>Integrations</span>
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    style={{ transform: expandedSection === 'integrations' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                  >
                    <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                  </svg>
                </button>

                {expandedSection === 'integrations' && (
                  <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-muted-2, #f5f5f5)' }}>
                    {/* Obsidian Vault */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500 }}>
                          <span>📁</span> Obsidian Vault
                        </span>
                        <span
                          style={{
                            fontSize: '9px',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            backgroundColor: session.obsidianVaultName ? '#d1fae5' : '#fef3c7',
                            color: session.obsidianVaultName ? '#065f46' : '#92400e',
                            fontWeight: 500,
                          }}
                        >
                          {session.obsidianVaultName ? 'Connected' : 'Not Set'}
                        </span>
                      </div>
                      {session.obsidianVaultName && (
                        <p style={{ fontSize: '10px', color: '#059669', marginBottom: '4px' }}>{session.obsidianVaultName}</p>
                      )}
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('open-obsidian-browser'))
                          setShowProfilePopup(false)
                        }}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          fontSize: '10px',
                          backgroundColor: 'white',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        {session.obsidianVaultName ? 'Change Vault' : 'Connect Vault'}
                      </button>
                    </div>

                    {/* Fathom Meetings */}
                    <div style={{ paddingTop: '8px', borderTop: '1px solid var(--color-muted-1, #ddd)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500 }}>
                          <span>🎥</span> Fathom Meetings
                        </span>
                        <span
                          style={{
                            fontSize: '9px',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            backgroundColor: hasFathomApiKey ? '#d1fae5' : '#fef3c7',
                            color: hasFathomApiKey ? '#065f46' : '#92400e',
                            fontWeight: 500,
                          }}
                        >
                          {hasFathomApiKey ? 'Connected' : 'Not Set'}
                        </span>
                      </div>

                      {showFathomInput ? (
                        <div>
                          <input
                            type="password"
                            value={fathomKeyInput}
                            onChange={(e) => setFathomKeyInput(e.target.value)}
                            placeholder="Enter Fathom API key..."
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              fontSize: '11px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              marginBottom: '6px',
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && fathomKeyInput.trim()) {
                                saveFathomApiKey(fathomKeyInput.trim(), session.username)
                                setHasFathomApiKey(true)
                                setShowFathomInput(false)
                                setFathomKeyInput('')
                              } else if (e.key === 'Escape') {
                                setShowFathomInput(false)
                                setFathomKeyInput('')
                              }
                            }}
                            autoFocus
                          />
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={() => {
                                if (fathomKeyInput.trim()) {
                                  saveFathomApiKey(fathomKeyInput.trim(), session.username)
                                  setHasFathomApiKey(true)
                                  setShowFathomInput(false)
                                  setFathomKeyInput('')
                                }
                              }}
                              style={{
                                flex: 1,
                                padding: '5px',
                                fontSize: '10px',
                                backgroundColor: 'var(--color-primary, #3b82f6)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setShowFathomInput(false)
                                setFathomKeyInput('')
                              }}
                              style={{
                                flex: 1,
                                padding: '5px',
                                fontSize: '10px',
                                backgroundColor: 'white',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                          <a
                            href="https://app.usefathom.com/settings/integrations"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'block', fontSize: '9px', color: '#3b82f6', marginTop: '6px', textDecoration: 'none' }}
                          >
                            Get API key from Fathom →
                          </a>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => {
                              setShowFathomInput(true)
                              const currentKey = getFathomApiKey(session.username)
                              if (currentKey) setFathomKeyInput(currentKey)
                            }}
                            style={{
                              flex: 1,
                              padding: '5px 8px',
                              fontSize: '10px',
                              backgroundColor: 'white',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            {hasFathomApiKey ? 'Change Key' : 'Add API Key'}
                          </button>
                          {hasFathomApiKey && (
                            <button
                              onClick={() => {
                                removeFathomApiKey(session.username)
                                setHasFathomApiKey(false)
                              }}
                              style={{
                                padding: '5px 8px',
                                fontSize: '10px',
                                backgroundColor: '#fee2e2',
                                color: '#dc2626',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              Disconnect
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="profile-dropdown-divider" />

                {!session.backupCreated && (
                  <div className="profile-dropdown-warning">
                    Back up your encryption keys to prevent data loss
                  </div>
                )}

                <button className="profile-dropdown-item danger" onClick={handleLogout}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"/>
                    <path fillRule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"/>
                  </svg>
                  <span>Sign Out</span>
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
        {tools["FathomMeetings"] && (
          <TldrawUiMenuItem
            {...tools["FathomMeetings"]}
            icon="calendar"
            label="Fathom Meetings"
            isSelected={tools["FathomMeetings"].id === editor.getCurrentToolId()}
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
        {tools["Map"] && (
          <TldrawUiMenuItem
            {...tools["Map"]}
            icon="geo-globe"
            label="Map"
            isSelected={tools["Map"].id === editor.getCurrentToolId()}
          />
        )}
        {/* MycelialIntelligence moved to permanent floating bar */}
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
