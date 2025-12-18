/**
 * Worker tests for CryptID Authentication handlers
 *
 * Tests the D1-backed auth handlers with mocked database responses.
 * This tests the business logic without requiring a full Miniflare setup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  handleCheckUsername,
  handleLinkEmail,
  handleVerifyEmail,
  handleRequestDeviceLink,
  handleLinkDevice,
  handleLookup,
  handleGetDevices,
  handleRevokeDevice,
} from '../../worker/cryptidAuth'
import type { Environment } from '../../worker/types'

// Mock D1 database
function createMockD1() {
  const mockResults: Map<string, unknown> = new Map()

  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...args: unknown[]) => ({
        first: vi.fn(async () => {
          // Return mock data based on query and args
          const key = `${sql}:${JSON.stringify(args)}`
          return mockResults.get(key) ?? null
        }),
        all: vi.fn(async () => ({
          results: mockResults.get(`all:${sql}`) ?? []
        })),
        run: vi.fn(async () => ({ success: true })),
      })),
      first: vi.fn(async () => null),
      all: vi.fn(async () => ({ results: [] })),
      run: vi.fn(async () => ({ success: true })),
    })),
    // Helper to set mock return values
    __setMockResult: (key: string, value: unknown) => {
      mockResults.set(key, value)
    },
    __clearMocks: () => {
      mockResults.clear()
    },
  }
}

// Create mock environment
function createMockEnv(overrides: Partial<Environment> = {}): Environment {
  return {
    TLDRAW_BUCKET: {} as R2Bucket,
    BOARD_BACKUPS_BUCKET: {} as R2Bucket,
    AUTOMERGE_DURABLE_OBJECT: {} as DurableObjectNamespace,
    DAILY_API_KEY: 'mock-daily-key',
    DAILY_DOMAIN: 'mock.daily.co',
    CRYPTID_DB: createMockD1() as unknown as D1Database,
    RESEND_API_KEY: 'mock-resend-key',
    APP_URL: 'https://test.example.com',
    ...overrides,
  }
}

// Create mock request
function createMockRequest(
  url: string,
  options: RequestInit = {}
): Request {
  return new Request(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
}

describe('handleCheckUsername', () => {
  let env: Environment

  beforeEach(() => {
    env = createMockEnv()
  })

  it('returns error when username is missing', async () => {
    const request = createMockRequest('https://test.com/auth/check-username')
    const response = await handleCheckUsername(request, env)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe('Username is required')
  })

  it('returns unavailable for username too short', async () => {
    const request = createMockRequest('https://test.com/auth/check-username?username=ab')
    const response = await handleCheckUsername(request, env)
    const data = await response.json() as { available: boolean; error: string }

    expect(data.available).toBe(false)
    expect(data.error).toBe('Username must be at least 3 characters')
  })

  it('returns unavailable for username too long', async () => {
    const longUsername = 'a'.repeat(21)
    const request = createMockRequest(`https://test.com/auth/check-username?username=${longUsername}`)
    const response = await handleCheckUsername(request, env)
    const data = await response.json() as { available: boolean; error: string }

    expect(data.available).toBe(false)
    expect(data.error).toBe('Username must be 20 characters or less')
  })

  it('normalizes username to lowercase', async () => {
    const request = createMockRequest('https://test.com/auth/check-username?username=TestUser')
    const response = await handleCheckUsername(request, env)
    const data = await response.json() as { username: string }

    expect(data.username).toBe('testuser')
  })

  it('returns available when username does not exist', async () => {
    const request = createMockRequest('https://test.com/auth/check-username?username=newuser')
    const response = await handleCheckUsername(request, env)
    const data = await response.json() as { available: boolean }

    expect(data.available).toBe(true)
  })

  it('returns available true when no database configured', async () => {
    const envWithoutDb = createMockEnv({ CRYPTID_DB: undefined })
    const request = createMockRequest('https://test.com/auth/check-username?username=testuser')
    const response = await handleCheckUsername(request, envWithoutDb)
    const data = await response.json() as { available: boolean }

    expect(data.available).toBe(true)
  })
})

describe('handleLinkEmail', () => {
  let env: Environment

  beforeEach(() => {
    env = createMockEnv()
    // Mock fetch for email sending
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'mock-email-id' }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns error when required fields are missing', async () => {
    const request = createMockRequest('https://test.com/auth/link-email', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    })
    const response = await handleLinkEmail(request, env)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing required fields')
  })

  it('returns error for invalid email format', async () => {
    const request = createMockRequest('https://test.com/auth/link-email', {
      method: 'POST',
      body: JSON.stringify({
        email: 'not-an-email',
        cryptidUsername: 'testuser',
        publicKey: 'mock-public-key',
      }),
    })
    const response = await handleLinkEmail(request, env)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid email format')
  })

  it('returns error when database not configured', async () => {
    const envWithoutDb = createMockEnv({ CRYPTID_DB: undefined })
    const request = createMockRequest('https://test.com/auth/link-email', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        cryptidUsername: 'testuser',
        publicKey: 'mock-public-key',
      }),
    })
    const response = await handleLinkEmail(request, envWithoutDb)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(503)
    expect(data.error).toBe('Database not configured')
  })
})

describe('handleVerifyEmail', () => {
  let env: Environment

  beforeEach(() => {
    env = createMockEnv()
  })

  it('returns error when database not configured', async () => {
    const envWithoutDb = createMockEnv({ CRYPTID_DB: undefined })
    const response = await handleVerifyEmail('test-token', envWithoutDb)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(503)
    expect(data.error).toBe('Database not configured')
  })

  it('returns error for invalid/expired token', async () => {
    const response = await handleVerifyEmail('invalid-token', env)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid or expired token')
  })
})

describe('handleRequestDeviceLink', () => {
  let env: Environment

  beforeEach(() => {
    env = createMockEnv()
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'mock-email-id' }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns error when required fields are missing', async () => {
    const request = createMockRequest('https://test.com/auth/request-device-link', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    })
    const response = await handleRequestDeviceLink(request, env)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing required fields')
  })

  it('returns error when database not configured', async () => {
    const envWithoutDb = createMockEnv({ CRYPTID_DB: undefined })
    const request = createMockRequest('https://test.com/auth/request-device-link', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        publicKey: 'mock-public-key',
      }),
    })
    const response = await handleRequestDeviceLink(request, envWithoutDb)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(503)
    expect(data.error).toBe('Database not configured')
  })

  it('returns error when no verified account found', async () => {
    const request = createMockRequest('https://test.com/auth/request-device-link', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        publicKey: 'mock-public-key',
      }),
    })
    const response = await handleRequestDeviceLink(request, env)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(404)
    expect(data.error).toBe('No verified CryptID account found for this email')
  })
})

describe('handleLinkDevice', () => {
  let env: Environment

  beforeEach(() => {
    env = createMockEnv()
  })

  it('returns error when database not configured', async () => {
    const envWithoutDb = createMockEnv({ CRYPTID_DB: undefined })
    const response = await handleLinkDevice('test-token', envWithoutDb)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(503)
    expect(data.error).toBe('Database not configured')
  })

  it('returns error for invalid/expired token', async () => {
    const response = await handleLinkDevice('invalid-token', env)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid or expired token')
  })
})

describe('handleLookup', () => {
  let env: Environment

  beforeEach(() => {
    env = createMockEnv()
  })

  it('returns error when publicKey is missing', async () => {
    const request = createMockRequest('https://test.com/auth/lookup', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await handleLookup(request, env)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing publicKey')
  })

  it('returns error when database not configured', async () => {
    const envWithoutDb = createMockEnv({ CRYPTID_DB: undefined })
    const request = createMockRequest('https://test.com/auth/lookup', {
      method: 'POST',
      body: JSON.stringify({ publicKey: 'mock-public-key' }),
    })
    const response = await handleLookup(request, envWithoutDb)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(503)
    expect(data.error).toBe('Database not configured')
  })

  it('returns found: false when publicKey not in database', async () => {
    const request = createMockRequest('https://test.com/auth/lookup', {
      method: 'POST',
      body: JSON.stringify({ publicKey: 'unknown-public-key' }),
    })
    const response = await handleLookup(request, env)
    const data = await response.json() as { found: boolean }

    expect(data.found).toBe(false)
  })
})

describe('handleGetDevices', () => {
  let env: Environment

  beforeEach(() => {
    env = createMockEnv()
  })

  it('returns error when publicKey is missing', async () => {
    const request = createMockRequest('https://test.com/auth/devices', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await handleGetDevices(request, env)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing publicKey')
  })

  it('returns error when database not configured', async () => {
    const envWithoutDb = createMockEnv({ CRYPTID_DB: undefined })
    const request = createMockRequest('https://test.com/auth/devices', {
      method: 'POST',
      body: JSON.stringify({ publicKey: 'mock-public-key' }),
    })
    const response = await handleGetDevices(request, envWithoutDb)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(503)
    expect(data.error).toBe('Database not configured')
  })

  it('returns error when device not found', async () => {
    const request = createMockRequest('https://test.com/auth/devices', {
      method: 'POST',
      body: JSON.stringify({ publicKey: 'unknown-public-key' }),
    })
    const response = await handleGetDevices(request, env)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(404)
    expect(data.error).toBe('Device not found')
  })
})

describe('handleRevokeDevice', () => {
  let env: Environment

  beforeEach(() => {
    env = createMockEnv()
  })

  it('returns error when publicKey is missing', async () => {
    const request = createMockRequest('https://test.com/auth/devices/device-123', {
      method: 'DELETE',
      body: JSON.stringify({}),
    })
    const response = await handleRevokeDevice('device-123', request, env)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing publicKey')
  })

  it('returns error when database not configured', async () => {
    const envWithoutDb = createMockEnv({ CRYPTID_DB: undefined })
    const request = createMockRequest('https://test.com/auth/devices/device-123', {
      method: 'DELETE',
      body: JSON.stringify({ publicKey: 'mock-public-key' }),
    })
    const response = await handleRevokeDevice('device-123', request, envWithoutDb)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(503)
    expect(data.error).toBe('Database not configured')
  })

  it('returns unauthorized when device not found', async () => {
    const request = createMockRequest('https://test.com/auth/devices/device-123', {
      method: 'DELETE',
      body: JSON.stringify({ publicKey: 'unknown-public-key' }),
    })
    const response = await handleRevokeDevice('device-123', request, env)
    const data = await response.json() as { error: string }

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })
})
