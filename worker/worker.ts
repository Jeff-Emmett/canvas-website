import { AutoRouter, cors, error, IRequest } from "itty-router"
import { handleAssetDownload, handleAssetUpload } from "./assetUploads"
import { Environment } from "./types"

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
        
        // Store in backup bucket as JSON with proper content-type
        await env.BOARD_BACKUPS_BUCKET.put(backupKey, jsonData, {
          httpMetadata: {
            contentType: 'application/json'
          }
        })
        
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
