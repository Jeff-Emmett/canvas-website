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
    const storeString = JSON.stringify(storeData, storeKeys)
    
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

class CloudflareNetworkAdapter extends NetworkAdapter {
  private workerUrl: string
  private websocket: WebSocket | null = null
  private roomId: string | null = null
  private readyPromise: Promise<void>
  private readyResolve: (() => void) | null = null

  constructor(workerUrl: string, roomId?: string) {
    super()
    this.workerUrl = workerUrl
    this.roomId = roomId || 'default-room'
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
    // Use the room ID from constructor or default
    // Add sessionId as a query parameter as required by AutomergeDurableObject
    const sessionId = peerId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const wsUrl = `${this.workerUrl.replace('http', 'ws')}/connect/${this.roomId}?sessionId=${sessionId}`
    
    // Add a small delay to ensure the server is ready
    setTimeout(() => {
      try {
        this.websocket = new WebSocket(wsUrl)
        
        this.websocket.onopen = () => {
          this.readyResolve?.()
        }

        this.websocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            
            // Convert the message to the format expected by Automerge
            if (message.type === 'sync' && message.data) {
              // For now, we'll handle the JSON data directly
              // In a full implementation, this would be binary sync data
              this.emit('message', {
                type: 'sync',
                senderId: message.senderId,
                targetId: message.targetId,
                documentId: message.documentId,
                data: message.data
              })
            } else {
              this.emit('message', message)
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }

        this.websocket.onclose = (event) => {
          console.log('Disconnected from Cloudflare WebSocket', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          })
          this.emit('close')
          // Attempt to reconnect after a delay
          setTimeout(() => {
            if (this.roomId) {
              console.log('Attempting to reconnect WebSocket...')
              this.connect(peerId, peerMetadata)
            }
          }, 5000)
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
        }
      } catch (error) {
        console.error('Failed to create WebSocket:', error)
        return
      }
    }, 100)
  }

  send(message: Message): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      console.log('Sending WebSocket message:', message.type)
      this.websocket.send(JSON.stringify(message))
    }
  }

  broadcast(message: Message): void {
    // For WebSocket-based adapters, broadcast is the same as send
    // since we're connected to a single server that handles broadcasting
    this.send(message)
  }

  disconnect(): void {
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
    }
    this.roomId = null
    this.emit('close')
  }
}
