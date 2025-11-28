import { Router } from 'express';
import { SessionManager } from '../managers/SessionManager';
import { TokenManager } from '../managers/TokenManager';

export function createRouter(
  sessionManager: SessionManager,
  tokenManager: TokenManager
): Router {
  const router = Router();

  // Create a new session
  router.post('/sessions', async (req, res) => {
    try {
      const { name, repoPath } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Session name is required' });
      }

      const session = await sessionManager.createSession(name, repoPath);
      const token = tokenManager.generateToken(session.id, 60, 'write');

      res.json({
        session: {
          id: session.id,
          name: session.name,
          createdAt: session.createdAt,
        },
        token,
        inviteUrl: `multmux join ${token}`,
      });
    } catch (error) {
      console.error('Failed to create session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  // List active sessions
  router.get('/sessions', (req, res) => {
    const sessions = sessionManager.listSessions();
    res.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        name: s.name,
        createdAt: s.createdAt,
        activeClients: s.clients.size,
      })),
    });
  });

  // Get session info
  router.get('/sessions/:id', (req, res) => {
    const session = sessionManager.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      activeClients: session.clients.size,
    });
  });

  // Join an existing session (generates a new token and returns session info)
  router.post('/sessions/:id/join', (req, res) => {
    const session = sessionManager.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Generate a new token for this joining client
    const token = tokenManager.generateToken(session.id, 60, 'write');

    res.json({
      id: session.id,
      name: session.name,
      token,
      createdAt: session.createdAt,
      activeClients: session.clients.size,
    });
  });

  // Generate new invite token for existing session
  router.post('/sessions/:id/tokens', (req, res) => {
    const session = sessionManager.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { expiresInMinutes = 60, permissions = 'write' } = req.body;
    const token = tokenManager.generateToken(session.id, expiresInMinutes, permissions);

    res.json({
      token,
      inviteUrl: `multmux join ${token}`,
      expiresInMinutes,
      permissions,
    });
  });

  // Health check
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      activeSessions: sessionManager.listSessions().length,
      activeTokens: tokenManager.getActiveTokens(),
    });
  });

  return router;
}
