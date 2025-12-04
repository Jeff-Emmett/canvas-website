// Google OAuth 2.0 with PKCE flow
// All tokens are encrypted before storage

import { GOOGLE_SCOPES, type GoogleService } from './types';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  encryptData,
  decryptDataToString,
  deriveServiceKey
} from './encryption';
import { tokensStore } from './database';

// OAuth configuration
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Auth state stored in sessionStorage during OAuth flow
interface GoogleAuthState {
  codeVerifier: string;
  redirectUri: string;
  state: string;
  requestedServices: GoogleService[];
}

// Get the Google Client ID from environment
function getGoogleClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID environment variable is not set');
  }
  return clientId;
}

// Get the Google Client Secret from environment
function getGoogleClientSecret(): string {
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error('VITE_GOOGLE_CLIENT_SECRET environment variable is not set');
  }
  return clientSecret;
}

// Build the OAuth redirect URI
function getRedirectUri(): string {
  return `${window.location.origin}/oauth/google/callback`;
}

// Get requested scopes based on selected services
function getRequestedScopes(services: GoogleService[]): string {
  const scopes: string[] = [GOOGLE_SCOPES.profile, GOOGLE_SCOPES.email];

  for (const service of services) {
    const scope = GOOGLE_SCOPES[service];
    if (scope) {
      scopes.push(scope);
    }
  }

  return scopes.join(' ');
}

// Initiate the Google OAuth flow
export async function initiateGoogleAuth(services: GoogleService[]): Promise<void> {
  if (services.length === 0) {
    throw new Error('At least one service must be selected');
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = crypto.randomUUID();
  const redirectUri = getRedirectUri();

  // Store auth state for callback verification
  const authState: GoogleAuthState = {
    codeVerifier,
    redirectUri,
    state,
    requestedServices: services
  };
  sessionStorage.setItem('google_auth_state', JSON.stringify(authState));

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: getRequestedScopes(services),
    access_type: 'offline',  // Get refresh token
    prompt: 'consent',       // Always show consent to get refresh token
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state
  });

  // Redirect to Google OAuth
  window.location.href = `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// Handle the OAuth callback
export async function handleGoogleCallback(
  code: string,
  state: string,
  masterKey: CryptoKey
): Promise<{
  success: boolean;
  scopes: string[];
  error?: string;
}> {
  // Retrieve and validate stored state
  const storedStateJson = sessionStorage.getItem('google_auth_state');
  if (!storedStateJson) {
    return { success: false, scopes: [], error: 'No auth state found' };
  }

  const storedState: GoogleAuthState = JSON.parse(storedStateJson);

  // Verify state matches
  if (storedState.state !== state) {
    return { success: false, scopes: [], error: 'State mismatch - possible CSRF attack' };
  }

  // Clean up session storage
  sessionStorage.removeItem('google_auth_state');

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: getGoogleClientId(),
        client_secret: getGoogleClientSecret(),
        code,
        code_verifier: storedState.codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: storedState.redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json() as { error_description?: string };
      return {
        success: false,
        scopes: [],
        error: error.error_description || 'Token exchange failed'
      };
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    };

    // Encrypt and store tokens
    await storeEncryptedTokens(tokens, masterKey);

    // Parse scopes from response
    const grantedScopes = (tokens.scope || '').split(' ');

    return {
      success: true,
      scopes: grantedScopes
    };

  } catch (error) {
    console.error('OAuth callback error:', error);
    return {
      success: false,
      scopes: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Store encrypted tokens
async function storeEncryptedTokens(
  tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  },
  masterKey: CryptoKey
): Promise<void> {
  const tokenKey = await deriveServiceKey(masterKey, 'tokens');

  const encryptedAccessToken = await encryptData(tokens.access_token, tokenKey);

  let encryptedRefreshToken = null;
  if (tokens.refresh_token) {
    encryptedRefreshToken = await encryptData(tokens.refresh_token, tokenKey);
  }

  await tokensStore.put({
    encryptedAccessToken,
    encryptedRefreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scopes: (tokens.scope || '').split(' ')
  });
}

// Get decrypted access token (refreshing if needed)
export async function getAccessToken(masterKey: CryptoKey): Promise<string | null> {
  const tokens = await tokensStore.get();
  if (!tokens) {
    return null;
  }

  const tokenKey = await deriveServiceKey(masterKey, 'tokens');

  // Check if token is expired
  if (await tokensStore.isExpired()) {
    // Try to refresh
    if (tokens.encryptedRefreshToken) {
      const refreshed = await refreshAccessToken(
        tokens.encryptedRefreshToken,
        tokenKey,
        masterKey
      );
      if (refreshed) {
        return refreshed;
      }
    }
    return null;  // Token expired and can't refresh
  }

  // Decrypt and return access token
  return await decryptDataToString(tokens.encryptedAccessToken, tokenKey);
}

// Refresh access token using refresh token
async function refreshAccessToken(
  encryptedRefreshToken: { encrypted: ArrayBuffer; iv: Uint8Array },
  tokenKey: CryptoKey,
  masterKey: CryptoKey
): Promise<string | null> {
  try {
    const refreshToken = await decryptDataToString(encryptedRefreshToken, tokenKey);

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: getGoogleClientId(),
        client_secret: getGoogleClientSecret(),
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return null;
    }

    const tokens = await response.json() as {
      access_token: string;
      expires_in: number;
    };

    // Store new tokens (refresh token may not be returned on refresh)
    const newTokenKey = await deriveServiceKey(masterKey, 'tokens');
    const encryptedAccessToken = await encryptData(tokens.access_token, newTokenKey);

    const existingTokens = await tokensStore.get();
    await tokensStore.put({
      encryptedAccessToken,
      encryptedRefreshToken: existingTokens?.encryptedRefreshToken || null,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scopes: existingTokens?.scopes || []
    });

    return tokens.access_token;

  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

// Check if user is authenticated with Google
export async function isGoogleAuthenticated(): Promise<boolean> {
  const tokens = await tokensStore.get();
  return tokens !== null;
}

// Get granted scopes
export async function getGrantedScopes(): Promise<string[]> {
  const tokens = await tokensStore.get();
  return tokens?.scopes || [];
}

// Check if a specific service is authorized
export async function isServiceAuthorized(service: GoogleService): Promise<boolean> {
  const scopes = await getGrantedScopes();
  return scopes.includes(GOOGLE_SCOPES[service]);
}

// Revoke Google access
export async function revokeGoogleAccess(masterKey: CryptoKey): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(masterKey);

    if (accessToken) {
      // Revoke token with Google
      await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
        method: 'POST'
      });
    }

    // Clear stored tokens
    await tokensStore.delete();

    return true;
  } catch (error) {
    console.error('Revoke error:', error);
    // Still delete local tokens even if revocation fails
    await tokensStore.delete();
    return false;
  }
}

// Get user info from Google
export async function getGoogleUserInfo(masterKey: CryptoKey): Promise<{
  email: string;
  name: string;
  picture: string;
} | null> {
  const accessToken = await getAccessToken(masterKey);
  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      return null;
    }

    const userInfo = await response.json() as {
      email: string;
      name: string;
      picture: string;
    };
    return {
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture
    };
  } catch (error) {
    console.error('Get user info error:', error);
    return null;
  }
}

// Parse callback URL parameters
export function parseCallbackParams(url: string): {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
} {
  const urlObj = new URL(url);
  return {
    code: urlObj.searchParams.get('code') || undefined,
    state: urlObj.searchParams.get('state') || undefined,
    error: urlObj.searchParams.get('error') || undefined,
    error_description: urlObj.searchParams.get('error_description') || undefined
  };
}
