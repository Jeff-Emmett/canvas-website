import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { SessionManager } from './managers/SessionManager';
import { TokenManager } from './managers/TokenManager';
import { TerminalHandler } from './websocket/TerminalHandler';
import { createRouter } from './api/routes';

const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;

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

  app.listen(PORT, () => {
    console.log(`mulTmux HTTP API listening on port ${PORT}`);
  });

  // WebSocket Server
  const wss = new WebSocketServer({ port: Number(WS_PORT) });

  wss.on('connection', (ws, req) => {
    // Extract token from query string
    const url = new URL(req.url || '', `http://localhost:${WS_PORT}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.send(JSON.stringify({ type: 'error', message: 'Token required' }));
      ws.close();
      return;
    }

    terminalHandler.handleConnection(ws, token);
  });

  console.log(`mulTmux WebSocket server listening on port ${WS_PORT}`);
  console.log('');
  console.log('mulTmux server is ready!');
  console.log(`API: http://localhost:${PORT}/api`);
  console.log(`WebSocket: ws://localhost:${WS_PORT}`);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
