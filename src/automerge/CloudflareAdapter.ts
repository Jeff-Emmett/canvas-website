import { Repo, DocHandle, NetworkAdapter, PeerId, PeerMetadata, Message } from "@automerge/automerge-repo"
import { TLStoreSnapshot } from "@tldraw/tldraw"
import { init } from "./index"

export class CloudflareAdapter {
  private repo: Repo
  private handles: Map<string, DocHandle<TLStoreSnapshot>> = new Map()
  private workerUrl: string
  private networkAdapter: CloudflareNetworkAdapter
  // Track last persisted state to detect changes
  private lastPersistedState: Map<string, string> = new Map()

  constructor(workerUrl: string, roomId?: string) {
    this.workerUrl = workerUrl
    this.networkAdapter = new CloudflareNetworkAdapter(workerUrl, roomId)
    
    // Create repo with network adapter
    this.repo = new Repo({
      sharePolicy: async () => true, // Allow sharing with all peers
      network: [this.networkAdapter],
    })
  }

  async getHandle(roomId: string): Promise<DocHandle<TLStoreSnapshot>> {
    if (!this.handles.has(roomId)) {
      const handle = this.repo.create<TLStoreSnapshot>()

      // Initialize with default store if this is a new document
      handle.change((doc) => {
        if (!doc.store) {
          init(doc)
        }
      })

      this.handles.set(roomId, handle)
    }

    return this.handles.get(roomId)!
  }

