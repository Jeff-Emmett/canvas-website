// the contents of the environment should mostly be determined by wrangler.toml. These entries match
// the bindings defined there.
/// <reference types="@cloudflare/workers-types" />

export interface Environment {
	TLDRAW_BUCKET: R2Bucket
	BOARD_BACKUPS_BUCKET: R2Bucket
	AUTOMERGE_DURABLE_OBJECT: DurableObjectNamespace
	DAILY_API_KEY: string;
	DAILY_DOMAIN: string;
	// CryptID auth bindings
	CRYPTID_DB?: D1Database;
	SENDGRID_API_KEY?: string;
	CRYPTID_EMAIL_FROM?: string;
	APP_URL?: string;
}

// CryptID types for auth
export interface User {
	id: string;
	cryptid_username: string;
	email: string | null;
	email_verified: boolean;
	created_at: string;
	updated_at: string;
}

export interface DeviceKey {
	id: string;
	user_id: string;
	public_key: string;
	device_name: string | null;
	user_agent: string | null;
	created_at: string;
	last_used: string | null;
}

export interface VerificationToken {
	id: string;
	user_id: string;
	token: string;
	type: 'email_verification' | 'device_link';
	expires_at: string;
	created_at: string;
	metadata: string | null;
	// Metadata fields that get parsed from JSON
	email?: string;
	public_key?: string;
	device_name?: string;
	user_agent?: string;
}

// =============================================================================
// Board Permission Types
// =============================================================================

/**
 * Permission levels for board access:
 * - 'view': Read-only access, cannot create/edit/delete shapes
 * - 'edit': Can create, edit, and delete shapes
 * - 'admin': Full access including permission management and board settings
 */
export type PermissionLevel = 'view' | 'edit' | 'admin';

/**
 * Board record in the database
 */
export interface Board {
	id: string;                    // board slug/room ID
	owner_id: string | null;       // user ID of creator (NULL for legacy boards)
	created_at: string;
	updated_at: string;
	default_permission: 'view' | 'edit';
	name: string | null;
	description: string | null;
	is_public: number;             // SQLite boolean (0 or 1)
}

/**
 * Board permission record for a specific user
 */
export interface BoardPermission {
	id: string;
	board_id: string;
	user_id: string;
	permission: PermissionLevel;
	granted_by: string | null;
	granted_at: string;
}

/**
 * Response when checking a user's permission for a board
 */
export interface PermissionCheckResult {
	permission: PermissionLevel;
	isOwner: boolean;
	boardExists: boolean;
}