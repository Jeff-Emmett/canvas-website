// This module contains browser-specific WebCrypto API utilities

// Check if we're in a browser environment
export const isBrowser = (): boolean => typeof window !== 'undefined';

// Use the polyfill if available, otherwise fall back to native WebCrypto
const getCrypto = (): Crypto => {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  // Fallback to native WebCrypto if polyfill is not available
  return window.crypto;
};

// Get registered users from localStorage
export const getRegisteredUsers = (): string[] => {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(window.localStorage.getItem('registeredUsers') || '[]');
  } catch (error) {
    console.error('Error getting registered users:', error);
    return [];
  }
};

// Add a user to the registered users list
export const addRegisteredUser = (username: string): void => {
  if (!isBrowser()) return;
  try {
    const users = getRegisteredUsers();
    if (!users.includes(username)) {
      users.push(username);
      window.localStorage.setItem('registeredUsers', JSON.stringify(users));
    }
  } catch (error) {
    console.error('Error adding registered user:', error);
  }
};

// Check if a username is available
export const isUsernameAvailable = async (username: string): Promise<boolean> => {
  console.log('Checking if username is available:', username);

  try {
    // Get the list of registered users
    const users = getRegisteredUsers();

    // Check if the username is already taken
    const isAvailable = !users.includes(username);

    console.log('Username availability result:', isAvailable);
    return isAvailable;
  } catch (error) {
    console.error('Error checking username availability:', error);
    return false;
  }
};

// Check if username is valid format (letters, numbers, underscores, hyphens)
export const isUsernameValid = (username: string): boolean => {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
};

// Store a public key for a user
export const storePublicKey = (username: string, publicKey: string): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(`${username}_publicKey`, publicKey);
  } catch (error) {
    console.error('Error storing public key:', error);
  }
};

// Get a user's public key
export const getPublicKey = (username: string): string | null => {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(`${username}_publicKey`);
  } catch (error) {
    console.error('Error getting public key:', error);
    return null;
  }
};

// Generate a key pair using Web Crypto API
export const generateKeyPair = async (): Promise<CryptoKeyPair | null> => {
  if (!isBrowser()) return null;
  try {
    const crypto = getCrypto();
    return await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );
  } catch (error) {
    console.error('Error generating key pair:', error);
    return null;
  }
};

// Export a public key to a base64 string
export const exportPublicKey = async (publicKey: CryptoKey): Promise<string | null> => {
  if (!isBrowser()) return null;
  try {
    const crypto = getCrypto();
    const publicKeyBuffer = await crypto.subtle.exportKey(
      'raw',
      publicKey
    );

    return btoa(
      String.fromCharCode.apply(null, Array.from(new Uint8Array(publicKeyBuffer)))
    );
  } catch (error) {
    console.error('Error exporting public key:', error);
    return null;
  }
};

// Import a public key from a base64 string
export const importPublicKey = async (base64Key: string): Promise<CryptoKey | null> => {
  if (!isBrowser()) return null;
  try {
    const crypto = getCrypto();
    const binaryString = atob(base64Key);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return await crypto.subtle.importKey(
      'raw',
      bytes,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['verify']
    );
  } catch (error) {
    console.error('Error importing public key:', error);
    return null;
  }
};

// Sign data with a private key
export const signData = async (privateKey: CryptoKey, data: string): Promise<string | null> => {
  if (!isBrowser()) return null;
  try {
    const crypto = getCrypto();
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);

    const signature = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      privateKey,
      encodedData
    );

    return btoa(
      String.fromCharCode.apply(null, Array.from(new Uint8Array(signature)))
    );
  } catch (error) {
    console.error('Error signing data:', error);
    return null;
  }
};

// Verify a signature
export const verifySignature = async (
  publicKey: CryptoKey,
  signature: string,
  data: string
): Promise<boolean> => {
  if (!isBrowser()) return false;
  try {
    const crypto = getCrypto();
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);

    const binarySignature = atob(signature);
    const signatureBytes = new Uint8Array(binarySignature.length);

    for (let i = 0; i < binarySignature.length; i++) {
      signatureBytes[i] = binarySignature.charCodeAt(i);
    }

    return await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      publicKey,
      signatureBytes,
      encodedData
    );
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
};