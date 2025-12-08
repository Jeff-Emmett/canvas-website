import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
} from "tldraw"
import React, { useState, useContext } from "react"
import { ObsidianVaultBrowser } from "../components/ObsidianVaultBrowser"
import { ObsidianObsNote } from "../lib/obsidianImporter"
import { ObsNoteShape } from "./ObsNoteShapeUtil"
import { createShapeId } from "tldraw"
import { findNonOverlappingPosition } from "@/utils/shapeCollisionUtils"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"
import { AuthContext } from "../context/AuthContext"
import { usePinnedToView } from "../hooks/usePinnedToView"
import { useMaximize } from "../hooks/useMaximize"

type IObsidianBrowser = TLBaseShape<
  "ObsidianBrowser",
  {
    w: number
    h: number
    pinnedToView: boolean
    tags: string[]
  }
>

export class ObsidianBrowserShape extends BaseBoxShapeUtil<IObsidianBrowser> {
  static override type = "ObsidianBrowser" as const

  getDefaultProps(): IObsidianBrowser["props"] {
    return {
      w: 800,
      h: 600,
      pinnedToView: false,
      tags: ['obsidian', 'browser'],
    }
  }

  // Obsidian theme color: Darker Pink/Purple
  static readonly PRIMARY_COLOR = "#9333ea"

