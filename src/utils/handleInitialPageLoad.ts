import { Editor, TLEventMap, TLInstancePresence } from "tldraw"

export const handleInitialPageLoad = async (editor: Editor) => {
  // Wait for editor to be ready
  while (!editor.store || !editor.getInstanceState().isFocused) {
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }

  try {
    // Set initial tool
    editor.setCurrentTool("hand")

    // Force a re-render of the toolbar
    editor.emit("toolsChange" as keyof TLEventMap)
  } catch (error) {
    console.error("Error during initial page load:", error)
  }
}
