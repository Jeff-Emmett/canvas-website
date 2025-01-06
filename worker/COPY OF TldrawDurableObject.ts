/// <reference types="@cloudflare/workers-types" />

import { RoomSnapshot, TLSocketRoom } from "@tldraw/sync-core"
import {
  TLRecord,
  TLShape,
  TLStoreSnapshot,
  createTLSchema,
  defaultBindingSchemas,
  defaultShapeSchemas,
} from "@tldraw/tlschema"
import { AutoRouter, IRequest, error } from "itty-router"
import throttle from "lodash.throttle"
import { Environment } from "./types"
import { ChatBoxShape } from "@/shapes/ChatBoxShapeUtil"
import { VideoChatShape } from "@/shapes/VideoChatShapeUtil"
import { EmbedShape } from "@/shapes/EmbedShapeUtil"
import { MarkdownShape } from "@/shapes/MarkdownShapeUtil"
import { MycrozineTemplateShape } from "@/shapes/MycrozineTemplateShapeUtil"
import { WORKER_URL } from "@/routes/Board"

// Add after the imports
interface BoardVersion {
  timestamp: number
  snapshot: RoomSnapshot
  version: number
  dateKey: string
}

// add custom shapes and bindings here if needed:
export const customSchema = createTLSchema({
  shapes: {
    ...defaultShapeSchemas,
    ChatBox: {
      props: ChatBoxShape.props,
      migrations: ChatBoxShape.migrations,
    },
    VideoChat: {
      props: VideoChatShape.props,
      migrations: VideoChatShape.migrations,
    },
    Embed: {
      props: EmbedShape.props,
      migrations: EmbedShape.migrations,
    },
    Markdown: {
      props: MarkdownShape.props,
      migrations: MarkdownShape.migrations,
    },
    MycrozineTemplate: {
      props: MycrozineTemplateShape.props,
      migrations: MycrozineTemplateShape.migrations,
    },
  },
  bindings: defaultBindingSchemas,
})

// each whiteboard room is hosted in a DurableObject:
// https://developers.cloudflare.com/durable-objects/

// there's only ever one durable object instance per room. it keeps all the room state in memory and
// handles websocket connections. periodically, it persists the room state to the R2 bucket.
export class TldrawDurableObject {
  private r2: R2Bucket
  private backupR2: R2Bucket
  private roomId: string | null = null
  private roomPromise: Promise<TLSocketRoom<TLRecord, void>> | null = null
  private room: TLSocketRoom<TLRecord, void> | null = null
  private lastBackupDate: string | null = null
  private readonly MAX_VERSIONS = 31
  private readonly env: Environment
  private readonly BACKUP_INTERVAL: number
  private readonly schedulePersistToR2: ReturnType<typeof throttle>
  

