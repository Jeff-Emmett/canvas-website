import HoloSphere from 'holosphere'
import * as h3 from 'h3-js'

export interface HolonData {
  id: string
  name: string
  description?: string
  latitude: number
  longitude: number
  resolution: number
  data: Record<string, any>
  timestamp: number
}

export interface HolonLens {
  name: string
  schema?: any
  data: any[]
}

export interface HolonConnection {
  id: string
  name: string
  type: 'federation' | 'reference'
  targetSpace: string
  status: 'connected' | 'disconnected' | 'error'
}

export class HoloSphereService {
  private sphere!: HoloSphere
  private isInitialized: boolean = false
  private connections: Map<string, HolonConnection> = new Map()
  private connectionErrorLogged: boolean = false // Track if we've already logged connection errors

  constructor(appName: string = 'canvas-holons', strict: boolean = false, openaiKey?: string) {
    try {
      this.sphere = new HoloSphere(appName, strict, openaiKey)
      this.isInitialized = true
      console.log('✅ HoloSphere service initialized')
    } catch (error) {
      console.error('❌ Failed to initialize HoloSphere:', error)
      this.isInitialized = false
    }
  }

  async initialize(): Promise<boolean> {
    if (!this.isInitialized) {
      console.error('❌ HoloSphere not initialized')
      return false
    }
    return true
  }

  // Get a holon for specific coordinates and resolution
  async getHolon(lat: number, lng: number, resolution: number): Promise<string> {
    if (!this.isInitialized) return ''
    try {
      return await this.sphere.getHolon(lat, lng, resolution)
    } catch (error) {
      console.error('❌ Error getting holon:', error)
      return ''
    }
  }

  // Store data in a holon
  async putData(holon: string, lens: string, data: any): Promise<boolean> {
    if (!this.isInitialized) return false
    try {
      await this.sphere.put(holon, lens, data)
      return true
    } catch (error) {
      console.error('❌ Error storing data:', error)
      return false
    }
  }

  // Retrieve data from a holon
  async getData(holon: string, lens: string, key?: string): Promise<any> {
    if (!this.isInitialized) return null
    try {
      if (key) {
        return await this.sphere.get(holon, lens, key)
      } else {
        return await this.sphere.getAll(holon, lens)
      }
    } catch (error) {
      console.error('❌ Error retrieving data:', error)
      return null
    }
  }

  // Retrieve data with subscription and timeout (better for Gun's async nature)
  async getDataWithWait(holon: string, lens: string, timeoutMs: number = 5000): Promise<any> {
    if (!this.isInitialized) {
      console.log(`⚠️ HoloSphere not initialized for ${lens}`)
      return null
    }

    // Check for WebSocket connection issues
    // Note: GunDB connection errors appear in browser console, we can't directly detect them
    // but we can provide better feedback when no data is received

    return new Promise((resolve) => {
      let resolved = false
      let collectedData: any = {}
      let subscriptionActive = false

      console.log(`🔍 getDataWithWait: holon=${holon}, lens=${lens}, timeout=${timeoutMs}ms`)
      
      // Listen for WebSocket errors (they appear in console but we can't catch them directly)
      // Instead, we'll detect the pattern: subscription never fires + getAll never resolves

      // Set up timeout (increased default to 5 seconds for network sync)
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          const keyCount = Object.keys(collectedData).length
          const status = subscriptionActive 
            ? '(subscription was active)' 
            : '(subscription never fired - possible WebSocket connection issue)'
          
          console.log(`⏱️ Timeout for lens ${lens}, returning collected data:`, keyCount, 'keys', status)
          
          // If no data and subscription never fired, it's likely a connection issue
          // Only log this once to avoid console spam
          if (keyCount === 0 && !subscriptionActive && !this.connectionErrorLogged) {
            this.connectionErrorLogged = true
            console.error(`❌ GunDB Connection Issue: WebSocket to 'wss://gun.holons.io/gun' is failing`)
            console.error(`💡 This prevents loading data from the Holosphere. Possible causes:`)
            console.error(`   • GunDB server may be down or unreachable`)
            console.error(`   • Network/firewall blocking WebSocket connections`)
            console.error(`   • Check browser console for WebSocket connection errors`)
            console.error(`   • Data will not load until connection is established`)
          }
          
          resolve(keyCount > 0 ? collectedData : null)
        }
      }, timeoutMs)

