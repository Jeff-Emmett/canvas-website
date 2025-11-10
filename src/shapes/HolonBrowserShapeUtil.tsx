import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
} from "tldraw"
import React, { useState } from "react"
import { HolonBrowser } from "../components/HolonBrowser"
import { HolonData } from "../lib/HoloSphereService"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"

type IHolonBrowser = TLBaseShape<
  "HolonBrowser",
  {
    w: number
    h: number
  }
>

export class HolonBrowserShape extends BaseBoxShapeUtil<IHolonBrowser> {
  static override type = "HolonBrowser" as const

  getDefaultProps(): IHolonBrowser["props"] {
    return {
      w: 800,
      h: 600,
    }
  }

  // Holon theme color: Green (Rainbow)
  static readonly PRIMARY_COLOR = "#22c55e"

  component(shape: IHolonBrowser) {
    const { w, h } = shape.props
    const [isOpen, setIsOpen] = useState(true)
    const [isMinimized, setIsMinimized] = useState(false)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    const handleSelectHolon = (holonData: HolonData) => {
      // Store current camera position to prevent it from changing
      const currentCamera = this.editor.getCamera()
      this.editor.stopCameraAnimation()
      
      // Get the browser shape bounds to position the new Holon shape nearby
      const browserShapeBounds = this.editor.getShapePageBounds(shape.id)
      const shapeWidth = 700
      const shapeHeight = 400
      
      let xPosition: number
      let yPosition: number
      
      if (browserShapeBounds) {
        // Position to the right of the browser shape
        const spacing = 20
        xPosition = browserShapeBounds.x + browserShapeBounds.w + spacing
        yPosition = browserShapeBounds.y
      } else {
        // Fallback to viewport center if shape bounds not available
        const viewport = this.editor.getViewportPageBounds()
        const centerX = viewport.x + viewport.w / 2
        const centerY = viewport.y + viewport.h / 2
        xPosition = centerX - shapeWidth / 2
        yPosition = centerY - shapeHeight / 2
      }
      
      const holonShape = this.editor.createShape({
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
      
      console.log('✅ Created Holon shape from browser:', holonShape.id)
      
      // Restore camera position if it changed
      const newCamera = this.editor.getCamera()
      if (currentCamera.x !== newCamera.x || currentCamera.y !== newCamera.y || currentCamera.z !== newCamera.z) {
        this.editor.setCamera(currentCamera, { animation: { duration: 0 } })
      }
      
      // Select the new shape
      setTimeout(() => {
        // Preserve camera position when selecting
        const cameraBeforeSelect = this.editor.getCamera()
        this.editor.stopCameraAnimation()
        this.editor.setSelectedShapes([`shape:${holonShape.id}`] as any)
        // Restore camera if it changed during selection
        const cameraAfterSelect = this.editor.getCamera()
        if (cameraBeforeSelect.x !== cameraAfterSelect.x || cameraBeforeSelect.y !== cameraAfterSelect.y || cameraAfterSelect.z !== cameraAfterSelect.z) {
          this.editor.setCamera(cameraBeforeSelect, { animation: { duration: 0 } })
        }
      }, 100)
      
      // Close the browser shape
      setIsOpen(false)
      // Delete the browser shape after a short delay
      setTimeout(() => {
        this.editor.deleteShape(shape.id)
      }, 100)
    }

    const handleClose = () => {
      setIsOpen(false)
      // Delete the browser shape
      setTimeout(() => {
        this.editor.deleteShape(shape.id)
      }, 100)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    if (!isOpen) {
      return null
    }

    return (
      <HTMLContainer style={{ width: w, height: h }}>
        <StandardizedToolWrapper
          title="Holon Browser"
          primaryColor={HolonBrowserShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={w}
          height={h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          editor={this.editor}
          shapeId={shape.id}
        >
          <HolonBrowser
            isOpen={isOpen}
            onClose={handleClose}
            onSelectHolon={handleSelectHolon}
            shapeMode={true}
          />
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  indicator(shape: IHolonBrowser) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}











