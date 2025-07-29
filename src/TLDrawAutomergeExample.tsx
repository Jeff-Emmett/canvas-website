import { type DocHandle } from "@automerge/automerge-repo"
import { type TLStoreSnapshot, Tldraw, track, useEditor } from "@tldraw/tldraw"
import "@tldraw/tldraw/tldraw.css"

import { useAutomergeStore } from "./useAutomergeStore"

interface TLDrawAutomergeExampleProps {
  handle: DocHandle<TLStoreSnapshot>
  userId: string
}

export function TLDrawAutomergeExample({
  handle,
  userId,
}: TLDrawAutomergeExampleProps) {
  const store = useAutomergeStore({ handle, userId })

  return (
    <div className="tldraw__editor">
      <Tldraw autoFocus store={store} />
    </div>
  )
}

const NameEditor = track(() => {
  const editor = useEditor()

  return (
    <div style={{ pointerEvents: "all", display: "flex" }}>
      <input
        type="color"
        value={editor.user.getUserPreferences().color}
        onChange={(e) => {
          editor.user.updateUserPreferences({
            color: e.currentTarget.value,
          })
        }}
      />
      <input
        value={editor.user.getUserPreferences().name}
        onChange={(e) => {
          editor.user.updateUserPreferences({
            name: e.currentTarget.value,
          })
        }}
      />
    </div>
  )
}) 