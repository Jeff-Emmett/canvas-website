/// <reference types="@cloudflare/workers-types" />

import { RoomSnapshot, TLSocketRoom } from '@tldraw/sync-core'
import {
	TLRecord,
	TLShape,
	createTLSchema,
	// defaultBindingSchemas,
	defaultShapeSchemas,
} from '@tldraw/tlschema'
import { AutoRouter, IRequest, error } from 'itty-router'
import throttle from 'lodash.throttle'
import { Environment } from './types'
import { ChatBoxShape } from '@/shapes/ChatBoxShapeUtil'
import { VideoChatShape } from '@/shapes/VideoChatShapeUtil'
import { EmbedShape } from '@/shapes/EmbedShapeUtil'
import GSet from 'crdts/src/G-Set'

// add custom shapes and bindings here if needed:
export const customSchema = createTLSchema({
	shapes: {
		...defaultShapeSchemas,
		ChatBox: ChatBoxShape,
		VideoChat: VideoChatShape,
		Embed: EmbedShape
	},
	// bindings: { ...defaultBindingSchemas },
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

	constructor(
		private readonly ctx: DurableObjectState,
		env: Environment
	) {
		this.r2 = env.TLDRAW_BUCKET

		ctx.blockConcurrencyWhile(async () => {
			this.roomId = ((await this.ctx.storage.get('roomId')) ?? null) as string | null
		})
	}

	private readonly router = AutoRouter({
		catch: (e) => {
			console.log(e)
			return error(e)
		},
	})
		// when we get a connection request, we stash the room id if needed and handle the connection
		.get('/connect/:roomId', async (request) => {
			if (!this.roomId) {
				await this.ctx.blockConcurrencyWhile(async () => {
					await this.ctx.storage.put('roomId', request.params.roomId)
					this.roomId = request.params.roomId
				})
			}
			return this.handleConnect(request)
		})
		.get('/room/:roomId', async () => {
			const room = await this.getRoom()
			const snapshot = room.getCurrentSnapshot()
			return new Response(JSON.stringify(snapshot.documents))
		})
		.post('/room/:roomId', async (request) => {
			const records = await request.json() as TLRecord[]
			const mergedRecords = await this.mergeCrdtState(records)
			return new Response(JSON.stringify(Array.from(mergedRecords)))
		})

	// `fetch` is the entry point for all requests to the Durable Object
	fetch(request: Request): Response | Promise<Response> {
		return this.router.fetch(request)
	}

	// what happens when someone tries to connect to this room?
	async handleConnect(request: IRequest): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade')
		if (!upgradeHeader || upgradeHeader !== 'websocket') {
			return new Response('Expected Upgrade: websocket', { status: 426 })
		}

		const webSocketPair = new WebSocketPair()
		const [client, server] = Object.values(webSocketPair)

		server.accept()

		// Get room and initial state immediately
		const room = await this.getRoom()
		const snapshot = room.getCurrentSnapshot()

		// Add connection to TLSocketRoom first
		const sessionId = crypto.randomUUID()
		room.handleSocketConnect({
			sessionId,
			socket: server
		});

		// Send initial state right after connection
		if (snapshot && snapshot.documents) {
			const normalizedDocuments = snapshot.documents.map(doc => {
				const state = doc.state;

				// Handle documents
				if (state.id.startsWith('document:')) {
					return {
						...state,
						typeName: 'document'
					} as TLRecord;
				}

				// Handle pages
				if (state.id.startsWith('page:')) {
					return {
						...state,
						typeName: 'page'
					} as TLRecord;
				}

				// Handle actual shapes
				return {
					...state,
					id: state.id.startsWith('shape:') ? state.id : `shape:${state.id}`,
					type: (state as { type?: string }).type || 'draw',
					typeName: 'shape',
					x: (state as any).x || 0,
					y: (state as any).y || 0,
					rotation: (state as any).rotation || 0,
					isLocked: (state as any).isLocked || false,
					opacity: (state as any).opacity || 1,
					props: (state as any).props || {}
				} as TLRecord;
			});

			console.log('Room snapshot:', {
				hasDocuments: !!snapshot?.documents,
				documentCount: snapshot?.documents?.length,
				documents: snapshot?.documents
			});

			console.log('Normalized documents:', normalizedDocuments);

			server.send(JSON.stringify({
				type: 'initial-state',
				data: {
					documents: normalizedDocuments
				}
			}));
		}

		// Set up error handling and heartbeat after state is sent
		server.addEventListener('error', (err) => {
			console.error('WebSocket error:', err)
		})

		server.addEventListener('close', () => {
			console.log('WebSocket closed')
		})

		// Heartbeat setup
		const startHeartbeat = () => {
			const pingInterval = setInterval(() => {
				if (server.readyState === 1) {
					server.send(JSON.stringify({ type: 'ping' }));
				}
			}, 10000);

			server.addEventListener('close', () => {
				clearInterval(pingInterval);
			});
		};

		startHeartbeat();

		return new Response(null, {
			status: 101,
			webSocket: client,
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Headers': '*',
				'Sec-WebSocket-Protocol': request.headers.get('Sec-WebSocket-Protocol') || '',
			},
		})
	}

	getRoom() {
		const roomId = this.roomId
		if (!roomId) throw new Error('Missing roomId')

		if (!this.roomPromise) {
			this.roomPromise = (async () => {
				// fetch the room from R2
				console.log('Fetching room from R2:', roomId);
				const roomFromBucket = await this.r2.get(`rooms/${roomId}`)
				console.log('Room from bucket exists:', !!roomFromBucket);
				if (roomFromBucket) {
					const data = await roomFromBucket.json();
					console.log('Room data:', data);
				}
				// if it doesn't exist, we'll just create a new empty room
				const initialSnapshot = roomFromBucket
					? ((await roomFromBucket.json()) as RoomSnapshot)
					: undefined
				if (initialSnapshot) {
					initialSnapshot.documents = initialSnapshot.documents.filter(record => {
						const shape = record.state as TLShape
						return shape.type !== "chatBox"
					})
				}
				// create a new TLSocketRoom. This handles all the sync protocol & websocket connections.
				// it's up to us to persist the room state to R2 when needed though.
				return new TLSocketRoom<TLRecord, void>({
					schema: customSchema,
					initialSnapshot,
					onDataChange: () => {
						// and persist whenever the data in the room changes
						this.schedulePersistToR2()
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

	async mergeCrdtState(records: TLRecord[]) {
		const room = await this.getRoom();
		const gset = new GSet<TLRecord>();

		const store = room.getCurrentSnapshot();
		if (!store) {
			throw new Error('Room store not initialized');
		}

		// First cast to unknown, then to TLRecord
		store.documents.forEach((record) => gset.add(record as unknown as TLRecord));

		// Merge new records 
		records.forEach((record: TLRecord) => gset.add(record));
		return gset.values();
	}
}
