/// <reference types="@cloudflare/workers-types" />

import { RoomSnapshot, TLSocketRoom } from "@tldraw/sync-core"
import {
  TLRecord,
  TLShape,
  createTLSchema,
  defaultBindingSchemas,
  defaultShapeSchemas,
  shapeIdValidator,
} from "@tldraw/tlschema"
import { AutoRouter, IRequest, error } from "itty-router"
import throttle from "lodash.throttle"
import { Environment } from "./types"
import { ChatBoxShape } from "@/shapes/ChatBoxShapeUtil"
import { VideoChatShape } from "@/shapes/VideoChatShapeUtil"
import { EmbedShape } from "@/shapes/EmbedShapeUtil"
import { MarkdownShape } from "@/shapes/MarkdownShapeUtil"
import { MycrozineTemplateShape } from "@/shapes/MycrozineTemplateShapeUtil"
import { SlideShape } from "@/shapes/SlideShapeUtil"
import { PromptShape } from "@/shapes/PromptShapeUtil"
import { SharedPianoShape } from "@/shapes/SharedPianoShapeUtil"

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
    Slide: {
      props: SlideShape.props,
      migrations: SlideShape.migrations,
    },
    Prompt: {
      props: PromptShape.props,
      migrations: PromptShape.migrations,
    },
    SharedPiano: {
      props: SharedPianoShape.props,
      migrations: SharedPianoShape.migrations,
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
  // the room ID will be missing whilst the room is being initialized
  private roomId: string | null = null
  // when we load the room from the R2 bucket, we keep it here. it's a promise so we only ever
  // load it once.
  private roomPromise: Promise<TLSocketRoom<TLRecord, void>> | null = null

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

    const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair()

    try {
      serverWebSocket.accept()
      const room = await this.getRoom()

      // Handle socket connection with proper error boundaries
      room.handleSocketConnect({
        sessionId,
        socket: {
          send: serverWebSocket.send.bind(serverWebSocket),
          close: serverWebSocket.close.bind(serverWebSocket),
          addEventListener:
            serverWebSocket.addEventListener.bind(serverWebSocket),
          removeEventListener:
            serverWebSocket.removeEventListener.bind(serverWebSocket),
          readyState: serverWebSocket.readyState,
        },
      })

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
      serverWebSocket.close(1011, "Failed to initialize connection")
      return new Response("Failed to establish WebSocket connection", {
        status: 500,
      })
    }
  }

  getRoom() {
    const roomId = this.roomId
    if (!roomId) throw new Error("Missing roomId")

    if (!this.roomPromise) {
      this.roomPromise = (async () => {
        // fetch the room from R2
        const roomFromBucket = await this.r2.get(`rooms/${roomId}`)
        // if it doesn't exist, we'll just create a new empty room
        const initialSnapshot = roomFromBucket
          ? ((await roomFromBucket.json()) as RoomSnapshot)
          : undefined
        if (initialSnapshot) {
          initialSnapshot.documents = initialSnapshot.documents.filter(
            (record) => {
              const shape = record.state as TLShape
              return shape.type !== "ChatBox"
            },
          )
        }
        // create a new TLSocketRoom. This handles all the sync protocol & websocket connections.
        // it's up to us to persist the room state to R2 when needed though.
        return new TLSocketRoom<TLRecord, void>({
          schema: customSchema,
          initialSnapshot,
          onDataChange: () => {
            // and persist whenever the data in the room changes
            this.schedulePersistToR2()
            console.log("Persisting", this.roomId, "to R2")
          },
        })
      })()
    }

    return this.roomPromise
  }

  // we throttle persistance so it only happens every 10 seconds
  schedulePersistToR2 = throttle(async () => {
    if (!this.roomPromise || !this.roomId) return
    const room = await this.getRoom()
    
    // convert the room to JSON and upload it to R2
    const snapshot = JSON.stringify(room.getCurrentSnapshot())
    await this.r2.put(`rooms/${this.roomId}`, snapshot)
  }, 10_000)

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
