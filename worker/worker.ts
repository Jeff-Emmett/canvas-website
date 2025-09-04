import { AutoRouter, cors, error, IRequest } from "itty-router"
import { handleAssetDownload, handleAssetUpload } from "./assetUploads"
import { Environment } from "./types"

// make sure our sync durable objects are made available to cloudflare
export { TldrawDurableObject } from "./TldrawDurableObject"
// export { AutomergeDurableObject } from "./AutomergeDurableObject" // Disabled - not currently used

// Lazy load heavy dependencies to avoid startup timeouts
let handleUnfurlRequest: any = null

async function getUnfurlHandler() {
  if (!handleUnfurlRequest) {
    const unfurl = await import("cloudflare-workers-unfurl")
    handleUnfurlRequest = unfurl.handleUnfurlRequest
  }
  return handleUnfurlRequest
}

// Define security headers
const securityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; connect-src 'self' wss: https:; img-src 'self' data: blob: https: https://cdn.tldraw.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}

// we use itty-router (https://itty.dev/) to handle routing. in this example we turn on CORS because
// we're hosting the worker separately to the client. you should restrict this to your own domain.
const { preflight, corsify } = cors({
  origin: (origin) => {
    const allowedOrigins = [
      "https://jeffemmett.com",
      "https://www.jeffemmett.com",
      "https://jeffemmett-canvas.jeffemmett.workers.dev",
      "https://jeffemmett.com/board/*",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]

    // Always allow if no origin (like from a local file)
    if (!origin) return "*"

    // Check exact matches
    if (allowedOrigins.includes(origin)) {
      return origin
    }

    // For development - check if it's a localhost or local IP (both http and https)
    if (
      origin.match(
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|169\.254\.|10\.)/,
      )
    ) {
      return origin
    }

    // If no match found, return * to allow all origins
    return "*"
  },
  allowMethods: ["GET", "POST", "HEAD", "OPTIONS", "UPGRADE"],
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "Upgrade",
    "Connection",
    "Sec-WebSocket-Key",
    "Sec-WebSocket-Version",
    "Sec-WebSocket-Extensions",
    "Sec-WebSocket-Protocol",
    "Content-Length",
    "Content-Range",
    "Range",
    "If-None-Match",
    "If-Modified-Since",
    "*"
  ],
  maxAge: 86400,
  credentials: true,
})
const router = AutoRouter<IRequest, [env: Environment, ctx: ExecutionContext]>({
  before: [
    // Handle WebSocket upgrades before CORS processing
    (request) => {
      const upgradeHeader = request.headers.get("Upgrade")
      if (upgradeHeader === "websocket") {
        // WebSocket upgrade detected, bypassing CORS
        return // Don't process CORS for WebSocket upgrades
      }
      return preflight(request)
    }
  ],
  finally: [
    (response) => {
      // Add security headers to all responses except WebSocket upgrades
      if (response.status !== 101) {
        // Create new headers to avoid modifying immutable headers
        const newHeaders = new Headers(response.headers)
        Object.entries(securityHeaders).forEach(([key, value]) => {
          newHeaders.set(key, value)
        })
        
        // Create a new response with the updated headers
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        })
      }
      return corsify(response)
    },
  ],
  catch: (e: Error) => {
    // Log all errors for debugging
    console.error("Worker error:", e)
    console.error("Error stack:", e.stack)
    
    // Handle WebSocket errors more gracefully
    if (e.message?.includes("WebSocket")) {
      console.error("WebSocket error:", e)
      return new Response(JSON.stringify({ error: "WebSocket connection failed", message: e.message }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    return error(e)
  },
})
  // requests to /connect are routed to the Durable Object, and handle realtime websocket syncing
  .get("/connect/:roomId", (request, env) => {
    console.log("Connect request for room:", request.params.roomId)
    console.log("Request headers:", Object.fromEntries(request.headers.entries()))
    
    // Check if this is a WebSocket upgrade request
    const upgradeHeader = request.headers.get("Upgrade")
    console.log("Upgrade header:", upgradeHeader)
    
    if (upgradeHeader === "websocket") {
      console.log("WebSocket upgrade requested for room:", request.params.roomId)
      console.log("Request URL:", request.url)
      console.log("Request method:", request.method)
      console.log("All headers:", Object.fromEntries(request.headers.entries()))
      
      const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId)
      const room = env.TLDRAW_DURABLE_OBJECT.get(id)
      
      console.log("Calling Durable Object fetch...")
      const result = room.fetch(request.url, {
        headers: request.headers,
        body: request.body,
        method: request.method,
      })
      
      console.log("Durable Object fetch result:", result)
      return result
    }
    
    // Handle regular GET requests
    const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.TLDRAW_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, {
      headers: request.headers,
      body: request.body,
      method: request.method,
    })
  })

  // assets can be uploaded to the bucket under /uploads:
  .post("/uploads/:uploadId", handleAssetUpload)

  // they can be retrieved from the bucket too:
  .get("/uploads/:uploadId", handleAssetDownload)

  // bookmarks need to extract metadata from pasted URLs:
  .get("/unfurl", async (request, env) => {
    const handler = await getUnfurlHandler()
    return handler(request, env)
  })

  .get("/room/:roomId", (request, env) => {
    const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.TLDRAW_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, {
      headers: request.headers,
      body: request.body,
      method: request.method,
    })
  })

  .post("/room/:roomId", async (request, env) => {
    const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.TLDRAW_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, {
      method: "POST",
      body: request.body,
    })
  })

  // Automerge routes - disabled for now
  // .get("/automerge/connect/:roomId", (request, env) => {
  //   // Check if this is a WebSocket upgrade request
  //   const upgradeHeader = request.headers.get("Upgrade")
  //   if (upgradeHeader === "websocket") {
  //     const id = env.AUTOMERGE_DURABLE_OBJECT.idFromName(request.params.roomId)
  //     const room = env.AUTOMERGE_DURABLE_OBJECT.get(id)
  //     return room.fetch(request.url, {
  //       headers: request.headers,
  //       body: request.body,
  //       method: request.method,
  //     })
  //   }
  //   
  //   // Handle regular GET requests
  //   const id = env.AUTOMERGE_DURABLE_OBJECT.idFromName(request.params.roomId)
  //   const room = env.AUTOMERGE_DURABLE_OBJECT.get(id)
  //   return room.fetch(request.url, {
  //     headers: request.headers,
  //     body: request.body,
  //     method: request.method,
  //   })
  // })

  // .get("/automerge/room/:roomId", (request, env) => {
  //   const id = env.AUTOMERGE_DURABLE_OBJECT.idFromName(request.params.roomId)
  //   const room = env.AUTOMERGE_DURABLE_OBJECT.get(id)
  //   return room.fetch(request.url, {
  //     headers: request.headers,
  //     body: request.body,
  //     method: request.method,
  //   })
  // })

  // .post("/automerge/room/:roomId", async (request, env) => {
  //   const id = env.AUTOMERGE_DURABLE_OBJECT.idFromName(request.params.roomId)
  //   const room = env.AUTOMERGE_DURABLE_OBJECT.get(id)
  //   return room.fetch(request.url, {
  //     method: "POST",
  //     body: request.body,
  //   })
  // })

  .post("/daily/rooms", async (req) => {
    const apiKey = req.headers.get('Authorization')?.split('Bearer ')[1]
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key provided' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      // Get the request body from the client
      const body = await req.json()
      
      const response = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.json()
        return new Response(JSON.stringify(error), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  .post("/daily/tokens", async (req) => {
    const apiKey = req.headers.get('Authorization')?.split('Bearer ')[1]
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key provided' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const body = await req.json() as { room_name: string; properties: any };
      const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          room_name: body.room_name,
          properties: body.properties
        })
      })

      if (!response.ok) {
        const error = await response.json()
        return new Response(JSON.stringify(error), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // Add new transcription endpoints
  .post("/daily/rooms/:roomName/start-transcription", async (req) => {
    const apiKey = req.headers.get('Authorization')?.split('Bearer ')[1]
    const { roomName } = req.params
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key provided' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}/transcription/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        return new Response(JSON.stringify(error), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  .post("/daily/rooms/:roomName/stop-transcription", async (req) => {
    const apiKey = req.headers.get('Authorization')?.split('Bearer ')[1]
    const { roomName } = req.params
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key provided' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}/transcription/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        return new Response(JSON.stringify(error), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // Add endpoint to get transcript access link
  .get("/daily/transcript/:transcriptId/access-link", async (req) => {
    const apiKey = req.headers.get('Authorization')?.split('Bearer ')[1]
    const { transcriptId } = req.params
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key provided' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const response = await fetch(`https://api.daily.co/v1/transcript/${transcriptId}/access-link`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        return new Response(JSON.stringify(error), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // Add endpoint to get transcript text
  .get("/daily/transcript/:transcriptId", async (req) => {
    const apiKey = req.headers.get('Authorization')?.split('Bearer ')[1]
    const { transcriptId } = req.params
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key provided' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const response = await fetch(`https://api.daily.co/v1/transcripts/${transcriptId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        return new Response(JSON.stringify(error), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // Recording endpoints
  .post("/daily/recordings/start", async (req) => {
    const apiKey = req.headers.get('Authorization')?.split('Bearer ')[1]
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key provided' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const body = await req.json() as any;
      const response = await fetch('https://api.daily.co/v1/recordings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.json()
        return new Response(JSON.stringify(error), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  .post("/daily/recordings/:recordingId/stop", async (req) => {
    const apiKey = req.headers.get('Authorization')?.split('Bearer ')[1]
    const { recordingId } = req.params
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key provided' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const response = await fetch(`https://api.daily.co/v1/recordings/${recordingId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        return new Response(JSON.stringify(error), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

async function backupAllBoards(env: Environment) {
  try {
    // List all room files from TLDRAW_BUCKET
    const roomsList = await env.TLDRAW_BUCKET.list({ prefix: 'rooms/' })
    
    const date = new Date().toISOString().split('T')[0]
    
    // Process each room
    for (const room of roomsList.objects) {
      try {
        // Get the room data
        const roomData = await env.TLDRAW_BUCKET.get(room.key)
        if (!roomData) continue

        // Get the data as text since it's already stringified JSON
        const jsonData = await roomData.text()
        
        // Create backup key with date only
        const backupKey = `${date}/${room.key}`
        
        // Store in backup bucket as JSON
        await env.BOARD_BACKUPS_BUCKET.put(backupKey, jsonData)
        
        // Backed up successfully
      } catch (error) {
        console.error(`Failed to backup room ${room.key}:`, error)
      }
    }
    
    // Clean up old backups (keep last 90 days)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    
    const oldBackups = await env.BOARD_BACKUPS_BUCKET.list({
      prefix: ninetyDaysAgo.toISOString().split('T')[0]
    })
    
    for (const backup of oldBackups.objects) {
      await env.BOARD_BACKUPS_BUCKET.delete(backup.key)
    }
    
    return { success: true, message: 'Backup completed successfully' }
  } catch (error) {
    console.error('Backup failed:', error)
    return { success: false, message: (error as Error).message }
  }
}

router
  .get("/backup", async (_, env) => {
    const result = await backupAllBoards(env)
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    })
  })
  .get("/backup/test", async (_, env) => {
    try {
      // Simple test to check R2 access
      const testResult = await env.TLDRAW_BUCKET.list({ prefix: 'rooms/', limit: 1 })
      
      return new Response(JSON.stringify({
        success: true,
        message: 'R2 access test successful',
        roomCount: testResult.objects?.length || 0,
        hasMore: testResult.truncated || false
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('R2 test failed:', error)
      return new Response(JSON.stringify({
        success: false,
        message: 'R2 access test failed',
        error: (error as Error).message
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

// Handle scheduled events (cron jobs)
export async function scheduled(_event: ScheduledEvent, env: Environment, _ctx: ExecutionContext) {
  // Cron job triggered
   

  try {
    // Run the backup function
    const result = await backupAllBoards(env)
    
    // Scheduled backup completed
    
    // You can add additional logging or notifications here
    if (!result.success) {
      console.error('Scheduled backup failed:', result.message)
      // In a real scenario, you might want to send alerts here
    }
    
    return result
   } catch (error) {
    console.error('Scheduled backup error:', error)
    throw error
  }
}

// export our router for cloudflare with CORS enabled
export default {
  fetch: (request: Request, env: Environment, ctx: ExecutionContext) => {
    // Handle WebSocket upgrades directly without CORS processing
    const upgradeHeader = request.headers.get("Upgrade")
    if (upgradeHeader === "websocket") {
      // WebSocket upgrade detected, bypassing router CORS
      return router.fetch(request, env, ctx)
    }
    
    // For regular requests, apply CORS
    return router.fetch(request, env, ctx).then(response => corsify(response))
  },
  scheduled
}
