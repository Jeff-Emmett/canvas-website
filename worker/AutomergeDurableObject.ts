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
  // Track if document was converted from old format (for JSON sync decision)
  private wasConvertedFromOldFormat: boolean = false
  // Cache R2 document hash to avoid reloading when unchanged
  private cachedR2Hash: string | null = null
  private cachedR2Doc: any = null
  // Store the Automerge document ID for this room
  private automergeDocumentId: string | null = null

  constructor(private readonly ctx: DurableObjectState, env: Environment) {
    this.r2 = env.TLDRAW_BUCKET

    ctx.blockConcurrencyWhile(async () => {
      this.roomId = ((await this.ctx.storage.get("roomId")) ?? null) as
        | string
        | null
      this.automergeDocumentId = ((await this.ctx.storage.get("automergeDocumentId")) ?? null) as
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
    .get("/room/:roomId/documentId", async (request) => {
      // Initialize roomId if not already set
      if (!this.roomId) {
        await this.ctx.blockConcurrencyWhile(async () => {
          await this.ctx.storage.put("roomId", request.params.roomId)
          this.roomId = request.params.roomId
        })
      }

      if (!this.automergeDocumentId) {
        return new Response(JSON.stringify({ error: "No document ID found" }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
          },
        })
      }

      return new Response(JSON.stringify({ documentId: this.automergeDocumentId }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
        },
      })
    })
    .post("/room/:roomId/documentId", async (request) => {
      // Initialize roomId if not already set
      if (!this.roomId) {
        await this.ctx.blockConcurrencyWhile(async () => {
          await this.ctx.storage.put("roomId", request.params.roomId)
          this.roomId = request.params.roomId
        })
      }

      const { documentId } = (await request.json()) as { documentId: string }

      await this.ctx.blockConcurrencyWhile(async () => {
        await this.ctx.storage.put("automergeDocumentId", documentId)
        this.automergeDocumentId = documentId
      })

      console.log(`📝 Stored document ID ${documentId} for room ${this.roomId}`)

      return new Response(JSON.stringify({ success: true, documentId }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
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
        
        // CRITICAL: No JSON sync - all data flows through Automerge sync protocol
        // Old format content is converted to Automerge format server-side during getDocument()
        // and saved back to R2, then Automerge sync loads it normally
        console.log(`🔌 AutomergeDurableObject: Document ready for Automerge sync (was converted: ${this.wasConvertedFromOldFormat})`)
        
        const doc = await this.getDocument()
        const shapeCount = doc.store ? Object.values(doc.store).filter((record: any) => record.typeName === 'shape').length : 0
        
        console.log(`🔌 AutomergeDurableObject: Document loaded:`, { 
          hasStore: !!doc.store, 
          storeKeys: doc.store ? Object.keys(doc.store).length : 0,
          shapes: shapeCount,
          wasConvertedFromOldFormat: this.wasConvertedFromOldFormat
        })
        
        // Automerge sync protocol will handle loading the document
        // No JSON sync needed - everything goes through Automerge's native sync
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
            // Use consistent document ID format: automerge:${roomId}
            // This matches what the client uses when calling repo.find()
            const documentId = message.documentId || `automerge:${this.roomId}`
            // Send the document as a sync message
            client.send(JSON.stringify({
              type: "sync",
              senderId: "server",
              targetId: sessionId,
              documentId: documentId,
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
          // Use consistent document ID format: automerge:${roomId}
          // This matches what the client uses when calling repo.find()
          const documentId = message.documentId || `automerge:${this.roomId}`
          requestClient.send(JSON.stringify({
            type: "sync",
            senderId: "server",
            targetId: sessionId,
            documentId: documentId,
            data: doc
          }))
        }
        break
      case "request-document-state":
        // Handle document state request from worker (for persistence)
        await this.handleDocumentStateRequest(sessionId)
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
    
    // NOTE: Clients will periodically POST their document state to /room/:roomId
    // which updates this.currentDoc and triggers persistence to R2
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
    
    // CRITICAL FIX: JSON.stringify's second parameter when it's an array is a replacer
    // that only includes those properties. We need to stringify the entire store object.
    // To ensure stable ordering, create a new object with sorted keys
    const sortedStore: any = {}
    for (const key of storeKeys) {
      sortedStore[key] = storeData[key]
    }
    const storeString = JSON.stringify(sortedStore)
    
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

    // CRITICAL: Always load from R2 first if we haven't loaded yet
    // Don't return currentDoc if it was set by a client POST before R2 load
    // This ensures we get all shapes from R2, not just what the client sent
    
    // If R2 load is in progress or completed, wait for it and return the result
    if (this.roomPromise) {
      const doc = await this.roomPromise
      // After R2 load, merge any client updates that happened during load
      if (this.currentDoc && this.currentDoc !== doc) {
        // Merge client updates into R2-loaded document
        if (doc.store && this.currentDoc.store) {
          Object.entries(this.currentDoc.store).forEach(([id, record]) => {
            doc.store[id] = record
          })
        }
        this.currentDoc = doc
      }
      return this.currentDoc || doc
    }

    // Otherwise, start loading from R2 (only once)
    if (!this.roomPromise) {
      this.roomPromise = (async () => {
        let initialDoc: any
        let wasConverted = false
        
        try {
          // fetch the document from R2
          const docFromBucket = await this.r2.get(`rooms/${this.roomId}`)
          
          if (docFromBucket) {
            try {
              const rawDoc = await docFromBucket.json()
              const r2ShapeCount = (rawDoc as any).store ? 
                Object.values((rawDoc as any).store).filter((r: any) => r?.typeName === 'shape').length : 
                (Array.isArray(rawDoc) ? rawDoc.filter((r: any) => r?.state?.typeName === 'shape').length : 0)
              
              console.log(`Loaded raw document from R2 for room ${this.roomId}:`, {
                isArray: Array.isArray(rawDoc),
                length: Array.isArray(rawDoc) ? rawDoc.length : 'not array',
                hasStore: !!(rawDoc as any).store,
                hasDocuments: !!(rawDoc as any).documents,
                shapeCount: r2ShapeCount,
                storeKeys: (rawDoc as any).store ? Object.keys((rawDoc as any).store).length : 0,
                sampleKeys: Array.isArray(rawDoc) ? rawDoc.slice(0, 3).map((r: any) => r.state?.id) : []
              })
              
              // Convert Automerge document format to TLStoreSnapshot format
              if (Array.isArray(rawDoc)) {
                // This is the raw Automerge document format - convert to store format
                console.log(`Converting Automerge document format to store format for room ${this.roomId}`)
                initialDoc = this.convertAutomergeToStore(rawDoc)
                wasConverted = true
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
                wasConverted = true
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
        // Store conversion flag for JSON sync decision
        this.wasConvertedFromOldFormat = wasConverted
        
        // Initialize the last persisted hash with the loaded document
        this.lastPersistedHash = this.generateDocHash(initialDoc)
        
        // If document was converted/migrated, persist it immediately to save in new format
        if (wasConverted && initialDoc.store && Object.keys(initialDoc.store).length > 0) {
          const shapeCount = Object.values(initialDoc.store).filter((r: any) => r.typeName === 'shape').length
          console.log(`📦 Persisting converted document to R2 in new format for room ${this.roomId} (${shapeCount} shapes)`)
          // Persist immediately without throttling for converted documents
          try {
            const docJson = JSON.stringify(initialDoc)
            await this.r2.put(`rooms/${this.roomId}`, docJson, {
              httpMetadata: {
                contentType: 'application/json'
              }
            })
            this.lastPersistedHash = this.generateDocHash(initialDoc)
            console.log(`✅ Successfully persisted converted document for room ${this.roomId} with ${shapeCount} shapes`)
          } catch (persistError) {
            console.error(`❌ Error persisting converted document for room ${this.roomId}:`, persistError)
          }
        }
        
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
    // CRITICAL: Wait for R2 load to complete before processing updates
    // This ensures we have all shapes from R2 before merging client updates
    if (this.roomPromise) {
      try {
        await this.roomPromise
      } catch (e) {
        // R2 load might have failed, continue anyway
        console.warn(`⚠️ R2 load failed, continuing with client update:`, e)
      }
    }
    
    const oldShapeCount = this.currentDoc?.store ? Object.values(this.currentDoc.store).filter((r: any) => r?.typeName === 'shape').length : 0
    const newShapeCount = newDoc?.store ? Object.values(newDoc.store).filter((r: any) => r?.typeName === 'shape').length : 0
    
    // Get list of old shape IDs to check if we're losing any
    const oldShapeIds = this.currentDoc?.store ? 
      Object.values(this.currentDoc.store)
        .filter((r: any) => r?.typeName === 'shape')
        .map((r: any) => r.id) : []
    const newShapeIds = newDoc?.store ?
      Object.values(newDoc.store)
        .filter((r: any) => r?.typeName === 'shape')
        .map((r: any) => r.id) : []
    
    // CRITICAL: Replace the entire store with the client's document
    // The client's document is authoritative and includes deletions
    // This ensures that when shapes are deleted, they're actually removed
    // Clear R2 cache since document has been updated
    this.cachedR2Doc = null
    this.cachedR2Hash = null
    
    if (this.currentDoc && newDoc?.store) {
      // Count records before update
      const recordsBefore = Object.keys(this.currentDoc.store || {}).length
      
      // Replace the entire store with the client's version (preserves deletions)
      this.currentDoc.store = { ...newDoc.store }
      
      // Count records after update
      const recordsAfter = Object.keys(this.currentDoc.store).length
      
      // Update schema if provided
      if (newDoc.schema) {
        this.currentDoc.schema = newDoc.schema
      }
      
      console.log(`📊 updateDocument: Replaced store with client document: ${recordsBefore} -> ${recordsAfter} records (client sent ${Object.keys(newDoc.store).length})`)
    } else {
      // If no current doc yet, set it (R2 load should have completed by now)
      console.log(`📊 updateDocument: No current doc, setting to new doc (${newShapeCount} shapes)`)
      this.currentDoc = newDoc
    }
    
    const finalShapeCount = this.currentDoc?.store ? Object.values(this.currentDoc.store).filter((r: any) => r?.typeName === 'shape').length : 0
    const finalShapeIds = this.currentDoc?.store ?
      Object.values(this.currentDoc.store)
        .filter((r: any) => r?.typeName === 'shape')
        .map((r: any) => r.id) : []
    
    // Check for lost shapes
    const lostShapes = oldShapeIds.filter(id => !finalShapeIds.includes(id))
    if (lostShapes.length > 0) {
      console.error(`❌ CRITICAL: Lost ${lostShapes.length} shapes during merge! Lost IDs:`, lostShapes)
    }
    
    if (finalShapeCount !== oldShapeCount) {
      console.log(`📊 Document updated: shape count changed from ${oldShapeCount} to ${finalShapeCount} (merged from client with ${newShapeCount} shapes)`)
      // CRITICAL: Always persist when shape count changes
      console.log(`📤 Triggering R2 persistence due to shape count change`)
      this.schedulePersistToR2()
    } else if (newShapeCount < oldShapeCount) {
      console.log(`⚠️ Client sent ${newShapeCount} shapes but server has ${oldShapeCount}. Merged to preserve all shapes (final: ${finalShapeCount})`)
      // Persist to ensure we save the merged state
      console.log(`📤 Triggering R2 persistence to save merged state`)
      this.schedulePersistToR2()
    } else if (newShapeCount === oldShapeCount && oldShapeCount > 0) {
      // OPTIMIZED: Fast comparison without expensive JSON.stringify
      // Check if any records were actually added/updated using lightweight comparison
      let recordsChanged = false
      const newStore = newDoc.store || {}
      const currentStore = this.currentDoc?.store || {}
      
      // Quick check: compare record counts and IDs first
      const newKeys = Object.keys(newStore)
      const currentKeys = Object.keys(currentStore)
      
      if (newKeys.length !== currentKeys.length) {
        recordsChanged = true
      } else {
        // Check for new or removed records
        for (const id of newKeys) {
          if (!currentStore[id]) {
            recordsChanged = true
            break
          }
        }
        if (!recordsChanged) {
          for (const id of currentKeys) {
            if (!newStore[id]) {
              recordsChanged = true
              break
            }
          }
        }
        
        // Only do deep comparison if structure matches (avoid expensive JSON.stringify)
        if (!recordsChanged) {
          // Lightweight comparison: check if record types or key properties changed
          for (const id of newKeys) {
            const newRecord = newStore[id]
            const currentRecord = currentStore[id]
            if (!currentRecord) continue
            
            // Quick checks: typeName, type, x, y (most common changes)
            if (newRecord.typeName !== currentRecord.typeName ||
                newRecord.type !== currentRecord.type ||
                (newRecord.x !== currentRecord.x) ||
                (newRecord.y !== currentRecord.y)) {
              recordsChanged = true
              break
            }
          }
        }
      }
      
      if (recordsChanged) {
        console.log(`ℹ️ Client sent ${newShapeCount} shapes, server had ${oldShapeCount}. Records were updated. Merge complete (final: ${finalShapeCount})`)
        // Persist if records were updated
        console.log(`📤 Triggering R2 persistence due to record updates`)
        this.schedulePersistToR2()
      } else {
        console.log(`ℹ️ Client sent ${newShapeCount} shapes, server had ${oldShapeCount}. No changes detected, skipping persistence.`)
      }
    } else {
      // New shapes or other changes - always persist
      console.log(`📊 Document updated: scheduling persistence (old: ${oldShapeCount}, new: ${newShapeCount}, final: ${finalShapeCount})`)
      console.log(`📤 Triggering R2 persistence for new shapes/changes`)
      this.schedulePersistToR2()
    }
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
    
    // Count shapes after migration
    const shapeCount = Object.values(newDoc.store).filter((r: any) => r?.typeName === 'shape').length
    
    console.log(`📊 Documents to Store migration statistics:`, {
      total: migrationStats.total,
      converted: migrationStats.converted,
      skipped: migrationStats.skipped,
      errors: migrationStats.errors,
      storeKeys: Object.keys(newDoc.store).length,
      recordTypes: migrationStats.recordTypes,
      shapeCount: shapeCount,
      customRecordCount: migrationStats.customRecords.length,
      customRecordIds: migrationStats.customRecords.slice(0, 10),
      errorCount: migrationStats.errorDetails.length
    })
    
    // CRITICAL: Log if shapes are missing after migration
    if (shapeCount === 0 && migrationStats.recordTypes['shape'] === undefined) {
      console.warn(`⚠️ Migration completed but NO shapes found! This might indicate old format didn't have shapes or they were filtered out.`)
    } else if (migrationStats.recordTypes['shape'] && shapeCount !== migrationStats.recordTypes['shape']) {
      console.warn(`⚠️ Shape count mismatch: Expected ${migrationStats.recordTypes['shape']} shapes but found ${shapeCount} after migration`)
    } else if (shapeCount > 0) {
      console.log(`✅ Migration successfully converted ${shapeCount} shapes from old format to new format`)
    }
    
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
        const customShapeTypes = ['ObsNote', 'Holon', 'FathomMeetingsBrowser', 'FathomNote', 'HolonBrowser', 'LocationShare', 'ObsidianBrowser']
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
          // CRITICAL: Check for undefined, null, or non-number values (including NaN)
          if (record.x === undefined || record.x === null || typeof record.x !== 'number' || isNaN(record.x)) {
            record.x = 0
            needsUpdate = true
          }
          if (record.y === undefined || record.y === null || typeof record.y !== 'number' || isNaN(record.y)) {
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
          // Validate and fix index property - must be a valid IndexKey (like 'a1', 'a2', etc.)
          if (!record.index || typeof record.index !== 'string' || !/^[a-z]\d+$/.test(record.index)) {
            record.index = 'a1' // Required index property for all shapes - must be valid IndexKey format
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
          
          // Special handling for text shapes - ensure required properties exist
          if (record.type === 'text') {
            if (!record.props || typeof record.props !== 'object') {
              record.props = {}
              needsUpdate = true
            }
            
            // CRITICAL: color is REQUIRED for text shapes and must be a valid color value
            const validColors = ['black', 'grey', 'light-violet', 'violet', 'blue', 'light-blue', 'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white']
            if (!record.props.color || typeof record.props.color !== 'string' || !validColors.includes(record.props.color)) {
              record.props.color = 'black'
              needsUpdate = true
            }
            
            // Ensure other required text shape properties have defaults
            if (typeof record.props.w !== 'number') {
              record.props.w = 300
              needsUpdate = true
            }
            if (!record.props.size || typeof record.props.size !== 'string') {
              record.props.size = 'm'
              needsUpdate = true
            }
            if (!record.props.font || typeof record.props.font !== 'string') {
              record.props.font = 'draw'
              needsUpdate = true
            }
            if (!record.props.textAlign || typeof record.props.textAlign !== 'string') {
              record.props.textAlign = 'start'
              needsUpdate = true
            }
            if (typeof record.props.autoSize !== 'boolean') {
              record.props.autoSize = false
              needsUpdate = true
            }
            if (typeof record.props.scale !== 'number') {
              record.props.scale = 1
              needsUpdate = true
            }
            
            // Ensure richText structure is correct
            if (record.props.richText) {
              if (Array.isArray(record.props.richText)) {
                record.props.richText = { content: record.props.richText, type: 'doc' }
                needsUpdate = true
              } else if (typeof record.props.richText === 'object' && record.props.richText !== null) {
                if (!record.props.richText.type) {
                  record.props.richText = { ...record.props.richText, type: 'doc' }
                  needsUpdate = true
                }
                if (!record.props.richText.content) {
                  record.props.richText = { ...record.props.richText, content: [] }
                  needsUpdate = true
                }
              }
            }
            
            // Remove invalid properties for text shapes (these cause validation errors)
            // Remove properties that are only valid for custom shapes, not standard TLDraw text shapes
            const invalidTextProps = ['h', 'geo', 'text', 'isEditing', 'editingContent', 'isTranscribing', 'isPaused', 'fixedHeight', 'pinnedToView', 'isModified', 'originalContent', 'editingName', 'editingDescription', 'isConnected', 'holonId', 'noteId', 'title', 'content', 'tags', 'showPreview', 'backgroundColor', 'textColor']
            invalidTextProps.forEach(prop => {
              if (prop in record.props) {
                delete record.props[prop]
                needsUpdate = true
              }
            })
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
    console.log(`📤 schedulePersistToR2 called for room ${this.roomId}`)
    
    if (!this.roomId || !this.currentDoc) {
      console.log(`⚠️ Cannot persist to R2: roomId=${this.roomId}, currentDoc=${!!this.currentDoc}`)
      return
    }
    
    // CRITICAL: Load current R2 state and merge with this.currentDoc before saving
    // This ensures we never overwrite old shapes that might be in R2 but not in currentDoc
    let mergedDoc = { ...this.currentDoc }
    let r2ShapeCount = 0
    let mergedShapeCount = 0
    
    try {
      // OPTIMIZATION: Only reload R2 if we don't have a cached version or if it might have changed
      // Since currentDoc is authoritative (includes deletions), we can skip R2 merge in most cases
      // Only merge if we suspect there might be data in R2 that's not in currentDoc
      let r2Doc: any = null
      
      // Check if we need to reload R2 (only if cache is invalid or missing)
      if (!this.cachedR2Doc) {
        const docFromBucket = await this.r2.get(`rooms/${this.roomId}`)
        if (docFromBucket) {
          try {
            r2Doc = await docFromBucket.json() as any
            // Cache the R2 document
            this.cachedR2Doc = r2Doc
            this.cachedR2Hash = this.generateDocHash(r2Doc)
          } catch (r2ParseError) {
            console.warn(`⚠️ Error parsing R2 document, using current document:`, r2ParseError)
            r2Doc = null
          }
        }
      } else {
        // Use cached R2 document
        r2Doc = this.cachedR2Doc
      }
      
      if (r2Doc) {
        r2ShapeCount = r2Doc.store ? 
          Object.values(r2Doc.store).filter((r: any) => r?.typeName === 'shape').length : 0
        
        // CRITICAL: Use currentDoc as the source of truth (has the latest state including deletions)
        // Don't merge in old records from R2 - currentDoc is authoritative
        mergedDoc = { ...this.currentDoc }
        mergedDoc.store = { ...this.currentDoc.store }
        
        // Update schema from currentDoc if it exists
        if (this.currentDoc.schema) {
          mergedDoc.schema = this.currentDoc.schema
        }
        
        mergedShapeCount = Object.values(mergedDoc.store).filter((r: any) => r?.typeName === 'shape').length
        
        // Only log merge details if there's a significant difference
        if (Math.abs(mergedShapeCount - r2ShapeCount) > 0) {
          const mergedShapeTypeCounts = Object.values(mergedDoc.store)
            .filter((r: any) => r?.typeName === 'shape')
            .reduce((acc: any, r: any) => {
              const type = r?.type || 'unknown'
              acc[type] = (acc[type] || 0) + 1
              return acc
            }, {})
          
          console.log(`🔀 Merging R2 state with current state before persistence:`, {
            r2Shapes: r2ShapeCount,
            currentShapes: this.currentDoc.store ? Object.values(this.currentDoc.store).filter((r: any) => r?.typeName === 'shape').length : 0,
            mergedShapes: mergedShapeCount,
            r2Records: Object.keys(r2Doc.store || {}).length,
            currentRecords: Object.keys(this.currentDoc.store || {}).length,
            mergedRecords: Object.keys(mergedDoc.store || {}).length
          })
          console.log(`🔀 Merged shape type breakdown:`, mergedShapeTypeCounts)
          
          // Log merge results
          if (mergedShapeCount < r2ShapeCount) {
            // This is expected when shapes are deleted - currentDoc has fewer shapes than R2
            console.log(`✅ Merged document has ${r2ShapeCount - mergedShapeCount} fewer shapes than R2 (deletions preserved)`)
          } else if (mergedShapeCount > r2ShapeCount) {
            console.log(`✅ Merged document has ${mergedShapeCount - r2ShapeCount} new shapes added to R2's ${r2ShapeCount} shapes`)
          }
        }
      } else {
        // No R2 document exists yet - use currentDoc
        mergedDoc = this.currentDoc
        mergedShapeCount = this.currentDoc.store ? Object.values(this.currentDoc.store).filter((r: any) => r?.typeName === 'shape').length : 0
        console.log(`ℹ️ No existing R2 document, using current document (${mergedShapeCount} shapes)`)
      }
    } catch (r2LoadError) {
      // If R2 load fails, use currentDoc (better than losing data)
      console.warn(`⚠️ Error loading from R2, using current document:`, r2LoadError)
      mergedDoc = this.currentDoc
      mergedShapeCount = this.currentDoc.store ? Object.values(this.currentDoc.store).filter((r: any) => r?.typeName === 'shape').length : 0
      // Clear cache on error
      this.cachedR2Doc = null
      this.cachedR2Hash = null
    }
    
    // Generate hash of merged document state
    const currentHash = this.generateDocHash(mergedDoc)
    
    console.log(`🔍 Server checking R2 persistence for room ${this.roomId}:`, {
      currentHash: currentHash.substring(0, 8) + '...',
      lastHash: this.lastPersistedHash ? this.lastPersistedHash.substring(0, 8) + '...' : 'none',
      hasStore: !!mergedDoc.store,
      storeKeys: mergedDoc.store ? Object.keys(mergedDoc.store).length : 0,
      shapeCount: mergedShapeCount,
      hashesMatch: currentHash === this.lastPersistedHash
    })
    
    // Skip persistence if document hasn't changed
    if (currentHash === this.lastPersistedHash) {
      console.log(`⏭️ Skipping R2 persistence for room ${this.roomId} - no changes detected (hash matches)`)
      return
    }
    
    console.log(`💾 Attempting to persist room ${this.roomId} to R2...`)
    
    try {
      // Update currentDoc to the merged version
      this.currentDoc = mergedDoc
      
      // OPTIMIZED: Serialize efficiently - R2 handles large payloads well, but we can optimize
      // For very large documents, consider compression or chunking in the future
      const docJson = JSON.stringify(mergedDoc)
      const docSize = docJson.length
      
      console.log(`💾 Uploading to R2: ${docSize} bytes, ${mergedShapeCount} shapes`)
      
      const putResult = await this.r2.put(`rooms/${this.roomId}`, docJson, {
        httpMetadata: {
          contentType: 'application/json'
        }
      })
      
      // Track shape types in final persisted document
      const persistedShapeTypeCounts = Object.values(mergedDoc.store || {})
        .filter((r: any) => r?.typeName === 'shape')
        .reduce((acc: any, r: any) => {
          const type = r?.type || 'unknown'
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {})
      
      // Update last persisted hash only after successful save
      this.lastPersistedHash = currentHash
      // Update cached R2 document to match what we just saved
      this.cachedR2Doc = mergedDoc
      this.cachedR2Hash = currentHash
      console.log(`✅ Successfully persisted room ${this.roomId} to R2 (merged):`, {
        storeKeys: mergedDoc.store ? Object.keys(mergedDoc.store).length : 0,
        shapeCount: mergedShapeCount,
        docSize: docSize,
        preservedR2Shapes: r2ShapeCount > 0 ? `${r2ShapeCount} from R2` : 'none',
        r2PutResult: putResult ? 'success' : 'unknown'
      })
      console.log(`✅ Persisted shape type breakdown:`, persistedShapeTypeCounts)
    } catch (error) {
      // Enhanced error logging for R2 persistence failures
      const errorDetails = {
        roomId: this.roomId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack : undefined,
        shapeCount: mergedShapeCount,
        storeKeys: mergedDoc.store ? Object.keys(mergedDoc.store).length : 0,
        docSize: mergedDoc.store ? JSON.stringify(mergedDoc).length : 0
      }
      console.error(`❌ Error persisting room ${this.roomId} to R2:`, errorDetails)
      console.error(`❌ Full error object:`, error)
    }
  }, 2_000)

  // Handle request-document-state message from worker
  // This allows the worker to request current document state from clients for persistence
  private async handleDocumentStateRequest(sessionId: string) {
    // When worker requests document state, we'll respond via the existing POST endpoint
    // Clients should periodically send their document state, so this is mainly for logging
    console.log(`📡 Worker: Document state requested from ${sessionId} (clients should send via POST /room/:roomId)`)
  }
}
