#!/bin/bash

# mulTmux Deployment Script for AI Server
# This script sets up mulTmux on your existing droplet

set -e

echo "🚀 mulTmux Deployment Script"
echo "============================"
echo ""

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "📦 Installing tmux..."
    sudo apt-get update
    sudo apt-get install -y tmux
else
    echo "✅ tmux is already installed"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js is already installed ($(node --version))"
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
else
    echo "✅ npm is already installed ($(npm --version))"
fi

# Build the server
echo ""
echo "🔨 Building mulTmux..."
cd "$(dirname "$0")/.."
npm install
npm run build

echo ""
echo "📝 Setting up PM2 for process management..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'multmux-server',
    script: './packages/server/dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      WS_PORT: 3001
    }
  }]
};
EOF

echo ""
echo "🚀 Starting mulTmux server with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -n 1 | bash || true

echo ""
echo "✅ mulTmux deployed successfully!"
echo ""
echo "Server is running on:"
echo "  HTTP API:  http://localhost:3000"
echo "  WebSocket: ws://localhost:3001"
echo ""
echo "Useful PM2 commands:"
echo "  pm2 status          - Check server status"
echo "  pm2 logs multmux-server - View logs"
echo "  pm2 restart multmux-server - Restart server"
echo "  pm2 stop multmux-server - Stop server"
echo ""
echo "To install the CLI globally:"
echo "  cd packages/cli && npm link"
echo ""
