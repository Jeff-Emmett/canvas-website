import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { SessionManager } from '../managers/SessionManager';
import { TokenManager } from '../managers/TokenManager';
import { TerminalMessage, ClientConnection } from '../types';

export class TerminalHandler {
  private clients: Map<string, { ws: WebSocket; connection: ClientConnection }> = new Map();

  constructor(
    private sessionManager: SessionManager,
    private tokenManager: TokenManager
  ) {}

  handleConnection(ws: WebSocket, token: string): void {
    // Validate token
    const sessionToken = this.tokenManager.validateToken(token);
    if (!sessionToken) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid or expired token' }));
      ws.close();
      return;
    }

    // Verify session exists
    const session = this.sessionManager.getSession(sessionToken.sessionId);
    if (!session) {
      ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
      ws.close();
      return;
    }

    const clientId = nanoid(16);
    const connection: ClientConnection = {
      id: clientId,
      sessionId: sessionToken.sessionId,
      permissions: sessionToken.permissions,
    };

    this.clients.set(clientId, { ws, connection });
    this.sessionManager.addClient(sessionToken.sessionId, clientId);

    // Attach terminal output to WebSocket
    const terminal = this.sessionManager.getTerminal(sessionToken.sessionId);
    if (terminal) {
      const onData = (data: string) => {
        const message: TerminalMessage = {
          type: 'output',
          data,
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(message));
      };

      const dataListener = terminal.onData(onData);

      // Clean up on disconnect
      ws.on('close', () => {
        dataListener.dispose();
        this.handleDisconnect(clientId);
      });
    }

    // Send join confirmation
    ws.send(
      JSON.stringify({
        type: 'joined',
        sessionId: session.id,
        sessionName: session.name,
        clientId,
      })
    );

    // Broadcast presence
    this.broadcastToSession(sessionToken.sessionId, {
      type: 'presence',
      data: {
        action: 'join',
        clientId,
        totalClients: session.clients.size,
      },
      timestamp: Date.now(),
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      this.handleMessage(clientId, data.toString());
    });
  }

  private handleMessage(clientId: string, rawMessage: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const message: TerminalMessage = JSON.parse(rawMessage);

      switch (message.type) {
        case 'input':
          this.handleInput(client.connection, message.data);
          break;
        case 'resize':
          this.handleResize(client.connection, message.data);
          break;
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  private handleInput(connection: ClientConnection, data: string): void {
    if (connection.permissions !== 'write') {
      return; // Read-only clients can't send input
    }

    const terminal = this.sessionManager.getTerminal(connection.sessionId);
    if (terminal) {
      terminal.write(data);
    }

    // Broadcast input to other clients for cursor tracking
    this.broadcastToSession(
      connection.sessionId,
      {
        type: 'input',
        data,
        clientId: connection.id,
        timestamp: Date.now(),
      },
      connection.id // Exclude sender
    );
  }

  private handleResize(connection: ClientConnection, data: { cols: number; rows: number }): void {
    this.sessionManager.resizeTerminal(connection.sessionId, data.cols, data.rows);
  }

  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.sessionManager.removeClient(client.connection.sessionId, clientId);
    this.clients.delete(clientId);

    // Broadcast leave
    const session = this.sessionManager.getSession(client.connection.sessionId);
    if (session) {
      this.broadcastToSession(client.connection.sessionId, {
        type: 'presence',
        data: {
          action: 'leave',
          clientId,
          totalClients: session.clients.size,
        },
        timestamp: Date.now(),
      });
    }
  }

  private broadcastToSession(
    sessionId: string,
    message: TerminalMessage,
    excludeClientId?: string
  ): void {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return;

    const messageStr = JSON.stringify(message);

    for (const [clientId, client] of this.clients.entries()) {
      if (client.connection.sessionId === sessionId && clientId !== excludeClientId) {
        client.ws.send(messageStr);
      }
    }
  }
}
