/**
 * User Networking API Routes
 *
 * Handles:
 * - User search by username
 * - Connection management (follow/unfollow)
 * - Edge metadata (labels, notes, colors)
 * - Network graph retrieval
 */

import { IRequest } from 'itty-router';
import { Environment, UserProfile, UserConnection, ConnectionMetadata, UserNode, GraphEdge, NetworkGraph } from './types';

// =============================================================================
// Helper Functions
// =============================================================================

function generateId(): string {
  return crypto.randomUUID();
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// Extract user ID from request (from auth header or session)
// For now, we'll use a simple header-based approach
function getUserIdFromRequest(request: IRequest): string | null {
  // Check for X-User-Id header (set by client after CryptID auth)
  const userId = request.headers.get('X-User-Id');
  return userId;
}

// =============================================================================
// User Search Routes
// =============================================================================

/**
 * GET /api/networking/users/search?q=query&limit=20
 * Search users by username or display name
 */
export async function searchUsers(request: IRequest, env: Environment): Promise<Response> {
  const db = env.CRYPTID_DB;
  if (!db) {
    return errorResponse('Database not configured', 500);
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

  if (!query || query.length < 2) {
    return errorResponse('Query must be at least 2 characters');
  }

  const currentUserId = getUserIdFromRequest(request);

  try {
    // Search users by username or display name
    const searchPattern = `%${query}%`;
    const users = await db.prepare(`
      SELECT
        u.id,
        u.cryptid_username as username,
        COALESCE(p.display_name, u.cryptid_username) as displayName,
        p.avatar_color as avatarColor,
        p.bio
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE (
        u.cryptid_username LIKE ?1
        OR p.display_name LIKE ?1
      )
      AND (p.is_searchable = 1 OR p.is_searchable IS NULL)
      LIMIT ?2
    `).bind(searchPattern, limit).all();

    // If we have a current user, add connection status
    let results = users.results || [];

    if (currentUserId && results.length > 0) {
      const userIds = results.map((u: any) => u.id);

      // Get connections from current user
      const myConnections = await db.prepare(`
        SELECT to_user_id FROM user_connections WHERE from_user_id = ?
      `).bind(currentUserId).all();
      const connectedIds = new Set((myConnections.results || []).map((c: any) => c.to_user_id));

      // Get connections to current user
      const theirConnections = await db.prepare(`
        SELECT from_user_id FROM user_connections WHERE to_user_id = ?
      `).bind(currentUserId).all();
      const connectedBackIds = new Set((theirConnections.results || []).map((c: any) => c.from_user_id));

      results = results.map((user: any) => ({
        ...user,
        isConnected: connectedIds.has(user.id),
        isConnectedBack: connectedBackIds.has(user.id),
        mutualConnections: 0, // TODO: Calculate mutual connections
      }));
    }

    return jsonResponse(results);
  } catch (error) {
    console.error('User search error:', error);
    return errorResponse('Search failed', 500);
  }
}

/**
 * GET /api/networking/users/:userId
 * Get a user's public profile
 */
export async function getUserProfile(request: IRequest, env: Environment): Promise<Response> {
  const db = env.CRYPTID_DB;
  if (!db) {
    return errorResponse('Database not configured', 500);
  }

  const { userId } = request.params;

  try {
    const result = await db.prepare(`
      SELECT
        u.id,
        u.cryptid_username as username,
        COALESCE(p.display_name, u.cryptid_username) as displayName,
        p.avatar_color as avatarColor,
        p.bio
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `).bind(userId).first();

    if (!result) {
      return errorResponse('User not found', 404);
    }

    return jsonResponse(result);
  } catch (error) {
    console.error('Get profile error:', error);
    return errorResponse('Failed to get profile', 500);
  }
}

/**
 * PUT /api/networking/users/me
 * Update current user's profile
 */
export async function updateMyProfile(request: IRequest, env: Environment): Promise<Response> {
  const db = env.CRYPTID_DB;
  if (!db) {
    return errorResponse('Database not configured', 500);
  }

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const body = await request.json() as {
      displayName?: string;
      bio?: string;
      avatarColor?: string;
    };

    // Upsert profile
    await db.prepare(`
      INSERT INTO user_profiles (user_id, display_name, bio, avatar_color, updated_at)
      VALUES (?1, ?2, ?3, ?4, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        display_name = COALESCE(?2, display_name),
        bio = COALESCE(?3, bio),
        avatar_color = COALESCE(?4, avatar_color),
        updated_at = datetime('now')
    `).bind(userId, body.displayName || null, body.bio || null, body.avatarColor || null).run();

    // Return updated profile
    return getUserProfile({ ...request, params: { userId } } as unknown as IRequest, env);
  } catch (error) {
    console.error('Update profile error:', error);
    return errorResponse('Failed to update profile', 500);
  }
}

// =============================================================================
// Connection Management Routes
// =============================================================================

/**
 * POST /api/networking/connections
 * Create a connection (follow a user)
 * Body: { toUserId: string, trustLevel?: 'connected' | 'trusted' }
 */
export async function createConnection(request: IRequest, env: Environment): Promise<Response> {
  const db = env.CRYPTID_DB;
  if (!db) {
    return errorResponse('Database not configured', 500);
  }

  const fromUserId = getUserIdFromRequest(request);
  if (!fromUserId) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const body = await request.json() as { toUserId: string; trustLevel?: 'connected' | 'trusted' };
    const { toUserId, trustLevel = 'connected' } = body;

    if (!toUserId) {
      return errorResponse('toUserId is required');
    }

    if (fromUserId === toUserId) {
      return errorResponse('Cannot connect to yourself');
    }

    if (trustLevel !== 'connected' && trustLevel !== 'trusted') {
      return errorResponse('trustLevel must be "connected" or "trusted"');
    }

    // Check if target user exists
    const targetUser = await db.prepare('SELECT id FROM users WHERE id = ?').bind(toUserId).first();
    if (!targetUser) {
      return errorResponse('User not found', 404);
    }

    // Check if connection already exists
    const existing = await db.prepare(`
      SELECT id FROM user_connections WHERE from_user_id = ? AND to_user_id = ?
    `).bind(fromUserId, toUserId).first();

    if (existing) {
      return errorResponse('Already connected');
    }

    // Create connection
    const connectionId = generateId();
    await db.prepare(`
      INSERT INTO user_connections (id, from_user_id, to_user_id, trust_level)
      VALUES (?, ?, ?, ?)
    `).bind(connectionId, fromUserId, toUserId, trustLevel).run();

    // Check if mutual and get their trust level
    const reverseConnection = await db.prepare(`
      SELECT id, trust_level FROM user_connections WHERE from_user_id = ? AND to_user_id = ?
    `).bind(toUserId, fromUserId).first() as { id: string; trust_level: string } | null;

    // Calculate effective trust level (highest of both directions)
    let effectiveTrustLevel = null;
    if (reverseConnection) {
      const theirLevel = reverseConnection.trust_level;
      effectiveTrustLevel = (trustLevel === 'trusted' || theirLevel === 'trusted') ? 'trusted' : 'connected';
    }

    const connection = {
      id: connectionId,
      fromUserId,
      toUserId,
      trustLevel,
      createdAt: new Date().toISOString(),
      isMutual: !!reverseConnection,
      effectiveTrustLevel,
    };

    return jsonResponse(connection, 201);
  } catch (error) {
    console.error('Create connection error:', error);
    return errorResponse('Failed to create connection', 500);
  }
}

