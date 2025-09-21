import { TLStoreSnapshot } from "@tldraw/tldraw"
import { DEFAULT_STORE } from "./default_store"

/* a similar pattern to other automerge init functions */
export function init(doc: TLStoreSnapshot) {
  Object.assign(doc, DEFAULT_STORE)
}

// Export the new V2 approach as the default
export * from "./useAutomergeStoreV2"
export * from "./useAutomergeSync"

// Keep the old store for backward compatibility (deprecated)
// export * from "./useAutomergeStore"
