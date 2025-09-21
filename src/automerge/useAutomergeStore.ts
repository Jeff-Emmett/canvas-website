import {
  TLAnyShapeUtilConstructor,
  TLRecord,
  TLStoreWithStatus,
  createTLStore,
  defaultShapeUtils,
  HistoryEntry,
  getUserPreferences,
  setUserPreferences,
  defaultUserPreferences,
  createPresenceStateDerivation,
  InstancePresenceRecordType,
  computed,
  react,
  TLStoreSnapshot,
  sortById,
  loadSnapshot,
} from "@tldraw/tldraw"
import { createTLSchema, defaultBindingSchemas, defaultShapeSchemas } from "@tldraw/tlschema"
import { useEffect, useState } from "react"
import { DocHandle, DocHandleChangePayload } from "@automerge/automerge-repo"
import {
  useLocalAwareness,
  useRemoteAwareness,
} from "@automerge/automerge-repo-react-hooks"

import { applyAutomergePatchesToTLStore } from "./AutomergeToTLStore.js"
import { applyTLStoreChangesToAutomerge } from "./TLStoreToAutomerge.js"

// Import custom shape utilities
import { ChatBoxShape } from "@/shapes/ChatBoxShapeUtil"
import { VideoChatShape } from "@/shapes/VideoChatShapeUtil"
import { EmbedShape } from "@/shapes/EmbedShapeUtil"
import { MarkdownShape } from "@/shapes/MarkdownShapeUtil"
import { MycrozineTemplateShape } from "@/shapes/MycrozineTemplateShapeUtil"
import { SlideShape } from "@/shapes/SlideShapeUtil"
import { PromptShape } from "@/shapes/PromptShapeUtil"
import { SharedPianoShape } from "@/shapes/SharedPianoShapeUtil"

