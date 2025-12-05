/**
 * CryptID Email Service
 * Handles communication with the backend for email linking and device verification
 */

import * as crypto from './crypto';

// Get the worker API URL based on environment
function getApiUrl(): string {
  // In development, use the local worker
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5172';
  }
  // In production, use the deployed worker
  return 'https://jeffemmett-canvas.jeffemmett.workers.dev';
}

export interface LinkEmailResult {
  success: boolean;
  message?: string;
  emailVerified?: boolean;
  emailSent?: boolean;
  error?: string;
}

export interface DeviceLinkResult {
  success: boolean;
  message?: string;
  cryptidUsername?: string;
  alreadyLinked?: boolean;
  emailSent?: boolean;
  error?: string;
}

export interface LookupResult {
  found: boolean;
  cryptidUsername?: string;
  email?: string;
  emailVerified?: boolean;
  deviceName?: string;
}

export interface Device {
  id: string;
  deviceName: string;
  userAgent: string | null;
  createdAt: string;
  lastUsed: string | null;
  isCurrentDevice: boolean;
}

/**
 * Link an email to the current CryptID account
 * Called from Device A (existing device with account)
 */
export async function linkEmailToAccount(
  email: string,
  cryptidUsername: string,
  deviceName?: string
): Promise<LinkEmailResult> {
  try {
    // Get the public key for this user
    const publicKey = crypto.getPublicKey(cryptidUsername);
    if (!publicKey) {
      return {
        success: false,
        error: 'No public key found for this account'
      };
    }

    const response = await fetch(`${getApiUrl()}/auth/link-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        cryptidUsername,
        publicKey,
        deviceName: deviceName || getDeviceName()
      }),
    });

    const data = await response.json() as LinkEmailResult & { error?: string };

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to link email'
      };
    }

    return data;
  } catch (error) {
    console.error('Link email error:', error);
    return {
      success: false,
      error: String(error)
    };
  }
}

/**
 * Check the status of email verification
 */
export async function checkEmailStatus(cryptidUsername: string): Promise<LookupResult> {
  try {
    const publicKey = crypto.getPublicKey(cryptidUsername);
    if (!publicKey) {
      return { found: false };
    }

    const response = await fetch(`${getApiUrl()}/auth/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publicKey }),
    });

    const data = await response.json() as LookupResult;
    return data;
  } catch (error) {
    console.error('Check email status error:', error);
    return { found: false };
  }
}

/**
 * Request to link a new device using email
 * Called from Device B (new device)
 *
 * Flow:
 * 1. Generate new keypair on Device B
 * 2. Send email + publicKey to server
 * 3. Server sends verification email
 * 4. User clicks link in email (on Device B)
 * 5. Device B's key is linked to the account
 */
