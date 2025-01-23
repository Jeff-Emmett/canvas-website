import {
  TLUiDialogProps,
  TldrawUiButton,
  TldrawUiButtonLabel,
  TldrawUiDialogBody,
  TldrawUiDialogCloseButton,
  TldrawUiDialogFooter,
  TldrawUiDialogHeader,
  TldrawUiDialogTitle,
  TldrawUiInput,
} from "tldraw"
import React from "react"

export function SettingsDialog({ onClose }: TLUiDialogProps) {
  const [apiKey, setApiKey] = React.useState(() => {
    return localStorage.getItem("openai_api_key") || ""
  })

  const handleChange = (value: string) => {
    setApiKey(value)
    localStorage.setItem("openai_api_key", value)
  }

  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>API Keys</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody style={{ maxWidth: 350 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label>OpenAI API Key</label>
          <TldrawUiInput
            value={apiKey}
            placeholder="Enter your OpenAI API key"
            onValueChange={handleChange}
          />
        </div>
      </TldrawUiDialogBody>
      <TldrawUiDialogFooter>
        <TldrawUiButton type="primary" onClick={onClose}>
          <TldrawUiButtonLabel>Close</TldrawUiButtonLabel>
        </TldrawUiButton>
      </TldrawUiDialogFooter>
    </>
  )
}
