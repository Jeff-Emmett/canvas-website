import { spawn, ChildProcess } from 'child_process';
import * as pty from 'node-pty';
import { Session } from '../types';
import { nanoid } from 'nanoid';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private terminals: Map<string, pty.IPty> = new Map();

  async createSession(name: string, repoPath?: string): Promise<Session> {
    const id = nanoid(16);
    const tmuxSessionName = `multmux-${id}`;

    const session: Session = {
      id,
      name,
      createdAt: new Date(),
      tmuxSessionName,
      clients: new Set(),
      repoPath,
    };

    this.sessions.set(id, session);

    // Create tmux session
    await this.createTmuxSession(tmuxSessionName, repoPath);

    // Attach to tmux session with pty
    const terminal = pty.spawn('tmux', ['attach-session', '-t', tmuxSessionName], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: repoPath || process.cwd(),
      env: process.env as { [key: string]: string },
    });

    this.terminals.set(id, terminal);

    return session;
  }

  private async createTmuxSession(name: string, cwd?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['new-session', '-d', '-s', name];
      if (cwd) {
        args.push('-c', cwd);
      }

      const proc = spawn('tmux', args);

      proc.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to create tmux session: exit code ${code}`));
        }
      });
    });
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  getTerminal(sessionId: string): pty.IPty | undefined {
    return this.terminals.get(sessionId);
  }

  addClient(sessionId: string, clientId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.clients.add(clientId);
    }
  }

  removeClient(sessionId: string, clientId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.clients.delete(clientId);

      // Clean up session if no clients left
      if (session.clients.size === 0) {
        this.destroySession(sessionId);
      }
    }
  }

  private async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const terminal = this.terminals.get(sessionId);
    if (terminal) {
      terminal.kill();
      this.terminals.delete(sessionId);
    }

    // Kill tmux session
    spawn('tmux', ['kill-session', '-t', session.tmuxSessionName]);

    this.sessions.delete(sessionId);
  }

  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  resizeTerminal(sessionId: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(sessionId);
    if (terminal) {
      terminal.resize(cols, rows);
    }
  }
}
