import { TLStoreSnapshot } from "@tldraw/tldraw"
import { DEFAULT_STORE } from "./default_store"

/* a similar pattern to other automerge init functions */
export function init(doc: TLStoreSnapshot) {
  Object.assign(doc, DEFAULT_STORE)
}

// Export the V2 implementation
export * from "./useAutomergeStoreV2"
export * from "./useAutomergeSync"
