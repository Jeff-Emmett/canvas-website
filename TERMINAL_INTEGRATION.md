# Terminal Feature Integration Guide

## Overview

This document provides step-by-step instructions for integrating the terminal feature with the backend infrastructure. The terminal feature requires WebSocket support and SSH proxy capabilities that cannot run directly in Cloudflare Workers due to PTY limitations.

---

## Backend Architecture Decision

Since Cloudflare Workers cannot create PTY (pseudo-terminal) processes required for tmux, you have **two implementation options**:

### Option 1: Separate WebSocket Server (Recommended)

Run a Node.js WebSocket server on your DigitalOcean droplet that handles terminal connections.

**Pros:**
- Clean separation of concerns
- Full control over PTY/tmux integration
- No Cloudflare Worker modifications needed
- Better security (SSH keys never leave your droplet)

**Cons:**
- Additional server to maintain
- Need to expose WebSocket port

### Option 2: Hybrid Cloudflare + Droplet Service

Use Cloudflare Durable Objects to proxy WebSocket connections to a backend service on your droplet.

**Pros:**
- Leverages existing Cloudflare infrastructure
- Can reuse authentication
- Single entry point for clients

**Cons:**
- More complex setup
- Still requires separate service on droplet
- May have latency overhead

---

## Option 1: Separate WebSocket Server (Step-by-Step)

### Step 1: Create WebSocket Server on Droplet

Create a new file on your DigitalOcean droplet: `/opt/terminal-server/server.js`

```javascript
import WebSocket from 'ws'
import { TerminalProxyManager, SSHConfig } from './TerminalProxy.js'

const PORT = 8080
const wss = new WebSocket.Server({ port: PORT })

// Load SSH config from environment or config file
const sshConfig: SSHConfig = {
  host: 'localhost',  // Connect to same droplet
  port: 22,
  username: process.env.SSH_USER || 'canvas-terminal',
  privateKey: fs.readFileSync(process.env.SSH_KEY_PATH || '/opt/terminal-server/key')
}

const proxyManager = new TerminalProxyManager()

console.log(`Terminal WebSocket server listening on port ${PORT}`)

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `ws://localhost:${PORT}`)
  const sessionId = url.pathname.split('/').pop()

  // TODO: Add authentication
  const userId = req.headers['x-user-id'] || 'anonymous'

  console.log(`Client connected: ${userId}`)

  const proxy = proxyManager.getProxy(userId, sshConfig)
  let currentSession: string | null = null

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString())

      switch (message.type) {
        case 'init':
          // Attach to tmux session
          const connectionId = `${userId}-conn`

          if (!proxy.isConnected(connectionId)) {
            await proxy.connect(connectionId)
          }

          currentSession = await proxy.attachSession(
            connectionId,
            message.sessionId,
            message.cols || 80,
            message.rows || 24,
            (output) => {
              ws.send(JSON.stringify({ type: 'output', data: output }))
            },
            () => {
              ws.send(JSON.stringify({ type: 'status', status: 'disconnected' }))
            }
          )

          ws.send(JSON.stringify({ type: 'status', status: 'connected' }))
          break

        case 'input':
          if (currentSession) {
            await proxy.sendInput(currentSession, message.data)
          }
          break

        case 'resize':
          if (currentSession) {
            await proxy.resize(currentSession, message.cols, message.rows)
          }
          break

        case 'list_sessions':
          const connectionId2 = `${userId}-conn`
          if (!proxy.isConnected(connectionId2)) {
            await proxy.connect(connectionId2)
          }
          const sessions = await proxy.listSessions(connectionId2)
          ws.send(JSON.stringify({ type: 'sessions', sessions }))
          break

        case 'create_session':
          const connectionId3 = `${userId}-conn`
          if (!proxy.isConnected(connectionId3)) {
            await proxy.connect(connectionId3)
          }
          const newSession = await proxy.createSession(connectionId3, message.name)
          ws.send(JSON.stringify({ type: 'session_created', sessionId: newSession }))
          break

        case 'detach':
          if (currentSession) {
            await proxy.detachSession(currentSession)
            currentSession = null
            ws.send(JSON.stringify({ type: 'status', status: 'detached' }))
          }
          break
      }
    } catch (err) {
      console.error('Error handling message:', err)
      ws.send(JSON.stringify({ type: 'error', message: err.message }))
    }
  })

  ws.on('close', async () => {
    console.log(`Client disconnected: ${userId}`)
    if (currentSession) {
      await proxy.detachSession(currentSession)
    }
  })

  ws.on('error', (err) => {
    console.error('WebSocket error:', err)
  })
})

