import { useEditor } from 'tldraw'
import { usePrivateWorkspace } from '../hooks/usePrivateWorkspace'

/**
 * Component that manages the Private Workspace zone for Google Export data.
 * Listens for 'add-google-items-to-canvas' events and creates items in the workspace.
 *
 * Must be rendered inside a Tldraw context.
 */
export function PrivateWorkspaceManager() {
  const editor = useEditor()

  // This hook handles:
  // - Creating/showing the private workspace zone
  // - Listening for 'add-google-items-to-canvas' events
  // - Adding items to the workspace when triggered
  usePrivateWorkspace({ editor })

  // This component doesn't render anything visible
  // It just manages the workspace logic
  return null
}
