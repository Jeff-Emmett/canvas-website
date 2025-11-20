import { Client, ClientChannel } from 'ssh2'

export interface SSHConfig {
  host: string
  port: number
  username: string
  privateKey: string
}

export interface TmuxSession {
  name: string
  windows: number
  created: string
  attached: boolean
}

export class TerminalProxy {
  private connections: Map<string, Client> = new Map()
  private sessions: Map<string, ClientChannel> = new Map()
  private reconnectAttempts: Map<string, number> = new Map()

  private readonly MAX_RECONNECT_ATTEMPTS = 5
  private readonly CONNECTION_TIMEOUT = 30000

  constructor(private config: SSHConfig) {}

  async connect(connectionId: string): Promise<void> {
    if (this.connections.has(connectionId)) {
      console.log(`Connection ${connectionId} already exists`)
      return
    }

    return new Promise((resolve, reject) => {
      const conn = new Client()

      conn.on('ready', () => {
        console.log(`SSH connection ${connectionId} ready`)
        this.connections.set(connectionId, conn)
        this.reconnectAttempts.set(connectionId, 0)
        resolve()
      })

      conn.on('error', (err) => {
        console.error(`SSH connection ${connectionId} error:`, err)
        this.connections.delete(connectionId)
        reject(err)
      })

      conn.on('end', () => {
        console.log(`SSH connection ${connectionId} ended`)
        this.handleDisconnect(connectionId)
      })

      conn.on('close', () => {
        console.log(`SSH connection ${connectionId} closed`)
        this.handleDisconnect(connectionId)
      })

      try {
        conn.connect({
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          privateKey: this.config.privateKey,
          readyTimeout: this.CONNECTION_TIMEOUT
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  async disconnect(connectionId: string): Promise<void> {
    const conn = this.connections.get(connectionId)
    if (conn) {
      conn.end()
      this.connections.delete(connectionId)
      this.reconnectAttempts.delete(connectionId)
    }

    // Close any active sessions for this connection
    for (const [sessionId, channel] of this.sessions.entries()) {
      if (sessionId.startsWith(connectionId)) {
        channel.close()
        this.sessions.delete(sessionId)
      }
    }
  }

  private handleDisconnect(connectionId: string): void {
    this.connections.delete(connectionId)

    const attempts = this.reconnectAttempts.get(connectionId) || 0
    if (attempts < this.MAX_RECONNECT_ATTEMPTS) {
      console.log(`Attempting reconnect ${attempts + 1}/${this.MAX_RECONNECT_ATTEMPTS}`)
      this.reconnectAttempts.set(connectionId, attempts + 1)

      setTimeout(() => {
        this.connect(connectionId).catch((err) => {
          console.error('Reconnect failed:', err)
        })
      }, Math.min(1000 * Math.pow(2, attempts), 16000))
    } else {
      console.error(`Max reconnect attempts reached for ${connectionId}`)
      this.reconnectAttempts.delete(connectionId)
    }
  }

  async listSessions(connectionId: string): Promise<TmuxSession[]> {
    const conn = this.connections.get(connectionId)
    if (!conn) {
      throw new Error(`No connection found: ${connectionId}`)
    }

    return new Promise((resolve, reject) => {
      conn.exec('tmux list-sessions -F "#{session_name}|#{session_windows}|#{session_created}|#{session_attached}"', (err, stream) => {
        if (err) {
          reject(err)
          return
        }

        let output = ''

        stream.on('data', (data: Buffer) => {
          output += data.toString()
        })

        stream.on('close', (code: number) => {
          if (code !== 0) {
            // No sessions exist (tmux returns non-zero when no sessions)
            resolve([])
            return
          }

          try {
            const sessions: TmuxSession[] = output
              .trim()
              .split('\n')
              .filter(line => line.length > 0)
              .map(line => {
                const [name, windows, created, attached] = line.split('|')
                return {
                  name,
                  windows: parseInt(windows, 10),
                  created: new Date(parseInt(created, 10) * 1000).toISOString(),
                  attached: attached === '1'
                }
              })

            resolve(sessions)
          } catch (parseErr) {
            reject(parseErr)
          }
        })

        stream.stderr.on('data', (data: Buffer) => {
          console.error('tmux list-sessions error:', data.toString())
        })
      })
    })
  }

  async createSession(connectionId: string, sessionName: string): Promise<string> {
    const conn = this.connections.get(connectionId)
    if (!conn) {
      throw new Error(`No connection found: ${connectionId}`)
    }

    return new Promise((resolve, reject) => {
      const command = `tmux new-session -d -s "${sessionName}" && echo "${sessionName}"`

      conn.exec(command, (err, stream) => {
        if (err) {
          reject(err)
          return
        }

        let output = ''

        stream.on('data', (data: Buffer) => {
          output += data.toString()
        })

        stream.on('close', (code: number) => {
          if (code !== 0) {
            reject(new Error(`Failed to create session: ${sessionName}`))
            return
          }

          resolve(output.trim())
        })

        stream.stderr.on('data', (data: Buffer) => {
          console.error('tmux create-session error:', data.toString())
        })
      })
    })
  }

  async attachSession(
    connectionId: string,
    sessionName: string,
    cols: number = 80,
    rows: number = 24,
    onData: (data: Buffer) => void,
    onClose: () => void
  ): Promise<string> {
    const conn = this.connections.get(connectionId)
    if (!conn) {
      throw new Error(`No connection found: ${connectionId}`)
    }

    const sessionId = `${connectionId}:${sessionName}`

    return new Promise((resolve, reject) => {
      conn.exec(
        `tmux attach-session -t "${sessionName}"`,
        {
          pty: {
            term: 'xterm-256color',
            cols,
            rows
          }
        },
        (err, stream) => {
          if (err) {
            reject(err)
            return
          }

          this.sessions.set(sessionId, stream)

          stream.on('data', (data: Buffer) => {
            onData(data)
          })

          stream.on('close', () => {
            console.log(`Session ${sessionId} closed`)
            this.sessions.delete(sessionId)
            onClose()
          })

          stream.stderr.on('data', (data: Buffer) => {
            console.error(`Session ${sessionId} error:`, data.toString())
          })

          resolve(sessionId)
        }
      )
    })
  }

  async sendInput(sessionId: string, data: string): Promise<void> {
    const stream = this.sessions.get(sessionId)
    if (!stream) {
      throw new Error(`No session found: ${sessionId}`)
    }

    return new Promise((resolve, reject) => {
      stream.write(data, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  async resize(sessionId: string, cols: number, rows: number): Promise<void> {
    const stream = this.sessions.get(sessionId)
    if (!stream) {
      throw new Error(`No session found: ${sessionId}`)
    }

    stream.setWindow(rows, cols)
  }

  async killSession(connectionId: string, sessionName: string): Promise<void> {
    const conn = this.connections.get(connectionId)
    if (!conn) {
      throw new Error(`No connection found: ${connectionId}`)
    }

    return new Promise((resolve, reject) => {
      conn.exec(`tmux kill-session -t "${sessionName}"`, (err, stream) => {
        if (err) {
          reject(err)
          return
        }

        stream.on('close', (code: number) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`Failed to kill session: ${sessionName}`))
          }
        })
      })
    })
  }

  async detachSession(sessionId: string): Promise<void> {
    const stream = this.sessions.get(sessionId)
    if (stream) {
      stream.close()
      this.sessions.delete(sessionId)
    }
  }

  isConnected(connectionId: string): boolean {
    return this.connections.has(connectionId)
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  getActiveSessionCount(): number {
    return this.sessions.size
  }

  getConnectionCount(): number {
    return this.connections.size
  }

  async cleanup(): Promise<void> {
    // Close all sessions
    for (const [sessionId, stream] of this.sessions.entries()) {
      stream.close()
    }
    this.sessions.clear()

    // Close all connections
    for (const [connectionId, conn] of this.connections.entries()) {
      conn.end()
    }
    this.connections.clear()
    this.reconnectAttempts.clear()
  }
}

export class TerminalProxyManager {
  private proxies: Map<string, TerminalProxy> = new Map()
  private idleTimeouts: Map<string, NodeJS.Timeout> = new Map()

  private readonly IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes

  getProxy(userId: string, config: SSHConfig): TerminalProxy {
    let proxy = this.proxies.get(userId)

    if (!proxy) {
      proxy = new TerminalProxy(config)
      this.proxies.set(userId, proxy)
    }

    // Reset idle timeout
    this.resetIdleTimeout(userId)

    return proxy
  }

  private resetIdleTimeout(userId: string): void {
    const existing = this.idleTimeouts.get(userId)
    if (existing) {
      clearTimeout(existing)
    }

    const timeout = setTimeout(() => {
      this.removeProxy(userId)
    }, this.IDLE_TIMEOUT)

    this.idleTimeouts.set(userId, timeout)
  }

  async removeProxy(userId: string): Promise<void> {
    const proxy = this.proxies.get(userId)
    if (proxy) {
      await proxy.cleanup()
      this.proxies.delete(userId)
    }

    const timeout = this.idleTimeouts.get(userId)
    if (timeout) {
      clearTimeout(timeout)
      this.idleTimeouts.delete(userId)
    }
  }

  async cleanup(): Promise<void> {
    for (const [userId, proxy] of this.proxies.entries()) {
      await proxy.cleanup()
    }

    this.proxies.clear()

    for (const timeout of this.idleTimeouts.values()) {
      clearTimeout(timeout)
    }

    this.idleTimeouts.clear()
  }

  getStats() {
    const stats = {
      totalProxies: this.proxies.size,
      userStats: [] as Array<{
        userId: string
        connections: number
        sessions: number
      }>
    }

    for (const [userId, proxy] of this.proxies.entries()) {
      stats.userStats.push({
        userId,
        connections: proxy.getConnectionCount(),
        sessions: proxy.getActiveSessionCount()
      })
    }

    return stats
  }
}