  component(shape: IObsidianBrowser) {
    const { w, h } = shape.props
    const [isOpen, setIsOpen] = useState(true)
    const [isMinimized, setIsMinimized] = useState(false)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    // Use the pinning hook to keep the shape fixed to viewport when pinned
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    // Use the maximize hook for fullscreen functionality
    const { isMaximized, toggleMaximize } = useMaximize({
      editor: this.editor,
      shapeId: shape.id,
      currentW: w,
      currentH: h,
      shapeType: 'ObsidianBrowser',
    })

    // Wrapper component to access auth context
    const ObsidianBrowserContent: React.FC<{ vaultName?: string }> = ({ vaultName }) => {

    const handleObsNoteSelect = (obsNote: ObsidianObsNote) => {
      // Position notes in a 3xn grid (3 columns, unlimited rows), incrementally
      const shapeWidth = 300
      const shapeHeight = 200
      const noteSpacing = 20
      const notesPerRow = 3
      
      // Get the ObsidianBrowser shape bounds for reference
      const browserShapeBounds = this.editor.getShapePageBounds(shape.id)
      let startX: number
      let startY: number
      
      if (!browserShapeBounds) {
        // Fallback to viewport center if shape bounds not available
        const viewport = this.editor.getViewportPageBounds()
        startX = viewport.x + viewport.w / 2
        startY = viewport.y + viewport.h / 2
      } else {
        // Position to the right of the browser shape, aligned with the TOP
        const browserSpacing = 5
        startX = browserShapeBounds.x + browserShapeBounds.w + browserSpacing
        startY = browserShapeBounds.y // TOP of browser vault - this is the key!
      }
      
      // Find existing ObsNote shapes that belong to THIS specific browser instance
      // Only count notes that are positioned immediately to the right of this browser
      const allShapes = this.editor.getCurrentPageShapes()
      let nextIndex: number
      
      if (browserShapeBounds) {
        const browserSpacing = 5
        const expectedStartX = browserShapeBounds.x + browserShapeBounds.w + browserSpacing
        const maxGridWidth = 3 * (shapeWidth + noteSpacing) // Width of 3 columns
        const maxGridHeight = 10 * (shapeHeight + noteSpacing) // Height for many rows (n)
        
        const existingObsNotes = allShapes.filter(s => {
          if (s.type !== 'ObsNote') return false
          const noteBounds = this.editor.getShapePageBounds(s.id)
          if (!noteBounds) return false
          
          // Check if note is positioned immediately to the right of THIS browser
          // X should be in the grid area to the right of this browser
          const isInXRange = noteBounds.x >= expectedStartX - 50 && 
                            noteBounds.x <= expectedStartX + maxGridWidth + 50
          
          // Y should be aligned with the top of this browser (within grid area)
          const isInYRange = noteBounds.y >= browserShapeBounds.y - 50 && 
                            noteBounds.y <= browserShapeBounds.y + maxGridHeight + 50
          
          return isInXRange && isInYRange
        })
        
        // Calculate next position in 3xn grid starting from TOP
        nextIndex = existingObsNotes.length
      } else {
        // Fallback: count all notes if browser bounds not available
        const existingObsNotes = allShapes.filter(s => s.type === 'ObsNote')
        nextIndex = existingObsNotes.length
      }
      
      const row = Math.floor(nextIndex / notesPerRow)
      const col = nextIndex % notesPerRow
      const xPosition = startX + col * (shapeWidth + noteSpacing)
      const yPosition = startY + row * (shapeHeight + noteSpacing) // Row 0 = TOP alignment

      // Vault info will be handled by ObsidianVaultBrowser component which has access to session
      // For now, pass undefined and let ObsNoteShape handle it
      const vaultPath = undefined
      const vaultName = undefined

      // Create a new obs_note shape with vault information
      const obsNoteShape = ObsNoteShape.createFromObsidianObsNote(
        obsNote,
        xPosition,
        yPosition,
        createShapeId(),
        vaultPath,
        vaultName
      )

      // Add the shape to the canvas
      try {
        // Store current camera position to prevent it from changing
        const currentCamera = this.editor.getCamera()
        this.editor.stopCameraAnimation()
        
        this.editor.createShapes([obsNoteShape])
        
        // Restore camera position if it changed
        const newCamera = this.editor.getCamera()
        if (currentCamera.x !== newCamera.x || currentCamera.y !== newCamera.y || currentCamera.z !== newCamera.z) {
          this.editor.setCamera(currentCamera, { animation: { duration: 0 } })
        }
        
        // Select the newly created shape
        setTimeout(() => {
          // Preserve camera position when selecting
          const cameraBeforeSelect = this.editor.getCamera()
          this.editor.stopCameraAnimation()
          this.editor.setSelectedShapes([obsNoteShape.id] as any)
          this.editor.setCurrentTool('select')
          // Restore camera if it changed during selection
          const cameraAfterSelect = this.editor.getCamera()
          if (cameraBeforeSelect.x !== cameraAfterSelect.x || cameraBeforeSelect.y !== cameraAfterSelect.y || cameraBeforeSelect.z !== cameraAfterSelect.z) {
            this.editor.setCamera(cameraBeforeSelect, { animation: { duration: 0 } })
          }
        }, 100)
      } catch (error) {
        console.error('🎯 Error adding shape to canvas:', error)
      }
    }

    const handleObsNotesSelect = (obsNotes: ObsidianObsNote[]) => {
      // Vault info will be handled by ObsidianVaultBrowser component which has access to session
      // For now, pass undefined and let ObsNoteShape handle it
      const vaultPath = undefined
      const vaultName = undefined

      // Position notes in a 3xn grid (3 columns, unlimited rows), incrementally
      const noteSpacing = 20
      const shapeWidth = 300
      const shapeHeight = 200
      const notesPerRow = 3
      
      // Get the ObsidianBrowser shape bounds for reference
      const browserShapeBounds = this.editor.getShapePageBounds(shape.id)
      let startX: number
      let startY: number
      
      if (!browserShapeBounds) {
        // Fallback to viewport center if shape bounds not available
        const viewport = this.editor.getViewportPageBounds()
        startX = viewport.x + viewport.w / 2
        startY = viewport.y + viewport.h / 2
      } else {
        // Position to the right of the browser shape, aligned with the TOP
        const browserSpacing = 5
        startX = browserShapeBounds.x + browserShapeBounds.w + browserSpacing
        startY = browserShapeBounds.y // TOP of browser vault - this is the key!
      }
      
      // Find existing ObsNote shapes that belong to THIS specific browser instance
      // Only count notes that are positioned immediately to the right of this browser
      const allShapes = this.editor.getCurrentPageShapes()
      let startIndex: number
      
      if (browserShapeBounds) {
        const browserSpacing = 5
        const expectedStartX = browserShapeBounds.x + browserShapeBounds.w + browserSpacing
        const maxGridWidth = 3 * (shapeWidth + noteSpacing) // Width of 3 columns
        const maxGridHeight = 10 * (shapeHeight + noteSpacing) // Height for many rows (n)
        
        const existingObsNotes = allShapes.filter(s => {
          if (s.type !== 'ObsNote') return false
          const noteBounds = this.editor.getShapePageBounds(s.id)
          if (!noteBounds) return false
          
          // Check if note is positioned immediately to the right of THIS browser
          // X should be in the grid area to the right of this browser
          const isInXRange = noteBounds.x >= expectedStartX - 50 && 
                            noteBounds.x <= expectedStartX + maxGridWidth + 50
          
          // Y should be aligned with the top of this browser (within grid area)
          const isInYRange = noteBounds.y >= browserShapeBounds.y - 50 && 
                            noteBounds.y <= browserShapeBounds.y + maxGridHeight + 50
          
          return isInXRange && isInYRange
        })
        startIndex = existingObsNotes.length
      } else {
        // Fallback: count all notes if browser bounds not available
        const existingObsNotes = allShapes.filter(s => s.type === 'ObsNote')
        startIndex = existingObsNotes.length
      }
      
      const shapes = obsNotes.map((obsNote, index) => {
        // Calculate position in 3xn grid, continuing from existing notes, starting from TOP
        const gridIndex = startIndex + index
        const row = Math.floor(gridIndex / notesPerRow)
        const col = gridIndex % notesPerRow
        const xPosition = startX + col * (shapeWidth + noteSpacing)
        const yPosition = startY + row * (shapeHeight + noteSpacing) // Row 0 = TOP alignment
        
        const shapeId = createShapeId()

        return ObsNoteShape.createFromObsidianObsNote(
          obsNote,
          xPosition,
          yPosition,
          shapeId,
          vaultPath,
          vaultName
        )
      })

      // Add all shapes to the canvas
      try {
        // Store current camera position to prevent it from changing
        const currentCamera = this.editor.getCamera()
        this.editor.stopCameraAnimation()
        
        this.editor.createShapes(shapes)
        
        // Restore camera position if it changed
        const newCamera = this.editor.getCamera()
        if (currentCamera.x !== newCamera.x || currentCamera.y !== newCamera.y || currentCamera.z !== newCamera.z) {
          this.editor.setCamera(currentCamera, { animation: { duration: 0 } })
        }
        
        // Select the newly created shapes
        setTimeout(() => {
          // Preserve camera position when selecting
          const cameraBeforeSelect = this.editor.getCamera()
          this.editor.stopCameraAnimation()
          this.editor.setSelectedShapes(shapes.map(s => s.id) as any)
          this.editor.setCurrentTool('select')
          // Restore camera if it changed during selection
          const cameraAfterSelect = this.editor.getCamera()
          if (cameraBeforeSelect.x !== cameraAfterSelect.x || cameraBeforeSelect.y !== cameraAfterSelect.y || cameraBeforeSelect.z !== cameraAfterSelect.z) {
            this.editor.setCamera(cameraBeforeSelect, { animation: { duration: 0 } })
          }
        }, 100)
      } catch (error) {
        console.error('🎯 Error adding shapes to canvas:', error)
      }
    }

    const handleClose = () => {
      setIsOpen(false)
      // Delete the browser shape immediately so it's tracked in undo/redo history
      this.editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<IObsidianBrowser>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

      // Custom header content with vault information
      const headerContent = (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <span>
            📚 Obsidian Browser
            {vaultName && (
              <span style={{ 
                marginLeft: '8px', 
                fontSize: '11px', 
                fontWeight: 400,
                color: isSelected ? 'rgba(255,255,255,0.8)' : `${ObsidianBrowserShape.PRIMARY_COLOR}80`
              }}>
                ({vaultName})
              </span>
            )}
            {!vaultName && (
              <span style={{ 
                marginLeft: '8px', 
                fontSize: '11px', 
                fontWeight: 400,
                color: isSelected ? 'rgba(255,255,255,0.7)' : `${ObsidianBrowserShape.PRIMARY_COLOR}60`
              }}>
                (No vault connected)
              </span>
            )}
          </span>
        </div>
      )

      if (!isOpen) {
        return null
      }

      return (
        <HTMLContainer style={{ width: w, height: h }}>
          <StandardizedToolWrapper
            title="Obsidian Browser"
            primaryColor={ObsidianBrowserShape.PRIMARY_COLOR}
            isSelected={isSelected}
            width={w}
            height={h}
            onClose={handleClose}
            onMinimize={handleMinimize}
            isMinimized={isMinimized}
            onMaximize={toggleMaximize}
            isMaximized={isMaximized}
            editor={this.editor}
            shapeId={shape.id}
            headerContent={headerContent}
            isPinnedToView={shape.props.pinnedToView}
            onPinToggle={handlePinToggle}
            tags={shape.props.tags}
            onTagsChange={(newTags) => {
              this.editor.updateShape<IObsidianBrowser>({
                id: shape.id,
                type: 'ObsidianBrowser',
                props: {
                  ...shape.props,
                  tags: newTags,
                }
              })
            }}
            tagsEditable={true}
          >
            <ObsidianVaultBrowser
              key={`obsidian-browser-${shape.id}`}
              onObsNoteSelect={handleObsNoteSelect}
              onObsNotesSelect={handleObsNotesSelect}
              onClose={handleClose}
              shapeMode={true}
              autoOpenFolderPicker={false}
              showVaultBrowser={true}
            />
          </StandardizedToolWrapper>
        </HTMLContainer>
      )
    }

    // Get vault information from auth context using a wrapper component
    const ObsidianBrowserWithContext: React.FC = () => {
      const authContext = useContext(AuthContext)
      const fallbackSession = {
        username: '',
        authed: false,
        loading: false,
        backupCreated: null,
        obsidianVaultPath: undefined,
        obsidianVaultName: undefined
      }
      const session = authContext?.session || fallbackSession
      const vaultName = session.obsidianVaultName
      
      return <ObsidianBrowserContent vaultName={vaultName} />
    }

    return <ObsidianBrowserWithContext />
  }

  indicator(shape: IObsidianBrowser) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}

