/// <reference types="@cloudflare/workers-types" />

import { AutoRouter, IRequest, error } from "itty-router"
import throttle from "lodash.throttle"
import { Environment } from "./types"

// each whiteboard room is hosted in a DurableObject:
// https://developers.cloudflare.com/durable-objects/

// there's only ever one durable object instance per room. it keeps all the room state in memory and
// handles websocket connections. periodically, it persists the room state to the R2 bucket.
export class AutomergeDurableObject {
  private r2: R2Bucket
  // the room ID will be missing whilst the room is being initialized
  private roomId: string | null = null
  // when we load the room from the R2 bucket, we keep it here. it's a promise so we only ever
  // load it once.
  private roomPromise: Promise<any> | null = null
  // Store the current Automerge document state
  private currentDoc: any = null
  // Track connected WebSocket clients
  private clients: Map<string, WebSocket> = new Map()
  // Track last persisted state to detect changes
  private lastPersistedHash: string | null = null

  constructor(private readonly ctx: DurableObjectState, env: Environment) {
    this.r2 = env.TLDRAW_BUCKET

    ctx.blockConcurrencyWhile(async () => {
      this.roomId = ((await this.ctx.storage.get("roomId")) ?? null) as
        | string
        | null
    })
  }

  private readonly router = AutoRouter({
    catch: (e) => {
      console.log(e)
      return error(e)
    },
  })
    // when we get a connection request, we stash the room id if needed and handle the connection
    .get("/connect/:roomId", async (request) => {
      if (!this.roomId) {
        await this.ctx.blockConcurrencyWhile(async () => {
          await this.ctx.storage.put("roomId", request.params.roomId)
          this.roomId = request.params.roomId
        })
      }
      return this.handleConnect(request)
    })
    .get("/room/:roomId", async (request) => {
      // Initialize roomId if not already set
      if (!this.roomId) {
        await this.ctx.blockConcurrencyWhile(async () => {
          await this.ctx.storage.put("roomId", request.params.roomId)
          this.roomId = request.params.roomId
        })
      }
      
      const doc = await this.getDocument()
      return new Response(JSON.stringify(doc), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      })
    })
    .post("/room/:roomId", async (request) => {
      // Initialize roomId if not already set
      if (!this.roomId) {
        await this.ctx.blockConcurrencyWhile(async () => {
          await this.ctx.storage.put("roomId", request.params.roomId)
          this.roomId = request.params.roomId
        })
      }
      
      const doc = (await request.json()) as any
      await this.updateDocument(doc)

      return new Response(JSON.stringify(doc), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      })
    })

  // `fetch` is the entry point for all requests to the Durable Object
  fetch(request: Request): Response | Promise<Response> {
    try {
      return this.router.fetch(request)
    } catch (err) {
      console.error("Error in DO fetch:", err)
      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          message: (err as Error).message,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS, UPGRADE",
            "Access-Control-Allow-Headers":
              "Content-Type, Authorization, Upgrade, Connection",
            "Access-Control-Max-Age": "86400",
            "Access-Control-Allow-Credentials": "true",
          },
        },
      )
    }
  }

  // what happens when someone tries to connect to this room?
  async handleConnect(request: IRequest): Promise<Response> {
    if (!this.roomId) {
      return new Response("Room not initialized", { status: 400 })
    }

    const sessionId = request.query.sessionId as string
    if (!sessionId) {
      return new Response("Missing sessionId", { status: 400 })
    }

    // Check if this is a WebSocket upgrade request
    const upgradeHeader = request.headers.get("Upgrade")
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 })
    }

    const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair()

    try {
      console.log(`Accepting WebSocket connection for session: ${sessionId}`)
      serverWebSocket.accept()
      
      // Store the client connection
      this.clients.set(sessionId, serverWebSocket)
      console.log(`Stored client connection for session: ${sessionId}`)

      // Set up message handling
      serverWebSocket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log(`Received message from ${sessionId}:`, message)
          this.handleMessage(sessionId, message)
        } catch (error) {
          console.error("Error parsing WebSocket message:", error)
        }
      })

      // Handle disconnection
      serverWebSocket.addEventListener("close", () => {
        console.log(`Client disconnected: ${sessionId}`)
        this.clients.delete(sessionId)
      })

      // Send current document state to the new client using Automerge sync protocol
      console.log(`Sending document to client: ${sessionId}`)
      const doc = await this.getDocument()
      console.log(`Document loaded, sending to client:`, { hasStore: !!doc.store, storeKeys: doc.store ? Object.keys(doc.store).length : 0 })
      // Send the document using Automerge's sync protocol
      serverWebSocket.send(JSON.stringify({
        type: "sync",
        senderId: "server",
        targetId: sessionId,
        documentId: "default",
        data: doc
      }))
      console.log(`Document sent to client: ${sessionId}`)

      return new Response(null, {
        status: 101,
        webSocket: clientWebSocket,
        headers: {
          "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS, UPGRADE",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Credentials": "true",
          Upgrade: "websocket",
          Connection: "Upgrade",
        },
      })
    } catch (error) {
      console.error("WebSocket connection error:", error)
      if (error instanceof Error) {
        console.error("Error stack:", error.stack)
        console.error("Error details:", {
          message: error.message,
          name: error.name
        })
      }
      serverWebSocket.close(1011, "Failed to initialize connection")
      return new Response("Failed to establish WebSocket connection", {
        status: 500,
      })
    }
  }

  private async handleMessage(sessionId: string, message: any) {
    console.log(`Handling message from ${sessionId}:`, message.type)
    
    switch (message.type) {
      case "sync":
        // Handle Automerge sync message
        if (message.data && message.documentId) {
          // This is a sync message with binary data
          await this.handleSyncMessage(sessionId, message)
        } else {
          // This is a sync request - send current document state
          const doc = await this.getDocument()
          const client = this.clients.get(sessionId)
          if (client) {
            // Send the document as a sync message
            client.send(JSON.stringify({
              type: "sync",
              senderId: "server",
              targetId: sessionId,
              documentId: message.documentId || "default",
              data: doc
            }))
          }
        }
        break
      case "request":
        // Handle document request
        const doc = await this.getDocument()
        const client = this.clients.get(sessionId)
        if (client) {
          client.send(JSON.stringify({
            type: "sync",
            senderId: "server",
            targetId: sessionId,
            documentId: message.documentId || "default",
            data: doc
          }))
        }
        break
      default:
        console.log("Unknown message type:", message.type)
    }
  }

  private async handleSyncMessage(sessionId: string, message: any) {
    // Handle incoming sync data from client
    // For now, just broadcast to other clients
    this.broadcastToOthers(sessionId, message)
  }

  private broadcastToOthers(senderId: string, message: any) {
    for (const [sessionId, client] of this.clients) {
      if (sessionId !== senderId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message))
      }
    }
  }

  // Generate a simple hash of the document state for change detection
  private generateDocHash(doc: any): string {
    // Create a stable string representation of the document
    // Focus on the store data which is what actually changes
    const storeData = doc.store || {}
    const storeKeys = Object.keys(storeData).sort()
    const storeString = JSON.stringify(storeData, storeKeys)
    
    // Simple hash function (you could use a more sophisticated one if needed)
    let hash = 0
    for (let i = 0; i < storeString.length; i++) {
      const char = storeString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    const hashString = hash.toString()
    console.log(`Server generated hash:`, {
      storeStringLength: storeString.length,
      hash: hashString,
      storeKeys: storeKeys.length,
      sampleKeys: storeKeys.slice(0, 3)
    })
    return hashString
  }

  private async applyPatch(patch: any) {
    // For now, we'll store patches and apply them to the document
    // In a full implementation, you'd want to use Automerge's patch application
    console.log("Applying patch:", patch)
    this.schedulePersistToR2()
  }

  async getDocument() {
    if (!this.roomId) throw new Error("Missing roomId")

    // If we already have a current document, return it
    if (this.currentDoc) {
      return this.currentDoc
    }

    // Otherwise, load from R2 (only once)
    if (!this.roomPromise) {
      this.roomPromise = (async () => {
        let initialDoc: any
        
        try {
          // fetch the document from R2
          const docFromBucket = await this.r2.get(`rooms/${this.roomId}`)
          
          if (docFromBucket) {
            try {
              initialDoc = await docFromBucket.json()
              console.log(`Loaded document from R2 for room ${this.roomId}:`, {
                hasStore: !!initialDoc.store,
                hasDocuments: !!initialDoc.documents,
                storeKeys: initialDoc.store ? Object.keys(initialDoc.store).length : 0,
                documentsCount: initialDoc.documents ? initialDoc.documents.length : 0,
                sampleKeys: initialDoc.store ? Object.keys(initialDoc.store).slice(0, 5) : [],
                docSize: JSON.stringify(initialDoc).length
              })
              
              // Migrate old format (documents array) to new format (store object)
              if (initialDoc.documents && !initialDoc.store) {
                console.log(`Migrating old documents format to new store format for room ${this.roomId}`)
                initialDoc = this.migrateDocumentsToStore(initialDoc)
                console.log(`Migration completed:`, {
                  storeKeys: Object.keys(initialDoc.store).length,
                  shapeCount: Object.values(initialDoc.store).filter((r: any) => r.typeName === 'shape').length
                })
              }
              
              // Migrate shapes to ensure they have required properties
              if (initialDoc.store) {
                console.log(`🔄 Server-side: Starting shape migration for room ${this.roomId}`)
                initialDoc = this.migrateShapeProperties(initialDoc)
                console.log(`✅ Server-side: Shape migration completed for room ${this.roomId}`)
              }
            } catch (jsonError) {
              console.error(`Error parsing JSON from R2 for room ${this.roomId}:`, jsonError)
              // If JSON parsing fails, create a new document
              initialDoc = this.createEmptyDocument()
            }
          } else {
            console.log(`No document found in R2 for room ${this.roomId}, creating new one`)
            initialDoc = this.createEmptyDocument()
          }
        } catch (r2Error) {
          console.error(`Error loading from R2 for room ${this.roomId}:`, r2Error)
          // If R2 loading fails, create a new document
          initialDoc = this.createEmptyDocument()
        }
        
        this.currentDoc = initialDoc
        
        // Initialize the last persisted hash with the loaded document
        this.lastPersistedHash = this.generateDocHash(initialDoc)
        
        return initialDoc
      })()
    }

    return this.roomPromise
  }

  private createEmptyDocument() {
    return {
      store: {
        "document:document": {
          gridSize: 10,
          name: "",
          meta: {},
          id: "document:document",
          typeName: "document",
        },
        "pointer:pointer": {
          id: "pointer:pointer",
          typeName: "pointer",
          x: 0,
          y: 0,
          lastActivityTimestamp: 0,
          meta: {},
        },
        "page:page": {
          meta: {},
          id: "page:page",
          name: "Page 1",
          index: "a1",
          typeName: "page",
        },
        "camera:page:page": {
          x: 0,
          y: 0,
          z: 1,
          meta: {},
          id: "camera:page:page",
          typeName: "camera",
        },
        "instance_page_state:page:page": {
          editingShapeId: null,
          croppingShapeId: null,
          selectedShapeIds: [],
          hoveredShapeId: null,
          erasingShapeIds: [],
          hintingShapeIds: [],
          focusedGroupId: null,
          meta: {},
          id: "instance_page_state:page:page",
          pageId: "page:page",
          typeName: "instance_page_state",
        },
        "instance:instance": {
          followingUserId: null,
          opacityForNextShape: 1,
          stylesForNextShape: {},
          brush: { x: 0, y: 0, w: 0, h: 0 },
          zoomBrush: { x: 0, y: 0, w: 0, h: 0 },
          scribbles: [],
          cursor: {
            type: "default",
            rotation: 0,
          },
          isFocusMode: false,
          exportBackground: true,
          isDebugMode: false,
          isToolLocked: false,
          screenBounds: {
            x: 0,
            y: 0,
            w: 720,
            h: 400,
          },
          isGridMode: false,
          isPenMode: false,
          chatMessage: "",
          isChatting: false,
          highlightedUserIds: [],
          isFocused: true,
          devicePixelRatio: 2,
          insets: [false, false, false, false],
          isCoarsePointer: false,
          isHoveringCanvas: false,
          openMenus: [],
          isChangingStyle: false,
          isReadonly: false,
          meta: {},
          id: "instance:instance",
          currentPageId: "page:page",
          typeName: "instance",
        },
      },
      schema: {
        schemaVersion: 2,
        sequences: {
          "com.tldraw.store": 4,
          "com.tldraw.asset": 1,
          "com.tldraw.camera": 1,
          "com.tldraw.document": 2,
          "com.tldraw.instance": 25,
          "com.tldraw.instance_page_state": 5,
          "com.tldraw.page": 1,
          "com.tldraw.instance_presence": 5,
          "com.tldraw.pointer": 1,
          "com.tldraw.shape": 4,
          "com.tldraw.asset.bookmark": 2,
          "com.tldraw.asset.image": 4,
          "com.tldraw.asset.video": 4,
          "com.tldraw.shape.group": 0,
          "com.tldraw.shape.text": 2,
          "com.tldraw.shape.bookmark": 2,
          "com.tldraw.shape.draw": 2,
          "com.tldraw.shape.geo": 9,
          "com.tldraw.shape.note": 7,
          "com.tldraw.shape.line": 5,
          "com.tldraw.shape.frame": 0,
          "com.tldraw.shape.arrow": 5,
          "com.tldraw.shape.highlight": 1,
          "com.tldraw.shape.embed": 4,
          "com.tldraw.shape.image": 3,
          "com.tldraw.shape.video": 2,
          "com.tldraw.shape.container": 0,
          "com.tldraw.shape.element": 0,
          "com.tldraw.binding.arrow": 0,
          "com.tldraw.binding.layout": 0
        }
      }
    }
  }

  private async updateDocument(newDoc: any) {
    this.currentDoc = newDoc
    this.schedulePersistToR2()
  }

  // Migrate old documents format to new store format
  private migrateDocumentsToStore(oldDoc: any): any {
    const newDoc = {
      store: {},
      schema: oldDoc.schema || this.createEmptyDocument().schema
    }
    
    // Convert documents array to store object
    if (oldDoc.documents && Array.isArray(oldDoc.documents)) {
      oldDoc.documents.forEach((doc: any) => {
        if (doc.state && doc.state.id && doc.state.typeName) {
          (newDoc.store as any)[doc.state.id] = doc.state
        }
      })
    }
    
    console.log(`Migrated ${Object.keys(newDoc.store).length} records from documents format`)
    return newDoc
  }

  // Migrate shape properties to ensure they have required fields
  private migrateShapeProperties(doc: any): any {
    if (!doc.store) return doc
    
    let migratedCount = 0
    const store = { ...doc.store }
    
    // Fix all shape records to ensure they have required properties
    Object.keys(store).forEach(key => {
      const record = store[key]
      if (record && record.typeName === 'shape') {
        const originalRecord = { ...record }
        let needsUpdate = false
        
        // Ensure isLocked property exists and is a boolean
        if (record.isLocked === undefined || typeof record.isLocked !== 'boolean') {
          record.isLocked = false
          needsUpdate = true
        }
        
        // Ensure other required shape properties exist
        if (record.x === undefined) {
          record.x = 0
          needsUpdate = true
        }
        if (record.y === undefined) {
          record.y = 0
          needsUpdate = true
        }
        if (record.rotation === undefined) {
          record.rotation = 0
          needsUpdate = true
        }
        if (record.opacity === undefined) {
          record.opacity = 1
          needsUpdate = true
        }
        if (!record.meta || typeof record.meta !== 'object') {
          record.meta = {}
          needsUpdate = true
        }
        
        // Special handling for geo shapes - move w and h to props
        const isGeoShape = record.type === 'geo' || 
          (record.typeName === 'shape' && 'w' in record && 'h' in record)
        
        if (isGeoShape) {
          // If we don't have a type but have w/h, assume it's a geo shape
          if (!record.type) {
            record.type = 'geo'
            console.log(`Setting type to 'geo' for shape with w/h properties:`, {
              id: record.id,
              w: record.w,
              h: record.h
            })
          }
          // Ensure props property exists
          if (!record.props || typeof record.props !== 'object') {
            record.props = {
              w: 100,
              h: 100,
              geo: 'rectangle',
              dash: 'draw',
              growY: 0,
              url: '',
              scale: 1,
              color: 'black',
              labelColor: 'black',
              fill: 'none',
              size: 'm',
              font: 'draw',
              align: 'middle',
              verticalAlign: 'middle'
            }
            needsUpdate = true
          }
          
          // Move w and h from top level to props if they exist
          if ('w' in record && typeof record.w === 'number') {
            record.props.w = record.w
            needsUpdate = true
          }
          if ('h' in record && typeof record.h === 'number') {
            record.props.h = record.h
            needsUpdate = true
          }
        }
        
        if (needsUpdate) {
          console.log(`Migrating shape ${record.id}:`, {
            id: record.id,
            type: record.type,
            originalIsLocked: originalRecord.isLocked,
            newIsLocked: record.isLocked,
            hadX: 'x' in originalRecord,
            hadY: 'y' in originalRecord,
            hadRotation: 'rotation' in originalRecord,
            hadOpacity: 'opacity' in originalRecord,
            hadMeta: 'meta' in originalRecord,
            hadW: 'w' in originalRecord,
            hadH: 'h' in originalRecord,
            propsW: record.props?.w,
            propsH: record.props?.h
          })
          migratedCount++
        }
      }
    })
    
    if (migratedCount > 0) {
      console.log(`Migrated ${migratedCount} shapes to ensure required properties`)
    }
    
    return {
      ...doc,
      store
    }
  }

  // we throttle persistence so it only happens every 2 seconds, batching all updates
  schedulePersistToR2 = throttle(async () => {
    if (!this.roomId || !this.currentDoc) return
    
    // Generate hash of current document state
    const currentHash = this.generateDocHash(this.currentDoc)
    
    console.log(`Server checking R2 persistence for room ${this.roomId}:`, {
      currentHash: currentHash.substring(0, 8) + '...',
      lastHash: this.lastPersistedHash ? this.lastPersistedHash.substring(0, 8) + '...' : 'none',
      hasStore: !!this.currentDoc.store,
      storeKeys: this.currentDoc.store ? Object.keys(this.currentDoc.store).length : 0
    })
    
    // Skip persistence if document hasn't changed
    if (currentHash === this.lastPersistedHash) {
      console.log(`Skipping R2 persistence for room ${this.roomId} - no changes detected`)
      return
    }
    
    try {
      // convert the document to JSON and upload it to R2
      const docJson = JSON.stringify(this.currentDoc)
      await this.r2.put(`rooms/${this.roomId}`, docJson, {
        httpMetadata: {
          contentType: 'application/json'
        }
      })
      
      // Update last persisted hash only after successful save
      this.lastPersistedHash = currentHash
      console.log(`Successfully persisted room ${this.roomId} to R2 (batched):`, {
        storeKeys: this.currentDoc.store ? Object.keys(this.currentDoc.store).length : 0,
        docSize: docJson.length
      })
    } catch (error) {
      console.error(`Error persisting room ${this.roomId} to R2:`, error)
    }
  }, 2_000)
}
