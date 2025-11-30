# mulTmux Server Dockerfile
FROM node:20-slim

# Install tmux and build dependencies for node-pty
RUN apt-get update && apt-get install -y \
    tmux \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root files
COPY package.json ./
COPY tsconfig.json ./

# Copy packages
COPY packages/server ./packages/server
COPY packages/cli ./packages/cli

# Install dependencies (including node-pty native compilation)
RUN npm install --workspaces

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3002

# Run the server
CMD ["node", "packages/server/dist/index.js"]
