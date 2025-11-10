#!/bin/bash

# Worker Environment Switcher
# Usage: ./switch-worker-env.sh [local|dev|production]

ENV=${1:-dev}

case $ENV in
  "local")
    echo "🔧 Switching to LOCAL worker environment"
    echo "VITE_WORKER_ENV=local" > .env.local
    echo "✅ Set to use local worker on port 5172"
    echo "📝 Make sure to run: npm run dev:worker:local"
    ;;
  "dev")
    echo "🔧 Switching to DEV worker environment"
    echo "VITE_WORKER_ENV=dev" > .env.local
    echo "✅ Set to use Cloudflare dev environment"
    echo "🌐 URL: https://jeffemmett-canvas-automerge-dev.jeffemmett.workers.dev"
    ;;
  "production")
    echo "🔧 Switching to PRODUCTION worker environment"
    echo "VITE_WORKER_ENV=production" > .env.local
    echo "✅ Set to use production environment"
    echo "🌐 URL: https://jeffemmett-canvas.jeffemmett.workers.dev"
    ;;
  *)
    echo "❌ Invalid environment. Use: local, dev, or production"
    echo "📖 Available environments:"
    echo "   local      - Use local worker (port 5172)"
    echo "   dev        - Use Cloudflare dev environment"
    echo "   production - Use production environment"
    exit 1
    ;;
esac

echo ""
echo "🔄 Restart your dev server to apply changes:"
echo "   npm run dev"

































