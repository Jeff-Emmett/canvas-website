import React from "react"
import { CustomMainMenu } from "./CustomMainMenu"
import { CustomToolbar } from "./CustomToolbar"
import { CustomContextMenu } from "./CustomContextMenu"
import { FocusLockIndicator } from "./FocusLockIndicator"
import { MycelialIntelligenceBar } from "./MycelialIntelligenceBar"
import { CommandPalette } from "./CommandPalette"
import {
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  TLComponents,
  TldrawUiMenuItem,
  useTools,
  useActions,
  useEditor,
  useValue,
} from "tldraw"
import { SlidesPanel } from "@/slides/SlidesPanel"

// Custom People Menu component for showing connected users
function CustomPeopleMenu() {
  const editor = useEditor()
  const [showDropdown, setShowDropdown] = React.useState(false)

  // Get current user info
  const myUserColor = useValue('myColor', () => editor.user.getColor(), [editor])
  const myUserName = useValue('myName', () => editor.user.getName() || 'You', [editor])

  // Get all collaborators (other users in the session)
  const collaborators = useValue('collaborators', () => editor.getCollaborators(), [editor])

  const totalUsers = collaborators.length + 1

  return (
    <div className="custom-people-menu" style={{ position: 'relative' }}>
      {/* Clickable avatar stack */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
        title="Click to see participants"
      >
        {/* Current user avatar */}
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: myUserColor,
            border: '2px solid white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 600,
            color: 'white',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          {myUserName.charAt(0).toUpperCase()}
        </div>

        {/* Other users (stacked) */}
        {collaborators.slice(0, 3).map((presence, index) => (
          <div
            key={presence.id}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: presence.color,
              border: '2px solid white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              marginLeft: '-10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 600,
              color: 'white',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            {(presence.userName || 'A').charAt(0).toUpperCase()}
          </div>
        ))}

        {/* User count badge if more than shown */}
        {totalUsers > 1 && (
          <span style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-1)',
            marginLeft: '6px',
          }}>
            {totalUsers}
          </span>
        )}
      </button>

      {/* Dropdown with user names */}
      {showDropdown && (
        <div
          className="people-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: '180px',
            background: 'var(--bg-color, #fff)',
            border: '1px solid var(--border-color, #e1e4e8)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 100000,
            padding: '8px 0',
          }}
        >
          <div style={{
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--tool-text)',
            opacity: 0.7,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Participants ({totalUsers})
          </div>

          {/* Current user */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 12px',
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: myUserColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 600,
              color: 'white',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}>
              {myUserName.charAt(0).toUpperCase()}
            </div>
            <span style={{
              fontSize: '13px',
              color: 'var(--text-color)',
              fontWeight: 500,
            }}>
              {myUserName} (you)
            </span>
          </div>

          {/* Other users */}
          {collaborators.map((presence) => (
            <div
              key={presence.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: presence.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 600,
                color: 'white',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}>
                {(presence.userName || 'A').charAt(0).toUpperCase()}
              </div>
              <span style={{
                fontSize: '13px',
                color: 'var(--text-color)',
              }}>
                {presence.userName || 'Anonymous'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Click outside to close */}
      {showDropdown && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
          }}
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  )
}

// Custom SharePanel that shows the people menu
function CustomSharePanel() {
  return (
    <div className="tlui-share-zone" draggable={false}>
      <CustomPeopleMenu />
    </div>
  )
}

// Combined InFrontOfCanvas component for floating UI elements
function CustomInFrontOfCanvas() {
  return (
    <>
      <MycelialIntelligenceBar />
      <FocusLockIndicator />
      <CommandPalette />
    </>
  )
}

export const components: TLComponents = {
  Toolbar: CustomToolbar,
  MainMenu: CustomMainMenu,
  ContextMenu: CustomContextMenu,
  HelperButtons: SlidesPanel,
  SharePanel: CustomSharePanel,
  InFrontOfTheCanvas: CustomInFrontOfCanvas,
  KeyboardShortcutsDialog: (props: any) => {
    const tools = useTools()
    const actions = useActions()
    
    // Get all custom tools with keyboard shortcuts
    const customTools = [
      tools["VideoChat"],
      tools["ChatBox"],
      tools["Embed"],
      tools["Slide"],
      tools["Markdown"],
      tools["MycrozineTemplate"],
      tools["Prompt"],
      tools["ObsidianNote"],
      tools["Transcription"],
      tools["Holon"],
      tools["FathomMeetings"],
      tools["ImageGen"],
      tools["VideoGen"],
      tools["Multmux"],
      // MycelialIntelligence moved to permanent floating bar
    ].filter(tool => tool && tool.kbd)
    
    // Get all custom actions with keyboard shortcuts
    const customActions = [
      actions["zoom-in"],
      actions["zoom-out"],
      actions["zoom-to-selection"],
      actions["copy-link-to-current-view"],
      actions["copy-focus-link"],
      actions["unlock-camera-focus"],
      actions["revert-camera"],
      actions["lock-element"],
      actions["save-to-pdf"],
      actions["search-shapes"],
      actions["llm"],
      actions["open-obsidian-browser"],
    ].filter(action => action && action.kbd)
    
    return (
      <DefaultKeyboardShortcutsDialog {...props}>
        {/* Custom Tools */}
        {customTools.map(tool => (
          <TldrawUiMenuItem 
            key={tool.id} 
            id={tool.id}
            label={tool.label}
            icon={typeof tool.icon === 'string' ? tool.icon : undefined}
            kbd={tool.kbd}
            onSelect={tool.onSelect}
          />
        ))}
        
        {/* Custom Actions */}
        {customActions.map(action => (
          <TldrawUiMenuItem 
            key={action.id} 
            id={action.id}
            label={action.label}
            icon={typeof action.icon === 'string' ? action.icon : undefined}
            kbd={action.kbd}
            onSelect={action.onSelect}
          />
        ))}
        
        {/* Default content (includes standard TLDraw shortcuts) */}
        <DefaultKeyboardShortcutsDialogContent />
      </DefaultKeyboardShortcutsDialog>
    )
  },
}
