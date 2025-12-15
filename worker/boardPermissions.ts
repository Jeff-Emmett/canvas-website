import { Environment, Board, BoardPermission, PermissionLevel, PermissionCheckResult, User, BoardAccessToken, GlobalAdmin } from './types';

// Generate a UUID v4
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Check if a user is a global admin by their email
 * Global admins have admin access to ALL boards
 */
export async function isGlobalAdmin(db: D1Database, userId: string): Promise<boolean> {
  // Get user's email
  const user = await db.prepare(
    'SELECT email FROM users WHERE id = ?'
  ).bind(userId).first<{ email: string }>();

  if (!user?.email) {
    return false;
  }

  // Check if email is in global_admins table
  const admin = await db.prepare(
    'SELECT email FROM global_admins WHERE email = ?'
  ).bind(user.email).first<GlobalAdmin>();

  return !!admin;
}

/**
 * Check if an email is a global admin (direct check without user lookup)
 */
export async function isEmailGlobalAdmin(db: D1Database, email: string): Promise<boolean> {
  const admin = await db.prepare(
    'SELECT email FROM global_admins WHERE email = ?'
  ).bind(email).first<GlobalAdmin>();

  return !!admin;
}

/**
 * Get a user's effective permission for a board
 *
 * NEW PERMISSION MODEL (Dec 2024):
 * - Everyone (including anonymous) can EDIT by default
 * - Boards can be marked as "protected" - only listed editors can edit protected boards
 * - Global admins have admin access to ALL boards
 *
 * Priority:
 * 1. Access token from share link (overrides all)
 * 2. Global admin status (returns 'admin')
 * 3. Board owner (returns 'admin')
 * 4. If board is NOT protected → everyone gets 'edit'
 * 5. If board IS protected → check explicit permissions, default to 'view'
 *
 * @param accessToken - Optional access token from share link (grants specific permission)
 */
export async function getEffectivePermission(
  db: D1Database,
  boardId: string,
  userId: string | null,
  accessToken?: string | null
): Promise<PermissionCheckResult> {
  // Check if board exists
  const board = await db.prepare(
    'SELECT * FROM boards WHERE id = ?'
  ).bind(boardId).first<Board>();

  // 1. If an access token is provided, validate it and use its permission level
  if (accessToken) {
    const tokenPermission = await validateAccessToken(db, boardId, accessToken);
    if (tokenPermission) {
      return {
        permission: tokenPermission,
        isOwner: false,
        boardExists: !!board,
        grantedByToken: true
      };
    }
  }

  // 2. Check if user is a global admin (admin on ALL boards)
  if (userId) {
    const globalAdmin = await isGlobalAdmin(db, userId);
    if (globalAdmin) {
      console.log('🔐 User is global admin, granting admin access');
      return {
        permission: 'admin',
        isOwner: false,
        boardExists: !!board,
        isGlobalAdmin: true
      };
    }
  }

  // Board doesn't exist in permissions DB
  // NEW: Everyone can edit by default (board will be created on first edit)
  if (!board) {
    return {
      permission: 'edit',
      isOwner: false,
      boardExists: false
    };
  }

  // 3. Check if user is the board owner (always admin)
  if (userId && board.owner_id === userId) {
    return {
      permission: 'admin',
      isOwner: true,
      boardExists: true
    };
  }

  // 4. If board is NOT protected, everyone can edit (NEW DEFAULT)
  if (!board.is_protected) {
    return {
      permission: 'edit',
      isOwner: false,
      boardExists: true,
      isProtected: false
    };
  }

  // 5. Board IS protected - check for explicit permission
  if (userId) {
    const explicitPerm = await db.prepare(
      'SELECT * FROM board_permissions WHERE board_id = ? AND user_id = ?'
    ).bind(boardId, userId).first<BoardPermission>();

    if (explicitPerm) {
      // User has been granted specific permission on this protected board
      return {
        permission: explicitPerm.permission,
        isOwner: false,
        boardExists: true,
        isProtected: true,
        isExplicitPermission: true
      };
    }
  }

  // 6. Protected board, no explicit permission → view only
  return {
    permission: 'view',
    isOwner: false,
    boardExists: true,
    isProtected: true
  };
}