  constructor(private readonly ctx: DurableObjectState, env: Environment) {
    if (!ctx) {
        console.error('[Debug] DurableObjectState is undefined!')
        throw new Error('DurableObjectState is required')
    }
    if (!env) {
        console.error('[Debug] Environment is undefined!')
        throw new Error('Environment is required')
    }

    // Initialize all class properties explicitly
    this.env = env
    this.roomId = null
    this.roomPromise = null
    this.room = null
    this.lastBackupDate = null
    this.BACKUP_INTERVAL = this.env?.DEV === true
      ? 10 * 1000  // 10 seconds in development
      : 24 * 60 * 60 * 1000 // 24 hours in production

    console.log('[Debug] Initializing TldrawDurableObject:', {
        hasContext: !!this,
        hasState: !!ctx,
        ctxId: ctx.id,
        hasEnv: !!env,
        envKeys: Object.keys(env),
        thisKeys: Object.keys(this)
    })

    // Verify R2 buckets
    if (!env.TLDRAW_BUCKET) {
        console.error('[Debug] TLDRAW_BUCKET is undefined!')
        throw new Error('TLDRAW_BUCKET is required')
    }
    if (!env.TLDRAW_BACKUP_BUCKET) {
        console.error('[Debug] TLDRAW_BACKUP_BUCKET is undefined!')
        throw new Error('TLDRAW_BACKUP_BUCKET is required')
    }

    this.r2 = env.TLDRAW_BUCKET
    this.backupR2 = env.TLDRAW_BACKUP_BUCKET

    // Verify buckets were assigned
    console.log('[Debug] Bucket initialization:', {
        hasMainBucket: !!this.r2,
        hasBackupBucket: !!this.backupR2,
        mainBucketMethods: Object.keys(this.r2 || {}),
        backupBucketMethods: Object.keys(this.backupR2 || {})
    })

    // Add more detailed logging
    console.log('[Debug] Environment:', {
      TLDRAW_BUCKET: !!env.TLDRAW_BUCKET,
      TLDRAW_BACKUP_BUCKET: !!env.TLDRAW_BACKUP_BUCKET,
      envKeys: Object.keys(env)
    })
    
    console.log('[Debug] Using buckets:', {
      main: this.r2.get(`rooms/${this.roomId}`) || 'undefined',
      backup: this.backupR2.get(`rooms/${this.roomId}`) || 'undefined'
    })

    // Add more detailed logging for storage initialization
    ctx.blockConcurrencyWhile(async () => {
      try {
        console.log('[Debug] Attempting to load roomId from storage...')
        console.log('[Debug] this.ctx.storage:', this.ctx.storage.get)
        console.log('[Debug] ctx.storage.get:', ctx.storage.get)
        console.log('[Debug] this.ctx.storage.get<string>("roomId"):', this.ctx.storage.get<string>("roomId"))
        const storedRoomId = await ctx.storage.get<string>("roomId")
        console.log('[Debug] Loaded roomId from storage:', storedRoomId)
        
        if (storedRoomId) {
          this.roomId = storedRoomId
          console.log('[Debug] Successfully set roomId:', this.roomId)
        } else {
          console.log('[Debug] No roomId found in storage')
        }
      } catch (error) {
        console.error('[Debug] Error loading roomId from storage:', error)
        throw error // Re-throw to ensure we know if there's a storage issue
      }
    }).catch(error => {
      console.error('[Debug] Failed to initialize storage:', error)
    })

    // this.BACKUP_INTERVAL = this.env?.DEV === true
    //   ? 10 * 1000  // 10 seconds in development
    //   : 24 * 60 * 60 * 1000 // 24 hours in production

    this.schedulePersistToR2 = throttle(async () => {
      if (!this.room || !this.roomId) {
        console.log('[Backup] No room available for backup')
        return
      }

      try {
        console.log(`[Backup] Starting backup process for room ${this.roomId}...`)
        const snapshot = this.room.getCurrentSnapshot()
        
        // Update current version in main bucket
        await this.r2.put(
          `rooms/${this.roomId}`, 
          JSON.stringify(snapshot)
        ).catch(err => {
          console.error(`[Backup] Failed to update main bucket:`, err)
        })

      // Check if today's backup already exists
      const today = new Date().toISOString().split('T')[0]
      const backupKey = `backups/${this.roomId}/${today}`
      console.log(`[Backup] Checking for existing backup at key: ${backupKey}`)
      const existingBackup = await this.backupR2.get(backupKey)

        // Create daily backup if needed
        if (!existingBackup || this.lastBackupDate !== today) {
          console.log(`[Backup] Creating new daily backup for ${today}`)
          
          // Get all assets for this room
          const assetsPrefix = `uploads/${this.roomId}/`
          const assets = await this.r2.list({ prefix: assetsPrefix })
          const assetData: { [key: string]: string } = {}

          // Fetch and store each asset
          for (const asset of assets.objects) {
            const assetContent = await this.r2.get(asset.key)
            if (assetContent) {
              const assetBuffer = await assetContent.arrayBuffer()
              const base64Data = Buffer.from(assetBuffer).toString('base64')
              assetData[asset.key] = base64Data
            }
          }

          const version = {
            timestamp: Date.now(),
            snapshot,
            dateKey: today,
            version: 0,
            assets: assetData
          }

          //TO DO: FIX DAILY BACKUP INTO CLOUDFLARE R2 BACKUPS BUCKET
          await this.backupR2.put(backupKey, JSON.stringify(version))
          console.log(`[Backup] ✅ Successfully saved daily backup with ${Object.keys(assetData).length} assets to: ${backupKey}`)

          this.lastBackupDate = today
        }
      } catch (error) {
        console.error('[Backup] Error during backup:', error)
      }
    }, this.BACKUP_INTERVAL, { leading: false, trailing: true })
  }

