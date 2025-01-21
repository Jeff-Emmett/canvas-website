import { useCallback } from 'react'
import { useEditor } from 'tldraw'
import { makeRealSettings } from '../makeRealSettings'

export function useMakeReal() {
  const editor = useEditor()

  return useCallback(async () => {
    const settings = makeRealSettings.get()
    
    // Get the current selection from the canvas
    const shapes = editor.getSelectedShapes()
    
    try {
      // Make API request with the selected shapes
      const response = await fetch('/api/make-real', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shapes,
          apiKey: settings.apiKey,
          provider: settings.provider,
        }),
      })
      
      const result = await response.json()
      // Handle the result
      
    } catch (error) {
      console.error('Error making real:', error)
    }
  }, [editor])
} 