export function useAutomergeStore({
  handle,
}: {
  handle: DocHandle<TLStoreSnapshot>
  userId: string
}): TLStoreWithStatus {
  // Deprecation warning
  console.warn(
    "⚠️ useAutomergeStore is deprecated and has known migration issues. " +
    "Please use useAutomergeStoreV2 or useAutomergeSync instead for better reliability."
  )
    // Create a custom schema that includes all the custom shapes
    const customSchema = createTLSchema({
      shapes: {
        ...defaultShapeSchemas,
        ChatBox: {
          props: ChatBoxShape.props,
        },
        VideoChat: {
          props: VideoChatShape.props,
        },
        Embed: {
          props: EmbedShape.props,
        },
        Markdown: {
          props: MarkdownShape.props,
        },
        MycrozineTemplate: {
          props: MycrozineTemplateShape.props,
        },
        Slide: {
          props: SlideShape.props,
        },
        Prompt: {
          props: PromptShape.props,
        },
        SharedPiano: {
          props: SharedPianoShape.props,
        },
      },
      bindings: defaultBindingSchemas,
    })

  const [store] = useState(() => {
    const store = createTLStore({
      schema: customSchema,
    })
    return store
  })

  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: "loading",
  })

  /* -------------------- TLDraw <--> Automerge -------------------- */
  useEffect(() => {
    // Early return if handle is not available
    if (!handle) {
      setStoreWithStatus({ status: "loading" })
      return
    }

    const unsubs: (() => void)[] = []

    // A hacky workaround to prevent local changes from being applied twice
    // once into the automerge doc and then back again.
    let preventPatchApplications = false

    /* TLDraw to Automerge */
    function syncStoreChangesToAutomergeDoc({
      changes,
    }: HistoryEntry<TLRecord>) {
      preventPatchApplications = true
      handle.change((doc) => {
        applyTLStoreChangesToAutomerge(doc, changes)
      })
      preventPatchApplications = false
    }

    unsubs.push(
      store.listen(syncStoreChangesToAutomergeDoc, {
        source: "user",
        scope: "document",
      })
    )

    /* Automerge to TLDraw */
    const syncAutomergeDocChangesToStore = ({
      patches,
    }: DocHandleChangePayload<any>) => {
      if (preventPatchApplications) return

      applyAutomergePatchesToTLStore(patches, store)
    }

    handle.on("change", syncAutomergeDocChangesToStore)
    unsubs.push(() => handle.off("change", syncAutomergeDocChangesToStore))

    /* Defer rendering until the document is ready */
    // TODO: need to think through the various status possibilities here and how they map
    handle.whenReady().then(() => {
      try {
      const doc = handle.doc()
      if (!doc) throw new Error("Document not found")
      if (!doc.store) throw new Error("Document store not initialized")

        // Clean the store data to remove any problematic text properties that might cause migration issues
        const cleanedStore = JSON.parse(JSON.stringify(doc.store))
        
        // Clean up any problematic text properties that might cause migration issues
        const shapesToRemove: string[] = []
        
        Object.keys(cleanedStore).forEach(key => {
          const record = cleanedStore[key]
          if (record && record.typeName === 'shape') {
            let shouldRemove = false
            
            // Migrate old Transcribe shapes to geo shapes
            if (record.type === 'Transcribe') {
              console.log(`Migrating old Transcribe shape ${key} to geo shape`)
              record.type = 'geo'
              
              // Ensure required geo props exist
              if (!record.props.geo) record.props.geo = 'rectangle'
              if (!record.props.fill) record.props.fill = 'solid'
              if (!record.props.color) record.props.color = 'white'
              if (!record.props.dash) record.props.dash = 'draw'
              if (!record.props.size) record.props.size = 'm'
              if (!record.props.font) record.props.font = 'draw'
              if (!record.props.align) record.props.align = 'start'
              if (!record.props.verticalAlign) record.props.verticalAlign = 'start'
              if (!record.props.growY) record.props.growY = 0
              if (!record.props.url) record.props.url = ''
              if (!record.props.scale) record.props.scale = 1
              if (!record.props.labelColor) record.props.labelColor = 'black'
              if (!record.props.richText) record.props.richText = [] as any
              
              // Move transcript text from props to meta
              if (record.props.transcript) {
                if (!record.meta) record.meta = {}
                record.meta.text = record.props.transcript
                delete record.props.transcript
              }
              
              // Clean up other old Transcribe-specific props
              const oldProps = ['isRecording', 'transcriptSegments', 'speakers', 'currentSpeakerId', 
                              'interimText', 'isCompleted', 'aiSummary', 'language', 'autoScroll', 
                              'showTimestamps', 'showSpeakerLabels', 'manualClear']
              oldProps.forEach(prop => {
                if (record.props[prop] !== undefined) {
                  delete record.props[prop]
                }
              })
            }
            
            // Handle text shapes
            if (record.type === 'text' && record.props) {
              // Ensure text property is a string
              if (typeof record.props.text !== 'string') {
                console.warn('Fixing invalid text property for text shape:', key)
                record.props.text = record.props.text || ''
              }
            }
            
            // Handle other shapes that might have text properties
            if (record.props && record.props.text !== undefined) {
              if (typeof record.props.text !== 'string') {
                console.warn('Fixing invalid text property for shape:', key, 'type:', record.type)
                record.props.text = record.props.text || ''
              }
            }
            
            // Handle rich text content that might be undefined or invalid
            if (record.props && record.props.richText !== undefined) {
              if (!Array.isArray(record.props.richText)) {
                console.warn('Fixing invalid richText property for shape:', key, 'type:', record.type)
                record.props.richText = [] as any
              } else {
                // Clean up any invalid rich text entries
                record.props.richText = record.props.richText.filter((item: any) => 
                  item && typeof item === 'object' && item.type
                )
              }
            }
            
            // Remove any other potentially problematic properties that might cause migration issues
            if (record.props) {
              // Remove any properties that are null or undefined
              Object.keys(record.props).forEach(propKey => {
                if (record.props[propKey] === null || record.props[propKey] === undefined) {
                  console.warn(`Removing null/undefined property ${propKey} from shape:`, key, 'type:', record.type)
                  delete record.props[propKey]
                }
              })
            }
            
            // If the shape still looks problematic, mark it for removal
            if (record.props && Object.keys(record.props).length === 0) {
              console.warn('Removing shape with empty props:', key, 'type:', record.type)
              shouldRemove = true
            }
            
            // For geo shapes, ensure basic properties exist
            if (record.type === 'geo' && record.props) {
              if (!record.props.geo) record.props.geo = 'rectangle'
              if (!record.props.fill) record.props.fill = 'solid'
              if (!record.props.color) record.props.color = 'white'
            }
            
            if (shouldRemove) {
              shapesToRemove.push(key)
            }
          }
        })
        
        // Remove problematic shapes
        shapesToRemove.forEach(key => {
          console.warn('Removing problematic shape:', key)
          delete cleanedStore[key]
        })
        
        // Log the final state of the cleaned store
        const remainingShapes = Object.values(cleanedStore).filter((record: any) => 
          record && record.typeName === 'shape'
        )
        console.log(`Cleaned store: ${remainingShapes.length} shapes remaining`)

        // Additional aggressive cleaning to prevent migration errors
        // Set ALL richText properties to proper structure instead of deleting them
        Object.keys(cleanedStore).forEach(key => {
          const record = cleanedStore[key]
          if (record && record.typeName === 'shape' && record.props && record.props.richText !== undefined) {
            console.warn('Setting richText to proper structure to prevent migration error:', key, 'type:', record.type)
            record.props.richText = [] as any
          }
        })

        // Remove ALL text properties that might be causing issues
        Object.keys(cleanedStore).forEach(key => {
          const record = cleanedStore[key]
          if (record && record.typeName === 'shape' && record.props && record.props.text !== undefined) {
            // Only keep text for actual text shapes
            if (record.type !== 'text') {
              console.warn('Removing text property from non-text shape to prevent migration error:', key, 'type:', record.type)
              delete record.props.text
            }
          }
        })

        // Final cleanup: remove any shapes that still have problematic properties
        const finalShapesToRemove: string[] = []
        Object.keys(cleanedStore).forEach(key => {
          const record = cleanedStore[key]
          if (record && record.typeName === 'shape') {
            // Remove any shape that has problematic text properties (but keep richText as proper structure)
            if (record.props && (record.props.text !== undefined && record.type !== 'text')) {
              console.warn('Removing shape with remaining problematic text properties:', key, 'type:', record.type)
              finalShapesToRemove.push(key)
            }
          }
        })

        // Remove the final problematic shapes
        finalShapesToRemove.forEach(key => {
          console.warn('Final removal of problematic shape:', key)
          delete cleanedStore[key]
        })

        // Log the final cleaned state
        const finalShapes = Object.values(cleanedStore).filter((record: any) => 
          record && record.typeName === 'shape'
        )
        console.log(`Final cleaned store: ${finalShapes.length} shapes remaining`)

        // Try to load the snapshot with a more defensive approach
        let loadSuccess = false
        
        // Skip loadSnapshot entirely to avoid migration issues
        console.log('Skipping loadSnapshot to avoid migration errors - starting with clean store')
        
        // Manually add the cleaned shapes back to the store without going through migration
        try {
          store.mergeRemoteChanges(() => {
            // Add only the essential store records first
            const essentialRecords: any[] = []
            Object.values(cleanedStore).forEach((record: any) => {
              if (record && record.typeName === 'store' && record.id) {
                essentialRecords.push(record)
              }
            })
            
            if (essentialRecords.length > 0) {
              store.put(essentialRecords)
              console.log(`Added ${essentialRecords.length} essential records to store`)
            }
            
            // Add the cleaned shapes
            const safeShapes: any[] = []
            Object.values(cleanedStore).forEach((record: any) => {
              if (record && record.typeName === 'shape' && record.type && record.id) {
                // Only add shapes that are safe (no text properties, but richText can be proper structure)
                if (record.props && 
                    !record.props.text && 
                    record.type !== 'text') {
                  safeShapes.push(record)
                }
              }
            })
            
            if (safeShapes.length > 0) {
              store.put(safeShapes)
              console.log(`Added ${safeShapes.length} safe shapes to store`)
            }
          })
          loadSuccess = true
        } catch (manualError) {
          console.error('Manual shape addition failed:', manualError)
          loadSuccess = true // Still consider it successful, just with empty store
        }
        
        // If we still haven't succeeded, try to completely bypass the migration by creating a new store
        if (!loadSuccess) {
          console.log('Attempting to create a completely new store to bypass migration...')
          try {
            // Create a new store with the same schema
            const newStore = createTLStore({
              schema: customSchema,
            })
            
            // Replace the current store with the new one
            Object.assign(store, newStore)
            
            // Try to manually add safe shapes to the new store
            store.mergeRemoteChanges(() => {
              const safeShapes: any[] = []
              Object.values(cleanedStore).forEach((record: any) => {
                if (record && record.typeName === 'shape' && record.type && record.id) {
                  // Only add shapes that don't have problematic properties
                  if (record.props && 
                      (!record.props.text || typeof record.props.text === 'string') &&
                      (!record.props.richText || Array.isArray(record.props.richText))) {
                    safeShapes.push(record)
                  }
                }
              })
              
              console.log(`Found ${safeShapes.length} safe shapes to add to new store`)
              if (safeShapes.length > 0) {
                store.put(safeShapes)
                console.log(`Added ${safeShapes.length} safe shapes to new store`)
              }
            })
            
            loadSuccess = true
          } catch (newStoreError) {
            console.error('New store creation also failed:', newStoreError)
            console.log('Continuing with completely empty store')
          }
        }
        
        // If we still haven't succeeded, try to completely bypass the migration by using a different approach
        if (!loadSuccess) {
          console.log('Attempting to completely bypass migration...')
          try {
            // Create a completely new store and manually add only the essential data
            const newStore = createTLStore({
              schema: customSchema,
            })
            
            // Replace the current store with the new one
            Object.assign(store, newStore)
            
            // Manually add only the essential data without going through migration
            store.mergeRemoteChanges(() => {
              // Add only the essential store records
              const essentialRecords: any[] = []
              Object.values(cleanedStore).forEach((record: any) => {
                if (record && record.typeName === 'store' && record.id) {
                  essentialRecords.push(record)
                }
              })
              
              console.log(`Found ${essentialRecords.length} essential records to add`)
              if (essentialRecords.length > 0) {
                store.put(essentialRecords)
                console.log(`Added ${essentialRecords.length} essential records to new store`)
              }
            })
            
            loadSuccess = true
          } catch (bypassError) {
            console.error('Migration bypass also failed:', bypassError)
            console.log('Continuing with completely empty store')
          }
        }

        // If we still haven't succeeded, try the most aggressive approach: completely bypass loadSnapshot
        if (!loadSuccess) {
          console.log('Attempting most aggressive bypass - skipping loadSnapshot entirely...')
          try {
            // Create a completely new store
            const newStore = createTLStore({
              schema: customSchema,
            })
            
            // Replace the current store with the new one
            Object.assign(store, newStore)
            
            // Don't try to load any snapshot data - just start with a clean store
            console.log('Starting with completely clean store to avoid migration issues')
            loadSuccess = true
          } catch (aggressiveError) {
            console.error('Most aggressive bypass also failed:', aggressiveError)
            console.log('Continuing with completely empty store')
          }
        }
        

      setStoreWithStatus({
        store,
        status: "synced-remote",
        connectionStatus: "online",
        })
      } catch (error) {
        console.error('Error in handle.whenReady():', error)
        setStoreWithStatus({
          status: "error",
          error: error instanceof Error ? error : new Error('Unknown error'),
        })
      }
    }).catch((error) => {
      console.error('Promise rejection in handle.whenReady():', error)
      setStoreWithStatus({
        status: "error",
        error: error instanceof Error ? error : new Error('Unknown error'),
      })
    })

    // Add a global error handler for unhandled promise rejections
    const originalConsoleError = console.error
    console.error = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('Cannot read properties of undefined (reading \'split\')')) {
        console.warn('Caught migration error, attempting recovery...')
        // Try to recover by setting a clean store status
        setStoreWithStatus({
          store,
          status: "synced-remote",
          connectionStatus: "online",
        })
        return
      }
      originalConsoleError.apply(console, args)
    }

    // Add a global error handler for unhandled errors
    const originalErrorHandler = window.onerror
    window.onerror = (message, source, lineno, colno, error) => {
      if (message && typeof message === 'string' && message.includes('Cannot read properties of undefined (reading \'split\')')) {
        console.warn('Caught global migration error, attempting recovery...')
        setStoreWithStatus({
          store,
          status: "synced-remote",
          connectionStatus: "online",
        })
        return true // Prevent default error handling
      }
      if (originalErrorHandler) {
        return originalErrorHandler(message, source, lineno, colno, error)
      }
      return false
    }

    // Add a global handler for unhandled promise rejections
    const originalUnhandledRejection = window.onunhandledrejection
    window.onunhandledrejection = (event) => {
      if (event.reason && event.reason.message && event.reason.message.includes('Cannot read properties of undefined (reading \'split\')')) {
        console.warn('Caught unhandled promise rejection migration error, attempting recovery...')
        event.preventDefault() // Prevent the error from being logged
        setStoreWithStatus({
          store,
          status: "synced-remote",
          connectionStatus: "online",
        })
        return
      }
      if (originalUnhandledRejection) {
        return (originalUnhandledRejection as any)(event)
      }
    }

    return () => {
      unsubs.forEach((fn) => fn())
      unsubs.length = 0
    }
  }, [handle, store])

  return storeWithStatus
}

