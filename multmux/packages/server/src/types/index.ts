export interface Session {
  id: string;
  name: string;
  createdAt: Date;
  tmuxSessionName: string;
  clients: Set<string>;
  repoPath?: string;
}

export interface SessionToken {
  token: string;
  sessionId: string;
  expiresAt: Date;
  permissions: 'read' | 'write';
}

export interface ClientConnection {
  id: string;
  sessionId: string;
  username?: string;
  permissions: 'read' | 'write';
}

export interface TerminalMessage {
  type: 'output' | 'input' | 'resize' | 'join' | 'leave' | 'presence';
  data: any;
  clientId?: string;
  timestamp: number;
}
