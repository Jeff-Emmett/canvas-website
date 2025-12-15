-- Migration: Add Protected Boards & Global Admin System
-- Date: 2024-12-15
-- Description: Implements new permission model where everyone can edit by default,
--              but boards can be marked as "protected" to restrict editing.

-- Add is_protected column to boards table (if it doesn't exist)
-- When is_protected = 1, only explicitly listed editors can edit
-- When is_protected = 0 (default), everyone can edit
ALTER TABLE boards ADD COLUMN is_protected INTEGER DEFAULT 0;

-- Create index for protected boards lookup
CREATE INDEX IF NOT EXISTS idx_boards_protected ON boards(is_protected);

-- Create global_admins table
-- Global admins have admin access to ALL boards
CREATE TABLE IF NOT EXISTS global_admins (
  email TEXT PRIMARY KEY,
  added_at TEXT DEFAULT (datetime('now')),
  added_by TEXT
);

-- Seed initial global admin
INSERT OR IGNORE INTO global_admins (email) VALUES ('jeffemmett@gmail.com');

-- Update default_permission default value on boards table
-- (This only affects new boards, existing boards keep their current value)
-- Note: SQLite doesn't support ALTER COLUMN, but our schema.sql already has the new default
