import { AutoRouter, cors, error, IRequest } from "itty-router"
import { handleAssetDownload, handleAssetUpload } from "./assetUploads"
import { Environment } from "./types"
import {
  searchUsers,
  getUserProfile,
  updateMyProfile,
  createConnection,
  updateConnectionTrust,
  removeConnection,
  getMyConnections,
  getMyFollowers,
  checkConnection,
  updateEdgeMetadata,
  getEdgeMetadata,
  getNetworkGraph,
  getRoomNetworkGraph,
  getMutualConnections,
} from "./networkingApi"
import {
  handleGetPermission,
  handleListPermissions,
  handleGrantPermission,
  handleRevokePermission,
  handleUpdateBoard,
  handleCreateAccessToken,
  handleListAccessTokens,
  handleRevokeAccessToken,
  handleGetGlobalAdminStatus,
  handleRequestAdminAccess,
  handleGetBoardInfo,
  handleListEditors,
} from "./boardPermissions"
import {
  handleSendBackupEmail,
  handleSearchUsers,
  handleListAllUsers,
  handleCheckUsername,
} from "./cryptidAuth"
import {
  handleLinkWallet,
  handleListWallets,
  handleGetWallet,
  handleUpdateWallet,
  handleUnlinkWallet,
  handleVerifyWallet,
} from "./walletAuth"

// make sure our sync durable objects are made available to cloudflare
export { AutomergeDurableObject } from "./AutomergeDurableObject"

// Temporary stub for TldrawDurableObject to allow delete-class migration
// This extends AutomergeDurableObject so existing instances can be handled during migration
// 
// DATA SAFETY: All document data is stored in R2 at `rooms/${roomId}`, not in Durable Object storage.
// When TldrawDurableObject instances are deleted, only the Durable Object instances are removed.
// The R2 data remains safe and accessible by AutomergeDurableObject, which uses the same R2 bucket
// (TLDRAW_BUCKET) and storage path. The roomId can be re-initialized from the URL path if needed.
//
// This will be removed after the migration completes
import { AutomergeDurableObject as BaseAutomergeDurableObject } from "./AutomergeDurableObject"