// Cleanup on shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...')
  await proxyManager.cleanup()
  wss.close()
  process.exit(0)
})
```

### Step 2: Copy TerminalProxy.ts to Droplet

Copy `/worker/TerminalProxy.ts` to your droplet and convert it to work with Node.js:

```bash
# On your local machine
scp worker/TerminalProxy.ts your-droplet:/opt/terminal-server/TerminalProxy.js
```

### Step 3: Install Dependencies on Droplet

```bash
ssh your-droplet
cd /opt/terminal-server
npm init -y
npm install ws ssh2
```

### Step 4: Create systemd Service

Create `/etc/systemd/system/terminal-server.service`:

```ini
[Unit]
Description=Terminal WebSocket Server
After=network.target

[Service]
Type=simple
User=canvas-terminal
WorkingDirectory=/opt/terminal-server
Environment="NODE_ENV=production"
Environment="SSH_USER=canvas-terminal"
Environment="SSH_KEY_PATH=/opt/terminal-server/key"
ExecStart=/usr/bin/node /opt/terminal-server/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable terminal-server
sudo systemctl start terminal-server
sudo systemctl status terminal-server
```

### Step 5: Configure Firewall

```bash
# Allow WebSocket connections
sudo ufw allow 8080/tcp

# Or if using specific IPs
sudo ufw allow from YOUR_CLOUDFLARE_IP to any port 8080
```

### Step 6: Update Frontend WebSocket URL

Modify `/src/components/TerminalContent.tsx`:

```typescript
const connectWebSocket = () => {
  // Update with your droplet IP
  const wsUrl = `wss://YOUR_DROPLET_IP:8080/terminal/${sessionId}`
  const ws = new WebSocket(wsUrl)
  // ... rest of code
}
```

### Step 7: Optional - Use nginx as Reverse Proxy

Create `/etc/nginx/sites-available/terminal-ws`:

```nginx
upstream terminal_backend {
    server 127.0.0.1:8080;
}

