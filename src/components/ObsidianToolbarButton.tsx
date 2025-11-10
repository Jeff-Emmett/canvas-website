import React from 'react'
import { Editor } from 'tldraw'

interface ObsidianToolbarButtonProps {
  editor: Editor
  className?: string
}

export const ObsidianToolbarButton: React.FC<ObsidianToolbarButtonProps> = ({
  editor: _editor,
  className = ''
}) => {
  const handleOpenBrowser = () => {
    // Dispatch event to open the centralized vault browser in CustomToolbar
    const event = new CustomEvent('open-obsidian-browser')
    window.dispatchEvent(event)
  }


  return (
    <button
      onClick={handleOpenBrowser}
      className={`obsidian-toolbar-button ${className}`}
      title="Import from Obsidian Vault"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M3 5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5Z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M8 8H16M8 12H16M8 16H12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="18" cy="6" r="2" fill="currentColor" />
      </svg>
      <span>Obsidian</span>
    </button>
  )
}

export default ObsidianToolbarButton