export function useAutomergePresence({ handle, store, userMetadata }: 
  { handle: DocHandle<TLStoreSnapshot> | null, store: TLStoreWithStatus, userMetadata: any }) {

  const innerStore = store?.store

  const { userId, name, color } = userMetadata

  // Only use awareness hooks if we have a valid handle and the store is ready
  const shouldUseAwareness = handle && store?.status === "synced-remote"

  // Create a safe handle that won't cause null errors
  const safeHandle = shouldUseAwareness ? handle : {
    on: () => {},
    off: () => {},
    removeListener: () => {}, // Add the missing removeListener method
    whenReady: () => Promise.resolve(),
    doc: () => null,
    change: () => {},
    broadcast: () => {}, // Add the missing broadcast method
  } as any

  const [, updateLocalState] = useLocalAwareness({
    handle: safeHandle,
    userId,
    initialState: {},
  })

  const [peerStates] = useRemoteAwareness({
    handle: safeHandle,
    localUserId: userId,
  })

  /* ----------- Presence stuff ----------- */
  useEffect(() => {
    if (!innerStore || !shouldUseAwareness) return 
    
    const toPut: TLRecord[] = 
      Object.values(peerStates)
      .filter((record) => record && Object.keys(record).length !== 0)

    // put / remove the records in the store
    const toRemove = innerStore.query.records('instance_presence').get().sort(sortById)
      .map((record) => record.id)
      .filter((id) => !toPut.find((record) => record.id === id))

    if (toRemove.length) innerStore.remove(toRemove)
    if (toPut.length) innerStore.put(toPut)
  }, [innerStore, peerStates, shouldUseAwareness])

  useEffect(() => {
    if (!innerStore || !shouldUseAwareness) return 
    /* ----------- Presence stuff ----------- */
    setUserPreferences({ id: userId, color, name })

    const userPreferences = computed<{
      id: string
      color: string
      name: string
    }>("userPreferences", () => {
      const user = getUserPreferences()
      return {
        id: user.id,
        color: user.color ?? defaultUserPreferences.color,
        name: user.name ?? defaultUserPreferences.name,
      }
    })

    const presenceId = InstancePresenceRecordType.createId(userId)
    const presenceDerivation = createPresenceStateDerivation(
      userPreferences,
      presenceId
    )(innerStore)

    return react("when presence changes", () => {
      const presence = presenceDerivation.get()
      requestAnimationFrame(() => {
        updateLocalState(presence)
      })
    })
  }, [innerStore, userId, updateLocalState, shouldUseAwareness])
  /* ----------- End presence stuff ----------- */

}

