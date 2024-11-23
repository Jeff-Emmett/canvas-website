import { handleUnfurlRequest } from 'cloudflare-workers-unfurl'
import { AutoRouter, cors, error, IRequest } from 'itty-router'
import { handleAssetDownload, handleAssetUpload } from './assetUploads'
import { Environment } from './types'

// make sure our sync durable object is made available to cloudflare
export { TldrawDurableObject } from './TldrawDurableObject'

// we use itty-router (https://itty.dev/) to handle routing. in this example we turn on CORS because
// we're hosting the worker separately to the client. you should restrict this to your own domain.
const { preflight, corsify } = cors({
	origin: '*',
	allowMethods: 'GET, POST, PUT, DELETE, OPTIONS',
	allowHeaders: {
		'Access-Control-Allow-Headers': '*',
		'Cross-Origin-Opener-Policy': 'same-origin',
		'Cross-Origin-Embedder-Policy': 'require-corp',
		'Upgrade': 'websocket',
		'Connection': 'Upgrade',
		'Sec-WebSocket-Key': '*',
		'Sec-WebSocket-Version': '*',
		'Sec-WebSocket-Protocol': '*'
	}
})

const addSecurityHeaders = (response: Response): Response => {
	const headers = new Headers(response.headers)
	headers.set('Cross-Origin-Opener-Policy', 'same-origin')
	headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
	return new Response(response.body, {
		status: response.status,
		headers
	})
}

const router = AutoRouter<IRequest, [env: Environment, ctx: ExecutionContext]>({
	before: [preflight],
	finally: [(response) => corsify(addSecurityHeaders(response))],
	catch: (e) => {
		console.error(e)
		return error(e)
	},
})
	// requests to /connect are routed to the Durable Object, and handle realtime websocket syncing
	.get('/connect/:roomId', async (request, env) => {
		const upgradeHeader = request.headers.get('Upgrade')
		if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
			return new Response('Expected Upgrade: websocket', { status: 426 })
		}

		const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId)
		const room = env.TLDRAW_DURABLE_OBJECT.get(id)
		return room.fetch(request.url, {
			headers: request.headers,
			body: request.body,
			method: request.method
		})
	})

	// assets can be uploaded to the bucket under /uploads:
	.post('/uploads/:uploadId', handleAssetUpload)

	// they can be retrieved from the bucket too:
	.get('/uploads/:uploadId', handleAssetDownload)

	// bookmarks need to extract metadata from pasted URLs:
	.get('/unfurl', handleUnfurlRequest)

// export our router for cloudflare
export default router
