#!/bin/bash

# Script to switch between local and production worker URLs

if [ "$1" = "local" ]; then
    echo "Switching to local worker (http://localhost:5172)..."
    sed -i 's|VITE_TLDRAW_WORKER_URL=.*|VITE_TLDRAW_WORKER_URL=http://localhost:5172|' .env.development
    echo "✅ Switched to local worker"
    echo "💡 Restart your dev server with: npm run dev"
elif [ "$1" = "prod" ]; then
    echo "Switching to production worker (https://jeffemmett-canvas.jeffemmett.workers.dev)..."
    sed -i 's|VITE_TLDRAW_WORKER_URL=.*|VITE_TLDRAW_WORKER_URL=https://jeffemmett-canvas.jeffemmett.workers.dev|' .env.development
    echo "✅ Switched to production worker"
    echo "💡 Restart your dev server with: npm run dev"
else
    echo "Usage: $0 [local|prod]"
    echo ""
    echo "Examples:"
    echo "  $0 local  - Use local worker (http://localhost:5172)"
    echo "  $0 prod   - Use production worker (https://jeffemmett-canvas.jeffemmett.workers.dev)"
    echo ""
    echo "Current setting:"
    grep VITE_TLDRAW_WORKER_URL .env.development
fi