/**
 * PUT /api/networking/connections/:connectionId/trust
 * Update trust level for a connection
 */
export async function updateConnectionTrust(request: IRequest, env: Environment): Promise<Response> {
  const db = env.CRYPTID_DB;
  if (!db) {
    return errorResponse('Database not configured', 500);
  }

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return errorResponse('Unauthorized', 401);
  }

  const { connectionId } = request.params;

  try {
    // Verify ownership
    const connection = await db.prepare(`
      SELECT id, from_user_id, to_user_id FROM user_connections WHERE id = ? AND from_user_id = ?
    `).bind(connectionId, userId).first() as { id: string; from_user_id: string; to_user_id: string } | null;

    if (!connection) {
      return errorResponse('Connection not found or not owned by you', 404);
    }

    const body = await request.json() as { trustLevel: 'connected' | 'trusted' };
    const { trustLevel } = body;

    if (trustLevel !== 'connected' && trustLevel !== 'trusted') {
      return errorResponse('trustLevel must be "connected" or "trusted"');
    }

    // Update trust level
    await db.prepare(`
      UPDATE user_connections SET trust_level = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(trustLevel, connectionId).run();

    // Check if mutual and get their trust level
    const reverseConnection = await db.prepare(`
      SELECT trust_level FROM user_connections WHERE from_user_id = ? AND to_user_id = ?
    `).bind(connection.to_user_id, connection.from_user_id).first() as { trust_level: string } | null;

    let effectiveTrustLevel = null;
    if (reverseConnection) {
      const theirLevel = reverseConnection.trust_level;
      effectiveTrustLevel = (trustLevel === 'trusted' || theirLevel === 'trusted') ? 'trusted' : 'connected';
    }

    return jsonResponse({
      id: connectionId,
      fromUserId: connection.from_user_id,
      toUserId: connection.to_user_id,
      trustLevel,
      isMutual: !!reverseConnection,
      effectiveTrustLevel,
    });
  } catch (error) {
    console.error('Update trust level error:', error);
    return errorResponse('Failed to update trust level', 500);
  }
}

/**
 * DELETE /api/networking/connections/:connectionId
 * Remove a connection (unfollow)
 */
export async function removeConnection(request: IRequest, env: Environment): Promise<Response> {
  const db = env.CRYPTID_DB;
  if (!db) {
    return errorResponse('Database not configured', 500);
  }

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return errorResponse('Unauthorized', 401);
  }

  const { connectionId } = request.params;

  try {
    // Verify ownership
    const connection = await db.prepare(`
      SELECT id FROM user_connections WHERE id = ? AND from_user_id = ?
    `).bind(connectionId, userId).first();

    if (!connection) {
      return errorResponse('Connection not found or not owned by you', 404);
    }

    // Delete connection and its metadata
    await db.prepare('DELETE FROM connection_metadata WHERE connection_id = ?').bind(connectionId).run();
    await db.prepare('DELETE FROM user_connections WHERE id = ?').bind(connectionId).run();

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Remove connection error:', error);
    return errorResponse('Failed to remove connection', 500);
  }
}

/**
 * GET /api/networking/connections
 * Get current user's connections (people they follow)
 */
export async function getMyConnections(request: IRequest, env: Environment): Promise<Response> {
  const db = env.CRYPTID_DB;
  if (!db) {
    return errorResponse('Database not configured', 500);
  }

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const connections = await db.prepare(`
      SELECT
        c.id,
        c.from_user_id as fromUserId,
        c.to_user_id as toUserId,
        c.created_at as createdAt,
        m.label,
        m.notes,
        m.color,
        m.strength,
        EXISTS(
          SELECT 1 FROM user_connections r
          WHERE r.from_user_id = c.to_user_id AND r.to_user_id = c.from_user_id
        ) as isMutual
      FROM user_connections c
      LEFT JOIN connection_metadata m ON c.id = m.connection_id AND m.user_id = ?
      WHERE c.from_user_id = ?
    `).bind(userId, userId).all();

    const results = (connections.results || []).map((c: any) => ({
      id: c.id,
      fromUserId: c.fromUserId,
      toUserId: c.toUserId,
      createdAt: c.createdAt,
      isMutual: !!c.isMutual,
      metadata: c.label || c.notes || c.color || c.strength ? {
        label: c.label,
        notes: c.notes,
        color: c.color,
        strength: c.strength || 5,
      } : undefined,
    }));

    return jsonResponse(results);
  } catch (error) {
    console.error('Get connections error:', error);
    return errorResponse('Failed to get connections', 500);
  }
}

/**
 * GET /api/networking/connections/followers
 * Get users who follow the current user
 */
export async function getMyFollowers(request: IRequest, env: Environment): Promise<Response> {
  const db = env.CRYPTID_DB;
  if (!db) {
    return errorResponse('Database not configured', 500);
  }

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const connections = await db.prepare(`
      SELECT
        c.id,
        c.from_user_id as fromUserId,
        c.to_user_id as toUserId,
        c.created_at as createdAt,
        EXISTS(
          SELECT 1 FROM user_connections r
          WHERE r.from_user_id = c.to_user_id AND r.to_user_id = c.from_user_id
        ) as isMutual
      FROM user_connections c
      WHERE c.to_user_id = ?
    `).bind(userId).all();

    const results = (connections.results || []).map((c: any) => ({
      id: c.id,
      fromUserId: c.fromUserId,
      toUserId: c.toUserId,
      createdAt: c.createdAt,
      isMutual: !!c.isMutual,
    }));

    return jsonResponse(results);
  } catch (error) {
    console.error('Get followers error:', error);
    return errorResponse('Failed to get followers', 500);
  }
}

/**
 * GET /api/networking/connections/check/:userId
 * Check if current user is connected to a specific user
 */
export async function checkConnection(request: IRequest, env: Environment): Promise<Response> {
  const db = env.CRYPTID_DB;
  if (!db) {
    return errorResponse('Database not configured', 500);
  }

  const currentUserId = getUserIdFromRequest(request);
  if (!currentUserId) {
    return errorResponse('Unauthorized', 401);
  }

  const { userId } = request.params;

  try {
    const connection = await db.prepare(`
      SELECT id FROM user_connections WHERE from_user_id = ? AND to_user_id = ?
    `).bind(currentUserId, userId).first();

    return jsonResponse({ connected: !!connection });
  } catch (error) {
    console.error('Check connection error:', error);
    return errorResponse('Failed to check connection', 500);
  }
}

// =============================================================================
// Edge Metadata Routes
// =============================================================================

/**
 * PUT /api/networking/connections/:connectionId/metadata
 * Update edge metadata for a connection
 */
export async function updateEdgeMetadata(request: IRequest, env: Environment): Promise<Response> {
  const db = env.CRYPTID_DB;
  if (!db) {
    return errorResponse('Database not configured', 500);
  }

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return errorResponse('Unauthorized', 401);
  }

  const { connectionId } = request.params;

  try {
    // Verify user is on this connection
    const connection = await db.prepare(`
      SELECT id, from_user_id, to_user_id FROM user_connections WHERE id = ?
    `).bind(connectionId).first() as { id: string; from_user_id: string; to_user_id: string } | null;

    if (!connection) {
      return errorResponse('Connection not found', 404);
    }

    if (connection.from_user_id !== userId && connection.to_user_id !== userId) {
      return errorResponse('Not authorized to edit this connection', 403);
    }

    const body = await request.json() as {
      label?: string;
      notes?: string;
      color?: string;
      strength?: number;
    };

    // Validate strength
    if (body.strength !== undefined && (body.strength < 1 || body.strength > 10)) {
      return errorResponse('Strength must be between 1 and 10');
    }

    // Upsert metadata
    const metadataId = generateId();
    await db.prepare(`
      INSERT INTO connection_metadata (id, connection_id, user_id, label, notes, color, strength, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
      ON CONFLICT(connection_id, user_id) DO UPDATE SET
        label = COALESCE(?4, label),
        notes = COALESCE(?5, notes),
        color = COALESCE(?6, color),
        strength = COALESCE(?7, strength),
        updated_at = datetime('now')
    `).bind(
      metadataId,
      connectionId,
      userId,
      body.label || null,
      body.notes || null,
      body.color || null,
      body.strength || null
    ).run();

    // Return updated metadata
    const metadata = await db.prepare(`
      SELECT label, notes, color, strength FROM connection_metadata
      WHERE connection_id = ? AND user_id = ?
    `).bind(connectionId, userId).first();

    return jsonResponse(metadata || { label: null, notes: null, color: null, strength: 5 });
  } catch (error) {
    console.error('Update metadata error:', error);
    return errorResponse('Failed to update metadata', 500);
  }
}

/**
 * GET /api/networking/connections/:connectionId/metadata
 * Get edge metadata for a connection
 */
export async function getEdgeMetadata(request: IRequest, env: Environment): Promise<Response> {
  const db = env.CRYPTID_DB;
  if (!db) {
    return errorResponse('Database not configured', 500);
  }

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return errorResponse('Unauthorized', 401);
  }

  const { connectionId } = request.params;

  try {
    // Verify user is on this connection
    const connection = await db.prepare(`
      SELECT id, from_user_id, to_user_id FROM user_connections WHERE id = ?
    `).bind(connectionId).first() as { id: string; from_user_id: string; to_user_id: string } | null;

    if (!connection) {
      return errorResponse('Connection not found', 404);
    }

    if (connection.from_user_id !== userId && connection.to_user_id !== userId) {
      return errorResponse('Not authorized to view this connection', 403);
    }

    const metadata = await db.prepare(`
      SELECT label, notes, color, strength FROM connection_metadata
      WHERE connection_id = ? AND user_id = ?
    `).bind(connectionId, userId).first();

    return jsonResponse(metadata || { label: null, notes: null, color: null, strength: 5 });
  } catch (error) {
    console.error('Get metadata error:', error);
    return errorResponse('Failed to get metadata', 500);
  }
}

// =============================================================================
// Network Graph Routes
// =============================================================================

/**
 * GET /api/networking/graph
 * Get the full network graph for current user
 */
export async function getNetworkGraph(request: IRequest, env: Environment): Promise<Response> {
  const db = env.CRYPTID_DB;
  if (!db) {
    return errorResponse('Database not configured', 500);
  }

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    // Get all users connected to/from current user
    const connections = await db.prepare(`
      SELECT DISTINCT user_id FROM (
        SELECT to_user_id as user_id FROM user_connections WHERE from_user_id = ?
        UNION
        SELECT from_user_id as user_id FROM user_connections WHERE to_user_id = ?
      )
    `).bind(userId, userId).all();

    const connectedUserIds = (connections.results || []).map((c: any) => c.user_id);
    connectedUserIds.push(userId); // Include self

    // Get user profiles for all connected users
    const placeholders = connectedUserIds.map(() => '?').join(',');
    const users = await db.prepare(`
      SELECT
        u.id,
        u.cryptid_username as username,
        COALESCE(p.display_name, u.cryptid_username) as displayName,
        p.avatar_color as avatarColor,
        p.bio
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id IN (${placeholders})
    `).bind(...connectedUserIds).all();

    // Build nodes
    const nodes: UserNode[] = (users.results || []).map((u: any) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarColor: u.avatarColor,
      bio: u.bio,
    }));

    // Get all edges between these users
    const edges = await db.prepare(`
      SELECT
        c.id,
        c.from_user_id as fromUserId,
        c.to_user_id as toUserId,
        c.created_at as createdAt,
        m.label,
        m.notes,
        m.color,
        m.strength,
        EXISTS(
          SELECT 1 FROM user_connections r
          WHERE r.from_user_id = c.to_user_id AND r.to_user_id = c.from_user_id
        ) as isMutual
      FROM user_connections c
      LEFT JOIN connection_metadata m ON c.id = m.connection_id AND m.user_id = ?
      WHERE c.from_user_id IN (${placeholders}) AND c.to_user_id IN (${placeholders})
    `).bind(userId, ...connectedUserIds, ...connectedUserIds).all();

    const graphEdges: GraphEdge[] = (edges.results || []).map((e: any) => ({
      id: e.id,
      fromUserId: e.fromUserId,
      toUserId: e.toUserId,
      trustLevel: e.trustLevel || 'connected',
      createdAt: e.createdAt || new Date().toISOString(),
      effectiveTrustLevel: e.isMutual ? (e.trustLevel || 'connected') : null,
      isMutual: !!e.isMutual,
      metadata: (e.fromUserId === userId || e.toUserId === userId) && (e.label || e.notes || e.color || e.strength) ? {
        label: e.label,
        notes: e.notes,
        color: e.color,
        strength: e.strength || 5,
      } : undefined,
    }));

    // Get list of users current user is connected to
    const myConnections = await db.prepare(`
      SELECT to_user_id FROM user_connections WHERE from_user_id = ?
    `).bind(userId).all();

    const graph: NetworkGraph = {
      nodes,
      edges: graphEdges,
      myConnections: (myConnections.results || []).map((c: any) => c.to_user_id),
    };

    return jsonResponse(graph);
  } catch (error) {
    console.error('Get network graph error:', error);
    return errorResponse('Failed to get network graph', 500);
  }
}

/**
 * POST /api/networking/graph/room
 * Get network graph scoped to room participants
 * Body: { participants: string[] }
 */
export async function getRoomNetworkGraph(request: IRequest, env: Environment): Promise<Response> {
  const db = env.CRYPTID_DB;
  if (!db) {
    return errorResponse('Database not configured', 500);
  }

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const body = await request.json() as { participants: string[] };
    const { participants } = body;

    if (!participants || !Array.isArray(participants)) {
      return errorResponse('participants array is required');
    }

    // First get the full network graph
    const graphResponse = await getNetworkGraph(request, env);
    const graph = await graphResponse.json() as NetworkGraph;

    // Mark which nodes are in the room
    const participantSet = new Set(participants);
    const nodesWithRoomStatus = graph.nodes.map(node => ({
      ...node,
      isInRoom: participantSet.has(node.id),
    }));

    return jsonResponse({
      ...graph,
      nodes: nodesWithRoomStatus,
      roomParticipants: participants,
    });
  } catch (error) {
    console.error('Get room network graph error:', error);
    return errorResponse('Failed to get room network graph', 500);
  }
}

/**
 * GET /api/networking/connections/mutual/:userId
 * Get mutual connections between current user and another user
 */
export async function getMutualConnections(request: IRequest, env: Environment): Promise<Response> {
  const db = env.CRYPTID_DB;
  if (!db) {
    return errorResponse('Database not configured', 500);
  }

  const currentUserId = getUserIdFromRequest(request);
  if (!currentUserId) {
    return errorResponse('Unauthorized', 401);
  }

  const { userId } = request.params;

  try {
    // Find users that both current user and target user are connected to
    const mutuals = await db.prepare(`
      SELECT
        u.id,
        u.cryptid_username as username,
        COALESCE(p.display_name, u.cryptid_username) as displayName,
        p.avatar_color as avatarColor,
        p.bio
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id IN (
        SELECT c1.to_user_id
        FROM user_connections c1
        INNER JOIN user_connections c2 ON c1.to_user_id = c2.to_user_id
        WHERE c1.from_user_id = ? AND c2.from_user_id = ?
      )
    `).bind(currentUserId, userId).all();

    return jsonResponse(mutuals.results || []);
  } catch (error) {
    console.error('Get mutual connections error:', error);
    return errorResponse('Failed to get mutual connections', 500);
  }
}
