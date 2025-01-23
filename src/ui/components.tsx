import { CustomMainMenu } from "./CustomMainMenu"
import { CustomToolbar } from "./CustomToolbar"
import { CustomContextMenu } from "./CustomContextMenu"
import {
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  DefaultToolbar,
  DefaultToolbarContent,
  TLComponents,
  TldrawUiMenuItem,
  useDialogs,
  useIsToolSelected,
  useTools,
} from "tldraw"
import { SettingsDialog } from "./SettingsDialog"
import { useEffect } from "react"
import { SlidesPanel } from "@/slides/SlidesPanel"
import { useState } from "react"

export const components: TLComponents = {
  // Toolbar: CustomToolbar,
  MainMenu: CustomMainMenu,
  ContextMenu: CustomContextMenu,
  HelperButtons: SlidesPanel,
  Toolbar: (props: any) => {
    const tools = useTools()
    const slideTool = tools["Slide"]
    const isSlideSelected = slideTool ? useIsToolSelected(slideTool) : false
    const { addDialog, removeDialog } = useDialogs()
    const [hasApiKey, setHasApiKey] = useState(false)

    useEffect(() => {
      const key = localStorage.getItem("openai_api_key")
      setHasApiKey(!!key)
    }, [])

    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <div
          style={{
            position: "fixed",
            top: "40px",
            right: "12px",
            zIndex: 99999,
            pointerEvents: "auto",
            display: "flex",
            gap: "8px",
          }}
        >
          (
          <button
            onClick={() => {
              addDialog({
                id: "api-keys",
                component: ({ onClose }: { onClose: () => void }) => (
                  <SettingsDialog
                    onClose={() => {
                      onClose()
                      removeDialog("api-keys")
                      const settings = localStorage.getItem("jeff_keys")
                      if (settings) {
                        const { keys } = JSON.parse(settings)
                        setHasApiKey(Object.values(keys).some((key) => key))
                      }
                    }}
                  />
                ),
              })
            }}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              background: "#2F80ED",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontWeight: 500,
              transition: "background 0.2s ease",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1366D6"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#2F80ED"
            }}
          >
            Keys {hasApiKey ? "✅" : "❌"}
          </button>
          )
        </div>
        <DefaultToolbar {...props}>
          {slideTool && (
            <TldrawUiMenuItem {...slideTool} isSelected={isSlideSelected} />
          )}
          <DefaultToolbarContent />
        </DefaultToolbar>
      </div>
    )
  },
  KeyboardShortcutsDialog: (props: any) => {
    const tools = useTools()
    return (
      <DefaultKeyboardShortcutsDialog {...props}>
        <TldrawUiMenuItem {...tools["Slide"]} />
        <DefaultKeyboardShortcutsDialogContent />
      </DefaultKeyboardShortcutsDialog>
    )
  },
}
