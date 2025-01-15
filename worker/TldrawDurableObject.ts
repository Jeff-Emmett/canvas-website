/// <reference types="@cloudflare/workers-types" />

import { RoomSnapshot, TLSocketRoom } from "@tldraw/sync-core"
import {
  TLRecord,
  TLShape,
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
  private backupsR2: R2Bucket
  private lastBackupDate: string | null = null
  // the room ID will be missing whilst the room is being initialized
  private roomId: string | null = null
  // when we load the room from the R2 bucket, we keep it here. it's a promise so we only ever
  // load it once.
  private roomPromise: Promise<TLSocketRoom<TLRecord, void>> | null = null
  private isDevelopment: boolean
  // Modify to use a more strict throttle with a flag to prevent multiple calls
  private isPersisting = false

  constructor(private readonly ctx: DurableObjectState, env: Environment) {
    this.r2 = env.TLDRAW_BUCKET
    this.backupsR2 = env.TLDRAW_BACKUPS_BUCKET
    this.isDevelopment = env.IS_DEVELOPMENT

    ctx.blockConcurrencyWhile(async () => {
      this.roomId = ((await this.ctx.storage.get("roomId")) ?? null) as
        | string
        | null
      this.lastBackupDate = ((await this.ctx.storage.get("lastBackupDate")) ?? null) as
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
      const room = await this.getRoom()
      const snapshot = room.getCurrentSnapshot()
      return new Response(JSON.stringify(snapshot.documents), {
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
      console.log('POST /room/:roomId called')
      const records = (await request.json()) as TLRecord[]
      console.log('Received records:', records)

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
    .get("/test-logs", () => {
      console.log("Test endpoint hit")
      return new Response("Test endpoint hit")
    })

  // `fetch` is the entry point for all requests to the Durable Object
  fetch(request: Request): Response | Promise<Response> {
    try {
      console.log('DO fetch called:', request.url, request.method)
      
      // Handle CORS preflight requests
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, UPGRADE',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Upgrade, Connection',
            'Access-Control-Max-Age': '86400',
            'Access-Control-Allow-Credentials': 'true',
          },
        })
      }
      
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
        }
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

    // Check if this is a websocket upgrade request
    const upgradeHeader = request.headers.get("Upgrade")
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected Upgrade: websocket", { 
        status: 426,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS, UPGRADE",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Credentials": "true",
          "Upgrade": "websocket"
        }
      })
    }

    // Create WebSocket pair and handle connection
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    try {
      server.accept()
      console.log(`Connected to room: ${this.roomId}, session: ${sessionId}`)
      
      const room = await this.getRoom()

      // Add error handling for the websocket
      server.addEventListener('error', (error) => {
        console.error(`WebSocket error in room ${this.roomId}, session ${sessionId}:`, error)
      })

      // Handle close event
      server.addEventListener('close', async () => {
        console.log(`Disconnected from room: ${this.roomId}, session: ${sessionId}`)
        if (this.roomPromise) {
          try {
            const room = await this.getRoom()
            if (room) {
              await this.schedulePersistToR2()
            }
          } catch (error) {
            console.error(`Failed to persist data on disconnect for room ${this.roomId}:`, error)
          }
        }
      })

      // Handle message event
      server.addEventListener('message', async (event) => {
        try {
          if (typeof event.data === 'string') {
            const data = JSON.parse(event.data)
            //console.log('Received message:', data)
          }
        } catch (error) {
          console.error('Error handling message:', error)
        }
      })

      room.handleSocketConnect({
        sessionId,
        socket: {
          send: (data: string) => {
            try {
              if (server.readyState === WebSocket.OPEN) {
                server.send(data)
              }
            } catch (error) {
              console.error(`Failed to send websocket data in room ${this.roomId}:`, error)
            }
          },
          close: (code?: number, reason?: string) => {
            try {
              server.close(code, reason)
            } catch (error) {
              console.error(`Error closing websocket in room ${this.roomId}:`, error)
            }
          },
          addEventListener: server.addEventListener.bind(server),
          removeEventListener: server.removeEventListener.bind(server),
          readyState: server.readyState,
        },
      })

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
          "Upgrade": "websocket",
          "Connection": "Upgrade",
          "Sec-WebSocket-Accept": "true",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS, UPGRADE",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Credentials": "true"
        }
      })
    } catch (error) {
      console.error("WebSocket connection error:", error)
      server.close(1011, "Failed to initialize connection")
      return new Response("Failed to establish WebSocket connection", { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS, UPGRADE",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Credentials": "true"
        }
      })
    }
  }

  getRoom() {
    const roomId = this.roomId
    if (!roomId) throw new Error("Missing roomId")
    console.log('getRoom called with roomId:', roomId)

    if (!this.roomPromise) {
      this.roomPromise = (async () => {
        // fetch the room from R2
        console.log(`Attempting to fetch room ${roomId} from R2...`)
        const roomFromBucket = await this.r2.get(`rooms/${roomId}`)
        
        if (roomFromBucket) {
          console.log(`Found existing room in R2 for ${roomId}`)
        } else {
          console.log(`No existing room found in R2 for ${roomId}, creating new room`)
        }

        // if it doesn't exist, we'll just create a new empty room
        const initialSnapshot = roomFromBucket
          ? ((await roomFromBucket.json()) as RoomSnapshot)
          : undefined
        if (initialSnapshot) {
          console.log(`Loaded snapshot for room ${roomId}`)
        }

        // create a new TLSocketRoom
        return new TLSocketRoom<TLRecord, void>({
          schema: customSchema,
          initialSnapshot,
          onDataChange: async () => {
            console.log('onDataChange triggered - scheduling persist to R2')
            await this.schedulePersistToR2()
            console.log('persist to R2 completed')
          },
        })
      })()
    }

    return this.roomPromise
  }

  private async checkAndCreateDailyBackup() {
    if (!this.roomId) return

    const now = new Date()
    const currentDate = now.toISOString().split('T')[0]
    
    // In development, check if 10 seconds have passed since last backup
    // In production, check if it's a different day
    const shouldBackup = this.isDevelopment
      ? !this.lastBackupDate || (now.getTime() - new Date(this.lastBackupDate).getTime() > 10000)
      : this.lastBackupDate !== currentDate

    if (!shouldBackup) return

    const room = await this.getRoom()
    const snapshot = room.getCurrentSnapshot()
    
    const timestamp = now.toISOString()
    const backupKey = `backups/${this.roomId}/${timestamp}.json`
    
    try {
      await this.backupsR2.put(backupKey, JSON.stringify(snapshot))
      
      // Store the full ISO timestamp in development, just the date in production
      await this.ctx.storage.put("lastBackupDate", this.isDevelopment ? timestamp : currentDate)
      this.lastBackupDate = this.isDevelopment ? timestamp : currentDate
      
      console.log(`Created backup for room ${this.roomId} at ${timestamp}`)
    } catch (error) {
      console.error(`Failed to create backup for room ${this.roomId}:`, error)
    }
  }

  // Modify to use a more strict throttle with a flag to prevent multiple calls
  schedulePersistToR2 = throttle(async () => {
    if (!this.roomPromise || !this.roomId || this.isPersisting) {
      console.log('Skipping persist - room not ready or persist already in progress')
      return
    }

    try {
      this.isPersisting = true
      console.log(`Persisting room ${this.roomId} to storage...`)
      
      const room = await this.getRoom()
      if (!room) {
        console.log(`Room ${this.roomId} no longer exists, skipping persist`)
        return
      }
      
      await this.r2.put(`rooms/${this.roomId}`, JSON.stringify(room.getCurrentSnapshot()))
      console.log(`Successfully persisted room ${this.roomId}`)
      
      await this.checkAndCreateDailyBackup()
    } catch (error) {
      console.error(`Failed to persist room ${this.roomId}:`, error)
    } finally {
      this.isPersisting = false
    }
  }, 10_000, { 
    leading: false,  // Don't execute on the leading edge of the timeout
    trailing: true,  // Execute on the trailing edge of the timeout
  })

  // Add CORS headers for WebSocket upgrade
  handleWebSocket(request: Request) {
    const upgradeHeader = request.headers.get("Upgrade")
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 })
    }

    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    server.accept()

    // Add error handling and reconnection logic
    server.addEventListener("error", (err) => {
      console.error("WebSocket error:", err)
    })

    server.addEventListener("close", () => {
      if (this.roomPromise) {
        this.getRoom().then((room) => {
          // Update store to ensure all changes are persisted
          room.updateStore(() => {})
        })
      }
    })

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
    })
  }
}
