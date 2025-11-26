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
      console.log(`Creating new Automerge handle for room ${roomId}`)
      const handle = this.repo.create<TLStoreSnapshot>()
      
      // Initialize with default store if this is a new document
      handle.change((doc) => {
        if (!doc.store) {
          console.log("Initializing new document with default store")
          init(doc)
        }
      })

      this.handles.set(roomId, handle)
    } else {
      console.log(`Reusing existing Automerge handle for room ${roomId}`)
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
      console.log(`No handle found for room ${roomId}`)
      return
    }

    const doc = handle.doc()
    if (!doc) {
      console.log(`No document found for room ${roomId}`)
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
      console.log(`Successfully loaded document from Cloudflare for room ${roomId}:`, {
        hasStore: !!doc.store,
        storeKeys: doc.store ? Object.keys(doc.store).length : 0
      })
      
      
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

export class CloudflareNetworkAdapter extends NetworkAdapter {
  private workerUrl: string
  private websocket: WebSocket | null = null
  private roomId: string | null = null
  public peerId: PeerId | undefined = undefined
  public sessionId: string | null = null  // Track our session ID
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

  constructor(
    workerUrl: string,
    roomId?: string,
    onJsonSyncData?: (data: any) => void,
    onPresenceUpdate?: (userId: string, data: any, senderId?: string, userName?: string, userColor?: string) => void
  ) {
    super()
    this.workerUrl = workerUrl
    this.roomId = roomId || 'default-room'
    this.onJsonSyncData = onJsonSyncData
    this.onPresenceUpdate = onPresenceUpdate
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve
    })
  }

  isReady(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN
  }

  whenReady(): Promise<void> {
    return this.readyPromise
  }

  connect(peerId: PeerId, peerMetadata?: PeerMetadata): void {
    if (this.isConnecting) {
      console.log('🔌 CloudflareAdapter: Connection already in progress, skipping')
      return
    }

    // Store peerId
    this.peerId = peerId

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
        console.log('🔌 CloudflareAdapter: Creating WebSocket connection to:', wsUrl)
        this.websocket = new WebSocket(wsUrl)
        
        this.websocket.onopen = () => {
          console.log('🔌 CloudflareAdapter: WebSocket connection opened successfully')
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.readyResolve?.()
          this.startKeepAlive()
        }

        this.websocket.onmessage = (event) => {
          try {
            // Automerge's native protocol uses binary messages
            // We need to handle both binary and text messages
            if (event.data instanceof ArrayBuffer) {
              console.log('🔌 CloudflareAdapter: Received binary message (Automerge protocol)')
              // Handle binary Automerge sync messages - convert ArrayBuffer to Uint8Array
              // Automerge Repo expects binary sync messages as Uint8Array
              const message: Message = {
                type: 'sync',
                data: new Uint8Array(event.data),
                senderId: this.peerId || ('unknown' as PeerId),
                targetId: this.peerId || ('unknown' as PeerId)
              }
              this.emit('message', message)
            } else if (event.data instanceof Blob) {
              // Handle Blob messages (convert to Uint8Array)
              event.data.arrayBuffer().then((buffer) => {
                console.log('🔌 CloudflareAdapter: Received Blob message, converted to Uint8Array')
                const message: Message = {
                  type: 'sync',
                  data: new Uint8Array(buffer),
                  senderId: this.peerId || ('unknown' as PeerId),
                  targetId: this.peerId || ('unknown' as PeerId)
                }
                this.emit('message', message)
              })
            } else {
              // Handle text messages (our custom protocol for backward compatibility)
              const message = JSON.parse(event.data)
              console.log('🔌 CloudflareAdapter: Received WebSocket message:', message.type)
              
              // Handle ping/pong messages for keep-alive
              if (message.type === 'ping') {
                this.sendPong()
                return
              }

              // Handle test messages
              if (message.type === 'test') {
                console.log('🔌 CloudflareAdapter: Received test message:', message.message)
                return
              }

              // Handle presence updates from other clients
              if (message.type === 'presence') {
                // Pass senderId, userName, and userColor so we can create proper instance_presence records
                if (this.onPresenceUpdate && message.userId && message.data) {
                  this.onPresenceUpdate(message.userId, message.data, message.senderId, message.userName, message.userColor)
                }
                return
              }
              
              // Convert the message to the format expected by Automerge
              if (message.type === 'sync' && message.data) {
                console.log('🔌 CloudflareAdapter: Received sync message with data:', {
                  hasStore: !!message.data.store,
                  storeKeys: message.data.store ? Object.keys(message.data.store).length : 0,
                  documentId: message.documentId,
                  documentIdType: typeof message.documentId
                })
                
                // JSON sync for real-time collaboration
                // When we receive TLDraw changes from other clients, apply them locally
                const isJsonDocumentData = message.data && typeof message.data === 'object' && message.data.store

                if (isJsonDocumentData) {
                  console.log('📥 CloudflareAdapter: Received JSON sync message with store data')

                  // Call the JSON sync callback to apply changes
                  if (this.onJsonSyncData) {
                    this.onJsonSyncData(message.data)
                  } else {
                    console.warn('⚠️ No JSON sync callback registered')
                  }
                  return // JSON sync handled
                }
                
                // Validate documentId - Automerge requires a valid Automerge URL format
                // Valid formats: "automerge:xxxxx" or other valid URL formats
                // Invalid: plain strings like "default", "default-room", etc.
                const isValidDocumentId = message.documentId && 
                  (typeof message.documentId === 'string' && 
                   (message.documentId.startsWith('automerge:') || 
                    message.documentId.includes(':') || 
                    /^[a-f0-9-]{36,}$/i.test(message.documentId))) // UUID-like format
                
                // For binary sync messages, use Automerge's sync protocol
                // Only include documentId if it's a valid Automerge document ID format
                const syncMessage: Message = {
                  type: 'sync',
                  senderId: message.senderId || this.peerId || ('unknown' as PeerId),
                  targetId: message.targetId || this.peerId || ('unknown' as PeerId),
                  data: message.data,
                  ...(isValidDocumentId && { documentId: message.documentId })
                }
                
                if (message.documentId && !isValidDocumentId) {
                  console.warn('⚠️ CloudflareAdapter: Ignoring invalid documentId from server:', message.documentId)
                }
                
                this.emit('message', syncMessage)
              } else if (message.senderId && message.targetId) {
                this.emit('message', message as Message)
              }
            }
          } catch (error) {
            console.error('❌ CloudflareAdapter: Error parsing WebSocket message:', error)
          }
        }

        this.websocket.onclose = (event) => {
          console.log('Disconnected from Cloudflare WebSocket', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            url: wsUrl,
            reconnectAttempts: this.reconnectAttempts
          })
          
          this.isConnecting = false
          this.stopKeepAlive()
          
          // Log specific error codes for debugging
          if (event.code === 1005) {
            console.error('❌ WebSocket closed with code 1005 (No Status Received) - this usually indicates a connection issue or idle timeout')
          } else if (event.code === 1006) {
            console.error('❌ WebSocket closed with code 1006 (Abnormal Closure) - connection was lost unexpectedly')
          } else if (event.code === 1011) {
            console.error('❌ WebSocket closed with code 1011 (Server Error) - server encountered an error')
          } else if (event.code === 1000) {
            console.log('✅ WebSocket closed normally (code 1000)')
            return // Don't reconnect on normal closure
          }
          
          this.emit('close')
          
          // Attempt to reconnect with exponential backoff
          this.scheduleReconnect(peerId, peerMetadata)
        }

        this.websocket.onerror = (error) => {
          console.error('WebSocket error:', error)
          console.error('WebSocket readyState:', this.websocket?.readyState)
          console.error('WebSocket URL:', wsUrl)
          console.error('Error event details:', {
            type: error.type,
            target: error.target,
            isTrusted: error.isTrusted
          })
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
    // Only log non-presence messages to reduce console spam
    if (message.type !== 'presence') {
      console.log('📤 CloudflareAdapter.send() called:', {
        messageType: message.type,
        dataType: (message as any).data?.constructor?.name || typeof (message as any).data,
        dataLength: (message as any).data?.byteLength || (message as any).data?.length,
        documentId: (message as any).documentId,
        hasTargetId: !!message.targetId,
        hasSenderId: !!message.senderId
      })
    }

    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      // Check if this is a binary sync message from Automerge Repo
      if (message.type === 'sync' && (message as any).data instanceof ArrayBuffer) {
        console.log('📤 CloudflareAdapter: Sending binary sync message (Automerge protocol)', {
          dataLength: (message as any).data.byteLength,
          documentId: (message as any).documentId,
          targetId: message.targetId
        })
        // Send binary data directly for Automerge's native sync protocol
        this.websocket.send((message as any).data)
      } else if (message.type === 'sync' && (message as any).data instanceof Uint8Array) {
        console.log('📤 CloudflareAdapter: Sending Uint8Array sync message (Automerge protocol)', {
          dataLength: (message as any).data.length,
          documentId: (message as any).documentId,
          targetId: message.targetId
        })
        // Convert Uint8Array to ArrayBuffer and send
        this.websocket.send((message as any).data.buffer)
      } else {
        // Handle text-based messages (backward compatibility and control messages)
        // Only log non-presence messages
        if (message.type !== 'presence') {
          console.log('📤 Sending WebSocket message:', message.type)
        }
        // Debug: Log patch content if it's a patch message
        if (message.type === 'patch' && (message as any).patches) {
          console.log('🔍 Sending patches:', (message as any).patches.length, 'patches')
          ;(message as any).patches.forEach((patch: any, index: number) => {
            console.log(`  Patch ${index}:`, {
              action: patch.action,
              path: patch.path,
              value: patch.value ? (typeof patch.value === 'object' ? 'object' : patch.value) : 'undefined'
            })
          })
        }
        this.websocket.send(JSON.stringify(message))
      }
    } else {
      if (message.type !== 'presence') {
        console.warn('⚠️ CloudflareAdapter: Cannot send message - WebSocket not open', {
          messageType: message.type,
          readyState: this.websocket?.readyState
        })
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
    this.emit('close')
  }

  private cleanup(): void {
    this.stopKeepAlive()
    this.clearReconnectTimeout()
    
    if (this.websocket) {
      this.websocket.close(1000, 'Client disconnecting')
      this.websocket = null
    }
  }

  private startKeepAlive(): void {
    // Send ping every 30 seconds to prevent idle timeout
    this.keepAliveInterval = setInterval(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        console.log('🔌 CloudflareAdapter: Sending keep-alive ping')
        this.websocket.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }))
      }
    }, 30000) // 30 seconds
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
      console.error('❌ CloudflareAdapter: Max reconnection attempts reached, giving up')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000) // Max 30 seconds
    
    console.log(`🔄 CloudflareAdapter: Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`)
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.roomId) {
        console.log(`🔄 CloudflareAdapter: Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
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