  private readonly router = AutoRouter({
    catch: (e) => {
      console.log(e)
      return error(e)
    },
  })
    // when we get a connection request, we stash the room id if needed and handle the connection
    .get("/connect/:roomId", async (request) => {
      try {
        await this.ensureRoomId(request.params.roomId)
        return this.handleConnect(request)
      } catch (error) {
        console.error('[Debug] Connection error:', error)
        return new Response((error as Error).message, { status: 400 })
      }
    })
    .get("/room/:roomId", async (request) => {
      // Directly fetch from jeffemmett-canvas bucket first
      const currentState = await this.r2.get(`rooms/${request.params.roomId}`)
      console.log('[Debug] Loading board state from jeffemmett-canvas:', currentState ? 'found' : 'not found')
      
      if (currentState) {
        const snapshot = await currentState.json() as RoomSnapshot
        console.log('[Debug] Loaded snapshot with', snapshot.documents.length, 'documents')
        return new Response(JSON.stringify(snapshot.documents), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
          },
        })
      }

      // Fallback to empty state
      console.log('[Debug] No existing board state found, returning empty array')
      return new Response(JSON.stringify([]), {
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
      const records = (await request.json()) as TLRecord[]

      return new Response(JSON.stringify(Array.from(records)), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      })
    })
    .get("/room/:roomId/versions", async () => {
      if (!this.roomId) {
        return new Response("Room not initialized", { status: 400 })
      }

      const prefix = `backups/${this.roomId}/`
      const objects = await this.backupR2.list({ prefix })
      const versions = objects.objects
        .map(obj => {
          const dateKey = obj.key.split('/').pop() || ''
          return {
            timestamp: obj.uploaded.getTime(),
            dateKey,
            version: 0
          }
        })
        .sort((a, b) => b.timestamp - a.timestamp)

      return new Response(JSON.stringify(versions), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      })
    })
    .post("/room/:roomId/restore/:dateKey", async (request) => {
      if (!this.roomId) {
        return new Response("Room not initialized", { status: 400 })
      }

      try {
        const version = await this.restoreVersion(request.params.dateKey)
        return new Response(JSON.stringify(version), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        })
      } catch (error) {
        return new Response(
          JSON.stringify({ error: (error as Error).message }), 
          { 
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          }
        )
      }
    })
    .get("/debug/backup", async (_request) => {
      console.log('[Debug] Listing all rooms in backup bucket...')
      const objects = await this.backupR2.list()
      
      // Group objects by room ID
      const rooms = objects.objects.reduce((acc, obj) => {
        const roomId = obj.key.split('/')[0]
        if (!acc[roomId]) {
          acc[roomId] = []
        }
        acc[roomId].push({
          key: obj.key,
          uploaded: obj.uploaded,
          size: obj.size
        })
        return acc
      }, {} as Record<string, any[]>)

      console.log('[Debug] Found rooms:', rooms)
      
      return new Response(JSON.stringify(rooms, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      })
    })
    .get("/debug/bucket", async () => {
      console.log('[Debug] Listing all objects in bucket:', this.env.TLDRAW_BUCKET_NAME)
      const objects = await this.r2.list()
      
      console.log('[Debug] Found', objects.objects.length, 'objects')
      objects.objects.forEach(obj => {
        console.log('[Debug] Object:', {
          key: obj.key,
          size: `${(obj.size / 1024).toFixed(2)} KB`,
          uploaded: obj.uploaded.toISOString()
        })
      })
      
      return new Response(JSON.stringify({
        bucket: this.env.TLDRAW_BUCKET_NAME,
        objects: objects.objects.map(obj => ({
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded
        }))
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      })
    })
    .get("/debug/sync-from-prod", async () => {
      console.log('[Debug] Starting production sync...')
      
      try {
        // List objects directly from production bucket
        const objects = await this.r2.list()
        console.log('[Debug] Path:', WORKER_URL + '/rooms/' + this.roomId)
        console.log('[Debug] Found', objects.objects.length, 'rooms in production')

        // Copy each room to local bucket
        let syncedCount = 0
        for (const obj of objects.objects) {
          // Get the room data directly from production bucket
          const roomData = await this.r2.get(obj.key)
          if (!roomData) {
            console.error(`Failed to fetch room data for ${obj.key}`)
            continue
          }

          // Store in local bucket
          await this.r2.put(obj.key, roomData.body)
          syncedCount++
          console.log(`[Debug] Synced room: ${obj.key}`)
        }

        return new Response(JSON.stringify({
          message: 'Sync complete',
          totalRooms: objects.objects.length,
          syncedRooms: syncedCount
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        })
      } catch (error) {
        console.error('[Debug] Sync error:', error)
        return new Response(JSON.stringify({
          error: 'Sync failed',
          message: (error as Error).message
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        })
      }
    })

  // `fetch` is the entry point for all requests to the Durable Object
  fetch(request: Request): Response | Promise<Response> {
    console.log('[Debug] Incoming request:', request.url, request.method)
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
    console.log('[Worker] handleConnect called')
    
    const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair()
    
    try {
      console.log('[Worker] Accepting WebSocket connection')
      serverWebSocket.accept()

      const room = await this.getRoom()
      console.log('[Debug] Room obtained, connecting socket')

      // Handle socket connection with proper error boundaries
      room.handleSocketConnect({
        sessionId: request.query.sessionId as string,
        socket: {
          send: (data: string) => {
          //  console.log('[WebSocket] Sending:', data.slice(0, 100) + '...')
            try {
              serverWebSocket.send(data)
            } catch (err) {
              console.error('[WebSocket] Send error:', err)
            }
          },
          close: () => {
            try {
              serverWebSocket.close()
            } catch (err) {
              console.error('[WebSocket] Close error:', err)
            }
          },
          addEventListener: serverWebSocket.addEventListener.bind(serverWebSocket),
          removeEventListener: serverWebSocket.removeEventListener.bind(serverWebSocket),
          readyState: serverWebSocket.readyState,
        },
      })

      console.log('[Debug] WebSocket connection established successfully')
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
      console.error("[Debug] WebSocket connection error:", error)
      serverWebSocket.close(1011, "Failed to initialize connection")
      return new Response("Failed to establish WebSocket connection", {
        status: 500,
      })
    }
  }

  async getRoom() {
    const roomId = this.roomId
    console.log('[Debug] Getting room:', roomId)
    console.log('[Debug] R2 bucket instance:', {
      exists: !!this.r2
    })
    if (!roomId) throw new Error("Missing roomId")

    if (!this.roomPromise) {
      console.log('[Debug] Creating new room promise')
      this.roomPromise = (async () => {
        // First, list all objects to see what's actually in the bucket
        const allObjects = await this.r2.list({ prefix: 'rooms/' })
        console.log('[Debug] Current bucket contents:', 
          allObjects.objects.map(obj => ({
            key: obj.key,
            size: obj.size
          }))
        )

        const path = `rooms/${this.roomId}`
        console.log('[Debug] Attempting to fetch from path:', path)
        
        const roomFromBucket = await this.r2.get(path)
        console.log('[Debug] Room fetch result:', {
          exists: !!roomFromBucket,
          size: roomFromBucket?.size,
          etag: roomFromBucket?.etag,
          path: path,
          bucket: this.r2 ? 'initialized' : 'undefined'
        })
        
        // Add this to see the actual content if it exists
        if (roomFromBucket) {
          const content = await roomFromBucket.text()
          console.log('[Debug] Room content preview:', content.slice(0, 100))
        }
        
        // if it doesn't exist, we'll just create a new empty room
        const initialSnapshot = roomFromBucket
          ? ((await roomFromBucket.json()) as RoomSnapshot)
          : undefined

        // Create the room and store it in this.room for direct access
        const room = new TLSocketRoom<TLRecord, void>({
          schema: customSchema,
          initialSnapshot,
          onDataChange: async () => {
            console.log('[Backup] Data change detected in room:', this.roomId)
            if (!this.lastBackupDate) {
              console.log('[Backup] First change detected, forcing immediate backup')
              await this.schedulePersistToR2.flush()
            }
            this.schedulePersistToR2()
          },
        })
        
        console.log('[Debug] Room created with snapshot:', initialSnapshot ? 'yes' : 'no')
        this.room = room
        return room
      })()
    }

    return this.roomPromise
  }

  // Comment out the duplicate function
  /*
  schedulePersistToR2 = throttle(async () => {
    if (!this.room || !this.roomId) {
      console.log('[Backup] No room available for backup')
      return
    }

    try {
      console.log(`[Backup] Starting backup process for room ${this.roomId}...`)
      const snapshot = this.room.getCurrentSnapshot()
      
      // Update current version in main bucket
      await this.r2.put(
        `rooms/${this.roomId}`, 
        JSON.stringify(snapshot)
      ).catch(err => {
        console.error(`[Backup] Failed to update main bucket:`, err)
      })

      // Check if today's backup already exists
      const today = new Date().toISOString().split('T')[0]
      const backupKey = `backups/${this.roomId}/${today}`
      console.log(`[Backup] Checking for existing backup at key: ${backupKey}`)
      const existingBackup = await this.backupR2.get(backupKey)

      // Create daily backup if needed
      if (!existingBackup || this.lastBackupDate !== today) {
        console.log(`[Backup] Creating new daily backup for ${today}`)
        
        // Get all assets for this room
        const assetsPrefix = `uploads/${this.roomId}/`
        const assets = await this.r2.list({ prefix: assetsPrefix })
        const assetData: { [key: string]: string } = {}

        // Fetch and store each asset
        for (const asset of assets.objects) {
          const assetContent = await this.r2.get(asset.key)
          if (assetContent) {
            const assetBuffer = await assetContent.arrayBuffer()
            const base64Data = Buffer.from(assetBuffer).toString('base64')
            assetData[asset.key] = base64Data
          }
        }

        const version = {
          timestamp: Date.now(),
          snapshot,
          dateKey: today,
          version: 0,
          assets: assetData
        }

        await this.backupR2.put(backupKey, JSON.stringify(version))
        console.log(`[Backup] ✅ Successfully saved daily backup with ${Object.keys(assetData).length} assets to: ${backupKey}`)

        this.lastBackupDate = today
      }
    } catch (error) {
      console.error('[Backup] Error during backup:', error)
    }
  }, this.BACKUP_INTERVAL)
  */

  // Modified scheduleBackupToR2 method
  scheduleBackupToR2 = throttle(async () => {
    if (!this.room || !this.roomId) return

    // Get current snapshot using TLSocketRoom's method
    const snapshot = this.room.getCurrentSnapshot()
    
    // Always update current version
    await this.r2.put(
      `rooms/${this.roomId}`, 
      JSON.stringify(snapshot)
    )

    // Check if we should create a daily backup
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    if (this.lastBackupDate !== today) {
      // Create version object with date info
      const version: BoardVersion = {
        timestamp: Date.now(),
        snapshot,
        version: 0,
        dateKey: today
      }

      // Store versioned backup with date in key
      await this.backupR2.put(
        `backups/${this.roomId}/${today}`, 
        JSON.stringify(version)
      )

      this.lastBackupDate = today

      // Clean up old versions
      //await this.cleanupOldVersions()
    }
  }, this.BACKUP_INTERVAL )

  // Modified method to restore specific version
  async restoreVersion(dateKey: string) {
    const versionKey = `backups/${this.roomId}/${dateKey}`
    console.log(`[Restore] Attempting to restore version from ${this.backupR2} at key: ${versionKey}`)
    const versionObj = await this.backupR2.get(versionKey)
    
    if (!versionObj) {
      console.error(`[Restore] Version not found in ${this.backupR2}`)
      throw new Error('Version not found')
    }

    console.log(`[Restore] Found version in ${this.backupR2}, restoring...`)
    const version = JSON.parse(await versionObj.text()) as BoardVersion & { assets?: { [key: string]: string } }
    
    // Restore assets if they exist
    if (version.assets) {
      console.log(`[Restore] Restoring ${Object.keys(version.assets).length} assets to ${this.r2}...`)
      for (const [key, base64Data] of Object.entries(version.assets)) {
        const binaryData = Buffer.from(base64Data, 'base64')
        await this.r2.put(key, binaryData)
        console.log(`[Restore] Asset restored: ${key}`)
      }
    }

    if (!this.room) {
      this.room = new TLSocketRoom({
        schema: customSchema,
        initialSnapshot: version.snapshot,
        onDataChange: () => {
          console.log('[Backup] Data change detected, triggering backup...')
          this.schedulePersistToR2()
        },
      })
    } else {
      this.room.loadSnapshot(version.snapshot)
    }
    
    await this.r2.put(
      `rooms/${this.roomId}`,
      JSON.stringify(version.snapshot)
    )
    
    return version
  }

  // Add method to initialize room from snapshot
  private async initializeRoom(snapshot?: TLStoreSnapshot) {
    this.room = new TLSocketRoom({
      schema: customSchema,
      initialSnapshot: snapshot,
      onDataChange: () => {
        this.schedulePersistToR2()
      },
    })
  }

  // Modified method to handle WebSocket connections
  async handleWebSocket(webSocket: WebSocket) {
    if (!this.room) {
      const current = await this.r2.get(`rooms/${this.roomId}`)
      if (current) {
        const snapshot = JSON.parse(await current.text()) as TLStoreSnapshot
        await this.initializeRoom(snapshot)
      } else {
        await this.initializeRoom()
      }
    }

    this.room?.handleSocketConnect({
      sessionId: crypto.randomUUID(),
      socket: {
        send: webSocket.send.bind(webSocket),
        close: webSocket.close.bind(webSocket),
        addEventListener: webSocket.addEventListener.bind(webSocket),
        removeEventListener: webSocket.removeEventListener.bind(webSocket),
        readyState: webSocket.readyState,
      },
    })
  }

  //TODO: TURN ON OLD VERSION CLEANUP AT SOME POINT

  // private async cleanupOldVersions() {
  //   if (!this.roomId) return
    
  //   const prefix = `${this.roomId}/`
  //   const objects = await this.backupR2.list({ prefix })
  //   const versions = objects.objects
  //     .sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
    
  //   // Delete versions beyond MAX_VERSIONS
  //   for (let i = this.MAX_VERSIONS; i < versions.length; i++) {
  //     await this.backupR2.delete(versions[i].key)
  //   }
  // }

  // Modify the connect handler to ensure roomId is set
  private async ensureRoomId(requestRoomId: string): Promise<void> {
    if (!this.roomId) {
      await this.ctx.blockConcurrencyWhile(async () => {
        // Double-check inside the critical section
        if (!this.roomId) {
          await this.ctx.storage.put("roomId", requestRoomId)
          this.roomId = requestRoomId
          console.log('[Debug] Set new roomId:', this.roomId)
        }
      })
    } else if (this.roomId !== requestRoomId) {
      throw new Error(`Room ID mismatch: expected ${this.roomId}, got ${requestRoomId}`)
    }
  }
}
