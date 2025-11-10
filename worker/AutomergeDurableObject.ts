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
    console.log(`🔌 AutomergeDurableObject: Received connection request for room ${this.roomId}`)
    
    if (!this.roomId) {
      console.error(`❌ AutomergeDurableObject: Room not initialized`)
      return new Response("Room not initialized", { status: 400 })
    }

    const sessionId = request.query.sessionId as string
    console.log(`🔌 AutomergeDurableObject: Session ID: ${sessionId}`)
    
    if (!sessionId) {
      console.error(`❌ AutomergeDurableObject: Missing sessionId`)
      return new Response("Missing sessionId", { status: 400 })
    }

    // Check if this is a WebSocket upgrade request
    const upgradeHeader = request.headers.get("Upgrade")
    console.log(`🔌 AutomergeDurableObject: Upgrade header: ${upgradeHeader}`)
    
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      console.error(`❌ AutomergeDurableObject: Expected Upgrade: websocket, got: ${upgradeHeader}`)
      return new Response("Expected Upgrade: websocket", { status: 426 })
    }

    const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair()

    try {
      console.log(`🔌 AutomergeDurableObject: Accepting WebSocket connection for session: ${sessionId}`)
      serverWebSocket.accept()
      
      // Store the client connection
      this.clients.set(sessionId, serverWebSocket)
      console.log(`🔌 AutomergeDurableObject: Stored client connection for session: ${sessionId}`)

      // Set up message handling
      serverWebSocket.addEventListener("message", async (event) => {
        try {
          // Handle binary messages (Automerge's native sync protocol)
          if (event.data instanceof ArrayBuffer) {
            console.log(`🔌 AutomergeDurableObject: Received binary message from ${sessionId}`)
            // Pass binary data directly to other clients for Automerge sync
            await this.handleBinaryMessage(sessionId, event.data)
          } else if (event.data instanceof Blob) {
            // Convert Blob to ArrayBuffer
            const buffer = await event.data.arrayBuffer()
            console.log(`🔌 AutomergeDurableObject: Received Blob message, converted to ArrayBuffer`)
            await this.handleBinaryMessage(sessionId, buffer)
          } else {
            // Handle text messages (JSON for backward compatibility and control messages)
            const message = JSON.parse(event.data)
            console.log(`🔌 AutomergeDurableObject: Received message from ${sessionId}:`, message.type)
            this.handleMessage(sessionId, message)
          }
        } catch (error) {
          console.error("❌ AutomergeDurableObject: Error parsing WebSocket message:", error)
        }
      })

      // Handle disconnection
      serverWebSocket.addEventListener("close", (event) => {
        console.log(`🔌 AutomergeDurableObject: Client disconnected: ${sessionId}, code: ${event.code}, reason: ${event.reason}`)
        this.clients.delete(sessionId)
      })
      
      // Handle WebSocket errors
      serverWebSocket.addEventListener("error", (error) => {
        console.error(`❌ AutomergeDurableObject: WebSocket error for session ${sessionId}:`, error)
      })
      
      // Add a small delay to ensure the WebSocket is properly established
      setTimeout(() => {
        if (serverWebSocket.readyState === WebSocket.OPEN) {
          console.log(`🔌 AutomergeDurableObject: WebSocket connection confirmed open for session ${sessionId}`)
        } else {
          console.error(`❌ AutomergeDurableObject: WebSocket connection failed for session ${sessionId}, state: ${serverWebSocket.readyState}`)
        }
      }, 100)

      // Send a simple test message first to ensure WebSocket is working
      console.log(`🔌 AutomergeDurableObject: Sending test message to client: ${sessionId}`)
      
      try {
        // Send a simple test message first
        serverWebSocket.send(JSON.stringify({
          type: "test",
          message: "WebSocket connection established",
          timestamp: Date.now()
        }))
        console.log(`🔌 AutomergeDurableObject: Test message sent to client: ${sessionId}`)
        
        // Then try to send the document
        console.log(`🔌 AutomergeDurableObject: Getting document for session ${sessionId}`)
        const doc = await this.getDocument()
        console.log(`🔌 AutomergeDurableObject: Document loaded, sending to client:`, { 
          hasStore: !!doc.store, 
          storeKeys: doc.store ? Object.keys(doc.store).length : 0,
          shapes: doc.store ? Object.values(doc.store).filter((record: any) => record.typeName === 'shape').length : 0,
          pages: doc.store ? Object.values(doc.store).filter((record: any) => record.typeName === 'page').length : 0
        })
        
        // Send the document using Automerge's sync protocol
        console.log(`🔌 AutomergeDurableObject: Sending document data to client ${sessionId}`)
        serverWebSocket.send(JSON.stringify({
          type: "sync",
          senderId: "server",
          targetId: sessionId,
          documentId: "default",
          data: doc
        }))
        console.log(`🔌 AutomergeDurableObject: Document sent to client: ${sessionId}`)
      } catch (error) {
        console.error(`❌ AutomergeDurableObject: Error sending document to client ${sessionId}:`, error)
        console.error(`❌ AutomergeDurableObject: Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
        // Don't close the WebSocket on document send errors, just log them
      }

      console.log(`🔌 AutomergeDurableObject: Returning WebSocket response for session ${sessionId}`)
      
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
      console.error("❌ AutomergeDurableObject: WebSocket connection error:", error)
      if (error instanceof Error) {
        console.error("❌ AutomergeDurableObject: Error stack:", error.stack)
        console.error("❌ AutomergeDurableObject: Error details:", {
          message: error.message,
          name: error.name
        })
      }
      
      // Only close the WebSocket if it's still open
      if (serverWebSocket.readyState === WebSocket.OPEN) {
        console.log("❌ AutomergeDurableObject: Closing WebSocket due to error")
        serverWebSocket.close(1011, "Failed to initialize connection")
      }
      
      return new Response("Failed to establish WebSocket connection", {
        status: 500,
      })
    }
  }

  private async handleMessage(sessionId: string, message: any) {
    console.log(`Handling message from ${sessionId}:`, message.type)
    
    switch (message.type) {
      case "ping":
        // Handle keep-alive ping
        const client = this.clients.get(sessionId)
        if (client && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: "pong",
            timestamp: Date.now()
          }))
        }
        break
      case "pong":
        // Handle keep-alive pong (just acknowledge)
        console.log(`Received pong from ${sessionId}`)
        break
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
              documentId: message.documentId || this.roomId,
              data: doc
            }))
          }
        }
        break
      case "request":
        // Handle document request
        const doc = await this.getDocument()
        const requestClient = this.clients.get(sessionId)
        if (requestClient) {
          requestClient.send(JSON.stringify({
            type: "sync",
            senderId: "server",
            targetId: sessionId,
            documentId: message.documentId || this.roomId,
            data: doc
          }))
        }
        break
      default:
        console.log("Unknown message type:", message.type)
    }
  }

  private async handleBinaryMessage(sessionId: string, data: ArrayBuffer) {
    // Handle incoming binary Automerge sync data from client
    console.log(`🔌 Worker: Handling binary sync message from ${sessionId}, size: ${data.byteLength} bytes`)
    
    // Broadcast binary data directly to other clients for Automerge's native sync protocol
    // Automerge Repo handles the binary sync protocol internally
    this.broadcastBinaryToOthers(sessionId, data)
  }

  private async handleSyncMessage(sessionId: string, message: any) {
    // Handle incoming Automerge sync data from client (JSON format for backward compatibility)
    console.log(`🔌 Worker: Handling sync message from ${sessionId}:`, {
      hasData: !!message.data,
      dataType: typeof message.data,
      isArrayBuffer: message.data instanceof ArrayBuffer,
      documentId: message.documentId
    })
    
    // For Automerge's native protocol, we need to handle binary data
    if (message.data instanceof ArrayBuffer) {
      console.log(`🔌 Worker: Processing binary Automerge sync data`)
      // Handle binary data
      await this.handleBinaryMessage(sessionId, message.data)
    } else {
      // Handle JSON sync data (backward compatibility)
      console.log(`🔌 Worker: Processing JSON sync data`)
      this.broadcastToOthers(sessionId, message)
    }
  }

  private broadcastBinaryToOthers(senderId: string, data: ArrayBuffer) {
    // Broadcast binary Automerge sync data to all other clients
    let broadcastCount = 0
    for (const [sessionId, client] of this.clients) {
      if (sessionId !== senderId && client.readyState === WebSocket.OPEN) {
        try {
          console.log(`🔌 Worker: Broadcasting binary sync data (${data.byteLength} bytes) to ${sessionId}`)
          client.send(data)
          broadcastCount++
        } catch (error) {
          console.error(`❌ Worker: Error broadcasting binary data to ${sessionId}:`, error)
        }
      }
    }
    if (broadcastCount > 0) {
      console.log(`🔌 Worker: Broadcast binary sync data to ${broadcastCount} client(s)`)
    }
  }

  private broadcastToOthers(senderId: string, message: any) {
    // Broadcast JSON messages (backward compatibility and control messages)
    let broadcastCount = 0
    for (const [sessionId, client] of this.clients) {
      if (sessionId !== senderId && client.readyState === WebSocket.OPEN) {
        try {
          if (message.data instanceof ArrayBuffer) {
            // Send binary data for Automerge protocol
            console.log(`🔌 Worker: Broadcasting binary sync data to ${sessionId}`)
            client.send(message.data)
          } else {
            // Send JSON data for backward compatibility
            console.log(`🔌 Worker: Broadcasting JSON sync data to ${sessionId}`)
            client.send(JSON.stringify(message))
          }
          broadcastCount++
        } catch (error) {
          console.error(`❌ Worker: Error broadcasting to ${sessionId}:`, error)
        }
      }
    }
    if (broadcastCount > 0) {
      console.log(`🔌 Worker: Broadcast message to ${broadcastCount} client(s)`)
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
              const rawDoc = await docFromBucket.json()
              console.log(`Loaded raw document from R2 for room ${this.roomId}:`, {
                isArray: Array.isArray(rawDoc),
                length: Array.isArray(rawDoc) ? rawDoc.length : 'not array',
                hasStore: !!(rawDoc as any).store,
                hasDocuments: !!(rawDoc as any).documents,
                sampleKeys: Array.isArray(rawDoc) ? rawDoc.slice(0, 3).map((r: any) => r.state?.id) : []
              })
              
              // Convert Automerge document format to TLStoreSnapshot format
              if (Array.isArray(rawDoc)) {
                // This is the raw Automerge document format - convert to store format
                console.log(`Converting Automerge document format to store format for room ${this.roomId}`)
                initialDoc = this.convertAutomergeToStore(rawDoc)
                const customRecords = Object.values(initialDoc.store).filter((r: any) => 
                  r.id && typeof r.id === 'string' && r.id.startsWith('obsidian_vault:')
                )
                console.log(`Conversion completed:`, {
                  storeKeys: Object.keys(initialDoc.store).length,
                  shapeCount: Object.values(initialDoc.store).filter((r: any) => r.typeName === 'shape').length,
                  customRecordCount: customRecords.length,
                  customRecordIds: customRecords.map((r: any) => r.id).slice(0, 5)
                })
              } else if ((rawDoc as any).store) {
                // This is already in store format
                initialDoc = rawDoc
                const customRecords = Object.values(initialDoc.store).filter((r: any) => 
                  r.id && typeof r.id === 'string' && r.id.startsWith('obsidian_vault:')
                )
                console.log(`Document already in store format:`, {
                  storeKeys: Object.keys(initialDoc.store).length,
                  shapeCount: Object.values(initialDoc.store).filter((r: any) => r.typeName === 'shape').length,
                  customRecordCount: customRecords.length,
                  customRecordIds: customRecords.map((r: any) => r.id).slice(0, 5)
                })
              } else if ((rawDoc as any).documents && !((rawDoc as any).store)) {
                // Migrate old format (documents array) to new format (store object)
                console.log(`Migrating old documents format to new store format for room ${this.roomId}`)
                initialDoc = this.migrateDocumentsToStore(rawDoc)
                const customRecords = Object.values(initialDoc.store).filter((r: any) => 
                  r.id && typeof r.id === 'string' && r.id.startsWith('obsidian_vault:')
                )
                console.log(`Migration completed:`, {
                  storeKeys: Object.keys(initialDoc.store).length,
                  shapeCount: Object.values(initialDoc.store).filter((r: any) => r.typeName === 'shape').length,
                  customRecordCount: customRecords.length,
                  customRecordIds: customRecords.map((r: any) => r.id).slice(0, 5)
                })
              } else {
                console.log(`Unknown document format, creating new document`)
                initialDoc = this.createEmptyDocument()
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

  private convertAutomergeToStore(automergeDoc: any[]): any {
    const store: any = {}
    const conversionStats = {
      total: automergeDoc.length,
      converted: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [] as string[],
      customRecords: [] as string[] // Track custom record IDs (obsidian_vault, etc.)
    }
    
    // Convert each Automerge record to store format
    automergeDoc.forEach((record: any, index: number) => {
      try {
        // Validate record structure
        if (!record) {
          conversionStats.skipped++
          conversionStats.errorDetails.push(`Record at index ${index} is null or undefined`)
          return
        }
        
        if (!record.state) {
          conversionStats.skipped++
          conversionStats.errorDetails.push(`Record at index ${index} missing state property`)
          return
        }
        
        if (!record.state.id) {
          conversionStats.skipped++
          conversionStats.errorDetails.push(`Record at index ${index} missing state.id`)
          return
        }
        
        // Validate ID is a string
        if (typeof record.state.id !== 'string') {
          conversionStats.skipped++
          conversionStats.errorDetails.push(`Record at index ${index} has invalid state.id type: ${typeof record.state.id}`)
          return
        }
        
        // Track custom records (obsidian_vault, etc.)
        if (record.state.id.startsWith('obsidian_vault:')) {
          conversionStats.customRecords.push(record.state.id)
        }
        
        // Extract the state and use it as the store record
        store[record.state.id] = record.state
        conversionStats.converted++
      } catch (error) {
        conversionStats.errors++
        const errorMsg = `Error converting record at index ${index}: ${error instanceof Error ? error.message : String(error)}`
        conversionStats.errorDetails.push(errorMsg)
        console.error(`❌ Conversion error:`, errorMsg)
      }
    })
    
    console.log(`📊 Automerge to Store conversion statistics:`, {
      total: conversionStats.total,
      converted: conversionStats.converted,
      skipped: conversionStats.skipped,
      errors: conversionStats.errors,
      storeKeys: Object.keys(store).length,
      customRecordCount: conversionStats.customRecords.length,
      customRecordIds: conversionStats.customRecords.slice(0, 10),
      errorCount: conversionStats.errorDetails.length
    })
    
    // Verify custom records are preserved
    if (conversionStats.customRecords.length > 0) {
      console.log(`✅ Verified ${conversionStats.customRecords.length} custom records preserved during conversion`)
    }
    
    if (conversionStats.errorDetails.length > 0 && conversionStats.errorDetails.length <= 10) {
      console.warn(`⚠️ Conversion warnings (showing first 10):`, conversionStats.errorDetails.slice(0, 10))
    } else if (conversionStats.errorDetails.length > 10) {
      console.warn(`⚠️ Conversion warnings (${conversionStats.errorDetails.length} total, showing first 10):`, conversionStats.errorDetails.slice(0, 10))
    }
    
    return {
      store,
      schema: {
        version: 1,
        recordVersions: {}
      }
    }
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
          "com.tldraw.binding.layout": 0,
          "obsidian_vault": 1
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
    
    const migrationStats = {
      total: 0,
      converted: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [] as string[],
      recordTypes: {} as Record<string, number>,
      customRecords: [] as string[] // Track custom record IDs (obsidian_vault, etc.)
    }
    
    // Convert documents array to store object
    if (oldDoc.documents && Array.isArray(oldDoc.documents)) {
      migrationStats.total = oldDoc.documents.length
      
      oldDoc.documents.forEach((doc: any, index: number) => {
        try {
          // Validate document structure
          if (!doc) {
            migrationStats.skipped++
            migrationStats.errorDetails.push(`Document at index ${index} is null or undefined`)
            return
          }
          
          if (!doc.state) {
            migrationStats.skipped++
            migrationStats.errorDetails.push(`Document at index ${index} missing state property`)
            return
          }
          
          if (!doc.state.id) {
            migrationStats.skipped++
            migrationStats.errorDetails.push(`Document at index ${index} missing state.id`)
            return
          }
          
          if (!doc.state.typeName) {
            migrationStats.skipped++
            migrationStats.errorDetails.push(`Document at index ${index} missing state.typeName (id: ${doc.state.id})`)
            return
          }
          
          // Validate ID is a string
          if (typeof doc.state.id !== 'string') {
            migrationStats.skipped++
            migrationStats.errorDetails.push(`Document at index ${index} has invalid state.id type: ${typeof doc.state.id}`)
            return
          }
          
          // Track record types
          const typeName = doc.state.typeName
          migrationStats.recordTypes[typeName] = (migrationStats.recordTypes[typeName] || 0) + 1
          
          // Track custom records (obsidian_vault, etc.)
          if (doc.state.id.startsWith('obsidian_vault:')) {
            migrationStats.customRecords.push(doc.state.id)
          }
          
          // Extract the state and use it as the store record
          (newDoc.store as any)[doc.state.id] = doc.state
          migrationStats.converted++
        } catch (error) {
          migrationStats.errors++
          const errorMsg = `Error migrating document at index ${index}: ${error instanceof Error ? error.message : String(error)}`
          migrationStats.errorDetails.push(errorMsg)
          console.error(`❌ Migration error:`, errorMsg)
        }
      })
    } else {
      console.warn(`⚠️ migrateDocumentsToStore: oldDoc.documents is not an array or doesn't exist`)
    }
    
    console.log(`📊 Documents to Store migration statistics:`, {
      total: migrationStats.total,
      converted: migrationStats.converted,
      skipped: migrationStats.skipped,
      errors: migrationStats.errors,
      storeKeys: Object.keys(newDoc.store).length,
      recordTypes: migrationStats.recordTypes,
      customRecordCount: migrationStats.customRecords.length,
      customRecordIds: migrationStats.customRecords.slice(0, 10),
      errorCount: migrationStats.errorDetails.length
    })
    
    // Verify custom records are preserved
    if (migrationStats.customRecords.length > 0) {
      console.log(`✅ Verified ${migrationStats.customRecords.length} custom records preserved during migration`)
    }
    
    if (migrationStats.errorDetails.length > 0 && migrationStats.errorDetails.length <= 10) {
      console.warn(`⚠️ Migration warnings (showing first 10):`, migrationStats.errorDetails.slice(0, 10))
    } else if (migrationStats.errorDetails.length > 10) {
      console.warn(`⚠️ Migration warnings (${migrationStats.errorDetails.length} total, showing first 10):`, migrationStats.errorDetails.slice(0, 10))
    }
    
    return newDoc
  }

  // Migrate shape properties to ensure they have required fields
  private migrateShapeProperties(doc: any): any {
    if (!doc.store) return doc
    
    const migrationStats = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [] as string[],
      shapeTypes: {} as Record<string, number>,
      customShapes: [] as string[] // Track custom shape IDs
    }
    
    const store = { ...doc.store }
    
    // Fix all shape records to ensure they have required properties
    Object.keys(store).forEach(key => {
      const record = store[key]
      if (record && record.typeName === 'shape') {
        migrationStats.total++
        
        // Track shape types
        const shapeType = record.type || 'unknown'
        migrationStats.shapeTypes[shapeType] = (migrationStats.shapeTypes[shapeType] || 0) + 1
        
        // Track custom shapes (non-standard TLDraw shapes)
        const customShapeTypes = ['ObsNote', 'Holon', 'FathomMeetingsBrowser', 'FathomTranscript', 'HolonBrowser', 'LocationShare', 'ObsidianBrowser']
        if (customShapeTypes.includes(shapeType)) {
          migrationStats.customShapes.push(record.id)
        }
        
        try {
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
          if (!record.index) {
            record.index = 'a1' // Required index property for all shapes
            needsUpdate = true
          }
          
          // Special handling for geo shapes - ensure w and h are in props, not top level
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
            
            // CRITICAL: Move w and h from top level to props to prevent validation errors
            if ('w' in record) {
              console.log(`🔧 Server: Moving w from top level to props for geo shape ${record.id}`)
              if (!record.props) record.props = {}
              if (record.props.w === undefined) {
                record.props.w = record.w
              }
              delete record.w
              needsUpdate = true
            }
            if ('h' in record) {
              console.log(`🔧 Server: Moving h from top level to props for geo shape ${record.id}`)
              if (!record.props) record.props = {}
              if (record.props.h === undefined) {
                record.props.h = record.h
              }
              delete record.h
              needsUpdate = true
            }
            
            // Ensure props property exists with defaults
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
            
            // Handle richText property for geo shapes - only fix structure, don't add if missing
            if ('richText' in record.props) {
              if (record.props.richText === undefined || record.props.richText === null) {
                console.log(`🔧 Worker: Adding missing richText property for geo shape:`, record.id)
                record.props.richText = { content: [], type: 'doc' }
                needsUpdate = true
              } else if (Array.isArray(record.props.richText)) {
                console.log(`🔧 Worker: Converting richText array to object for geo shape:`, record.id)
                record.props.richText = {
                  content: record.props.richText,
                  type: 'doc'
                }
                needsUpdate = true
              } else if (typeof record.props.richText !== 'object' || !record.props.richText.content) {
                console.log(`🔧 Worker: Fixing invalid richText structure for geo shape:`, record.id)
                record.props.richText = { content: [], type: 'doc' }
                needsUpdate = true
              }
            }
            // Don't add richText if it doesn't exist - let TLDraw handle it naturally
            
            // Only move w and h from top level to props if they're not already in props
            // This preserves the original data structure
            if ('w' in record && typeof record.w === 'number' && record.props.w === undefined) {
              record.props.w = record.w
              needsUpdate = true
            }
            if ('h' in record && typeof record.h === 'number' && record.props.h === undefined) {
              record.props.h = record.h
              needsUpdate = true
            }
          }
          
          if (needsUpdate) {
            migrationStats.migrated++
            // Only log detailed migration info for first few shapes to avoid spam
            if (migrationStats.migrated <= 5) {
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
                propsH: record.props?.h,
                // Verify custom shape props are preserved
                hasCustomProps: customShapeTypes.includes(shapeType) ? Object.keys(record.props || {}).length : undefined
              })
            }
          } else {
            // Count non-migrated shapes
            migrationStats.skipped++
          }
        } catch (error) {
          migrationStats.errors++
          const errorMsg = `Error migrating shape ${record.id}: ${error instanceof Error ? error.message : String(error)}`
          migrationStats.errorDetails.push(errorMsg)
          console.error(`❌ Shape migration error:`, errorMsg)
        }
      }
    })
    
    console.log(`📊 Shape migration statistics:`, {
      total: migrationStats.total,
      migrated: migrationStats.migrated,
      skipped: migrationStats.skipped,
      errors: migrationStats.errors,
      shapeTypes: migrationStats.shapeTypes,
      customShapesCount: migrationStats.customShapes.length,
      customShapeIds: migrationStats.customShapes.slice(0, 10), // Show first 10
      errorCount: migrationStats.errorDetails.length
    })
    
    if (migrationStats.errorDetails.length > 0 && migrationStats.errorDetails.length <= 10) {
      console.warn(`⚠️ Shape migration warnings (showing first 10):`, migrationStats.errorDetails.slice(0, 10))
    } else if (migrationStats.errorDetails.length > 10) {
      console.warn(`⚠️ Shape migration warnings (${migrationStats.errorDetails.length} total, showing first 10):`, migrationStats.errorDetails.slice(0, 10))
    }
    
    // Verify custom shapes are preserved
    if (migrationStats.customShapes.length > 0) {
      console.log(`✅ Verified ${migrationStats.customShapes.length} custom shapes preserved during migration`)
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
