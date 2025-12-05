import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { SessionManager } from './managers/SessionManager';
import { TokenManager } from './managers/TokenManager';
import { TerminalHandler } from './websocket/TerminalHandler';
import { createRouter } from './api/routes';

const PORT = process.env.PORT || 3002;

async function main() {
  // Initialize managers
  const sessionManager = new SessionManager();
  const tokenManager = new TokenManager();
  const terminalHandler = new TerminalHandler(sessionManager, tokenManager);

  // HTTP API Server
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', createRouter(sessionManager, tokenManager));

  // Create HTTP server to share with WebSocket
  const server = createServer(app);

  // WebSocket Server on same port, handles upgrade requests
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Extract token from query string
    const url = new URL(req.url || '', `http://localhost:${PORT}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.send(JSON.stringify({ type: 'error', message: 'Token required' }));
      ws.close();
      return;
    }

    terminalHandler.handleConnection(ws, token);
  });

  server.listen(PORT, () => {
    console.log('');
    console.log('mulTmux server is ready!');
    console.log(`API: http://localhost:${PORT}/api`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
