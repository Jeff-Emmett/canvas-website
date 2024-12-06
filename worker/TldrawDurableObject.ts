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
import { ChatBoxShapeUtil } from '@/shapes/ChatBoxShapeUtil'
import { VideoChatShapeUtil } from '@/shapes/VideoChatShapeUtil'
import { EmbedShapeUtil } from '@/shapes/EmbedShapeUtil'
//import GSet from 'crdts/src/G-Set'
import { Store, SerializedStore, StoreSchema } from '@tldraw/store'
import { createTLStore } from '@tldraw/tldraw'
import { TLStoreSchemaOptions } from '@tldraw/editor'


// Create the store schema
export const customSchema = createTLSchema({
	shapes: {
		...defaultShapeSchemas,
		ChatBox: ChatBoxShapeUtil.schema,
		VideoChat: VideoChatShapeUtil.schema,
		Embed: EmbedShapeUtil.schema
	},
	// Optional: add bindings if needed
	bindings: {}
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
	private store: ReturnType<typeof createTLStore>

	constructor(
		private readonly ctx: DurableObjectState,
		env: Environment
	) {
		this.r2 = env.TLDRAW_BUCKET
		this.store = createTLStore({
			schema: customSchema,
		})

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
			// Set roomId if not already set
			if (!this.roomId) {
				await this.ctx.blockConcurrencyWhile(async () => {
					await this.ctx.storage.put('roomId', request.params.roomId)
					this.roomId = request.params.roomId
				})
			}

			const records = await request.json() as TLRecord[]
			const mergedRecords = await this.mergeTLDrawState(records)
			return new Response(JSON.stringify(Array.from(mergedRecords)))
		})

	// `fetch` is the entry point for all requests to the Durable Object
	fetch(request: Request): Response | Promise<Response> {
		// Handle WebSocket upgrade requests
		if (request.headers.get('Upgrade') === 'websocket') {
			return this.handleConnect(request as unknown as IRequest);
		}

		// Handle regular HTTP requests through the router
		return this.router.fetch(request as unknown as IRequest);
	}

	// what happens when someone tries to connect to this room?
	async handleConnect(request: IRequest): Promise<Response> {
		try {
			const upgradeHeader = request.headers.get('Upgrade')
			if (!upgradeHeader || upgradeHeader !== 'websocket') {
				return new Response('Expected Upgrade: websocket', { status: 426 })
			}

			// Extract roomId from URL
			const url = new URL(request.url)
			const roomId = url.pathname.split('/').pop()

			if (!roomId) {
				return new Response('Missing roomId', { status: 400 })
			}

			// Set roomId if not already set
			if (!this.roomId) {
				await this.ctx.blockConcurrencyWhile(async () => {
					await this.ctx.storage.put('roomId', roomId)
					this.roomId = roomId
				})
			}

			const webSocketPair = new WebSocketPair()
			const [client, server] = Object.values(webSocketPair)

			server.accept()

			// Get room and initial state
			const room = await this.getRoom()
			const snapshot = room.getCurrentSnapshot()

			// Add connection to TLSocketRoom first
			const sessionId = crypto.randomUUID()
			room.handleSocketConnect({
				sessionId,
				socket: server
			});

			// Send initial state with room snapshot data
			if (snapshot?.documents) {
				server.send(JSON.stringify({
					type: 'initial-state',
					data: {
						records: snapshot.documents.map(doc => ({
							...doc.state,
							typeName: doc.state.typeName,
							id: doc.state.id
						}))
					}
				}));
			}

			// Handle updates from client
			server.addEventListener('message', async (event) => {
				try {
					const data = JSON.parse(event.data as string);
					if (data.type === 'ping') {
						server.send(JSON.stringify({ type: 'pong' }));
					} else if (data.type === 'update') {
						const mergedRecords = await this.mergeTLDrawState(data.records);
						room.updateStore((store) => {
							for (const record of mergedRecords) {
								store.put(record);
							}
						});

						// Broadcast to all sessions
						const sessions = room.getSessions();
						const message = JSON.stringify({
							type: 'update',
							data: Array.from(mergedRecords)
						});

						sessions.forEach(session => {
							if (session.isConnected) {
								room.handleSocketMessage(session.sessionId, message);
							}
						});
					}
				} catch (error) {
					console.error('Error handling message:', error);
				}
			});

			return new Response(null, {
				status: 101,
				webSocket: client,
			});
		} catch (error) {
			console.error('WebSocket connection error:', error);
			return new Response('Internal Server Error', { status: 500 });
		}
	}

	async getRoom() {
		const roomId = this.roomId
		if (!roomId) throw new Error('Missing roomId')

		if (!this.roomPromise) {
			this.roomPromise = (async () => {
				// First check R2 for existing room
				console.log('Fetching room from R2:', roomId);
				const roomFromBucket = await this.r2.get(`rooms/${roomId}`)

				let initialSnapshot: RoomSnapshot | undefined;

				if (roomFromBucket) {
					try {
						const data = await roomFromBucket.json() as RoomSnapshot;
						initialSnapshot = {
							clock: data.clock,
							schema: customSchema.serialize(),
							documents: data.documents.map(doc => ({
								lastChangedClock: doc.lastChangedClock,
								state: {
									...doc.state,
									typeName: doc.state.typeName,
									id: doc.state.id
								}
							}))
						};
					} catch (e) {
						console.error('Error parsing room data:', e);
					}
				}

				const room = new TLSocketRoom<TLRecord, void>({
					schema: customSchema,
					initialSnapshot,
					onDataChange: () => {
						const snapshot = room.getCurrentSnapshot();
						// Store in both DO and R2
						this.ctx.storage.put('room', snapshot);
						this.schedulePersistToR2();
					},
				});

				return room;
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

	async mergeTLDrawState(records: TLRecord[]) {
		const room = await this.getRoom();
		const snapshot = room.getCurrentSnapshot();

		if (!snapshot) {
			throw new Error('Room store not initialized')
		}

		const store = createTLStore({
			schema: customSchema,
		});

		store.mergeRemoteChanges(() => {
			// Handle existing records
			for (const record of snapshot.documents) {
				if (record && record.state && record.state.typeName) {
					store.put([record.state] as TLRecord[]);
				}
			}

			// Handle new records
			for (const record of records) {
				if (record && record.typeName) {
					store.put([record]);
				}
			}
		});

		return Array.from(store.allRecords());
	}

}

// Function to merge TLDraw store states
export function mergeTLDrawState(
	existingRecords: TLRecord[],
	newRecords: TLRecord[],
): TLRecord[] {
	const store = createTLStore({
		schema: customSchema,
	})

	store.mergeRemoteChanges(() => {
		const validExistingRecords = existingRecords?.filter(record => record?.typeName && record?.id) || [];
		const validNewRecords = newRecords?.filter(record => record?.typeName && record?.id) || [];

		for (const record of validExistingRecords) {
			store.put([record]);
		}

		for (const record of validNewRecords) {
			store.put([record]);
		}
	})

	return Array.from(store.allRecords());
}