/**
 * Create a board and assign owner
 * Called when a new board is first accessed by an authenticated user
 */
export async function createBoard(
  db: D1Database,
  boardId: string,
  ownerId: string,
  name?: string
): Promise<Board> {
  const id = boardId;

  await db.prepare(`
    INSERT INTO boards (id, owner_id, name, default_permission, is_public)
    VALUES (?, ?, ?, 'edit', 1)
    ON CONFLICT(id) DO NOTHING
  `).bind(id, ownerId, name || null).run();

  const board = await db.prepare(
    'SELECT * FROM boards WHERE id = ?'
  ).bind(id).first<Board>();

  if (!board) {
    throw new Error('Failed to create board');
  }

  return board;
}

/**
 * Ensure a board exists, creating it if necessary
 * Called on first edit by authenticated user
 */
export async function ensureBoardExists(
  db: D1Database,
  boardId: string,
  userId: string
): Promise<Board> {
  let board = await db.prepare(
    'SELECT * FROM boards WHERE id = ?'
  ).bind(boardId).first<Board>();

  if (!board) {
    // Create the board with this user as owner
    board = await createBoard(db, boardId, userId);
  }

  return board;
}

/**
 * GET /boards/:boardId/permission
 * Get current user's permission for a board
 * Query params: ?token=<access_token> - optional access token from share link
 */
