# mulTmux

A collaborative terminal tool that lets multiple users interact with the same tmux session in real-time.

## Features

- **Real-time Collaboration**: Multiple users can connect to the same terminal session
- **tmux Backend**: Leverages tmux for robust terminal multiplexing
- **Token-based Auth**: Secure invite links with expiration
- **Presence Indicators**: See who's connected to your session
- **Low Resource Usage**: ~200-300MB RAM for typical usage
- **Easy Deployment**: Works alongside existing services on your server

## Architecture

```
┌─────────────┐                          ┌──────────────────┐
│   Client    │ ──── WebSocket ────────> │  Server          │
│   (CLI)     │      (token auth)        │                  │
└─────────────┘                          │  ┌────────────┐  │
                                         │  │  Node.js   │  │
┌─────────────┐                          │  │  Backend   │  │
│  Client 2   │ ──── Invite Link ──────> │  └─────┬──────┘  │
│   (CLI)     │                          │        │         │
└─────────────┘                          │  ┌─────▼──────┐  │
                                         │  │   tmux     │  │
                                         │  │  Sessions  │  │
                                         │  └────────────┘  │
                                         └──────────────────┘
```

## Installation

### Server Setup

1. **Deploy to your AI server:**
   ```bash
   cd multmux
   chmod +x infrastructure/deploy.sh
   ./infrastructure/deploy.sh
   ```

   This will:
   - Install tmux if needed
   - Build the server
   - Set up PM2 for process management
   - Start the server

2. **(Optional) Set up nginx reverse proxy:**
   ```bash
   sudo cp infrastructure/nginx.conf /etc/nginx/sites-available/multmux
   sudo ln -s /etc/nginx/sites-available/multmux /etc/nginx/sites-enabled/
   # Edit the file to set your domain
   sudo nano /etc/nginx/sites-available/multmux
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### CLI Installation

**On your local machine:**
```bash
cd multmux/packages/cli
npm install
npm run build
npm link  # Installs 'multmux' command globally
```

## Usage

### Create a Session

```bash
multmux create my-project --repo /path/to/repo
```

This outputs an invite link like:
```
multmux join a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Join a Session

```bash
multmux join a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### List Active Sessions

```bash
multmux list
```

### Using a Remote Server

If your server is on a different machine:

```bash
# Create session
multmux create my-project --server http://your-server:3000

# Join session
multmux join <token> --server ws://your-server:3001
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `multmux create <name>` | Create a new collaborative session |
| `multmux join <token>` | Join an existing session |
| `multmux list` | List all active sessions |

### Options

**create:**
- `-s, --server <url>` - Server URL (default: http://localhost:3000)
- `-r, --repo <path>` - Repository path to cd into

**join:**
- `-s, --server <url>` - WebSocket server URL (default: ws://localhost:3001)

**list:**
- `-s, --server <url>` - Server URL (default: http://localhost:3000)

## Server Management

### PM2 Commands

```bash
pm2 status                    # Check server status
pm2 logs multmux-server      # View server logs
pm2 restart multmux-server   # Restart server
pm2 stop multmux-server      # Stop server
```

### Resource Usage

- **Idle**: ~100-150MB RAM
- **Per session**: ~5-10MB RAM
- **Per user**: ~1-2MB RAM
- **Typical usage**: 200-300MB RAM total

## API Reference

### HTTP API (default: port 3000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | POST | Create a new session |
| `/api/sessions` | GET | List active sessions |
| `/api/sessions/:id` | GET | Get session info |
| `/api/sessions/:id/tokens` | POST | Generate new invite token |
| `/api/health` | GET | Health check |

### WebSocket (default: port 3001)

Connect with: `ws://localhost:3001?token=<your-token>`

**Message Types:**
- `output` - Terminal output from server
- `input` - User input to terminal
- `resize` - Terminal resize event
- `presence` - User join/leave notifications
- `joined` - Connection confirmation

## Security

- **Token Expiration**: Invite tokens expire after 60 minutes (configurable)
- **Session Isolation**: Each session runs in its own tmux instance
- **Input Validation**: All terminal input is validated
- **No Persistence**: Sessions are destroyed when all users leave

## Troubleshooting

### Server won't start

Check if ports are available:
```bash
netstat -tlnp | grep -E '3000|3001'
```

### Can't connect to server

1. Check server is running: `pm2 status`
2. Check logs: `pm2 logs multmux-server`
3. Verify firewall allows ports 3000 and 3001

### Terminal not responding

1. Check WebSocket connection in browser console
2. Verify token hasn't expired
3. Restart session: `pm2 restart multmux-server`

## Development

### Project Structure

```
multmux/
├── packages/
│   ├── server/          # Backend server
│   │   ├── src/
│   │   │   ├── managers/      # Session & token management
│   │   │   ├── websocket/     # WebSocket handler
│   │   │   └── api/           # HTTP routes
│   └── cli/             # CLI client
│       ├── src/
│       │   ├── commands/      # CLI commands
│       │   ├── connection/    # WebSocket client
│       │   └── ui/            # Terminal UI
└── infrastructure/      # Deployment scripts
```

### Running in Development

**Terminal 1 - Server:**
```bash
npm run dev:server
```

**Terminal 2 - CLI:**
```bash
cd packages/cli
npm run dev -- create test-session
```

### Building

```bash
npm run build  # Builds both packages
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