export class TldrawDurableObject extends BaseAutomergeDurableObject {
  constructor(ctx: DurableObjectState, env: Environment) {
    // Extends AutomergeDurableObject, so it uses the same R2 bucket (env.TLDRAW_BUCKET)
    // and storage path (rooms/${roomId}), ensuring no data loss during migration
    super(ctx, env)
  }
}

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
      "http://172.22.168.84:5173",
    ]

    // Always allow if no origin (like from a local file)
    if (!origin) return "*"

    // Check exact matches
    if (allowedOrigins.includes(origin)) {
      return origin
    }

    // For development - check if it's a localhost or local IP (both http and https)
    // Includes: localhost, 127.x, 192.168.x, 169.254.x, 10.x, 172.16-31.x (private), 100.x (Tailscale)
    if (
      origin.match(
        /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|192\.168\.|169\.254\.|10\.|172\.(1[6-9]|2\d|3[01])\.|100\.)/,
      )
    ) {
      return origin
    }

    // If no match found, return * to allow all origins
    return "*"
  },
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "UPGRADE"],
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
    "X-CryptID-PublicKey",  // CryptID authentication header
    "X-User-Id",            // User ID header for networking API
    "X-Api-Key",            // API key header for external services
    "X-Admin-Secret",       // Admin secret header for protected endpoints
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

  // assets can be uploaded to the bucket under /uploads:
  .post("/uploads/:uploadId", handleAssetUpload)

  // they can be retrieved from the bucket too:
  .get("/uploads/:uploadId", handleAssetDownload)

  // bookmarks need to extract metadata from pasted URLs:
  .get("/unfurl", async (request, env) => {
    const handler = await getUnfurlHandler()
    return handler(request, env)
  })


  // Automerge routes
  .get("/connect/:roomId", (request, env) => {
    console.log(`🔌 Worker: Received request for room ${request.params.roomId}`)
    
    // Check if this is a WebSocket upgrade request
    const upgradeHeader = request.headers.get("Upgrade")
    console.log(`🔌 Worker: Upgrade header: ${upgradeHeader}`)
    
    if (upgradeHeader === "websocket") {
      console.log(`🔌 Worker: Handling WebSocket upgrade for room ${request.params.roomId}`)
      const id = env.AUTOMERGE_DURABLE_OBJECT.idFromName(request.params.roomId)
      const room = env.AUTOMERGE_DURABLE_OBJECT.get(id)
      return room.fetch(request.url, {
        headers: request.headers,
        body: request.body,
        method: request.method,
      })
    }
    
    // Handle regular GET requests
    console.log(`🔌 Worker: Handling regular GET request for room ${request.params.roomId}`)
    const id = env.AUTOMERGE_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.AUTOMERGE_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, {
      headers: request.headers,
      body: request.body,
      method: request.method,
    })
  })

  .get("/room/:roomId", (request, env) => {
    const id = env.AUTOMERGE_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.AUTOMERGE_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, {
      headers: request.headers,
      body: request.body,
      method: request.method,
    })
  })

  .post("/room/:roomId", async (request, env) => {
    const id = env.AUTOMERGE_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.AUTOMERGE_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, {
      method: "POST",
      body: request.body,
    })
  })

  // Get the Automerge document ID for a room
  .get("/room/:roomId/documentId", async (request, env) => {
    const id = env.AUTOMERGE_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.AUTOMERGE_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, {
      headers: request.headers,
      method: "GET",
    })
  })

  // Set the Automerge document ID for a room
  .post("/room/:roomId/documentId", async (request, env) => {
    const id = env.AUTOMERGE_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.AUTOMERGE_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, {
      method: "POST",
      body: request.body,
      headers: request.headers,
    })
  })

  // Version History API - forward to Durable Object
  .get("/room/:roomId/history", async (request, env) => {
    const id = env.AUTOMERGE_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.AUTOMERGE_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, {
      headers: request.headers,
      method: "GET",
    })
  })

  .get("/room/:roomId/snapshot/:hash", async (request, env) => {
    const id = env.AUTOMERGE_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.AUTOMERGE_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, {
      headers: request.headers,
      method: "GET",
    })
  })

  .post("/room/:roomId/diff", async (request, env) => {
    const id = env.AUTOMERGE_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.AUTOMERGE_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, {
      method: "POST",
      body: request.body,
      headers: request.headers,
    })
  })

  .post("/room/:roomId/revert", async (request, env) => {
    const id = env.AUTOMERGE_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.AUTOMERGE_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, {
      method: "POST",
      body: request.body,
      headers: request.headers,
    })
  })

  .post("/daily/rooms", async (req, env) => {
    // Use server-side API key - never expose to client
    const apiKey = env.DAILY_API_KEY

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Daily.co API key not configured on server' }), {
        status: 500,
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

  // Get room info by name
  .get("/daily/rooms/:roomName", async (req, env) => {
    // Use server-side API key - never expose to client
    const apiKey = env.DAILY_API_KEY
    const { roomName } = req.params

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Daily.co API key not configured on server' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
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

  .post("/daily/tokens", async (req, env) => {
    // Use server-side API key - never expose to client
    const apiKey = env.DAILY_API_KEY

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Daily.co API key not configured on server' }), {
        status: 500,
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
  .post("/daily/rooms/:roomName/start-transcription", async (req, env) => {
    // Use server-side API key - never expose to client
    const apiKey = env.DAILY_API_KEY
    const { roomName } = req.params

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Daily.co API key not configured on server' }), {
        status: 500,
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

  .post("/daily/rooms/:roomName/stop-transcription", async (req, env) => {
    // Use server-side API key - never expose to client
    const apiKey = env.DAILY_API_KEY
    const { roomName } = req.params

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Daily.co API key not configured on server' }), {
        status: 500,
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
  .get("/daily/transcript/:transcriptId/access-link", async (req, env) => {
    // Use server-side API key - never expose to client
    const apiKey = env.DAILY_API_KEY
    const { transcriptId } = req.params

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Daily.co API key not configured on server' }), {
        status: 500,
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
  .get("/daily/transcript/:transcriptId", async (req, env) => {
    // Use server-side API key - never expose to client
    const apiKey = env.DAILY_API_KEY
    const { transcriptId } = req.params

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Daily.co API key not configured on server' }), {
        status: 500,
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
  .post("/daily/recordings/start", async (req, env) => {
    // Use server-side API key - never expose to client
    const apiKey = env.DAILY_API_KEY

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Daily.co API key not configured on server' }), {
        status: 500,
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

  .post("/daily/recordings/:recordingId/stop", async (req, env) => {
    // Use server-side API key - never expose to client
    const apiKey = env.DAILY_API_KEY
    const { recordingId } = req.params

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Daily.co API key not configured on server' }), {
        status: 500,
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

  // Fathom API endpoints (api.fathom.ai)
  .get("/fathom/meetings", async (req) => {
    console.log('Fathom meetings endpoint called')
    // Support both Authorization: Bearer and X-Api-Key headers for backward compatibility
    let apiKey = req.headers.get('X-Api-Key')
    if (!apiKey) {
      apiKey = req.headers.get('Authorization')?.split('Bearer ')[1] || null
    }
    console.log('API key present:', !!apiKey)
    
    if (!apiKey) {
      console.log('No API key provided')
      return new Response(JSON.stringify({ error: 'No API key provided. Use X-Api-Key header or Authorization: Bearer' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      console.log('Making request to Fathom API...')
      
      // Build query parameters from URL
      const url = new URL(req.url)
      const params = new URLSearchParams()
      if (url.searchParams.has('cursor')) {
        params.append('cursor', url.searchParams.get('cursor')!)
      }
      if (url.searchParams.has('include_transcript')) {
        params.append('include_transcript', url.searchParams.get('include_transcript')!)
      }
      if (url.searchParams.has('created_after')) {
        params.append('created_after', url.searchParams.get('created_after')!)
      }
      if (url.searchParams.has('created_before')) {
        params.append('created_before', url.searchParams.get('created_before')!)
      }
      
      const queryString = params.toString()
      const apiUrl = `https://api.fathom.ai/external/v1/meetings${queryString ? '?' + queryString : ''}`
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json'
        }
      })

      console.log('Fathom API response status:', response.status)
      
      if (!response.ok) {
        console.log('Fathom API error response')
        const contentType = response.headers.get('content-type') || ''
        let errorData: any
        
        if (contentType.includes('application/json')) {
          try {
            errorData = await response.json()
            console.log('Error details:', errorData)
          } catch (e) {
            errorData = { error: `HTTP ${response.status}: ${response.statusText}` }
          }
        } else {
          // Handle HTML or text error responses
          const text = await response.text()
          console.log('Non-JSON error response:', text.substring(0, 200))
          errorData = { 
            error: `HTTP ${response.status}: ${response.statusText}`,
            details: text.substring(0, 500) // Include first 500 chars for debugging
          }
        }
        
        return new Response(JSON.stringify(errorData), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json() as { items?: any[], limit?: number, next_cursor?: string }
      console.log('Fathom API success, items length:', data?.items?.length || 0)
      // Transform response to match expected format (items -> data for backward compatibility)
      return new Response(JSON.stringify({
        data: data.items || [],
        limit: data.limit,
        next_cursor: data.next_cursor
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Fathom API error:', error)
      return new Response(JSON.stringify({ 
        error: (error as Error).message,
        details: 'Failed to fetch meetings from Fathom API'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  .get("/fathom/meetings/:meetingId", async (req) => {
    // Support both Authorization: Bearer and X-Api-Key headers
    let apiKey = req.headers.get('X-Api-Key')
    if (!apiKey) {
      apiKey = req.headers.get('Authorization')?.split('Bearer ')[1] || null
    }
    const { meetingId } = req.params
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key provided. Use X-Api-Key header or Authorization: Bearer' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      // Get transcript if requested
      const url = new URL(req.url)
      const includeTranscript = url.searchParams.get('include_transcript') === 'true'
      // Use the meetings endpoint with filters to get a specific meeting by recording_id
      // The API doesn't have a direct /meetings/:id endpoint, so we filter by recording_id
      // Include summary and action items parameters - these are required to get the data
      const apiUrl = `https://api.fathom.ai/external/v1/meetings?recording_id=${meetingId}&include_summary=true&include_action_items=true${includeTranscript ? '&include_transcript=true' : ''}`
      
      console.log('Fetching Fathom meeting with URL:', apiUrl)
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || ''
        let errorData: any
        
        if (contentType.includes('application/json')) {
          try {
            errorData = await response.json()
          } catch (e) {
            errorData = { error: `HTTP ${response.status}: ${response.statusText}` }
          }
        } else {
          // Handle HTML or text error responses
          const text = await response.text()
          errorData = { 
            error: `HTTP ${response.status}: ${response.statusText}`,
            details: text.substring(0, 500) // Include first 500 chars for debugging
          }
        }
        
        return new Response(JSON.stringify(errorData), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json() as { items?: any[] }
      // The API returns an array, so get the first item (should be the matching meeting)
      const meeting = data.items && data.items.length > 0 ? data.items[0] : null
      
      if (!meeting) {
        return new Response(JSON.stringify({ error: 'Meeting not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      // Log the meeting structure for debugging
      console.log('Fathom meeting response keys:', Object.keys(meeting))
      console.log('Has default_summary:', !!meeting.default_summary)
      console.log('Has action_items:', !!meeting.action_items)
      if (meeting.default_summary) {
        console.log('default_summary keys:', Object.keys(meeting.default_summary))
      }
      
      return new Response(JSON.stringify(meeting), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Fathom API error for meeting details:', error)
      return new Response(JSON.stringify({ 
        error: (error as Error).message,
        details: 'Failed to fetch meeting details from Fathom API'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  .post("/fathom/webhook", async (req) => {
    try {
      const body = await req.json()

      // Log the webhook for debugging
      console.log('Fathom webhook received:', JSON.stringify(body, null, 2))

      // TODO: Verify webhook signature for security
      // For now, we'll accept all webhooks. In production, you should:
      // 1. Get the webhook secret from Fathom
      // 2. Verify the signature using svix or similar library
      // const signature = req.headers.get('svix-signature')
      // const webhookSecret = env.FATHOM_WEBHOOK_SECRET
      // if (!verifyWebhookSignature(body, signature, webhookSecret)) {
      //   return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      //     status: 401,
      //     headers: { 'Content-Type': 'application/json' }
      //   })
      // }

      // Process the meeting data
      const meetingData = body as any

      // Store meeting data for later retrieval
      // This could be stored in R2 or Durable Object storage
      console.log('Processing meeting:', meetingData.meeting_id)

      // TODO: Store meeting data in R2 or send to connected clients
      // For now, just log it

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Webhook processing error:', error)
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // =============================================================================
  // Miro Import API
  // =============================================================================

  // Proxy endpoint for fetching external images (needed for CORS-blocked Miro images)
  .get("/proxy", async (req) => {
    const url = new URL(req.url)
    const targetUrl = url.searchParams.get('url')

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TldrawImporter/1.0)',
        }
      })

      if (!response.ok) {
        return new Response(JSON.stringify({ error: `Failed to fetch: ${response.statusText}` }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Get content type and pass through the image
      const contentType = response.headers.get('content-type') || 'application/octet-stream'
      const body = await response.arrayBuffer()

      return new Response(body, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400', // Cache for 1 day
        }
      })
    } catch (error) {
      console.error('Proxy fetch error:', error)
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // =============================================================================
  // CryptID Auth API
  // =============================================================================

  // Check if a username is available for registration
  .get("/api/auth/check-username", handleCheckUsername)

  // Send backup email for multi-device setup
  .post("/api/auth/send-backup-email", handleSendBackupEmail)

  // Search for CryptID users by username (for granting permissions)
  .get("/api/auth/users/search", handleSearchUsers)

  // List all CryptID users (admin only, requires X-Admin-Secret header)
  .get("/admin/users", handleListAllUsers)

  // =============================================================================
  // Wallet Linking API (Web3 Integration)
  // =============================================================================

  // Link a new wallet to the authenticated user's CryptID account
  .post("/api/wallet/link", handleLinkWallet)

  // List all wallets linked to the authenticated user
  .get("/api/wallet/list", handleListWallets)

  // Check if a wallet address is linked to any CryptID account (public)
  .get("/api/wallet/verify/:address", (req, env) =>
    handleVerifyWallet(req, env, req.params.address))

  // Get details for a specific linked wallet
  .get("/api/wallet/:address", (req, env) =>
    handleGetWallet(req, env, req.params.address))

  // Update a linked wallet (label, primary status)
  .patch("/api/wallet/:address", (req, env) =>
    handleUpdateWallet(req, env, req.params.address))

  // Unlink a wallet from the account
  .delete("/api/wallet/:address", (req, env) =>
    handleUnlinkWallet(req, env, req.params.address))

  // =============================================================================
  // User Networking / Social Graph API
  // =============================================================================

  // User search and profiles
  .get("/api/networking/users/search", searchUsers)
  .get("/api/networking/users/me", (req, env) => getUserProfile({ ...req, params: { userId: req.headers.get('X-User-Id') || '' } } as unknown as IRequest, env))
  .put("/api/networking/users/me", updateMyProfile)
  .get("/api/networking/users/:userId", getUserProfile)

  // Connection management
  .post("/api/networking/connections", createConnection)
  .get("/api/networking/connections", getMyConnections)
  .get("/api/networking/connections/followers", getMyFollowers)
  .get("/api/networking/connections/check/:userId", checkConnection)
  .get("/api/networking/connections/mutual/:userId", getMutualConnections)
  .put("/api/networking/connections/:connectionId/trust", updateConnectionTrust)
  .delete("/api/networking/connections/:connectionId", removeConnection)

  // Edge metadata
  .put("/api/networking/connections/:connectionId/metadata", updateEdgeMetadata)
  .get("/api/networking/connections/:connectionId/metadata", getEdgeMetadata)

  // Network graph
  .get("/api/networking/graph", getNetworkGraph)
  .post("/api/networking/graph/room", getRoomNetworkGraph)

  // =============================================================================
  // Board Permissions API
  // =============================================================================

  // Get current user's permission for a board
  .get("/boards/:boardId/permission", (req, env) =>
    handleGetPermission(req.params.boardId, req, env))

  // List all permissions for a board (admin only)
  .get("/boards/:boardId/permissions", (req, env) =>
    handleListPermissions(req.params.boardId, req, env))

  // Grant permission to a user (admin only)
  .post("/boards/:boardId/permissions", (req, env) =>
    handleGrantPermission(req.params.boardId, req, env))

  // Revoke a user's permission (admin only)
  .delete("/boards/:boardId/permissions/:userId", (req, env) =>
    handleRevokePermission(req.params.boardId, req.params.userId, req, env))

  // Update board settings (admin only)
  .patch("/boards/:boardId", (req, env) =>
    handleUpdateBoard(req.params.boardId, req, env))

  // Access token endpoints for shareable links
  // Create a new access token (admin only)
  .post("/boards/:boardId/access-tokens", (req, env) =>
    handleCreateAccessToken(req.params.boardId, req, env))

  // List all access tokens for a board (admin only)
  .get("/boards/:boardId/access-tokens", (req, env) =>
    handleListAccessTokens(req.params.boardId, req, env))

  // Revoke an access token (admin only)
  .delete("/boards/:boardId/access-tokens/:tokenId", (req, env) =>
    handleRevokeAccessToken(req.params.boardId, req.params.tokenId, req, env))

  // =============================================================================
  // Global Admin & Protected Boards API
  // =============================================================================

  // Check if current user is a global admin
  .get("/auth/global-admin-status", (req, env) =>
    handleGetGlobalAdminStatus(req, env))

  // Request global admin access (sends email)
  .post("/admin/request", (req, env) =>
    handleRequestAdminAccess(req, env))

  // Get board info including protection status
  .get("/boards/:boardId/info", (req, env) =>
    handleGetBoardInfo(req.params.boardId, req, env))

  // List editors on a protected board (admin only)
  .get("/boards/:boardId/editors", (req, env) =>
    handleListEditors(req.params.boardId, req, env))

  // =============================================================================
  // AI Service Proxies (fal.ai, RunPod)
  // These keep API keys server-side instead of exposing them to the browser
  // =============================================================================

  // Fal.ai proxy - submit job to queue
  // Use :endpoint+ for greedy named wildcard that captures multiple path segments
  .post("/api/fal/queue/:endpoint+", async (req, env) => {
    if (!env.FAL_API_KEY) {
      return new Response(JSON.stringify({ error: 'FAL_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const endpoint = req.params.endpoint
      const body = await req.json()

      const response = await fetch(`https://queue.fal.run/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${env.FAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorText = await response.text()
        return new Response(JSON.stringify({
          error: `fal.ai API error: ${response.status}`,
          details: errorText
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Fal.ai proxy error:', error)
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // Fal.ai proxy - check job status
  .get("/api/fal/queue/:endpoint+/status/:requestId", async (req, env) => {
    if (!env.FAL_API_KEY) {
      return new Response(JSON.stringify({ error: 'FAL_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const { endpoint, requestId } = req.params

      const response = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}/status`, {
        headers: { 'Authorization': `Key ${env.FAL_API_KEY}` }
      })

      if (!response.ok) {
        const errorText = await response.text()
        return new Response(JSON.stringify({
          error: `fal.ai status error: ${response.status}`,
          details: errorText
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Fal.ai status proxy error:', error)
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // Fal.ai proxy - get job result
  .get("/api/fal/queue/:endpoint+/result/:requestId", async (req, env) => {
    if (!env.FAL_API_KEY) {
      return new Response(JSON.stringify({ error: 'FAL_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const { endpoint, requestId } = req.params

      const response = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}`, {
        headers: { 'Authorization': `Key ${env.FAL_API_KEY}` }
      })

      if (!response.ok) {
        const errorText = await response.text()
        return new Response(JSON.stringify({
          error: `fal.ai result error: ${response.status}`,
          details: errorText
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Fal.ai result proxy error:', error)
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // Fal.ai subscribe (synchronous generation) - used by LiveImage
  .post("/api/fal/subscribe/:endpoint+", async (req, env) => {
    if (!env.FAL_API_KEY) {
      return new Response(JSON.stringify({ error: 'FAL_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const endpoint = req.params.endpoint
      const body = await req.json()

      // Use the direct endpoint for synchronous generation
      const response = await fetch(`https://fal.run/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${env.FAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorText = await response.text()
        return new Response(JSON.stringify({
          error: `fal.ai API error: ${response.status}`,
          details: errorText
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Fal.ai subscribe proxy error:', error)
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // RunPod proxy - run sync (blocking)
  .post("/api/runpod/:endpointType/runsync", async (req, env) => {
    const endpointType = req.params.endpointType as 'image' | 'video' | 'text' | 'whisper'

    // Get the appropriate endpoint ID
    const endpointIds: Record<string, string | undefined> = {
      'image': env.RUNPOD_IMAGE_ENDPOINT_ID || 'tzf1j3sc3zufsy',
      'video': env.RUNPOD_VIDEO_ENDPOINT_ID || '4jql4l7l0yw0f3',
      'text': env.RUNPOD_TEXT_ENDPOINT_ID || '03g5hz3hlo8gr2',
      'whisper': env.RUNPOD_WHISPER_ENDPOINT_ID || 'lrtisuv8ixbtub'
    }

    const endpointId = endpointIds[endpointType]
    if (!endpointId) {
      return new Response(JSON.stringify({ error: `Unknown endpoint type: ${endpointType}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!env.RUNPOD_API_KEY) {
      return new Response(JSON.stringify({ error: 'RUNPOD_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const body = await req.json()

      const response = await fetch(`https://api.runpod.ai/v2/${endpointId}/runsync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RUNPOD_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorText = await response.text()
        return new Response(JSON.stringify({
          error: `RunPod API error: ${response.status}`,
          details: errorText
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('RunPod runsync proxy error:', error)
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // RunPod proxy - run async (non-blocking)
  .post("/api/runpod/:endpointType/run", async (req, env) => {
    const endpointType = req.params.endpointType as 'image' | 'video' | 'text' | 'whisper'

    const endpointIds: Record<string, string | undefined> = {
      'image': env.RUNPOD_IMAGE_ENDPOINT_ID || 'tzf1j3sc3zufsy',
      'video': env.RUNPOD_VIDEO_ENDPOINT_ID || '4jql4l7l0yw0f3',
      'text': env.RUNPOD_TEXT_ENDPOINT_ID || '03g5hz3hlo8gr2',
      'whisper': env.RUNPOD_WHISPER_ENDPOINT_ID || 'lrtisuv8ixbtub'
    }

    const endpointId = endpointIds[endpointType]
    if (!endpointId) {
      return new Response(JSON.stringify({ error: `Unknown endpoint type: ${endpointType}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!env.RUNPOD_API_KEY) {
      return new Response(JSON.stringify({ error: 'RUNPOD_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const body = await req.json()

      const response = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RUNPOD_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorText = await response.text()
        return new Response(JSON.stringify({
          error: `RunPod API error: ${response.status}`,
          details: errorText
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('RunPod run proxy error:', error)
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // RunPod proxy - check job status
  .get("/api/runpod/:endpointType/status/:jobId", async (req, env) => {
    const endpointType = req.params.endpointType as 'image' | 'video' | 'text' | 'whisper'

    const endpointIds: Record<string, string | undefined> = {
      'image': env.RUNPOD_IMAGE_ENDPOINT_ID || 'tzf1j3sc3zufsy',
      'video': env.RUNPOD_VIDEO_ENDPOINT_ID || '4jql4l7l0yw0f3',
      'text': env.RUNPOD_TEXT_ENDPOINT_ID || '03g5hz3hlo8gr2',
      'whisper': env.RUNPOD_WHISPER_ENDPOINT_ID || 'lrtisuv8ixbtub'
    }

    const endpointId = endpointIds[endpointType]
    if (!endpointId) {
      return new Response(JSON.stringify({ error: `Unknown endpoint type: ${endpointType}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!env.RUNPOD_API_KEY) {
      return new Response(JSON.stringify({ error: 'RUNPOD_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const { jobId } = req.params

      const response = await fetch(`https://api.runpod.ai/v2/${endpointId}/status/${jobId}`, {
        headers: { 'Authorization': `Bearer ${env.RUNPOD_API_KEY}` }
      })

      if (!response.ok) {
        const errorText = await response.text()
        return new Response(JSON.stringify({
          error: `RunPod status error: ${response.status}`,
          details: errorText
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('RunPod status proxy error:', error)
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // =============================================================================
  // Blender 3D Render API
  // Proxies render requests to blender-automation server on Netcup RS 8000
  // =============================================================================

  .post("/api/blender/render", async (req, env) => {
    // Blender render server URL - hosted on Netcup RS 8000
    const BLENDER_API_URL = env.BLENDER_API_URL || 'https://blender.jeffemmett.com'

    try {
      const body = await req.json() as {
        preset: string
        text?: string
        complexity?: number
        seed?: number
        resolution?: string
        samples?: number
      }

      console.log('Blender render request:', body)

      const response = await fetch(`${BLENDER_API_URL}/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Blender API error:', response.status, errorText)
        return new Response(JSON.stringify({
          error: `Blender API error: ${response.status}`,
          details: errorText
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Blender render proxy error:', error)
      return new Response(JSON.stringify({
        error: 'Blender render failed',
        details: (error as Error).message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // Get render job status
  .get("/api/blender/status/:jobId", async (req, env) => {
    const BLENDER_API_URL = env.BLENDER_API_URL || 'https://blender.jeffemmett.com'
    const { jobId } = req.params

    try {
      const response = await fetch(`${BLENDER_API_URL}/status/${jobId}`)

      if (!response.ok) {
        const errorText = await response.text()
        return new Response(JSON.stringify({
          error: `Blender status error: ${response.status}`,
          details: errorText
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Blender status proxy error:', error)
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

/**
 * Compute SHA-256 hash of content for change detection
 */
async function computeContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Smart backup system - only backs up boards that have changed
 *
 * Instead of backing up every board daily (wasteful), we:
 * 1. Compute content hash for each board
 * 2. Compare against last backed-up hash
 * 3. Only backup if content changed
 *
 * This reduces storage by 80-90% while maintaining perpetual history
 * of actual changes (not duplicate snapshots of unchanged boards).
 */
async function backupAllBoards(env: Environment) {
  try {
    // List all room files from TLDRAW_BUCKET
    const roomsList = await env.TLDRAW_BUCKET.list({ prefix: 'rooms/' })

    const date = new Date().toISOString().split('T')[0]
    let backedUp = 0
    let skipped = 0

    // Process each room
    for (const room of roomsList.objects) {
      try {
        // Get the room data
        const roomData = await env.TLDRAW_BUCKET.get(room.key)
        if (!roomData) continue

        // Get the data as text since it's already stringified JSON
        const jsonData = await roomData.text()

        // Compute hash of current content
        const contentHash = await computeContentHash(jsonData)

        // Check if we already have this exact content backed up
        const hashKey = `hashes/${room.key}.hash`
        const lastHashObj = await env.BOARD_BACKUPS_BUCKET.get(hashKey)

        if (lastHashObj) {
          const lastHash = await lastHashObj.text()
          if (lastHash === contentHash) {
            // No changes since last backup - skip this board
            skipped++
            continue
          }
        }

        // Content changed - create backup
        const backupKey = `${date}/${room.key}`

        // Store in backup bucket as JSON with proper content-type
        await env.BOARD_BACKUPS_BUCKET.put(backupKey, jsonData, {
          httpMetadata: {
            contentType: 'application/json'
          },
          customMetadata: {
            contentHash,
            backedUpAt: new Date().toISOString()
          }
        })

        // Update the stored hash for next comparison
        await env.BOARD_BACKUPS_BUCKET.put(hashKey, contentHash, {
          httpMetadata: {
            contentType: 'text/plain'
          }
        })

        backedUp++
      } catch (error) {
        console.error(`Failed to backup room ${room.key}:`, error)
      }
    }

    console.log(`📦 Backup complete: ${backedUp} boards backed up, ${skipped} unchanged (skipped)`)

    // Clean up old backups (keep last 90 days)
    // Note: With change-triggered backups, storage is much more efficient
    // so we could extend this to 180+ days if desired
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const oldBackups = await env.BOARD_BACKUPS_BUCKET.list({
      prefix: ninetyDaysAgo.toISOString().split('T')[0]
    })

    for (const backup of oldBackups.objects) {
      await env.BOARD_BACKUPS_BUCKET.delete(backup.key)
    }

    return {
      success: true,
      message: `Backup completed: ${backedUp} backed up, ${skipped} unchanged`,
      stats: { backedUp, skipped, total: backedUp + skipped }
    }
  } catch (error) {
    console.error('Backup failed:', error)
    return { success: false, message: (error as Error).message }
  }
}

router
  .get("/export/:roomId", async (request, env) => {
    try {
      const roomId = request.params.roomId
      if (!roomId) {
        return new Response(JSON.stringify({ error: 'Room ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Get the room data from R2
      const roomData = await env.TLDRAW_BUCKET.get(`rooms/${roomId}`)
      if (!roomData) {
        return new Response(JSON.stringify({ error: 'Room not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Get the JSON data
      const jsonData = await roomData.text()
      
      // Return as downloadable JSON file
      return new Response(jsonData, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${roomId}-board.json"`,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        }
      })
    } catch (error) {
      console.error('Export failed:', error)
      return new Response(JSON.stringify({ 
        error: 'Export failed', 
        message: (error as Error).message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })
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

  // ============================================================================
  // Migration endpoints - for batch converting legacy JSON to Automerge format
  // ============================================================================

  // List all rooms with their size and migration status
  .get("/migrate/list", async (_, env) => {
    try {
      const rooms: Array<{
        roomId: string
        hasJson: boolean
        hasAutomerge: boolean
        shapeCount: number
        recordCount: number
        needsMigration: boolean
      }> = []

      // List all rooms in R2
      let cursor: string | undefined = undefined
      do {
        const result = await env.TLDRAW_BUCKET.list({
          prefix: 'rooms/',
          cursor,
          delimiter: '/'
        })

        // Process each room prefix
        for (const prefix of result.delimitedPrefixes || []) {
          const roomId = prefix.replace('rooms/', '').replace('/', '')
          if (!roomId) continue

          // Check if JSON exists
          const jsonObject = await env.TLDRAW_BUCKET.head(`rooms/${roomId}`)
          const hasJson = !!jsonObject

          // Check if Automerge binary exists
          const automergeObject = await env.TLDRAW_BUCKET.head(`rooms/${roomId}/automerge.bin`)
          const hasAutomerge = !!automergeObject

          // Get shape count from JSON if it exists
          let shapeCount = 0
          let recordCount = 0
          if (hasJson) {
            try {
              const jsonData = await env.TLDRAW_BUCKET.get(`rooms/${roomId}`)
              if (jsonData) {
                const doc = await jsonData.json() as { store?: Record<string, any> }
                if (doc.store) {
                  recordCount = Object.keys(doc.store).length
                  shapeCount = Object.values(doc.store).filter((r: any) => r?.typeName === 'shape').length
                }
              }
            } catch (e) {
              console.error(`Error reading room ${roomId}:`, e)
            }
          }

          rooms.push({
            roomId,
            hasJson,
            hasAutomerge,
            shapeCount,
            recordCount,
            needsMigration: hasJson && !hasAutomerge
          })
        }

        cursor = result.truncated ? result.cursor : undefined
      } while (cursor)

      // Sort by shape count descending (largest first)
      rooms.sort((a, b) => b.shapeCount - a.shapeCount)

      const summary = {
        total: rooms.length,
        needsMigration: rooms.filter(r => r.needsMigration).length,
        alreadyMigrated: rooms.filter(r => r.hasAutomerge).length,
        largeRooms: rooms.filter(r => r.shapeCount > 5000).length
      }

      return new Response(JSON.stringify({ summary, rooms }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Migration list failed:', error)
      return new Response(JSON.stringify({
        error: 'Failed to list rooms',
        message: (error as Error).message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // Migrate a single room to Automerge format
  .post("/migrate/:roomId", async (request, env) => {
    const roomId = request.params.roomId
    if (!roomId) {
      return new Response(JSON.stringify({ error: 'Room ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      // Import the storage module dynamically
      const { AutomergeR2Storage } = await import('./automerge-r2-storage')
      const storage = new AutomergeR2Storage(env.TLDRAW_BUCKET)

      // Check if already migrated
      const isAutomerge = await storage.isAutomergeFormat(roomId)
      if (isAutomerge) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Room already migrated to Automerge format',
          roomId
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Load legacy JSON
      const jsonObject = await env.TLDRAW_BUCKET.get(`rooms/${roomId}`)
      if (!jsonObject) {
        return new Response(JSON.stringify({
          error: 'Room not found',
          roomId
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const jsonDoc = await jsonObject.json() as { store?: Record<string, any>; schema?: any }
      const recordCount = jsonDoc.store ? Object.keys(jsonDoc.store).length : 0
      const shapeCount = jsonDoc.store ? Object.values(jsonDoc.store).filter((r: any) => r?.typeName === 'shape').length : 0

      console.log(`🔄 Starting migration for room ${roomId}: ${shapeCount} shapes, ${recordCount} records`)

      // Perform migration
      const startTime = Date.now()
      const doc = await storage.migrateFromJson(roomId, jsonDoc as any)
      const duration = Date.now() - startTime

      if (!doc) {
        throw new Error('Migration returned null')
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Room migrated successfully',
        roomId,
        shapeCount,
        recordCount,
        durationMs: duration
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error(`Migration failed for room ${roomId}:`, error)
      return new Response(JSON.stringify({
        error: 'Migration failed',
        roomId,
        message: (error as Error).message
      }), {
        status: 500,
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
