import { CustomMainMenu } from "./CustomMainMenu"
import { CustomToolbar } from "./CustomToolbar"
import { CustomContextMenu } from "./CustomContextMenu"
import { FocusLockIndicator } from "./FocusLockIndicator"
import { MycelialIntelligenceBar } from "./MycelialIntelligenceBar"
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

  // Get current user info
  const myUserColor = useValue('myColor', () => editor.user.getColor(), [editor])
  const myUserName = useValue('myName', () => editor.user.getName() || 'You', [editor])

  // Get all collaborators (other users in the session)
  const collaborators = useValue('collaborators', () => editor.getCollaborators(), [editor])

  return (
    <div className="custom-people-menu">
      {/* Current user avatar */}
      <div
        title={`${myUserName} (you)`}
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: myUserColor,
          border: '2px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          cursor: 'default',
        }}
      />

      {/* Other users */}
      {collaborators.map((presence) => (
        <div
          key={presence.id}
          title={`${presence.userName || 'Anonymous'}`}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: presence.color,
            border: '2px solid white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            marginLeft: '-8px',
            cursor: 'default',
          }}
        />
      ))}

      {/* User count badge */}
      {collaborators.length > 0 && (
        <span style={{
          fontSize: '12px',
          color: 'var(--color-text-1)',
          marginLeft: '4px',
        }}>
          {collaborators.length + 1}
        </span>
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
