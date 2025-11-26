import { nanoid } from 'nanoid';
import { SessionToken } from '../types';

export class TokenManager {
  private tokens: Map<string, SessionToken> = new Map();

  generateToken(
    sessionId: string,
    expiresInMinutes: number = 60,
    permissions: 'read' | 'write' = 'write'
  ): string {
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    this.tokens.set(token, {
      token,
      sessionId,
      expiresAt,
      permissions,
    });

    // Clean up expired token after expiration
    setTimeout(() => this.tokens.delete(token), expiresInMinutes * 60 * 1000);

    return token;
  }

  validateToken(token: string): SessionToken | null {
    const sessionToken = this.tokens.get(token);

    if (!sessionToken) {
      return null;
    }

    if (sessionToken.expiresAt < new Date()) {
      this.tokens.delete(token);
      return null;
    }

    return sessionToken;
  }

  revokeToken(token: string): void {
    this.tokens.delete(token);
  }

  getActiveTokens(): number {
    return this.tokens.size;
  }
}
