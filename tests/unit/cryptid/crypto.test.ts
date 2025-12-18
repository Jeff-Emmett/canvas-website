/**
 * Unit tests for CryptID WebCrypto utilities
 *
 * Tests the core cryptographic functions:
 * - Key pair generation
 * - Public key export
 * - Challenge signing
 * - Signature verification
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// We'll test the crypto utilities directly
// First, let's verify our mock setup works

describe('WebCrypto Environment', () => {
  it('crypto.subtle is available', () => {
    expect(crypto).toBeDefined()
    expect(crypto.subtle).toBeDefined()
  })

  it('crypto.getRandomValues works', () => {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)

    // Should have random values (not all zeros)
    const hasNonZero = array.some(v => v !== 0)
    expect(hasNonZero).toBe(true)
  })
})

describe('ECDSA Key Generation', () => {
  it('can generate ECDSA P-256 key pair', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true, // extractable
      ['sign', 'verify']
    )

    expect(keyPair).toBeDefined()
    expect(keyPair.privateKey).toBeDefined()
    expect(keyPair.publicKey).toBeDefined()
  })

  it('generated keys have correct algorithm', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    )

    expect(keyPair.privateKey.algorithm.name).toBe('ECDSA')
    expect(keyPair.publicKey.algorithm.name).toBe('ECDSA')
  })

  it('private key is extractable when requested', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true, // extractable = true
      ['sign', 'verify']
    )

    expect(keyPair.privateKey.extractable).toBe(true)
    expect(keyPair.publicKey.extractable).toBe(true)
  })
})

describe('Public Key Export', () => {
  it('can export public key in raw format', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    )

    const exportedKey = await crypto.subtle.exportKey('raw', keyPair.publicKey)

    // jsdom may return ArrayBuffer or ArrayBuffer-like object
    expect(exportedKey).toBeDefined()
    expect(exportedKey.byteLength).toBeDefined()
    // P-256 raw public key is 65 bytes (uncompressed point)
    expect(exportedKey.byteLength).toBe(65)
  })

  it('can export public key in spki format', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    )

    const exportedKey = await crypto.subtle.exportKey('spki', keyPair.publicKey)

    // jsdom may return ArrayBuffer or ArrayBuffer-like object
    expect(exportedKey).toBeDefined()
    expect(exportedKey.byteLength).toBeDefined()
    expect(exportedKey.byteLength).toBeGreaterThan(0)
  })

  it('exported key can be converted to base64', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    )

    const exportedKey = await crypto.subtle.exportKey('raw', keyPair.publicKey)
    const base64Key = btoa(String.fromCharCode(...new Uint8Array(exportedKey)))

    expect(typeof base64Key).toBe('string')
    expect(base64Key.length).toBeGreaterThan(0)
    // Base64 should be roughly 4/3 * 65 bytes ≈ 88 chars
    expect(base64Key.length).toBeGreaterThan(80)
  })
})

describe('Challenge Signing', () => {
  it('can sign a challenge string', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    )

    const challenge = 'testuser:1234567890:randomchallenge'
    const encoder = new TextEncoder()
    const data = encoder.encode(challenge)

    const signature = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      keyPair.privateKey,
      data
    )

    // jsdom may return ArrayBuffer or ArrayBuffer-like object
    expect(signature).toBeDefined()
    expect(signature.byteLength).toBeDefined()
    expect(signature.byteLength).toBeGreaterThan(0)
  })

  it('different challenges produce different signatures', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    )

    const encoder = new TextEncoder()

    const sig1 = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      encoder.encode('challenge1')
    )

    const sig2 = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      encoder.encode('challenge2')
    )

    // Signatures should be different
    const sig1Arr = new Uint8Array(sig1)
    const sig2Arr = new Uint8Array(sig2)

    let isDifferent = false
    for (let i = 0; i < Math.min(sig1Arr.length, sig2Arr.length); i++) {
      if (sig1Arr[i] !== sig2Arr[i]) {
        isDifferent = true
        break
      }
    }

    expect(isDifferent).toBe(true)
  })
})

describe('Signature Verification', () => {
  it('verifies valid signature', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    )

    const encoder = new TextEncoder()
    const data = encoder.encode('test challenge')

    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      data
    )

    const isValid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.publicKey,
      signature,
      data
    )

    expect(isValid).toBe(true)
  })

  it('rejects tampered data', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    )

    const encoder = new TextEncoder()
    const originalData = encoder.encode('original challenge')
    const tamperedData = encoder.encode('tampered challenge')

    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      originalData
    )

    // Verify with tampered data should fail
    const isValid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.publicKey,
      signature,
      tamperedData
    )

    expect(isValid).toBe(false)
  })

  it('rejects signature from different key', async () => {
    const keyPair1 = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    )

    const keyPair2 = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    )

    const encoder = new TextEncoder()
    const data = encoder.encode('test challenge')

    // Sign with key pair 1
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair1.privateKey,
      data
    )

    // Verify with key pair 2's public key should fail
    const isValid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair2.publicKey, // Different key!
      signature,
      data
    )

    expect(isValid).toBe(false)
  })
})

describe('Key Import/Export Round Trip', () => {
  it('can export and re-import public key', async () => {
    const originalKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    )

    // Export public key
    const exported = await crypto.subtle.exportKey('raw', originalKeyPair.publicKey)

    // Re-import
    const importedKey = await crypto.subtle.importKey(
      'raw',
      exported,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify']
    )

    expect(importedKey).toBeDefined()
    expect(importedKey.algorithm.name).toBe('ECDSA')

    // Verify a signature with the imported key
    const encoder = new TextEncoder()
    const data = encoder.encode('test data')

    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      originalKeyPair.privateKey,
      data
    )

    const isValid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      importedKey,
      signature,
      data
    )

    expect(isValid).toBe(true)
  })
})
