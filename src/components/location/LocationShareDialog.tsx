import {
  TLUiDialogProps,
  TldrawUiDialogBody,
  TldrawUiDialogCloseButton,
  TldrawUiDialogHeader,
  TldrawUiDialogTitle,
} from "tldraw"
import React from "react"
import { ShareLocation } from "./ShareLocation"

export function LocationShareDialog({ onClose }: TLUiDialogProps) {
  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>Share Location</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody style={{ maxWidth: 800, maxHeight: "90vh", overflow: "auto" }}>
        <ShareLocation />
      </TldrawUiDialogBody>
    </>
  )
}






















