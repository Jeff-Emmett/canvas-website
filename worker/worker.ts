import { handleUnfurlRequest } from 'cloudflare-workers-unfurl'
import { AutoRouter, cors, error, IRequest } from 'itty-router'
import { handleAssetDownload, handleAssetUpload } from './assetUploads'
import { Environment } from './types'

// make sure our sync durable object is made available to cloudflare
export { TldrawDurableObject } from './TldrawDurableObject'

// Define security headers
const securityHeaders = {
	'Content-Security-Policy': "default-src 'self'; connect-src 'self' wss: https:; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'X-XSS-Protection': '1; mode=block',
	'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
}

// we use itty-router (https://itty.dev/) to handle routing. in this example we turn on CORS because
// we're hosting the worker separately to the client. you should restrict this to your own domain.
const { preflight, corsify } = cors({
	origin: (origin) => {
		const allowedOrigins = [
			'http://localhost:5172',
			'http://192.168.1.7:5172',
			'https://jeffemmett.com'
		]
		return allowedOrigins.includes(origin) ? origin : undefined
	},
	allowMethods: ['GET', 'POST', 'OPTIONS', 'UPGRADE'],
	allowHeaders: [
		'Content-Type',
		'Authorization',
		'Upgrade',
		'Connection',
		'Sec-WebSocket-Key',
		'Sec-WebSocket-Version',
		'Sec-WebSocket-Extensions',
		'Sec-WebSocket-Protocol',
		...Object.keys(securityHeaders)
	],
	maxAge: 86400,
})
const router = AutoRouter<IRequest, [env: Environment, ctx: ExecutionContext]>({
	before: [preflight],
	finally: [(response) => {
		// Add security headers to all responses except WebSocket upgrades
		if (response.status !== 101) {
			Object.entries(securityHeaders).forEach(([key, value]) => {
				response.headers.set(key, value)
			})
		}
		return corsify(response)
	}],
	catch: (e) => {
		console.error(e)
		return error(e)
	},
})
	// requests to /connect are routed to the Durable Object, and handle realtime websocket syncing
	.get('/connect/:roomId', (request, env) => {
		const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId)
		const room = env.TLDRAW_DURABLE_OBJECT.get(id)
		return room.fetch(request.url, { headers: request.headers, body: request.body })
	})

	// assets can be uploaded to the bucket under /uploads:
	.post('/uploads/:uploadId', handleAssetUpload)

	// they can be retrieved from the bucket too:
	.get('/uploads/:uploadId', handleAssetDownload)

	// bookmarks need to extract metadata from pasted URLs:
	.get('/unfurl', handleUnfurlRequest)

	.get('/room/:roomId', async (request, env) => {
		const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId)
		const room = env.TLDRAW_DURABLE_OBJECT.get(id)
		const response = await room.fetch(request.url)
		return response
	})

	.post('/room/:roomId', async (request, env) => {
		const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId)
		const room = env.TLDRAW_DURABLE_OBJECT.get(id)
		return room.fetch(request.url, {
			method: 'POST',
			body: request.body
		})
	})

// export our router for cloudflare
export default router