  // Generate a simple hash of the document state for change detection
  private generateDocHash(doc: any): string {
    // Create a stable string representation of the document
    // Focus on the store data which is what actually changes
    const storeData = doc.store || {}
    const storeKeys = Object.keys(storeData).sort()
    
    // CRITICAL FIX: JSON.stringify's second parameter when it's an array is a replacer
    // that only includes those properties. We need to stringify the entire store object.
    // To ensure stable ordering, create a new object with sorted keys
    const sortedStore: any = {}
    for (const key of storeKeys) {
      sortedStore[key] = storeData[key]
    }
    const storeString = JSON.stringify(sortedStore)
    
    // Simple hash function (you could use a more sophisticated one if needed)
    let hash = 0
    for (let i = 0; i < storeString.length; i++) {
      const char = storeString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    const hashString = hash.toString()
    return hashString
  }

  async saveToCloudflare(roomId: string): Promise<void> {
    const handle = this.handles.get(roomId)
    if (!handle) {
      return
    }

    const doc = handle.doc()
    if (!doc) {
      return
    }

    // Generate hash of current document state
    const currentHash = this.generateDocHash(doc)
    const lastHash = this.lastPersistedState.get(roomId)


    // Skip save if document hasn't changed
    if (currentHash === lastHash) {
      return
    }

    try {
      const response = await fetch(`${this.workerUrl}/room/${roomId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(doc),
      })

      if (!response.ok) {
        throw new Error(`Failed to save to Cloudflare: ${response.statusText}`)
      }

      // Update last persisted state only after successful save
      this.lastPersistedState.set(roomId, currentHash)
    } catch (error) {
      console.error('Error saving to Cloudflare:', error)
    }
  }

  async loadFromCloudflare(roomId: string): Promise<TLStoreSnapshot | null> {
    try {
      // Add retry logic for connection issues
      let response: Response;
      let retries = 3;
      while (retries > 0) {
        try {
          response = await fetch(`${this.workerUrl}/room/${roomId}`)
          break;
        } catch (error) {
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw error;
          }
        }
      }

      if (!response!.ok) {
        if (response!.status === 404) {
          return null // Room doesn't exist yet
        }
        console.error(`Failed to load from Cloudflare: ${response!.status} ${response!.statusText}`)
        throw new Error(`Failed to load from Cloudflare: ${response!.statusText}`)
      }

      const doc = await response!.json() as TLStoreSnapshot

      // Initialize the last persisted state with the loaded document
      if (doc) {
        const docHash = this.generateDocHash(doc)
        this.lastPersistedState.set(roomId, docHash)
      }

      return doc
    } catch (error) {
      console.error('Error loading from Cloudflare:', error)
      return null
    }
  }
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export class CloudflareNetworkAdapter extends NetworkAdapter {
  private workerUrl: string
  private websocket: WebSocket | null = null
  private roomId: string | null = null
  public peerId: PeerId | undefined = undefined
  public sessionId: string | null = null  // Track our session ID
  private serverPeerId: PeerId | null = null  // The server's peer ID for Automerge sync
  private currentDocumentId: string | null = null  // Track the current document ID for sync messages
  private pendingBinaryMessages: Uint8Array[] = []  // Buffer for binary messages received before documentId is set
  private readyPromise: Promise<void>
  private readyResolve: (() => void) | null = null
  private keepAliveInterval: NodeJS.Timeout | null = null
  private reconnectTimeout: NodeJS.Timeout | null = null
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectDelay: number = 1000
  private isConnecting: boolean = false
  private onJsonSyncData?: (data: any) => void
  private onPresenceUpdate?: (userId: string, data: any, senderId?: string, userName?: string, userColor?: string) => void
  private onPresenceLeave?: (sessionId: string) => void

  // Binary sync mode - when true, uses native Automerge sync protocol
  private useBinarySync: boolean = true

  // Connection state tracking
  private _connectionState: ConnectionState = 'disconnected'
  private connectionStateListeners: Set<(state: ConnectionState) => void> = new Set()
  private _isNetworkOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true

  get connectionState(): ConnectionState {
    return this._connectionState
  }

  get isNetworkOnline(): boolean {
    return this._isNetworkOnline
  }

  private setConnectionState(state: ConnectionState): void {
    if (this._connectionState !== state) {
      this._connectionState = state
      this.connectionStateListeners.forEach(listener => listener(state))
    }
  }

  onConnectionStateChange(listener: (state: ConnectionState) => void): () => void {
    this.connectionStateListeners.add(listener)
    // Immediately call with current state
    listener(this._connectionState)
    return () => this.connectionStateListeners.delete(listener)
  }

  private networkOnlineHandler: () => void
  private networkOfflineHandler: () => void

  constructor(
    workerUrl: string,
    roomId?: string,
    onJsonSyncData?: (data: any) => void,
    onPresenceUpdate?: (userId: string, data: any, senderId?: string, userName?: string, userColor?: string) => void,
    onPresenceLeave?: (sessionId: string) => void
  ) {
    super()
    this.workerUrl = workerUrl
    this.roomId = roomId || 'default-room'
    this.onJsonSyncData = onJsonSyncData
    this.onPresenceUpdate = onPresenceUpdate
    this.onPresenceLeave = onPresenceLeave
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve
    })

    // Set up network online/offline listeners
    this.networkOnlineHandler = () => {
      this._isNetworkOnline = true
      // Trigger reconnect if we were disconnected
      if (this._connectionState === 'disconnected' && this.peerId) {
        this.setConnectionState('reconnecting')
        this.connect(this.peerId)
      }
    }
    this.networkOfflineHandler = () => {
      this._isNetworkOnline = false
      if (this._connectionState === 'connected') {
        this.setConnectionState('disconnected')
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.networkOnlineHandler)
      window.addEventListener('offline', this.networkOfflineHandler)
    }
  }

  isReady(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN
  }

  whenReady(): Promise<void> {
    return this.readyPromise
  }

  /**
   * Set the document ID for this adapter
   * This is needed because the server may send sync messages before we've sent any
   * @param documentId The Automerge document ID to use for incoming messages
   */
  setDocumentId(documentId: string): void {
    const previousDocId = this.currentDocumentId
    this.currentDocumentId = documentId

    // Process any buffered binary messages now that we have a documentId
    if (this.pendingBinaryMessages.length > 0) {
      const bufferedMessages = this.pendingBinaryMessages
      this.pendingBinaryMessages = []

      for (const binaryData of bufferedMessages) {
        const message: Message = {
          type: 'sync',
          data: binaryData,
          senderId: this.serverPeerId || ('server' as PeerId),
          targetId: this.peerId || ('unknown' as PeerId),
          documentId: this.currentDocumentId as any
        }
        this.emit('message', message)
      }
    }

    // CRITICAL: Re-emit peer-candidate now that we have a documentId
    // This triggers the Repo to sync this document with the server peer
    // Without this, the Repo may have connected before the document was created
    // and won't know to sync the document with the peer
    if (this.serverPeerId && this.websocket?.readyState === WebSocket.OPEN && !previousDocId) {
      this.emit('peer-candidate', {
        peerId: this.serverPeerId,
        peerMetadata: { storageId: undefined, isEphemeral: false }
      })
    }
  }

  /**
   * Get the current document ID
   */
  getDocumentId(): string | null {
    return this.currentDocumentId
  }

  connect(peerId: PeerId, peerMetadata?: PeerMetadata): void {
    if (this.isConnecting) {
      return
    }

    // Store peerId
    this.peerId = peerId

    // Set connection state
    this.setConnectionState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting')

    // Clean up existing connection
    this.cleanup()

    // Use the room ID from constructor or default
    // Add sessionId as a query parameter as required by AutomergeDurableObject
    const sessionId = peerId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.sessionId = sessionId  // Store our session ID for filtering echoes

    // Convert https:// to wss:// or http:// to ws://
    const protocol = this.workerUrl.startsWith('https://') ? 'wss://' : 'ws://'
    const baseUrl = this.workerUrl.replace(/^https?:\/\//, '')
    const wsUrl = `${protocol}${baseUrl}/connect/${this.roomId}?sessionId=${sessionId}`

    this.isConnecting = true

    // Add a small delay to ensure the server is ready
    setTimeout(() => {
      try {
        this.websocket = new WebSocket(wsUrl)
        
        this.websocket.onopen = () => {
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.setConnectionState('connected')
          this.readyResolve?.()
          this.startKeepAlive()

          // Emit 'ready' event for Automerge Repo
          ;(this as any).emit('ready', { network: this })

          // Create a server peer ID based on the room
          this.serverPeerId = `server-${this.roomId}` as PeerId

          // Emit 'peer-candidate' to announce the server as a sync peer
          this.emit('peer-candidate', {
            peerId: this.serverPeerId,
            peerMetadata: { storageId: undefined, isEphemeral: false }
          })
        }

        this.websocket.onmessage = (event) => {
          try {
            // Automerge's native protocol uses binary messages
            // We need to handle both binary and text messages
            if (event.data instanceof ArrayBuffer) {
              const binaryData = new Uint8Array(event.data)
              if (!this.currentDocumentId) {
                this.pendingBinaryMessages.push(binaryData)
                return
              }
              const message: Message = {
                type: 'sync',
                data: binaryData,
                senderId: this.serverPeerId || ('server' as PeerId),
                targetId: this.peerId || ('unknown' as PeerId),
                documentId: this.currentDocumentId as any
              }
              this.emit('message', message)
            } else if (event.data instanceof Blob) {
              event.data.arrayBuffer().then((buffer) => {
                const binaryData = new Uint8Array(buffer)
                if (!this.currentDocumentId) {
                  this.pendingBinaryMessages.push(binaryData)
                  return
                }
                const message: Message = {
                  type: 'sync',
                  data: binaryData,
                  senderId: this.serverPeerId || ('server' as PeerId),
                  targetId: this.peerId || ('unknown' as PeerId),
                  documentId: this.currentDocumentId as any
                }
                this.emit('message', message)
              })
            } else {
              // Handle text messages (our custom protocol for backward compatibility)
              const message = JSON.parse(event.data)

              // Handle ping/pong messages for keep-alive
              if (message.type === 'ping') {
                this.sendPong()
                return
              }

              // Handle test messages
              if (message.type === 'test') {
                return
              }

              // Handle presence updates from other clients
              if (message.type === 'presence') {
                if (this.onPresenceUpdate && message.userId && message.data) {
                  this.onPresenceUpdate(message.userId, message.data, message.senderId, message.userName, message.userColor)
                }
                return
              }

              // Handle leave messages (user disconnected)
              if (message.type === 'leave') {
                if (this.onPresenceLeave && message.sessionId) {
                  this.onPresenceLeave(message.sessionId)
                }
                return
              }

              // Convert the message to the format expected by Automerge
              if (message.type === 'sync' && message.data) {
                // JSON sync for real-time collaboration
                const isJsonDocumentData = message.data && typeof message.data === 'object' && message.data.store

                if (isJsonDocumentData) {
                  if (this.onJsonSyncData) {
                    this.onJsonSyncData(message.data)
                  }
                  return
                }

                // Validate documentId format
                const isValidDocumentId = message.documentId &&
                  (typeof message.documentId === 'string' &&
                   (message.documentId.startsWith('automerge:') ||
                    message.documentId.includes(':') ||
                    /^[a-f0-9-]{36,}$/i.test(message.documentId)))

                const syncMessage: Message = {
                  type: 'sync',
                  senderId: message.senderId || this.peerId || ('unknown' as PeerId),
                  targetId: message.targetId || this.peerId || ('unknown' as PeerId),
                  data: message.data,
                  ...(isValidDocumentId && { documentId: message.documentId })
                }

                this.emit('message', syncMessage)
              } else if (message.senderId && message.targetId) {
                this.emit('message', message as Message)
              }
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }

        this.websocket.onclose = (event) => {
          this.isConnecting = false
          this.stopKeepAlive()

          if (event.code === 1000) {
            this.setConnectionState('disconnected')
            return // Don't reconnect on normal closure
          }

          // Set state based on whether we'll try to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts && this._isNetworkOnline) {
            this.setConnectionState('reconnecting')
          } else {
            this.setConnectionState('disconnected')
          }

          this.emit('close')

          // Attempt to reconnect with exponential backoff
          this.scheduleReconnect(peerId, peerMetadata)
        }

        this.websocket.onerror = () => {
          this.isConnecting = false
        }
      } catch (error) {
        console.error('Failed to create WebSocket:', error)
        this.isConnecting = false
        return
      }
    }, 100)
  }

  send(message: Message): void {
    // Capture documentId from outgoing sync messages
    if (message.type === 'sync' && (message as any).documentId) {
      const docId = (message as any).documentId
      if (this.currentDocumentId !== docId) {
        this.currentDocumentId = docId
      }
    }

    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      // Check if this is a binary sync message from Automerge Repo
      if (message.type === 'sync' && (message as any).data instanceof ArrayBuffer) {
        this.websocket.send((message as any).data)
        return
      } else if (message.type === 'sync' && (message as any).data instanceof Uint8Array) {
        this.websocket.send((message as any).data)
        return
      } else {
        this.websocket.send(JSON.stringify(message))
      }
    }
  }

  broadcast(message: Message): void {
    // For WebSocket-based adapters, broadcast is the same as send
    // since we're connected to a single server that handles broadcasting
    this.send(message)
  }

  disconnect(): void {
    this.cleanup()
    this.roomId = null
    this.setConnectionState('disconnected')

    // Clean up network listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.networkOnlineHandler)
      window.removeEventListener('offline', this.networkOfflineHandler)
    }
    this.connectionStateListeners.clear()

    this.emit('close')
  }

  private cleanup(): void {
    this.stopKeepAlive()
    this.clearReconnectTimeout()

    if (this.websocket) {
      // Send leave message before closing to notify other clients
      if (this.websocket.readyState === WebSocket.OPEN && this.sessionId) {
        try {
          this.websocket.send(JSON.stringify({
            type: 'leave',
            sessionId: this.sessionId
          }))
        } catch (e) {
          // Ignore errors when sending leave message
        }
      }
      this.websocket.close(1000, 'Client disconnecting')
      this.websocket = null
    }
  }

  private startKeepAlive(): void {
    // Send ping every 30 seconds to prevent idle timeout
    this.keepAliveInterval = setInterval(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }))
      }
    }, 30000)
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = null
    }
  }

  private sendPong(): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: 'pong',
        timestamp: Date.now()
      }))
    }
  }

  private scheduleReconnect(peerId: PeerId, peerMetadata?: PeerMetadata): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000)

    this.reconnectTimeout = setTimeout(() => {
      if (this.roomId) {
        this.connect(peerId, peerMetadata)
      }
    }, delay)
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
  }
}
