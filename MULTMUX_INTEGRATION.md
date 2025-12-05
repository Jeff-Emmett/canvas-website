# mulTmux Integration

mulTmux is now integrated into the canvas-website project as a collaborative terminal tool. This allows multiple developers to work together in the same terminal session.

## Installation

From the root of the canvas-website project:

```bash
# Install all dependencies including mulTmux packages
npm run multmux:install

# Build mulTmux packages
npm run multmux:build
```

## Available Commands

All commands are run from the **root** of the canvas-website project:

| Command | Description |
|---------|-------------|
| `npm run multmux:install` | Install mulTmux dependencies |
| `npm run multmux:build` | Build server and CLI packages |
| `npm run multmux:dev:server` | Run server in development mode |
| `npm run multmux:dev:cli` | Run CLI in development mode |
| `npm run multmux:start` | Start the production server |

## Quick Start

### 1. Build mulTmux

```bash
npm run multmux:build
```

### 2. Start the Server Locally (for testing)

```bash
npm run multmux:start
```

Server will be available at:
- HTTP API: `http://localhost:3000`
- WebSocket: `ws://localhost:3001`

### 3. Install CLI Globally

```bash
cd multmux/packages/cli
npm link
```

Now you can use the `multmux` command anywhere!

### 4. Create a Session

```bash
# Local testing
multmux create my-session

# Or specify your AI server (when deployed)
multmux create my-session --server http://your-ai-server:3000
```

### 5. Join from Another Terminal

```bash
multmux join <token-from-above> --server ws://your-ai-server:3001
```

## Deploying to AI Server

### Option 1: Using the Deploy Script

```bash
cd multmux
./infrastructure/deploy.sh
```

This will:
- Install system dependencies (tmux, Node.js)
- Build the project
- Set up PM2 for process management
- Start the server

### Option 2: Manual Deployment

1. **SSH to your AI server**
   ```bash
   ssh your-ai-server
   ```

2. **Clone or copy the project**
   ```bash
   git clone <your-repo>
   cd canvas-website
   git checkout mulTmux-webtree
   ```

3. **Install and build**
   ```bash
   npm install
   npm run multmux:build
   ```

4. **Start with PM2**
   ```bash
   cd multmux
   npm install -g pm2
   pm2 start packages/server/dist/index.js --name multmux-server
   pm2 save
   pm2 startup
   ```

## Project Structure

```
canvas-website/
├── multmux/
│   ├── packages/
│   │   ├── server/          # Backend (Node.js + tmux)
│   │   └── cli/             # Command-line client
│   ├── infrastructure/
│   │   ├── deploy.sh        # Auto-deployment script
│   │   └── nginx.conf       # Reverse proxy config
│   └── README.md            # Full documentation
├── package.json             # Now includes workspace config
└── MULTMUX_INTEGRATION.md   # This file
```

## Usage Examples

### Collaborative Coding Session

```bash
# Developer 1: Create session in project directory
cd /path/to/project
multmux create coding-session --repo $(pwd)

# Developer 2: Join and start coding together
multmux join <token>

# Both can now type in the same terminal!
```

### Debugging Together

```bash
# Create a session for debugging
multmux create debug-auth-issue

# Share token with teammate
# Both can run commands, check logs, etc.
```

### List Active Sessions

```bash
multmux list
```

## Configuration

### Environment Variables

You can customize ports by setting environment variables:

```bash
export PORT=3000        # HTTP API port
export WS_PORT=3001     # WebSocket port
```

### Token Expiration

Default: 60 minutes. To change, edit `/home/jeffe/Github/canvas-website/multmux/packages/server/src/managers/TokenManager.ts:11`

### Session Cleanup

Sessions auto-cleanup when all users disconnect. To change this behavior, edit `/home/jeffe/Github/canvas-website/multmux/packages/server/src/managers/SessionManager.ts:64`

## Troubleshooting

### "Command not found: multmux"

Run `npm link` from the CLI package:
```bash
cd multmux/packages/cli
npm link
```

### "Connection refused"

1. Check server is running:
   ```bash
   pm2 status
   ```

2. Check ports are available:
   ```bash
   netstat -tlnp | grep -E '3000|3001'
   ```

3. Check logs:
   ```bash
   pm2 logs multmux-server
   ```

### Token Expired

Generate a new token:
```bash
curl -X POST http://localhost:3000/api/sessions/<session-id>/tokens \
  -H "Content-Type: application/json" \
  -d '{"expiresInMinutes": 60}'
```

## Security Notes

- Tokens expire after 60 minutes
- Sessions are isolated per tmux instance
- All input is validated on the server
- Use nginx + SSL for production deployments

## Next Steps

1. **Test locally first**: Run `npm run multmux:start` and try creating/joining sessions
2. **Deploy to AI server**: Use `./infrastructure/deploy.sh`
3. **Set up nginx**: Copy config from `infrastructure/nginx.conf` for SSL/reverse proxy
4. **Share with team**: Send them tokens to collaborate!

For full documentation, see `multmux/README.md`.
