/**
 * WebSocket mock for testing Automerge sync and real-time features
 */

import { vi } from 'vitest'

type WebSocketEventHandler = ((event: Event) => void) | null

export class MockWebSocket {
  static instances: MockWebSocket[] = []
  static nextId = 0

  readonly id: number
  readonly url: string

  readyState: number = WebSocket.CONNECTING

  onopen: WebSocketEventHandler = null
  onclose: WebSocketEventHandler = null
  onerror: WebSocketEventHandler = null
  onmessage: ((event: MessageEvent) => void) | null = null

  // Track sent messages for assertions
  sentMessages: (ArrayBuffer | string)[] = []

  // Track if close was called
  closeCalled = false
  closeCode?: number
  closeReason?: string

  constructor(url: string, protocols?: string | string[]) {
    this.id = MockWebSocket.nextId++
    this.url = url
    MockWebSocket.instances.push(this)

    // Simulate async connection (like real WebSocket)
    setTimeout(() => {
      if (this.readyState === WebSocket.CONNECTING) {
        this.readyState = WebSocket.OPEN
        this.onopen?.(new Event('open'))
      }
    }, 10)
  }

  send(data: ArrayBuffer | string): void {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    this.sentMessages.push(data)
  }

  close(code?: number, reason?: string): void {
    this.closeCalled = true
    this.closeCode = code
    this.closeReason = reason
    this.readyState = WebSocket.CLOSING

    setTimeout(() => {
      this.readyState = WebSocket.CLOSED
      this.onclose?.(new CloseEvent('close', { code, reason }))
    }, 0)
  }

  // Test helpers

  /**
   * Simulate receiving a message from the server
   */
  receiveMessage(data: ArrayBuffer | string): void {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('Cannot receive message on closed WebSocket')
    }
    this.onmessage?.({ data } as MessageEvent)
  }

  /**
   * Simulate receiving binary sync message
   */
  receiveBinaryMessage(data: Uint8Array): void {
    this.receiveMessage(data.buffer)
  }

  /**
   * Simulate connection error
   */
  simulateError(message = 'Connection failed'): void {
    this.onerror?.(new ErrorEvent('error', { message }))
    this.close(1006, message)
  }

  /**
   * Simulate server closing connection
   */
  simulateServerClose(code = 1000, reason = 'Normal closure'): void {
    this.readyState = WebSocket.CLOSED
    this.onclose?.(new CloseEvent('close', { code, reason }))
  }

  /**
   * Get the last sent message
   */
  getLastSentMessage(): ArrayBuffer | string | undefined {
    return this.sentMessages[this.sentMessages.length - 1]
  }

  /**
   * Get all sent binary messages as Uint8Arrays
   */
  getSentBinaryMessages(): Uint8Array[] {
    return this.sentMessages
      .filter((m): m is ArrayBuffer => m instanceof ArrayBuffer)
      .map(buffer => new Uint8Array(buffer))
  }

  // Static test helpers

  /**
   * Clear all mock instances
   */
  static clearInstances(): void {
    MockWebSocket.instances = []
    MockWebSocket.nextId = 0
  }

  /**
   * Get the most recent WebSocket instance
   */
  static getLastInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1]
  }

  /**
   * Get all instances connected to a specific URL
   */
  static getInstancesByUrl(url: string): MockWebSocket[] {
    return MockWebSocket.instances.filter(ws => ws.url.includes(url))
  }
}

// WebSocket ready states for reference
MockWebSocket.prototype.CONNECTING = WebSocket.CONNECTING
MockWebSocket.prototype.OPEN = WebSocket.OPEN
MockWebSocket.prototype.CLOSING = WebSocket.CLOSING
MockWebSocket.prototype.CLOSED = WebSocket.CLOSED

/**
 * Install the mock WebSocket globally
 */
export function installMockWebSocket(): void {
  MockWebSocket.clearInstances()
  global.WebSocket = MockWebSocket as unknown as typeof WebSocket
}

/**
 * Restore the original WebSocket
 */
export function restoreMockWebSocket(originalWebSocket: typeof WebSocket): void {
  MockWebSocket.clearInstances()
  global.WebSocket = originalWebSocket
}

/**
 * Create a spy on WebSocket that still uses the mock
 */
export function createWebSocketSpy() {
  const spy = vi.fn((url: string, protocols?: string | string[]) => {
    return new MockWebSocket(url, protocols)
  })
  global.WebSocket = spy as unknown as typeof WebSocket
  return spy
}