export async function requestDeviceLink(
  email: string,
  deviceName?: string
): Promise<DeviceLinkResult & { publicKey?: string }> {
  try {
    // Generate a new keypair for this device
    const keyPair = await crypto.generateKeyPair();
    if (!keyPair) {
      return {
        success: false,
        error: 'Failed to generate cryptographic keys'
      };
    }

    // Export the public key
    const publicKey = await crypto.exportPublicKey(keyPair.publicKey);
    if (!publicKey) {
      return {
        success: false,
        error: 'Failed to export public key'
      };
    }

    const response = await fetch(`${getApiUrl()}/auth/request-device-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        publicKey,
        deviceName: deviceName || getDeviceName()
      }),
    });

    const data = await response.json() as DeviceLinkResult & { error?: string };

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to request device link'
      };
    }

    // If successful, temporarily store the keypair for later
    // The user will need to click the email link to complete the process
    if (data.success && !data.alreadyLinked) {
      // Store pending link data
      sessionStorage.setItem('pendingDeviceLink', JSON.stringify({
        email,
        publicKey,
        cryptidUsername: data.cryptidUsername,
        timestamp: Date.now()
      }));
    }

    return {
      ...data,
      publicKey
    };
  } catch (error) {
    console.error('Request device link error:', error);
    return {
      success: false,
      error: String(error)
    };
  }
}

/**
 * Complete the device link after email verification
 * Called when user clicks the verification link and lands back on the app
 */
export async function completeDeviceLink(token: string): Promise<DeviceLinkResult> {
  try {
    const response = await fetch(`${getApiUrl()}/auth/link-device/${token}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json() as DeviceLinkResult & { email?: string; error?: string };

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to complete device link'
      };
    }

    // Use the typed data
    const result = data;

    // If successful, the pending device link data should match
    const pendingLink = sessionStorage.getItem('pendingDeviceLink');
    if (pendingLink && result.success) {
      const pending = JSON.parse(pendingLink);

      // Register this device locally with the CryptID username from the server
      if (result.cryptidUsername) {
        // Store the public key locally for this username
        crypto.storePublicKey(result.cryptidUsername, pending.publicKey);
        crypto.addRegisteredUser(result.cryptidUsername);

        // Store auth data to match the existing flow
        localStorage.setItem(`${result.cryptidUsername}_authData`, JSON.stringify({
          challenge: `device-linked:${Date.now()}`,
          signature: 'device-link-verified',
          timestamp: Date.now(),
          email: result.email
        }));
      }

      // Clear pending link data
      sessionStorage.removeItem('pendingDeviceLink');
    }

    return result;
  } catch (error) {
    console.error('Complete device link error:', error);
    return {
      success: false,
      error: String(error)
    };
  }
}

/**
 * Verify email via token (for initial email verification)
 */
export async function verifyEmail(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    const response = await fetch(`${getApiUrl()}/auth/verify-email/${token}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json() as { success: boolean; email?: string; error?: string };

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to verify email'
      };
    }

    return data;
  } catch (error) {
    console.error('Verify email error:', error);
    return {
      success: false,
      error: String(error)
    };
  }
}

/**
 * Get all devices linked to this account
 */
export async function getLinkedDevices(cryptidUsername: string): Promise<Device[]> {
  try {
    const publicKey = crypto.getPublicKey(cryptidUsername);
    if (!publicKey) {
      return [];
    }

    const response = await fetch(`${getApiUrl()}/auth/devices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publicKey }),
    });

    const data = await response.json() as { devices?: Device[] };
    return data.devices || [];
  } catch (error) {
    console.error('Get linked devices error:', error);
    return [];
  }
}

/**
 * Revoke a device from the account
 */
export async function revokeDevice(
  cryptidUsername: string,
  deviceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const publicKey = crypto.getPublicKey(cryptidUsername);
    if (!publicKey) {
      return {
        success: false,
        error: 'No public key found'
      };
    }

    const response = await fetch(`${getApiUrl()}/auth/devices/${deviceId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publicKey }),
    });

    const data = await response.json() as { success: boolean; error?: string };

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to revoke device'
      };
    }

    return data;
  } catch (error) {
    console.error('Revoke device error:', error);
    return {
      success: false,
      error: String(error)
    };
  }
}

/**
 * Get a friendly device name based on user agent
 */
function getDeviceName(): string {
  const ua = navigator.userAgent;

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  // Detect browser
  let browser = 'Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';

  return `${browser} on ${os}`;
}

/**
 * Check if there's a pending device link to complete
 */
export function hasPendingDeviceLink(): boolean {
  const pending = sessionStorage.getItem('pendingDeviceLink');
  if (!pending) return false;

  try {
    const data = JSON.parse(pending);
    // Check if it's less than 1 hour old
    return Date.now() - data.timestamp < 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Get pending device link info
 */
export function getPendingDeviceLink(): { email: string; cryptidUsername: string } | null {
  const pending = sessionStorage.getItem('pendingDeviceLink');
  if (!pending) return null;

  try {
    const data = JSON.parse(pending);
    if (Date.now() - data.timestamp < 60 * 60 * 1000) {
      return {
        email: data.email,
        cryptidUsername: data.cryptidUsername
      };
    }
    return null;
  } catch {
    return null;
  }
}
