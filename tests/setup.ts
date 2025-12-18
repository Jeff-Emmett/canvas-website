/**
 * Global test setup for Vitest
 * This file runs before all tests
 */

import { vi, beforeAll, afterEach, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import 'fake-indexeddb/auto'

// Extend expect with DOM matchers
import '@testing-library/jest-dom/vitest'

// Mock window.matchMedia (used by many UI components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver (used by tldraw)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}))

// Mock crypto.subtle for WebCrypto tests
if (!global.crypto) {
  global.crypto = {} as Crypto
}
if (!global.crypto.subtle) {
  // Use a basic mock - will be overridden in specific tests
  global.crypto.subtle = {
    generateKey: vi.fn(),
    exportKey: vi.fn(),
    importKey: vi.fn(),
    sign: vi.fn(),
    verify: vi.fn(),
  } as unknown as SubtleCrypto
}

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
})

// Store original WebSocket for tests that need it
const OriginalWebSocket = global.WebSocket

beforeAll(() => {
  // Setup before all tests
})

afterEach(() => {
  // Clean up React components after each test
  cleanup()

  // Clear all mocks
  vi.clearAllMocks()

  // Restore WebSocket if it was mocked
  global.WebSocket = OriginalWebSocket
})

afterAll(() => {
  // Cleanup after all tests
})

// Export utilities for tests
export { OriginalWebSocket }
