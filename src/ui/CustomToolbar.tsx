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
import { ObsNoteShape } from "../shapes/ObsNoteShapeUtil"
import { createShapeId } from "tldraw"
import type { ObsidianObsNote } from "../lib/obsidianImporter"

export function CustomToolbar() {
  const editor = useEditor()
  const tools = useTools()
  const [isReady, setIsReady] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const { addDialog, removeDialog } = useDialogs()

  const { session, setSession, clearSession } = useAuth()
  const [showProfilePopup, setShowProfilePopup] = useState(false)
  const [showVaultBrowser, setShowVaultBrowser] = useState(false)
  const [vaultBrowserMode, setVaultBrowserMode] = useState<'keyboard' | 'button'>('keyboard')
  const profilePopupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editor && tools) {
      setIsReady(true)
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

  // Keyboard shortcut for Alt+O to open Obsidian vault browser
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Alt+O (keyCode 79 for 'O')
      if (event.altKey && event.key === 'o') {
        event.preventDefault()
        
        // If vault browser is already open, close it
        if (showVaultBrowser) {
          console.log('🔧 Alt+O pressed, vault browser already open, closing it')
          setShowVaultBrowser(false)
          return
        }
        
        // Check if user already has a vault selected
        if (session.obsidianVaultPath && session.obsidianVaultPath !== 'folder-selected') {
          console.log('🔧 Alt+O pressed, vault already selected, opening search interface')
          setVaultBrowserMode('keyboard')
          setShowVaultBrowser(true)
        } else if (session.obsidianVaultPath === 'folder-selected' && session.obsidianVaultName) {
          console.log('🔧 Alt+O pressed, folder-selected vault exists, opening search interface')
          setVaultBrowserMode('keyboard')
          setShowVaultBrowser(true)
        } else {
          console.log('🔧 Alt+O pressed, no vault selected, opening vault selection')
          setVaultBrowserMode('keyboard')
          setShowVaultBrowser(true)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [session.obsidianVaultPath, session.obsidianVaultName, showVaultBrowser])

  // Listen for open-obsidian-browser event from toolbar button
  useEffect(() => {
    const handleOpenBrowser = () => {
      console.log('🔧 Received open-obsidian-browser event')
      
      // If vault browser is already open, close it
      if (showVaultBrowser) {
        console.log('🔧 Vault browser already open, closing it')
        setShowVaultBrowser(false)
        return
      }
      
      // Check if user already has a vault selected
      if (session.obsidianVaultPath && session.obsidianVaultPath !== 'folder-selected') {
        console.log('🔧 Vault already selected, opening search interface')
        setVaultBrowserMode('keyboard')
        setShowVaultBrowser(true)
      } else if (session.obsidianVaultPath === 'folder-selected' && session.obsidianVaultName) {
        console.log('🔧 Folder-selected vault exists, opening search interface')
        setVaultBrowserMode('keyboard')
        setShowVaultBrowser(true)
      } else {
        console.log('🔧 No vault selected, opening vault selection')
        setVaultBrowserMode('button')
        setShowVaultBrowser(true)
      }
    }

    window.addEventListener('open-obsidian-browser', handleOpenBrowser as EventListener)
    
    return () => {
      window.removeEventListener('open-obsidian-browser', handleOpenBrowser as EventListener)
    }
  }, [session.obsidianVaultPath, session.obsidianVaultName, showVaultBrowser])


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

  // Layout functions for Obsidian notes
  const findNonOverlappingPosition = (baseX: number, baseY: number, width: number = 300, height: number = 200, excludeShapeIds: string[] = []) => {
    const allShapes = editor.getCurrentPageShapes()
    // Check against all shapes, not just ObsNote shapes
    const existingShapes = allShapes.filter(s => !excludeShapeIds.includes(s.id))
    
    // Try positions in a spiral pattern with more positions
    const positions = [
      { x: baseX, y: baseY }, // Center
      { x: baseX + width + 20, y: baseY }, // Right
      { x: baseX - width - 20, y: baseY }, // Left
      { x: baseX, y: baseY - height - 20 }, // Above
      { x: baseX, y: baseY + height + 20 }, // Below
      { x: baseX + width + 20, y: baseY - height - 20 }, // Top-right
      { x: baseX - width - 20, y: baseY - height - 20 }, // Top-left
      { x: baseX + width + 20, y: baseY + height + 20 }, // Bottom-right
      { x: baseX - width - 20, y: baseY + height + 20 }, // Bottom-left
      // Additional positions for better coverage
      { x: baseX + (width + 20) * 2, y: baseY }, // Far right
      { x: baseX - (width + 20) * 2, y: baseY }, // Far left
      { x: baseX, y: baseY - (height + 20) * 2 }, // Far above
      { x: baseX, y: baseY + (height + 20) * 2 }, // Far below
    ]

    for (const pos of positions) {
      let hasOverlap = false
      
      for (const existingShape of existingShapes) {
        const shapeBounds = editor.getShapePageBounds(existingShape.id)
        if (shapeBounds) {
          // Add padding around shapes for better spacing
          const padding = 10
          const overlap = !(
            pos.x + width + padding < shapeBounds.x - padding ||
            pos.x - padding > shapeBounds.x + shapeBounds.w + padding ||
            pos.y + height + padding < shapeBounds.y - padding ||
            pos.y - padding > shapeBounds.y + shapeBounds.h + padding
          )
          
          if (overlap) {
            hasOverlap = true
            break
          }
        }
      }
      
      if (!hasOverlap) {
        return pos
      }
    }
    
    // If all positions overlap, use a more sophisticated grid-based approach
    const gridSize = Math.max(width, height) + 40 // Increased spacing
    const gridX = Math.floor(baseX / gridSize) * gridSize
    const gridY = Math.floor(baseY / gridSize) * gridSize
    
    // Try multiple grid positions
    for (let offsetX = 0; offsetX < 5; offsetX++) {
      for (let offsetY = 0; offsetY < 5; offsetY++) {
        const testX = gridX + offsetX * gridSize
        const testY = gridY + offsetY * gridSize
        
        let hasOverlap = false
        for (const existingShape of existingShapes) {
          const shapeBounds = editor.getShapePageBounds(existingShape.id)
          if (shapeBounds) {
            const padding = 10
            const overlap = !(
              testX + width + padding < shapeBounds.x - padding ||
              testX - padding > shapeBounds.x + shapeBounds.w + padding ||
              testY + height + padding < shapeBounds.y - padding ||
              testY - padding > shapeBounds.y + shapeBounds.h + padding
            )
            
            if (overlap) {
              hasOverlap = true
              break
            }
          }
        }
        
        if (!hasOverlap) {
          return { x: testX, y: testY }
        }
      }
    }
    
    // Fallback: place far to the right
    return { x: baseX + 500, y: baseY }
  }

  const handleObsNoteSelect = (obsNote: ObsidianObsNote) => {
    console.log('🎯 handleObsNoteSelect called with:', obsNote)
    
    // Get current camera position to place the obs_note
    const camera = editor.getCamera()
    const viewportCenter = editor.getViewportScreenCenter()
    
    // Ensure we have valid coordinates - use camera position as fallback
    const baseX = isNaN(viewportCenter.x) ? camera.x : viewportCenter.x
    const baseY = isNaN(viewportCenter.y) ? camera.y : viewportCenter.y
    
    console.log('🎯 Creating obs_note shape at base:', { baseX, baseY, viewportCenter, camera })
    
    // Find a non-overlapping position
    const position = findNonOverlappingPosition(baseX, baseY, 300, 200, [])
    
    // Get vault information from session
    const vaultPath = session.obsidianVaultPath
    const vaultName = session.obsidianVaultName
    
    // Create a new obs_note shape with vault information
    const obsNoteShape = ObsNoteShape.createFromObsidianObsNote(obsNote, position.x, position.y, createShapeId(), vaultPath, vaultName)
    
    console.log('🎯 Created obs_note shape:', obsNoteShape)
    console.log('🎯 Shape position:', position)
    console.log('🎯 Vault info:', { vaultPath, vaultName })
    
    // Add the shape to the canvas
    try {
      editor.createShapes([obsNoteShape])
      console.log('🎯 Successfully added shape to canvas')
      
      // Select the newly created shape so user can see it
      setTimeout(() => {
        editor.setSelectedShapes([obsNoteShape.id])
        console.log('🎯 Selected newly created shape:', obsNoteShape.id)
        
        // Center the camera on the new shape
        editor.zoomToFit()
        
        // Switch to hand tool after adding the shape
        editor.setCurrentTool('hand')
        console.log('🎯 Switched to hand tool after adding ObsNote')
      }, 100)
      
      // Check if shape was actually added
      const allShapes = editor.getCurrentPageShapes()
      const existingObsNoteShapes = allShapes.filter(s => s.type === 'ObsNote')
      console.log('🎯 Total ObsNote shapes on canvas:', existingObsNoteShapes.length)
    } catch (error) {
      console.error('🎯 Error adding shape to canvas:', error)
    }
    
    // Close the browser
    setShowVaultBrowser(false)
  }

  const handleObsNotesSelect = (obsNotes: ObsidianObsNote[]) => {
    console.log('🎯 handleObsNotesSelect called with:', obsNotes.length, 'notes')
    
    // Get current camera position to place the obs_notes
    const camera = editor.getCamera()
    const viewportCenter = editor.getViewportScreenCenter()
    
    // Ensure we have valid coordinates - use camera position as fallback
    const baseX = isNaN(viewportCenter.x) ? camera.x : viewportCenter.x
    const baseY = isNaN(viewportCenter.y) ? camera.y : viewportCenter.y
    
    console.log('🎯 Creating obs_note shapes at base:', { baseX, baseY, viewportCenter, camera })
    
    // Get vault information from session
    const vaultPath = session.obsidianVaultPath
    const vaultName = session.obsidianVaultName
    
    // Create obs_note shapes with improved collision avoidance
    const obsNoteShapes: any[] = []
    const createdShapeIds: string[] = []
    
    for (let index = 0; index < obsNotes.length; index++) {
      const obs_note = obsNotes[index]
      
      // Start with a grid-based position as a hint
      const gridCols = 3
      const gridWidth = 320
      const gridHeight = 220
      const hintX = baseX + (index % gridCols) * gridWidth
      const hintY = baseY + Math.floor(index / gridCols) * gridHeight
      
      // Find non-overlapping position for this specific note
      // Exclude already created shapes in this batch
      const position = findNonOverlappingPosition(hintX, hintY, 300, 200, createdShapeIds)
      
      const shape = ObsNoteShape.createFromObsidianObsNote(obs_note, position.x, position.y, createShapeId(), vaultPath, vaultName)
      obsNoteShapes.push(shape)
      createdShapeIds.push(shape.id)
    }
    
    console.log('🎯 Created obs_note shapes:', obsNoteShapes)
    console.log('🎯 Vault info:', { vaultPath, vaultName })
    
    // Add all shapes to the canvas
    try {
      editor.createShapes(obsNoteShapes)
      console.log('🎯 Successfully added shapes to canvas')
      
      // Select all newly created shapes so user can see them
      const newShapeIds = obsNoteShapes.map(shape => shape.id)
      setTimeout(() => {
        editor.setSelectedShapes(newShapeIds)
        console.log('🎯 Selected newly created shapes:', newShapeIds)
        
        // Center the camera on all new shapes
        editor.zoomToFit()
        
        // Switch to hand tool after adding the shapes
        editor.setCurrentTool('hand')
        console.log('🎯 Switched to hand tool after adding ObsNotes')
      }, 100)
      
      // Check if shapes were actually added
      const allShapes = editor.getCurrentPageShapes()
      const existingObsNoteShapes = allShapes.filter(s => s.type === 'ObsNote')
      console.log('🎯 Total ObsNote shapes on canvas:', existingObsNoteShapes.length)
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
              <span>{session.username}</span>
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
                  Hello, {session.username}!
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
                
                <a
                  href="/dashboard"
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
            label="Prompt"
            isSelected={tools["Prompt"].id === editor.getCurrentToolId()}
          />
        )}
        {tools["SharedPiano"] && (
          <TldrawUiMenuItem
            {...tools["SharedPiano"]}
            icon="music"
            label="Shared Piano"
            isSelected={tools["SharedPiano"].id === editor.getCurrentToolId()}
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
      
      {/* Obsidian Vault Browser */}
      {showVaultBrowser && (
        <ObsidianVaultBrowser
          onObsNoteSelect={handleObsNoteSelect}
          onObsNotesSelect={handleObsNotesSelect}
          onClose={() => setShowVaultBrowser(false)}
          autoOpenFolderPicker={vaultBrowserMode === 'button'}
          showVaultBrowser={showVaultBrowser}
        />
      )}
      
    </div>
  )
}
