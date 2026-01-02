import { TldrawUiMenuItem } from "tldraw"
import { DefaultToolbar, DefaultToolbarContent } from "tldraw"
import { useTools } from "tldraw"
import { useEditor } from "tldraw"
import { useState, useEffect, useRef, useMemo } from "react"
import { useDialogs } from "tldraw"
import { SettingsDialog } from "./SettingsDialog"
import { useAuth } from "../context/AuthContext"
import LoginButton from "../components/auth/LoginButton"
import { ObsidianVaultBrowser } from "../components/ObsidianVaultBrowser"
import { HolonBrowser } from "../components/HolonBrowser"
import { ObsNoteShape } from "../shapes/ObsNoteShapeUtil"
import { createShapeId } from "tldraw"
import type { ObsidianObsNote } from "../lib/obsidianImporter"
import { HolonData } from "../lib/HoloSphereService"
import { FathomMeetingsPanel } from "../components/FathomMeetingsPanel"
// Workflow Builder palette
import WorkflowPalette from "../components/workflow/WorkflowPalette"

// Feature flags - enable experimental features in dev/staging, disable in production
// Use VITE_WORKER_ENV to determine environment (staging is NOT production)
const WORKER_ENV = import.meta.env.VITE_WORKER_ENV || 'production'
const IS_PRODUCTION_ONLY = WORKER_ENV === 'production' // Only true for actual production
const ENABLE_WORKFLOW = !IS_PRODUCTION_ONLY // Workflow blocks - dev/staging only
const ENABLE_CALENDAR = !IS_PRODUCTION_ONLY // Calendar - dev/staging only
const ENABLE_DRAWFAST = !IS_PRODUCTION_ONLY // Drawfast - dev/staging only
import { getFathomApiKey, saveFathomApiKey, removeFathomApiKey, isFathomApiKeyConfigured } from "../lib/fathomApiKey"
import { getMyConnections, updateEdgeMetadata, createConnection, removeConnection, updateTrustLevel } from "../lib/networking/connectionService"
import { TRUST_LEVEL_COLORS, type TrustLevel, type UserConnectionWithProfile, type EdgeMetadata } from "../lib/networking/types"
import { useValue } from "tldraw"

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
  const [showWorkflowPalette, setShowWorkflowPalette] = useState(false)
  const profilePopupRef = useRef<HTMLDivElement>(null)
  const [isDarkMode, setIsDarkMode] = useState(getDarkMode())

  // Dropdown section states
  const [expandedSection, setExpandedSection] = useState<'none' | 'ai' | 'integrations' | 'connections'>('none')
  const [hasFathomApiKey, setHasFathomApiKey] = useState(false)
  const [showFathomInput, setShowFathomInput] = useState(false)
  const [fathomKeyInput, setFathomKeyInput] = useState('')

  // Connections state
  const [connections, setConnections] = useState<UserConnectionWithProfile[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(false)
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null)
  const [editingMetadata, setEditingMetadata] = useState<Partial<EdgeMetadata>>({})
  const [savingMetadata, setSavingMetadata] = useState(false)
  const [connectingUserId, setConnectingUserId] = useState<string | null>(null)

  // Get collaborators from tldraw
  const collaborators = useValue(
    'collaborators',
    () => editor.getCollaborators(),
    [editor]
  )

  // Canvas users with their connection status
  interface CanvasUser {
    id: string
    name: string
    color: string
    connectionStatus: 'trusted' | 'connected' | 'unconnected'
    connectionId?: string
  }

  const canvasUsers: CanvasUser[] = useMemo(() => {
    if (!collaborators || collaborators.length === 0) return []

    return collaborators.map((c: any) => {
      const userId = c.userId || c.id || c.instanceId
      const connection = connections.find(conn => conn.toUserId === userId)

      return {
        id: userId,
        name: c.userName || 'Anonymous',
        color: c.color || '#888888',
        connectionStatus: connection
          ? connection.trustLevel
          : 'unconnected' as const,
        connectionId: connection?.id,
      }
    })
  }, [collaborators, connections])

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

  // Fetch connections when section is expanded
  useEffect(() => {
    if (expandedSection === 'connections' && session.authed) {
      setConnectionsLoading(true)
      getMyConnections()
        .then(setConnections)
        .catch(console.error)
        .finally(() => setConnectionsLoading(false))
    }
  }, [expandedSection, session.authed])

  // Handle saving edge metadata
  const handleSaveMetadata = async (connectionId: string) => {
    setSavingMetadata(true)
    try {
      await updateEdgeMetadata(connectionId, editingMetadata)
      // Refresh connections to show updated metadata
      const updated = await getMyConnections()
      setConnections(updated)
      setEditingConnectionId(null)
      setEditingMetadata({})
    } catch (error) {
      console.error('Failed to save metadata:', error)
    } finally {
      setSavingMetadata(false)
    }
  }

  // Handle connecting to a canvas user
  const handleConnect = async (userId: string, trustLevel: TrustLevel = 'connected') => {
    setConnectingUserId(userId)
    try {
      await createConnection(userId, trustLevel)
      // Refresh connections
      const updated = await getMyConnections()
      setConnections(updated)
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setConnectingUserId(null)
    }
  }

  // Handle disconnecting from a user
  const handleDisconnect = async (connectionId: string, userId: string) => {
    setConnectingUserId(userId)
    try {
      await removeConnection(connectionId)
      // Refresh connections
      const updated = await getMyConnections()
      setConnections(updated)
    } catch (error) {
      console.error('Failed to disconnect:', error)
    } finally {
      setConnectingUserId(null)
    }
  }

  // Handle changing trust level
  const handleChangeTrust = async (connectionId: string, userId: string, newLevel: TrustLevel) => {
    setConnectingUserId(userId)
    try {
      await updateTrustLevel(connectionId, newLevel)
      // Refresh connections
      const updated = await getMyConnections()
      setConnections(updated)
    } catch (error) {
      console.error('Failed to update trust level:', error)
    } finally {
      setConnectingUserId(null)
    }
  }

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

  // Only show custom tools for authenticated users
  const isAuthenticated = session.authed

  return (
    <>
      <DefaultToolbar>
        <DefaultToolbarContent />
        {/* Custom tools - only shown when authenticated */}
        {isAuthenticated && (
          <>
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
            {/* MycroZine Generator temporarily disabled for debugging
            {tools["MycroZineGenerator"] && (
              <TldrawUiMenuItem
                {...tools["MycroZineGenerator"]}
                icon="zine"
                label="MycroZine Generator"
                isSelected={
                  tools["MycroZineGenerator"].id === editor.getCurrentToolId()
                }
              />
            )}
            */}
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
            {/* Holon - temporarily hidden until in better working state
            {tools["Holon"] && (
              <TldrawUiMenuItem
                {...tools["Holon"]}
                icon="globe"
                label="Holon"
                isSelected={tools["Holon"].id === editor.getCurrentToolId()}
              />
            )}
            */}
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
            {tools["BlenderGen"] && (
              <TldrawUiMenuItem
                {...tools["BlenderGen"]}
                icon="box"
                label="Blender 3D"
                isSelected={tools["BlenderGen"].id === editor.getCurrentToolId()}
              />
            )}
            {ENABLE_DRAWFAST && tools["Drawfast"] && (
              <TldrawUiMenuItem
                {...tools["Drawfast"]}
                icon="blob"
                label="Drawfast (AI Sketch)"
                isSelected={tools["Drawfast"].id === editor.getCurrentToolId()}
              />
            )}
            {/* Terminal (Multmux) - temporarily hidden until in better working state
            {tools["Multmux"] && (
              <TldrawUiMenuItem
                {...tools["Multmux"]}
                icon="terminal"
                label="Terminal"
                isSelected={tools["Multmux"].id === editor.getCurrentToolId()}
              />
            )}
            */}
            {tools["Map"] && (
              <TldrawUiMenuItem
                {...tools["Map"]}
                icon="geo-globe"
                label="Map"
                isSelected={tools["Map"].id === editor.getCurrentToolId()}
              />
            )}
            {ENABLE_CALENDAR && tools["calendar"] && (
              <TldrawUiMenuItem
                {...tools["calendar"]}
                icon="calendar"
                label="Calendar"
                isSelected={tools["calendar"].id === editor.getCurrentToolId()}
              />
            )}
            {/* Workflow Builder - Toggle Palette (dev only) */}
            {ENABLE_WORKFLOW && (
              <TldrawUiMenuItem
                id="workflow-palette"
                icon="sticker"
                label="Workflow Blocks"
                onSelect={() => setShowWorkflowPalette(!showWorkflowPalette)}
              />
            )}
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
          </>
        )}
      </DefaultToolbar>

      {/* Fathom Meetings Panel */}
      {showFathomPanel && (
        <FathomMeetingsPanel
          onClose={() => setShowFathomPanel(false)}
        />
      )}

      {/* Workflow Builder Palette (dev only) */}
      {ENABLE_WORKFLOW && (
        <WorkflowPalette
          editor={editor}
          isOpen={showWorkflowPalette}
          onClose={() => setShowWorkflowPalette(false)}
        />
      )}
    </>
  )
}
