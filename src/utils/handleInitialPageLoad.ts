import { Editor } from "tldraw"

export const handleInitialPageLoad = (editor: Editor) => {
  if (!editor.store || !editor.getInstanceState().isFocused) {
    setTimeout(() => handleInitialPageLoad(editor), 100)
    return
  }

  editor.setCurrentTool("hand")
}
