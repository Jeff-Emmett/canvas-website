// WebCrypto encryption utilities for Google Data Sovereignty
// Uses AES-256-GCM for symmetric encryption and HKDF for key derivation

import type { EncryptedData, GoogleService } from './types';

// Check if we're in a browser environment with WebCrypto
export const hasWebCrypto = (): boolean => {
  return typeof window !== 'undefined' &&
         window.crypto !== undefined &&
         window.crypto.subtle !== undefined;
};

// Generate a random master key for new users
export async function generateMasterKey(): Promise<CryptoKey> {
  if (!hasWebCrypto()) {
    throw new Error('WebCrypto not available');
  }

  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,  // extractable for backup
    ['encrypt', 'decrypt']
  );
}

// Export master key to raw format for backup
export async function exportMasterKey(key: CryptoKey): Promise<ArrayBuffer> {
  if (!hasWebCrypto()) {
    throw new Error('WebCrypto not available');
  }

  return await crypto.subtle.exportKey('raw', key);
}

// Import master key from raw format (for restore)
export async function importMasterKey(keyData: ArrayBuffer): Promise<CryptoKey> {
  if (!hasWebCrypto()) {
    throw new Error('WebCrypto not available');
  }

  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Derive a service-specific encryption key from master key using HKDF
export async function deriveServiceKey(
  masterKey: CryptoKey,
  service: GoogleService | 'tokens' | 'backup'
): Promise<CryptoKey> {
  if (!hasWebCrypto()) {
    throw new Error('WebCrypto not available');
  }

  const encoder = new TextEncoder();
  const info = encoder.encode(`canvas-google-data-${service}`);

  // Export master key to use as HKDF base
  const masterKeyRaw = await crypto.subtle.exportKey('raw', masterKey);

  // Import as HKDF key
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    masterKeyRaw,
    'HKDF',
    false,
    ['deriveKey']
  );

  // Generate a deterministic salt based on service
  const salt = encoder.encode(`canvas-salt-${service}`);

  // Derive the service-specific key
  return await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: info
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,  // not extractable for security
    ['encrypt', 'decrypt']
  );
}

// Encrypt data with AES-256-GCM
export async function encryptData(
  data: string | ArrayBuffer,
  key: CryptoKey
): Promise<EncryptedData> {
  if (!hasWebCrypto()) {
    throw new Error('WebCrypto not available');
  }

  // Generate random 96-bit IV (recommended for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Convert string to ArrayBuffer if needed
  const dataBuffer = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data;

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuffer
  );

  return { encrypted, iv };
}

// Decrypt data with AES-256-GCM
export async function decryptData(
  encryptedData: EncryptedData,
  key: CryptoKey
): Promise<ArrayBuffer> {
  if (!hasWebCrypto()) {
    throw new Error('WebCrypto not available');
  }

  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) as Uint8Array<ArrayBuffer> },
    key,
    encryptedData.encrypted
  );
}

// Decrypt data to string (convenience method)
export async function decryptDataToString(
  encryptedData: EncryptedData,
  key: CryptoKey
): Promise<string> {
  const decrypted = await decryptData(encryptedData, key);
  return new TextDecoder().decode(decrypted);
}

// Encrypt multiple fields of an object
export async function encryptFields<T extends Record<string, unknown>>(
  obj: T,
  fieldsToEncrypt: (keyof T)[],
  key: CryptoKey
): Promise<Record<string, EncryptedData | unknown>> {
  const result: Record<string, EncryptedData | unknown> = {};

  for (const [field, value] of Object.entries(obj)) {
    if (fieldsToEncrypt.includes(field as keyof T) && value !== null && value !== undefined) {
      const strValue = typeof value === 'string' ? value : JSON.stringify(value);
      result[`encrypted${field.charAt(0).toUpperCase()}${field.slice(1)}`] =
        await encryptData(strValue, key);
    } else if (!fieldsToEncrypt.includes(field as keyof T)) {
      result[field] = value;
    }
  }

  return result;
}

// Serialize EncryptedData for IndexedDB storage
export function serializeEncryptedData(data: EncryptedData): { encrypted: ArrayBuffer; iv: number[] } {
  return {
    encrypted: data.encrypted,
    iv: Array.from(data.iv)
  };
}

// Deserialize EncryptedData from IndexedDB
export function deserializeEncryptedData(data: { encrypted: ArrayBuffer; iv: number[] }): EncryptedData {
  return {
    encrypted: data.encrypted,
    iv: new Uint8Array(data.iv)
  };
}

// Base64 URL encoding for PKCE
export function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Base64 URL decoding
export function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Generate PKCE code verifier (43-128 chars, URL-safe)
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

// Generate PKCE code challenge from verifier
export async function generateCodeChallenge(verifier: string): Promise<string> {
  if (!hasWebCrypto()) {
    throw new Error('WebCrypto not available');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(hash);
}

// Derive a key from password for master key encryption (for backup)
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  if (!hasWebCrypto()) {
    throw new Error('WebCrypto not available');
  }

  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import password as raw key for PBKDF2
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive encryption key using PBKDF2
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt) as Uint8Array<ArrayBuffer>,
      iterations: 100000,  // High iteration count for security
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Generate random salt for password derivation
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

// Encrypt master key with password-derived key for backup
export async function encryptMasterKeyWithPassword(
  masterKey: CryptoKey,
  password: string
): Promise<{ encryptedKey: EncryptedData; salt: Uint8Array }> {
  const salt = generateSalt();
  const passwordKey = await deriveKeyFromPassword(password, salt);
  const masterKeyRaw = await exportMasterKey(masterKey);
  const encryptedKey = await encryptData(masterKeyRaw, passwordKey);

  return { encryptedKey, salt };
}

// Decrypt master key with password
export async function decryptMasterKeyWithPassword(
  encryptedKey: EncryptedData,
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const passwordKey = await deriveKeyFromPassword(password, salt);
  const masterKeyRaw = await decryptData(encryptedKey, passwordKey);
  return await importMasterKey(masterKeyRaw);
}
