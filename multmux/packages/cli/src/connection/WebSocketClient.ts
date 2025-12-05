import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface TerminalMessage {
  type: 'output' | 'input' | 'resize' | 'join' | 'leave' | 'presence' | 'joined' | 'error';
  data?: any;
  clientId?: string;
  timestamp?: number;
  sessionId?: string;
  sessionName?: string;
  message?: string;
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private url: string, private token: string) {
    super();
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.url}?token=${this.token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message: TerminalMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });

      this.ws.on('close', () => {
        this.emit('disconnected');
        this.attemptReconnect();
      });

      this.ws.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });
    });
  }

  private handleMessage(message: TerminalMessage): void {
    switch (message.type) {
      case 'output':
        this.emit('output', message.data);
        break;
      case 'joined':
        this.emit('joined', {
          sessionId: message.sessionId,
          sessionName: message.sessionName,
          clientId: message.clientId,
        });
        break;
      case 'presence':
        this.emit('presence', message.data);
        break;
      case 'error':
        this.emit('error', new Error(message.message || 'Unknown error'));
        break;
    }
  }

  sendInput(data: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'input',
          data,
          timestamp: Date.now(),
        })
      );
    }
  }

  resize(cols: number, rows: number): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'resize',
          data: { cols, rows },
          timestamp: Date.now(),
        })
      );
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.emit('reconnecting', this.reconnectAttempts);
        this.connect().catch(() => {
          // Reconnection failed, will retry
        });
      }, 1000 * this.reconnectAttempts);
    } else {
      this.emit('reconnect-failed');
    }
  }
}