export async function handleGetPermission(
  boardId: string,
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      // No database - default to view for anonymous (secure by default)
      console.log('🔐 Permission check: No database configured');
      return new Response(JSON.stringify({
        permission: 'view',
        isOwner: false,
        boardExists: false,
        message: 'Permission system not configured'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user ID from public key if provided
    let userId: string | null = null;
    const publicKey = request.headers.get('X-CryptID-PublicKey');

    console.log('🔐 Permission check for board:', boardId, {
      publicKeyReceived: publicKey ? `${publicKey.substring(0, 20)}...` : null
    });

    if (publicKey) {
      const deviceKey = await db.prepare(
        'SELECT user_id FROM device_keys WHERE public_key = ?'
      ).bind(publicKey).first<{ user_id: string }>();

      if (deviceKey) {
        userId = deviceKey.user_id;
        console.log('🔐 Found user ID for public key:', userId);
      } else {
        console.log('🔐 No user found for public key');
      }
    }

    // Get access token from query params if provided
    const url = new URL(request.url);
    const accessToken = url.searchParams.get('token');

    const result = await getEffectivePermission(db, boardId, userId, accessToken);
    console.log('🔐 Permission result:', result);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Get permission error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /boards/:boardId/permissions
 * List all permissions for a board (admin only)
 */
export async function handleListPermissions(
  boardId: string,
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Authenticate user
    const publicKey = request.headers.get('X-CryptID-PublicKey');
    if (!publicKey) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const deviceKey = await db.prepare(
      'SELECT user_id FROM device_keys WHERE public_key = ?'
    ).bind(publicKey).first<{ user_id: string }>();

    if (!deviceKey) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const permCheck = await getEffectivePermission(db, boardId, deviceKey.user_id);
    if (permCheck.permission !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get all permissions with user info
    const permissions = await db.prepare(`
      SELECT bp.*, u.cryptid_username, u.email
      FROM board_permissions bp
      JOIN users u ON bp.user_id = u.id
      WHERE bp.board_id = ?
      ORDER BY bp.granted_at DESC
    `).bind(boardId).all<BoardPermission & { cryptid_username: string; email: string }>();

    // Get board info
    const board = await db.prepare(
      'SELECT * FROM boards WHERE id = ?'
    ).bind(boardId).first<Board>();

    // Get owner info if exists
    let owner = null;
    if (board?.owner_id) {
      owner = await db.prepare(
        'SELECT id, cryptid_username, email FROM users WHERE id = ?'
      ).bind(board.owner_id).first<{ id: string; cryptid_username: string; email: string }>();
    }

    return new Response(JSON.stringify({
      board: board ? {
        id: board.id,
        name: board.name,
        defaultPermission: board.default_permission,
        isPublic: board.is_public === 1,
        createdAt: board.created_at
      } : null,
      owner,
      permissions: permissions.results || []
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('List permissions error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /boards/:boardId/permissions
 * Grant permission to a user (admin only)
 * Body: { userId, permission, username? }
 *
 * Note: This endpoint allows granting 'admin' permission because it requires
 * specifying a user by ID or CryptID username. This is the ONLY way to grant
 * admin access - share links (access tokens) can only grant 'view' or 'edit'.
 */
export async function handleGrantPermission(
  boardId: string,
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Authenticate user
    const publicKey = request.headers.get('X-CryptID-PublicKey');
    if (!publicKey) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const adminDeviceKey = await db.prepare(
      'SELECT user_id FROM device_keys WHERE public_key = ?'
    ).bind(publicKey).first<{ user_id: string }>();

    if (!adminDeviceKey) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const permCheck = await getEffectivePermission(db, boardId, adminDeviceKey.user_id);
    if (permCheck.permission !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json() as {
      userId?: string;
      username?: string;
      permission: PermissionLevel;
    };

    const { userId, username, permission } = body;

    if (!permission || !['view', 'edit', 'admin'].includes(permission)) {
      return new Response(JSON.stringify({ error: 'Invalid permission level' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find target user
    let targetUserId = userId;
    if (!targetUserId && username) {
      const user = await db.prepare(
        'SELECT id FROM users WHERE cryptid_username = ?'
      ).bind(username).first<{ id: string }>();

      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      targetUserId = user.id;
    }

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'userId or username required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Ensure board exists
    await ensureBoardExists(db, boardId, adminDeviceKey.user_id);

    // Upsert permission
    await db.prepare(`
      INSERT INTO board_permissions (id, board_id, user_id, permission, granted_by)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(board_id, user_id) DO UPDATE SET
        permission = excluded.permission,
        granted_by = excluded.granted_by,
        granted_at = datetime('now')
    `).bind(generateUUID(), boardId, targetUserId, permission, adminDeviceKey.user_id).run();

    return new Response(JSON.stringify({
      success: true,
      message: `Permission '${permission}' granted to user`
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Grant permission error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * DELETE /boards/:boardId/permissions/:userId
 * Revoke a user's permission (admin only)
 */
export async function handleRevokePermission(
  boardId: string,
  targetUserId: string,
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Authenticate user
    const publicKey = request.headers.get('X-CryptID-PublicKey');
    if (!publicKey) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const adminDeviceKey = await db.prepare(
      'SELECT user_id FROM device_keys WHERE public_key = ?'
    ).bind(publicKey).first<{ user_id: string }>();

    if (!adminDeviceKey) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const permCheck = await getEffectivePermission(db, boardId, adminDeviceKey.user_id);
    if (permCheck.permission !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Can't revoke from board owner
    const board = await db.prepare(
      'SELECT owner_id FROM boards WHERE id = ?'
    ).bind(boardId).first<{ owner_id: string }>();

    if (board?.owner_id === targetUserId) {
      return new Response(JSON.stringify({ error: 'Cannot revoke permission from board owner' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete permission
    await db.prepare(
      'DELETE FROM board_permissions WHERE board_id = ? AND user_id = ?'
    ).bind(boardId, targetUserId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Permission revoked'
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Revoke permission error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * PATCH /boards/:boardId
 * Update board settings (admin only)
 * Body: { name?, defaultPermission?, isPublic?, isProtected? }
 */
export async function handleUpdateBoard(
  boardId: string,
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Authenticate user
    const publicKey = request.headers.get('X-CryptID-PublicKey');
    if (!publicKey) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const deviceKey = await db.prepare(
      'SELECT user_id FROM device_keys WHERE public_key = ?'
    ).bind(publicKey).first<{ user_id: string }>();

    if (!deviceKey) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const permCheck = await getEffectivePermission(db, boardId, deviceKey.user_id);
    if (permCheck.permission !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json() as {
      name?: string;
      defaultPermission?: 'view' | 'edit';
      isPublic?: boolean;
      isProtected?: boolean;
    };

    const updates: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }
    if (body.defaultPermission !== undefined) {
      if (!['view', 'edit'].includes(body.defaultPermission)) {
        return new Response(JSON.stringify({ error: 'Invalid default permission' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updates.push('default_permission = ?');
      values.push(body.defaultPermission);
    }
    if (body.isPublic !== undefined) {
      updates.push('is_public = ?');
      values.push(body.isPublic ? 1 : 0);
    }
    if (body.isProtected !== undefined) {
      updates.push('is_protected = ?');
      values.push(body.isProtected ? 1 : 0);
      console.log(`🔒 Board ${boardId} protection set to: ${body.isProtected}`);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No updates provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    updates.push("updated_at = datetime('now')");
    values.push(boardId);

    await db.prepare(`
      UPDATE boards SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();

    const updatedBoard = await db.prepare(
      'SELECT * FROM boards WHERE id = ?'
    ).bind(boardId).first<Board>();

    return new Response(JSON.stringify({
      success: true,
      board: updatedBoard ? {
        id: updatedBoard.id,
        name: updatedBoard.name,
        defaultPermission: updatedBoard.default_permission,
        isPublic: updatedBoard.is_public === 1,
        isProtected: updatedBoard.is_protected === 1,
        updatedAt: updatedBoard.updated_at
      } : null
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Update board error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// =============================================================================
// Access Token Functions
// =============================================================================

/**
 * Generate a cryptographically secure random token
 */
function generateAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate an access token and return the permission level if valid
 */
export async function validateAccessToken(
  db: D1Database,
  boardId: string,
  token: string
): Promise<PermissionLevel | null> {
  const accessToken = await db.prepare(`
    SELECT * FROM board_access_tokens
    WHERE board_id = ? AND token = ? AND is_active = 1
  `).bind(boardId, token).first<BoardAccessToken>();

  if (!accessToken) {
    return null;
  }

  // Check expiration
  if (accessToken.expires_at) {
    const expiresAt = new Date(accessToken.expires_at);
    if (expiresAt < new Date()) {
      return null;
    }
  }

  // Check max uses
  if (accessToken.max_uses !== null && accessToken.use_count >= accessToken.max_uses) {
    return null;
  }

  // Increment use count
  await db.prepare(`
    UPDATE board_access_tokens SET use_count = use_count + 1 WHERE id = ?
  `).bind(accessToken.id).run();

  return accessToken.permission;
}

/**
 * POST /boards/:boardId/access-tokens
 * Create a new access token (admin only)
 * Body: { permission, label?, expiresIn?, maxUses? }
 */
export async function handleCreateAccessToken(
  boardId: string,
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Authenticate user
    const publicKey = request.headers.get('X-CryptID-PublicKey');
    if (!publicKey) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const deviceKey = await db.prepare(
      'SELECT user_id FROM device_keys WHERE public_key = ?'
    ).bind(publicKey).first<{ user_id: string }>();

    if (!deviceKey) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const permCheck = await getEffectivePermission(db, boardId, deviceKey.user_id);
    if (permCheck.permission !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json() as {
      permission: PermissionLevel;
      label?: string;
      expiresIn?: number;  // seconds from now
      maxUses?: number;
    };

    // Only allow 'view' and 'edit' permissions for access tokens
    // Admin permission must be granted directly by username/email through handleGrantPermission
    if (!body.permission || !['view', 'edit'].includes(body.permission)) {
      return new Response(JSON.stringify({
        error: 'Invalid permission level. Share links can only grant view or edit access. Use direct permission grants for admin access.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Ensure board exists
    await ensureBoardExists(db, boardId, deviceKey.user_id);

    const token = generateAccessToken();
    const id = generateUUID();

    // Calculate expiration
    let expiresAt: string | null = null;
    if (body.expiresIn) {
      const expDate = new Date(Date.now() + body.expiresIn * 1000);
      expiresAt = expDate.toISOString();
    }

    await db.prepare(`
      INSERT INTO board_access_tokens (id, board_id, token, permission, created_by, expires_at, max_uses, label, use_count, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
    `).bind(
      id,
      boardId,
      token,
      body.permission,
      deviceKey.user_id,
      expiresAt,
      body.maxUses || null,
      body.label || null
    ).run();

    return new Response(JSON.stringify({
      success: true,
      token,
      id,
      permission: body.permission,
      expiresAt,
      maxUses: body.maxUses || null,
      label: body.label || null
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Create access token error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /boards/:boardId/access-tokens
 * List all access tokens for a board (admin only)
 */
export async function handleListAccessTokens(
  boardId: string,
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Authenticate user
    const publicKey = request.headers.get('X-CryptID-PublicKey');
    if (!publicKey) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const deviceKey = await db.prepare(
      'SELECT user_id FROM device_keys WHERE public_key = ?'
    ).bind(publicKey).first<{ user_id: string }>();

    if (!deviceKey) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const permCheck = await getEffectivePermission(db, boardId, deviceKey.user_id);
    if (permCheck.permission !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tokens = await db.prepare(`
      SELECT id, board_id, permission, created_at, expires_at, max_uses, use_count, is_active, label
      FROM board_access_tokens
      WHERE board_id = ?
      ORDER BY created_at DESC
    `).bind(boardId).all<Omit<BoardAccessToken, 'token' | 'created_by'>>();

    return new Response(JSON.stringify({
      tokens: tokens.results || []
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('List access tokens error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * DELETE /boards/:boardId/access-tokens/:tokenId
 * Revoke an access token (admin only)
 */
export async function handleRevokeAccessToken(
  boardId: string,
  tokenId: string,
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Authenticate user
    const publicKey = request.headers.get('X-CryptID-PublicKey');
    if (!publicKey) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const deviceKey = await db.prepare(
      'SELECT user_id FROM device_keys WHERE public_key = ?'
    ).bind(publicKey).first<{ user_id: string }>();

    if (!deviceKey) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const permCheck = await getEffectivePermission(db, boardId, deviceKey.user_id);
    if (permCheck.permission !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Deactivate the token (soft delete)
    await db.prepare(`
      UPDATE board_access_tokens SET is_active = 0 WHERE id = ? AND board_id = ?
    `).bind(tokenId, boardId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Access token revoked'
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Revoke access token error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// =============================================================================
// Global Admin & Protected Board Functions
// =============================================================================

/**
 * GET /auth/global-admin-status
 * Check if the current user is a global admin
 */
export async function handleGetGlobalAdminStatus(
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ isGlobalAdmin: false }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const publicKey = request.headers.get('X-CryptID-PublicKey');
    if (!publicKey) {
      return new Response(JSON.stringify({ isGlobalAdmin: false }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const deviceKey = await db.prepare(
      'SELECT user_id FROM device_keys WHERE public_key = ?'
    ).bind(publicKey).first<{ user_id: string }>();

    if (!deviceKey) {
      return new Response(JSON.stringify({ isGlobalAdmin: false }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isAdmin = await isGlobalAdmin(db, deviceKey.user_id);

    return new Response(JSON.stringify({ isGlobalAdmin: isAdmin }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Global admin status check error:', error);
    return new Response(JSON.stringify({ isGlobalAdmin: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /admin/request
 * Request global admin access (sends email to existing global admin)
 * Body: { reason?: string }
 */
export async function handleRequestAdminAccess(
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Must be authenticated
    const publicKey = request.headers.get('X-CryptID-PublicKey');
    if (!publicKey) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const deviceKey = await db.prepare(
      'SELECT user_id FROM device_keys WHERE public_key = ?'
    ).bind(publicKey).first<{ user_id: string }>();

    if (!deviceKey) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user info
    const user = await db.prepare(
      'SELECT cryptid_username, email FROM users WHERE id = ?'
    ).bind(deviceKey.user_id).first<{ cryptid_username: string; email: string }>();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if already a global admin
    if (await isGlobalAdmin(db, deviceKey.user_id)) {
      return new Response(JSON.stringify({
        success: false,
        message: 'You are already a global admin'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json().catch(() => ({})) as { reason?: string };

    // Send email to global admin (jeffemmett@gmail.com)
    if (env.RESEND_API_KEY) {
      const emailFrom = env.CRYPTID_EMAIL_FROM || 'Canvas <noreply@jeffemmett.com>';

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: 'jeffemmett@gmail.com',
          subject: `Canvas Admin Request from ${user.cryptid_username}`,
          html: `
            <h2>Admin Access Request</h2>
            <p><strong>User:</strong> ${user.cryptid_username}</p>
            <p><strong>Email:</strong> ${user.email || 'Not provided'}</p>
            <p><strong>User ID:</strong> ${deviceKey.user_id}</p>
            ${body.reason ? `<p><strong>Reason:</strong> ${body.reason}</p>` : ''}
            <hr>
            <p>To grant admin access, add their email to the global_admins table in D1.</p>
          `,
        }),
      });

      if (!emailResponse.ok) {
        console.error('Failed to send admin request email:', await emailResponse.text());
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Admin access request sent. You will be notified when approved.'
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Request admin access error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /boards/:boardId/info
 * Get board info including protection status (public endpoint)
 */
export async function handleGetBoardInfo(
  boardId: string,
  _request: Request,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({
        board: null,
        isProtected: false
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const board = await db.prepare(
      'SELECT id, name, is_protected, owner_id FROM boards WHERE id = ?'
    ).bind(boardId).first<{ id: string; name: string | null; is_protected: number; owner_id: string | null }>();

    if (!board) {
      return new Response(JSON.stringify({
        board: null,
        isProtected: false
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get owner username if exists
    let ownerUsername: string | null = null;
    if (board.owner_id) {
      const owner = await db.prepare(
        'SELECT cryptid_username FROM users WHERE id = ?'
      ).bind(board.owner_id).first<{ cryptid_username: string }>();
      ownerUsername = owner?.cryptid_username || null;
    }

    return new Response(JSON.stringify({
      board: {
        id: board.id,
        name: board.name,
        isProtected: board.is_protected === 1,
        ownerUsername,
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Get board info error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /boards/:boardId/editors
 * List users with edit access on a protected board (admin only)
 */
export async function handleListEditors(
  boardId: string,
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Authenticate user
    const publicKey = request.headers.get('X-CryptID-PublicKey');
    if (!publicKey) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const deviceKey = await db.prepare(
      'SELECT user_id FROM device_keys WHERE public_key = ?'
    ).bind(publicKey).first<{ user_id: string }>();

    if (!deviceKey) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const permCheck = await getEffectivePermission(db, boardId, deviceKey.user_id);
    if (permCheck.permission !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get all users with edit or admin permission
    const editors = await db.prepare(`
      SELECT bp.user_id, bp.permission, bp.granted_at, u.cryptid_username, u.email
      FROM board_permissions bp
      JOIN users u ON bp.user_id = u.id
      WHERE bp.board_id = ? AND bp.permission IN ('edit', 'admin')
      ORDER BY bp.granted_at DESC
    `).bind(boardId).all<{
      user_id: string;
      permission: string;
      granted_at: string;
      cryptid_username: string;
      email: string;
    }>();

    return new Response(JSON.stringify({
      editors: (editors.results || []).map(e => ({
        userId: e.user_id,
        username: e.cryptid_username,
        email: e.email,
        permission: e.permission,
        grantedAt: e.granted_at,
      }))
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('List editors error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
