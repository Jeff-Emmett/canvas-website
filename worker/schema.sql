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