      try {
        // Check if methods exist
        if (!this.sphere.subscribe) {
          console.error(`❌ sphere.subscribe does not exist`)
        }
        if (!this.sphere.getAll) {
          console.error(`❌ sphere.getAll does not exist`)
        }
        if (!this.sphere.get) {
          console.error(`❌ sphere.get does not exist`)
        }

        console.log(`🔧 Attempting to subscribe to ${holon}/${lens}`)
        
        // Try subscribe if it exists
        let unsubscribe: (() => void) | undefined = undefined
        if (this.sphere.subscribe) {
          try {
            unsubscribe = this.sphere.subscribe(holon, lens, (data: any, key?: string) => {
              subscriptionActive = true
              console.log(`📥 Subscription callback fired for ${lens}:`, { data, key, dataType: typeof data, isObject: typeof data === 'object', isArray: Array.isArray(data) })
              
              if (data !== null && data !== undefined) {
                if (key) {
                  // If we have a key, it's a key-value pair
                  collectedData[key] = data
                  console.log(`📥 Added key-value pair: ${key} =`, data)
                } else if (typeof data === 'object' && !Array.isArray(data)) {
                  // If it's an object, merge it
                  collectedData = { ...collectedData, ...data }
                  console.log(`📥 Merged object data, total keys:`, Object.keys(collectedData).length)
                } else if (Array.isArray(data)) {
                  // If it's an array, convert to object with indices
                  data.forEach((item, index) => {
                    collectedData[String(index)] = item
                  })
                  console.log(`📥 Converted array to object, total keys:`, Object.keys(collectedData).length)
                } else {
                  // Primitive value
                  collectedData['value'] = data
                  console.log(`📥 Added primitive value:`, data)
                }
                
                console.log(`📥 Current collected data for ${lens}:`, Object.keys(collectedData).length, 'keys')
              }
            })
            console.log(`✅ Subscribe called successfully for ${lens}`)
          } catch (subError) {
            console.error(`❌ Error calling subscribe for ${lens}:`, subError)
          }
        }

        // Try getAll if it exists
        if (this.sphere.getAll) {
          console.log(`🔧 Attempting getAll for ${holon}/${lens}`)
          this.sphere.getAll(holon, lens).then((immediateData: any) => {
            console.log(`📦 getAll returned for ${lens}:`, { 
              data: immediateData, 
              type: typeof immediateData, 
              isObject: typeof immediateData === 'object',
              isArray: Array.isArray(immediateData),
              keys: immediateData && typeof immediateData === 'object' ? Object.keys(immediateData).length : 'N/A'
            })
            
            if (immediateData !== null && immediateData !== undefined) {
              if (typeof immediateData === 'object' && !Array.isArray(immediateData)) {
                collectedData = { ...collectedData, ...immediateData }
                console.log(`📦 Merged immediate data, total keys:`, Object.keys(collectedData).length)
              } else if (Array.isArray(immediateData)) {
                immediateData.forEach((item, index) => {
                  collectedData[String(index)] = item
                })
                console.log(`📦 Converted immediate array to object, total keys:`, Object.keys(collectedData).length)
              } else {
                collectedData['value'] = immediateData
                console.log(`📦 Added immediate primitive value`)
              }
            }

            // If we have data immediately, resolve early
            if (Object.keys(collectedData).length > 0 && !resolved) {
              resolved = true
              clearTimeout(timeout)
              if (unsubscribe) unsubscribe()
              console.log(`✅ Resolving early with ${Object.keys(collectedData).length} keys for ${lens}`)
              resolve(collectedData)
            }
          }).catch((error: any) => {
            console.error(`⚠️ Error getting immediate data for ${lens}:`, error)
          })
        } else {
          // Fallback: try using getData method instead
          console.log(`🔧 getAll not available, trying getData as fallback for ${lens}`)
          this.getData(holon, lens).then((fallbackData: any) => {
            console.log(`📦 getData (fallback) returned for ${lens}:`, fallbackData)
            if (fallbackData !== null && fallbackData !== undefined) {
              if (typeof fallbackData === 'object' && !Array.isArray(fallbackData)) {
                collectedData = { ...collectedData, ...fallbackData }
              } else {
                collectedData['value'] = fallbackData
              }
              if (Object.keys(collectedData).length > 0 && !resolved) {
                resolved = true
                clearTimeout(timeout)
                if (unsubscribe) unsubscribe()
                console.log(`✅ Resolving with fallback data: ${Object.keys(collectedData).length} keys for ${lens}`)
                resolve(collectedData)
              }
            }
          }).catch((error: any) => {
            console.error(`⚠️ Error in fallback getData for ${lens}:`, error)
          })
        }

      } catch (error) {
        console.error(`❌ Error setting up subscription for ${lens}:`, error)
        clearTimeout(timeout)
        if (!resolved) {
          resolved = true
          resolve(null)
        }
      }
    })
  }

  // Delete data from a holon
  async deleteData(holon: string, lens: string, key?: string): Promise<boolean> {
    if (!this.isInitialized) return false
    try {
      if (key) {
        await this.sphere.delete(holon, lens, key)
      } else {
        await this.sphere.deleteAll(holon, lens)
      }
      return true
    } catch (error) {
      console.error('❌ Error deleting data:', error)
      return false
    }
  }

  // Set schema for data validation
  async setSchema(lens: string, schema: any): Promise<boolean> {
    if (!this.isInitialized) return false
    try {
      await this.sphere.setSchema(lens, schema)
      return true
    } catch (error) {
      console.error('❌ Error setting schema:', error)
      return false
    }
  }

  // Get current schema
  async getSchema(lens: string): Promise<any> {
    if (!this.isInitialized) return null
    try {
      return await this.sphere.getSchema(lens)
    } catch (error) {
      console.error('❌ Error getting schema:', error)
      return null
    }
  }

  // Subscribe to changes in a holon
  subscribe(holon: string, lens: string, callback: (data: any) => void): void {
    if (!this.isInitialized) return
    try {
      this.sphere.subscribe(holon, lens, callback)
    } catch (error) {
      console.error('❌ Error subscribing to changes:', error)
    }
  }

  // Get holon hierarchy (parent and children)
  getHolonHierarchy(holon: string): { parent?: string; children: string[] } {
    try {
      const resolution = h3.getResolution(holon)
      const parent = resolution > 0 ? h3.cellToParent(holon, resolution - 1) : undefined
      const children = h3.cellToChildren(holon, resolution + 1)
      return { parent, children }
    } catch (error) {
      console.error('❌ Error getting holon hierarchy:', error)
      return { children: [] }
    }
  }

  // Get all scales for a holon (all containing holons)
  getHolonScalespace(holon: string): string[] {
    try {
      return this.sphere.getHolonScalespace(holon)
    } catch (error) {
      console.error('❌ Error getting holon scalespace:', error)
      return []
    }
  }

  // Federation methods
  async federate(spaceId1: string, spaceId2: string, password1?: string, password2?: string, bidirectional?: boolean): Promise<boolean> {
    if (!this.isInitialized) return false
    try {
      await this.sphere.federate(spaceId1, spaceId2, password1, password2, bidirectional)
      return true
    } catch (error) {
      console.error('❌ Error federating spaces:', error)
      return false
    }
  }

  async propagate(holon: string, lens: string, data: any, options?: { useReferences?: boolean; targetSpaces?: string[] }): Promise<boolean> {
    if (!this.isInitialized) return false
    try {
      await this.sphere.propagate(holon, lens, data, options)
      return true
    } catch (error) {
      console.error('❌ Error propagating data:', error)
      return false
    }
  }

  // Message federation
  async federateMessage(originalChatId: string, messageId: string, federatedChatId: string, federatedMessageId: string, type: string): Promise<boolean> {
    if (!this.isInitialized) return false
    try {
      await this.sphere.federateMessage(originalChatId, messageId, federatedChatId, federatedMessageId, type)
      return true
    } catch (error) {
      console.error('❌ Error federating message:', error)
      return false
    }
  }

  async getFederatedMessages(originalChatId: string, messageId: string): Promise<any[]> {
    if (!this.isInitialized) return []
    try {
      const result = await this.sphere.getFederatedMessages(originalChatId, messageId)
      return Array.isArray(result) ? result : []
    } catch (error) {
      console.error('❌ Error getting federated messages:', error)
      return []
    }
  }

  async updateFederatedMessages(originalChatId: string, messageId: string, updateCallback: (chatId: string, messageId: string) => Promise<void>): Promise<boolean> {
    if (!this.isInitialized) return false
    try {
      await this.sphere.updateFederatedMessages(originalChatId, messageId, updateCallback)
      return true
    } catch (error) {
      console.error('❌ Error updating federated messages:', error)
      return false
    }
  }

  // Utility methods for working with coordinates and resolutions
  static getResolutionName(resolution: number): string {
    const names = [
      'Country', 'State/Province', 'Metropolitan Area', 'City', 'District', 
      'Neighborhood', 'Block', 'Building', 'Room', 'Desk', 'Chair', 'Point'
    ]
    return names[resolution] || `Level ${resolution}`
  }

  static getResolutionDescription(resolution: number): string {
    const descriptions = [
      'Country level - covers entire countries',
      'State/Province level - covers states and provinces',
      'Metropolitan area level - covers large urban areas',
      'City level - covers individual cities',
      'District level - covers city districts',
      'Neighborhood level - covers neighborhoods',
      'Block level - covers city blocks',
      'Building level - covers individual buildings',
      'Room level - covers individual rooms',
      'Desk level - covers individual desks',
      'Chair level - covers individual chairs',
      'Point level - covers individual points'
    ]
    return descriptions[resolution] || `Geographic level ${resolution}`
  }

  // Get connection status
  getConnectionStatus(spaceId: string): HolonConnection | undefined {
    return this.connections.get(spaceId)
  }

  // Add connection
  addConnection(connection: HolonConnection): void {
    this.connections.set(connection.id, connection)
  }

  // Remove connection
  removeConnection(spaceId: string): boolean {
    return this.connections.delete(spaceId)
  }

  // Get all connections
  getAllConnections(): HolonConnection[] {
    return Array.from(this.connections.values())
  }
}

// Create a singleton instance
export const holosphereService = new HoloSphereService('canvas-holons', false)