server {
    listen 443 ssl http2;
    server_name terminal.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://terminal_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket specific
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/terminal-ws /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Option 2: Cloudflare Worker Integration

If you prefer to proxy through Cloudflare, add these routes to `worker/AutomergeDurableObject.ts`:

```typescript
import { TerminalProxyManager } from './TerminalProxy'

export class AutomergeDurableObject {
  // Add to existing class
  private terminalProxyManager: TerminalProxyManager | null = null

  private getTerminalProxy() {
    if (!this.terminalProxyManager) {
      this.terminalProxyManager = new TerminalProxyManager()
    }
    return this.terminalProxyManager
  }

  // Add to router (after line 155)
  private readonly router = AutoRouter({
    // ... existing routes ...
  })
    // ... existing routes ...

    // Terminal WebSocket endpoint
    .get("/terminal/ws/:sessionId", async (request) => {
      const upgradeHeader = request.headers.get("Upgrade")
      if (upgradeHeader !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 })
      }

      const [client, server] = Object.values(new WebSocketPair())

      // Handle WebSocket connection
      server.accept()

      const proxyManager = this.getTerminalProxy()
      const userId = "user-123" // TODO: Get from auth

      // Get SSH config from environment or secrets
      const sshConfig = {
        host: request.env.TERMINAL_SSH_HOST,
        port: 22,
        username: request.env.TERMINAL_SSH_USER,
        privateKey: request.env.TERMINAL_SSH_KEY
      }

      const proxy = proxyManager.getProxy(userId, sshConfig)
      let currentSession: string | null = null

      server.addEventListener("message", async (event) => {
        try {
          const message = JSON.parse(event.data as string)

          // Handle message types similar to Option 1
          // ... (implementation same as server.js above)
        } catch (err) {
          server.send(JSON.stringify({ type: "error", message: err.message }))
        }
      })

      return new Response(null, {
        status: 101,
        webSocket: client
      })
    })

    // List tmux sessions
    .get("/terminal/sessions", async (request) => {
      const userId = "user-123" // TODO: Get from auth
      const proxyManager = this.getTerminalProxy()

      const sshConfig = {
        host: request.env.TERMINAL_SSH_HOST,
        port: 22,
        username: request.env.TERMINAL_SSH_USER,
        privateKey: request.env.TERMINAL_SSH_KEY
      }

      const proxy = proxyManager.getProxy(userId, sshConfig)
      const connectionId = `${userId}-conn`

      if (!proxy.isConnected(connectionId)) {
        await proxy.connect(connectionId)
      }

      const sessions = await proxy.listSessions(connectionId)

      return new Response(JSON.stringify({ sessions }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      })
    })

    // Create new tmux session
    .post("/terminal/sessions", async (request) => {
      const userId = "user-123" // TODO: Get from auth
      const { name } = await request.json() as { name: string }

      const proxyManager = this.getTerminalProxy()
      const sshConfig = {
        host: request.env.TERMINAL_SSH_HOST,
        port: 22,
        username: request.env.TERMINAL_SSH_USER,
        privateKey: request.env.TERMINAL_SSH_KEY
      }

      const proxy = proxyManager.getProxy(userId, sshConfig)
      const connectionId = `${userId}-conn`

      if (!proxy.isConnected(connectionId)) {
        await proxy.connect(connectionId)
      }

      const sessionId = await proxy.createSession(connectionId, name)

      return new Response(JSON.stringify({ sessionId }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      })
    })
}
```

**Note:** Cloudflare Workers have limitations:
- 128MB memory limit
- 30-second CPU time limit (50ms for free tier)
- ssh2 may not work due to crypto limitations

**Recommendation:** Use Option 1 (separate WebSocket server) for better reliability.

---

## Environment Variables

Add to `.env` or Cloudflare Worker secrets:

```bash
TERMINAL_SSH_HOST=165.227.XXX.XXX
TERMINAL_SSH_PORT=22
TERMINAL_SSH_USER=canvas-terminal
TERMINAL_SSH_KEY="-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----"
```

Set Cloudflare secrets:

```bash
wrangler secret put TERMINAL_SSH_HOST
wrangler secret put TERMINAL_SSH_USER
wrangler secret put TERMINAL_SSH_KEY
```

---

## Testing

### 1. Test WebSocket Server

```bash
# Install wscat
npm install -g wscat

# Connect to server
wscat -c ws://YOUR_DROPLET_IP:8080/terminal/test-session

# Send test message
> {"type":"list_sessions"}
```

### 2. Test from Browser Console

```javascript
const ws = new WebSocket('wss://YOUR_DROPLET_IP:8080/terminal/test-session')

ws.onopen = () => {
  console.log('Connected')
  ws.send(JSON.stringify({ type: 'list_sessions' }))
}

ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data))
}
```

### 3. Test Terminal Creation in Canvas

1. Open canvas dashboard
2. Click terminal button in toolbar
3. Should see session browser
4. Click "Create New Session" or attach to existing
5. Should see terminal prompt

---

## Troubleshooting

### WebSocket Connection Failed

**Check server is running:**
```bash
sudo systemctl status terminal-server
sudo journalctl -u terminal-server -f
```

**Check firewall:**
```bash
sudo ufw status
telnet YOUR_DROPLET_IP 8080
```

**Check nginx (if using):**
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### SSH Connection Failed

**Test SSH manually:**
```bash
ssh -i /opt/terminal-server/key canvas-terminal@localhost
```

**Check SSH key permissions:**
```bash
chmod 600 /opt/terminal-server/key
chown canvas-terminal:canvas-terminal /opt/terminal-server/key
```

**Check authorized_keys:**
```bash
cat /home/canvas-terminal/.ssh/authorized_keys
```

### tmux Commands Not Working

**Test tmux manually:**
```bash
tmux ls
tmux new-session -d -s test
tmux attach -t test
```

**Install tmux if missing:**
```bash
sudo apt update
sudo apt install tmux
```

### Browser Console Errors

**Mixed content (HTTP/HTTPS):**
- Ensure WebSocket uses `wss://` not `ws://`
- Use HTTPS for canvas dashboard
- Use SSL certificate for WebSocket server

**CORS errors:**
- Check nginx/server CORS headers
- Verify origin matches

---

## Security Hardening

### 1. Restrict SSH Key

Create dedicated key for terminal server:

```bash
ssh-keygen -t ed25519 -f /opt/terminal-server/key -N ""
```

Add to droplet's `authorized_keys` with command restriction:

```bash
command="/usr/bin/tmux" ssh-ed25519 AAAA... canvas-terminal
```

### 2. Use Restricted Shell

Edit `/home/canvas-terminal/.bashrc`:

```bash
# Only allow tmux
if [[ $- == *i* ]]; then
    exec tmux attach || exec tmux
fi
```

### 3. Rate Limiting

Add to nginx config:

```nginx
limit_req_zone $binary_remote_addr zone=terminal:10m rate=10r/s;

server {
    location / {
        limit_req zone=terminal burst=20;
        # ... proxy config ...
    }
}
```

### 4. Authentication

Add JWT validation in WebSocket server:

```javascript
import jwt from 'jsonwebtoken'

wss.on('connection', (ws, req) => {
  const token = req.headers['authorization']?.split(' ')[1]

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const userId = payload.userId
    // ... rest of code ...
  } catch (err) {
    ws.close(1008, 'Unauthorized')
    return
  }
})
```

---

## Next Steps

1. Choose Option 1 or Option 2
2. Set up backend server/routes
3. Configure SSH credentials
4. Test WebSocket connection
5. Test terminal creation in canvas
6. Add authentication
7. Deploy to production

---

## Additional Resources

- [ssh2 documentation](https://github.com/mscdex/ssh2)
- [ws (WebSocket) documentation](https://github.com/websockets/ws)
- [tmux manual](https://github.com/tmux/tmux/wiki)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [nginx WebSocket proxying](https://nginx.org/en/docs/http/websocket.html)

---

**Last Updated:** 2025-01-19
**Status:** Implementation guide for terminal feature backend
