/// <reference types="@cloudflare/workers-types" />

import { IRequest, error } from 'itty-router'
import { Environment } from './types'

// assets are stored in the bucket under the /uploads path
function getAssetObjectName(uploadId: string) {
	return `uploads/${uploadId.replace(/[^a-zA-Z0-9\_\-]+/g, '_')}`
}

// when a user uploads an asset, we store it in the bucket. we only allow image and video assets.
export async function handleAssetUpload(request: IRequest, env: Environment) {
	// Add CORS headers that will be used for both success and error responses
	const corsHeaders = {
		'access-control-allow-origin': '*',
		'access-control-allow-methods': 'GET, POST, HEAD, OPTIONS',
		'access-control-allow-headers': '*',
		'access-control-max-age': '86400',
	}

	// Handle preflight
	if (request.method === 'OPTIONS') {
		return new Response(null, { headers: corsHeaders })
	}

	try {
		const objectName = getAssetObjectName(request.params.uploadId)

		const contentType = request.headers.get('content-type') ?? ''
		if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
			return new Response('Invalid content type', { 
				status: 400,
				headers: corsHeaders
			})
		}

		if (await env.TLDRAW_BUCKET.head(objectName)) {
			return new Response('Upload already exists', {
				status: 409,
				headers: corsHeaders
			})
		}

		await env.TLDRAW_BUCKET.put(objectName, request.body, {
			httpMetadata: request.headers,
		})

		return new Response(JSON.stringify({ ok: true }), {
			headers: {
				...corsHeaders,
				'content-type': 'application/json'
			}
		})
	} catch (error) {
		console.error('Asset upload failed:', error)
		return new Response(JSON.stringify({ error: (error as Error).message }), {
			status: 500,
			headers: {
				...corsHeaders,
				'content-type': 'application/json'
			}
		})
	}
}

// when a user downloads an asset, we retrieve it from the bucket. we also cache the response for performance.
export async function handleAssetDownload(
	request: IRequest,
	env: Environment,
	ctx: ExecutionContext
) {
	// Define CORS headers to be used consistently
	const corsHeaders = {
		'access-control-allow-origin': '*',
		'access-control-allow-methods': 'GET, HEAD, OPTIONS',
		'access-control-allow-headers': '*',
		'access-control-expose-headers': 'content-length, content-range',
		'access-control-max-age': '86400',
	}

	// Handle preflight
	if (request.method === 'OPTIONS') {
		return new Response(null, { headers: corsHeaders })
	}

	try {
		const objectName = getAssetObjectName(request.params.uploadId)

		// Handle cached response
		const cacheKey = new Request(request.url, { headers: request.headers })
		// @ts-ignore
		const cachedResponse = await caches.default.match(cacheKey)
		if (cachedResponse) {
			const headers = new Headers(cachedResponse.headers)
			Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value))
			return new Response(cachedResponse.body, {
				status: cachedResponse.status,
				headers
			})
		}

		// Get from bucket
		const object = await env.TLDRAW_BUCKET.get(objectName, {
			range: request.headers,
			onlyIf: request.headers,
		})

		if (!object) {
			return new Response('Not Found', { 
				status: 404,
				headers: corsHeaders
			})
		}

		// Set up response headers
		const headers = new Headers()
		object.writeHttpMetadata(headers)
		Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value))
		
		headers.set('cache-control', 'public, max-age=31536000, immutable')
		headers.set('etag', object.httpEtag)
		headers.set('cross-origin-resource-policy', 'cross-origin')
		headers.set('cross-origin-opener-policy', 'same-origin')
		headers.set('cross-origin-embedder-policy', 'require-corp')

		// Handle content range
		let contentRange
		if (object.range) {
			if ('suffix' in object.range) {
				const start = object.size - object.range.suffix
				const end = object.size - 1
				contentRange = `bytes ${start}-${end}/${object.size}`
			} else {
				const start = object.range.offset ?? 0
				const end = object.range.length ? start + object.range.length - 1 : object.size - 1
				if (start !== 0 || end !== object.size - 1) {
					contentRange = `bytes ${start}-${end}/${object.size}`
				}
			}
		}

		if (contentRange) {
			headers.set('content-range', contentRange)
		}

		const body = 'body' in object && object.body ? object.body : null
		const status = body ? (contentRange ? 206 : 200) : 304

		// Cache successful responses
		if (status === 200) {
			const [cacheBody, responseBody] = body!.tee()
			// @ts-ignore
			ctx.waitUntil(caches.default.put(cacheKey, new Response(cacheBody, { headers, status })))
			return new Response(responseBody, { headers, status })
		}

		return new Response(body, { headers, status })
	} catch (error) {
		console.error('Asset download failed:', error)
		return new Response(
			JSON.stringify({ error: (error as Error).message }), 
			{ 
				status: 500,
				headers: {
					...corsHeaders,
					'content-type': 'application/json'
				}
			}
		)
	}
}
