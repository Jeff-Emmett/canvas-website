# Worker Environment Switching Guide

## Quick Switch Commands

### Switch to Dev Environment (Default)
```bash
./switch-worker-env.sh dev
```

### Switch to Production Environment
```bash
./switch-worker-env.sh production
```

### Switch to Local Environment
```bash
./switch-worker-env.sh local
```

## Manual Switching

You can also manually edit the environment by:

1. **Option 1**: Set environment variable
   ```bash
   export VITE_WORKER_ENV=dev
   ```

2. **Option 2**: Edit `.env.local` file
   ```
   VITE_WORKER_ENV=dev
   ```

3. **Option 3**: Edit `src/constants/workerUrl.ts` directly
   ```typescript
   const WORKER_ENV = 'dev' // Change this line
   ```

## Available Environments

| Environment | URL | Description |
|-------------|-----|-------------|
| `local` | `http://localhost:5172` | Local worker (requires `npm run dev:worker:local`) |
| `dev` | `https://jeffemmett-canvas-automerge-dev.jeffemmett.workers.dev` | Cloudflare dev environment |
| `production` | `https://jeffemmett-canvas.jeffemmett.workers.dev` | Production environment |

## Current Status

- ✅ **Dev Environment**: Working with AutomergeDurableObject
- ✅ **R2 Data Loading**: Fixed format conversion
- ✅ **WebSocket**: Improved with keep-alive and reconnection
- 🔄 **Production**: Ready to deploy when testing is complete

## Testing the Fix

1. Switch to dev environment: `./switch-worker-env.sh dev`
2. Start your frontend: `npm run dev`
3. Check browser console for environment logs
4. Test R2 data loading in your canvas app
5. Verify WebSocket connections are stable

































