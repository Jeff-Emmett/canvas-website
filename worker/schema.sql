-- CryptID Authentication Schema
-- Cloudflare D1 Database

-- User accounts (one per email, linked to CryptID username)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified INTEGER DEFAULT 0,
  cryptid_username TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Device keys (multiple devices per user account)
CREATE TABLE IF NOT EXISTS device_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  public_key TEXT NOT NULL UNIQUE,
  device_name TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_used TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Verification tokens for email verification and device linking
CREATE TABLE IF NOT EXISTS verification_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('email_verify', 'device_link')),
  public_key TEXT,
  device_name TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_cryptid ON users(cryptid_username);
CREATE INDEX IF NOT EXISTS idx_device_keys_user ON device_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_device_keys_pubkey ON device_keys(public_key);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_email ON verification_tokens(email);
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON verification_tokens(expires_at);

-- =============================================================================
-- Board Permissions System
-- =============================================================================

-- Board ownership and default permissions
-- Each board has an owner (admin) and a default permission level for new visitors
CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,                    -- board slug/room ID (e.g., "mycofi33")
  owner_id TEXT,                          -- user ID of creator (NULL for legacy boards)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  -- Default permission for unauthenticated users: 'view' (read-only) or 'edit' (open)
  default_permission TEXT DEFAULT 'view' CHECK (default_permission IN ('view', 'edit')),
  -- Board metadata
  name TEXT,                              -- Optional display name
  description TEXT,                       -- Optional description
  is_public INTEGER DEFAULT 1,            -- 1 = anyone with link can view, 0 = invite only
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Per-user board permissions
-- Overrides the board's default permission for specific users
CREATE TABLE IF NOT EXISTS board_permissions (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  -- Permission levels: 'view' (read-only), 'edit' (can modify), 'admin' (full access)
  permission TEXT NOT NULL CHECK (permission IN ('view', 'edit', 'admin')),
  granted_by TEXT,                        -- user ID who granted permission (NULL for owner)
  granted_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(board_id, user_id)
);

-- Board permission indexes
CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards(owner_id);
CREATE INDEX IF NOT EXISTS idx_board_perms_board ON board_permissions(board_id);
CREATE INDEX IF NOT EXISTS idx_board_perms_user ON board_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_board_perms_board_user ON board_permissions(board_id, user_id);

-- =============================================================================
-- User Networking / Social Graph System
-- =============================================================================

-- User profiles with searchable usernames and display info
-- Extends the users table with public profile data
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,                -- References users.id
  display_name TEXT,                        -- Optional display name (defaults to username)
  bio TEXT,                                 -- Short bio
  avatar_color TEXT,                        -- Hex color for avatar
  is_searchable INTEGER DEFAULT 1,          -- 1 = appears in search results
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User connections (one-way following)
-- from_user follows to_user (asymmetric)
CREATE TABLE IF NOT EXISTS user_connections (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,              -- User who initiated the connection
  to_user_id TEXT NOT NULL,                -- User being connected to
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(from_user_id, to_user_id)          -- Can only connect once
);

-- Edge metadata (private notes/labels on connections)
-- Each user can have their own metadata for a connection edge
CREATE TABLE IF NOT EXISTS connection_metadata (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,             -- References user_connections.id
  user_id TEXT NOT NULL,                   -- Which party owns this metadata
  label TEXT,                              -- Short label (e.g., "Met at ETHDenver")
  notes TEXT,                              -- Private notes about the connection
  color TEXT,                              -- Custom edge color (hex)
  strength INTEGER DEFAULT 5 CHECK (strength >= 1 AND strength <= 10),  -- 1-10 connection strength
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (connection_id) REFERENCES user_connections(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(connection_id, user_id)           -- One metadata entry per user per connection
);

-- User networking indexes
CREATE INDEX IF NOT EXISTS idx_profiles_searchable ON user_profiles(is_searchable);
CREATE INDEX IF NOT EXISTS idx_connections_from ON user_connections(from_user_id);
CREATE INDEX IF NOT EXISTS idx_connections_to ON user_connections(to_user_id);
CREATE INDEX IF NOT EXISTS idx_connections_both ON user_connections(from_user_id, to_user_id);
CREATE INDEX IF NOT EXISTS idx_conn_meta_connection ON connection_metadata(connection_id);
CREATE INDEX IF NOT EXISTS idx_conn_meta_user ON connection_metadata(user_id);
