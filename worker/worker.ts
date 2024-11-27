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
		if (!origin ||
			origin.startsWith('http://localhost') ||
			origin.startsWith('ws://localhost')) {
			return '*';
		}

		const allowedPatterns = [
			// Localhost with any port
			/^http:\/\/localhost:\d+$/,
			// 127.0.0.1 with any port
			/^http:\/\/127\.0\.0\.1:\d+$/,
			// 192.168.*.* with any port
			/^http:\/\/192\.168\.\d+\.\d+:\d+$/,
			// 169.254.*.* with any port
			/^http:\/\/169\.254\.\d+\.\d+:\d+$/,
			// 10.*.*.* with any port
			/^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
			// Production domain
			/^https:\/\/jeffemmett\.com$/,
			// Allow ws:// in development
			/^ws:\/\/localhost:\d+$/,
			// Allow wss:// in development
			/^wss:\/\/localhost:\d+$/
		]

		// Check if origin matches any of our patterns
		const isAllowed = allowedPatterns.some(pattern =>
			pattern instanceof RegExp
				? pattern.test(origin)
				: pattern === origin
		)

		return isAllowed ? origin : undefined
	},
	allowMethods: ['GET', 'POST', 'OPTIONS', 'UPGRADE', 'CONNECT'],
	allowHeaders: [
		'Content-Type',
		'Authorization',
		'Upgrade',
		'Connection',
		'Sec-WebSocket-Key',
		'Sec-WebSocket-Version',
		'Sec-WebSocket-Extensions',
		'Sec-WebSocket-Protocol',
		...Object.keys(securityHeaders),
		'Upgrade-Insecure-Requests'
	],
	maxAge: 86400,
})
const router = AutoRouter<IRequest, [env: Environment, ctx: ExecutionContext]>({
	before: [preflight],
	finally: [(response) => {
		// Only add security headers to non-WebSocket responses
		if (response.status !== 101) {
			const newHeaders = new Headers(response.headers);
			Object.entries(securityHeaders).forEach(([key, value]) => {
				newHeaders.set(key, value);
			});
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: newHeaders
			});
		}
		return corsify(response);
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
		return room.fetch(request.url, {
			headers: request.headers,
			method: request.method,
			body: request.body
		})
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
