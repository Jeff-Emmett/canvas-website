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
	RESEND_API_KEY?: string;
	CRYPTID_EMAIL_FROM?: string;
	APP_URL?: string;
	// Admin secret for protected endpoints
	ADMIN_SECRET?: string;
	// AI Service API keys (stored as secrets, never exposed to client)
	FAL_API_KEY?: string;
	RUNPOD_API_KEY?: string;
	// RunPod endpoint IDs (not secrets, but kept server-side for flexibility)
	RUNPOD_IMAGE_ENDPOINT_ID?: string;
	RUNPOD_VIDEO_ENDPOINT_ID?: string;
	RUNPOD_TEXT_ENDPOINT_ID?: string;
	RUNPOD_WHISPER_ENDPOINT_ID?: string;
	// Blender render server URL
	BLENDER_API_URL?: string;
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
	is_protected: number;          // SQLite boolean (0 or 1) - when 1, only listed editors can edit
}

/**
 * Global admin record - admins have admin access to ALL boards
 */
export interface GlobalAdmin {
	email: string;
	added_at: string;
	added_by: string | null;
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
	grantedByToken?: boolean;     // True if permission was granted via access token
	isGlobalAdmin?: boolean;      // True if user is a global admin
	isProtected?: boolean;        // True if board is in protected mode
	isExplicitPermission?: boolean; // True if permission was explicitly granted (not default)
}

/**
 * Access token for sharing boards with specific permissions
 * Stored in board_access_tokens table
 */
export interface BoardAccessToken {
	id: string;
	board_id: string;
	token: string;            // Random token string
	permission: PermissionLevel;
	created_by: string;       // User ID who created the token
	created_at: string;
	expires_at: string | null;  // NULL = never expires
	max_uses: number | null;  // NULL = unlimited
	use_count: number;
	is_active: number;        // SQLite boolean (0 or 1)
	label: string | null;     // Optional label for the token
}

// =============================================================================
// User Networking / Social Graph Types
// =============================================================================

/**
 * User profile record in the database
 */
export interface UserProfile {
	user_id: string;
	display_name: string | null;
	bio: string | null;
	avatar_color: string | null;
	is_searchable: number;  // SQLite boolean (0 or 1)
	created_at: string;
	updated_at: string;
}

/**
 * Trust levels for connections:
 * - 'connected': Yellow, grants view permission on shared data
 * - 'trusted': Green, grants edit permission on shared data
 */
export type TrustLevel = 'connected' | 'trusted';

/**
 * User connection record (one-way follow with trust level)
 */
export interface UserConnection {
	id: string;
	from_user_id: string;
	to_user_id: string;
	trust_level: TrustLevel;
	created_at: string;
	updated_at: string;
}

/**
 * Edge metadata for a connection (private to each party)
 */
export interface ConnectionMetadata {
	id: string;
	connection_id: string;
	user_id: string;
	label: string | null;
	notes: string | null;
	color: string | null;
	strength: number;  // 1-10
	updated_at: string;
}

/**
 * Combined user info for search results and graph nodes
 */
export interface UserNode {
	id: string;
	username: string;
	displayName: string | null;
	avatarColor: string | null;
	bio: string | null;
}

/**
 * Graph edge with connection and optional metadata
 */
export interface GraphEdge {
	id: string;
	fromUserId: string;
	toUserId: string;
	trustLevel: TrustLevel;
	createdAt: string;
	// Metadata is only included for the requesting user's edges
	metadata?: {
		label: string | null;
		notes: string | null;
		color: string | null;
		strength: number;
	};
	// Indicates if this is a mutual connection (both follow each other)
	isMutual: boolean;
	// The highest trust level between both directions (if mutual)
	effectiveTrustLevel: TrustLevel | null;
}

/**
 * Full network graph response
 */
export interface NetworkGraph {
	nodes: UserNode[];
	edges: GraphEdge[];
	// Current user's connections (for filtering)
	myConnections: string[];  // User IDs I'm connected to
}

// =============================================================================
// Linked Wallet Types (Web3 Integration)
// =============================================================================

/**
 * Wallet types supported for linking
 * - 'eoa': Externally Owned Account (standard wallet)
 * - 'safe': Safe (Gnosis Safe) multisig
 * - 'hardware': Hardware wallet (via MetaMask bridge)
 * - 'contract': Other smart contract wallet
 */
export type WalletType = 'eoa' | 'safe' | 'hardware' | 'contract';

/**
 * Linked wallet record in the database
 */
export interface LinkedWallet {
	id: string;
	user_id: string;
	wallet_address: string;
	wallet_type: WalletType;
	chain_id: number;
	label: string | null;
	signature_message: string;
	signature: string;
	verified_at: string;
	ens_name: string | null;
	ens_avatar: string | null;
	ens_resolved_at: string | null;
	is_primary: number;  // SQLite boolean (0 or 1)
	is_active: number;   // SQLite boolean (0 or 1)
	created_at: string;
	updated_at: string;
	last_used_at: string | null;
}

/**
 * Wallet link token for delayed verification (Safe/contract wallets)
 */
export interface WalletLinkToken {
	id: string;
	user_id: string;
	wallet_address: string;
	nonce: string;
	token: string;
	expires_at: string;
	used: number;
	created_at: string;
}

/**
 * Cached token balance for a wallet
 */
export interface WalletTokenBalance {
	id: string;
	wallet_address: string;
	token_address: string;
	token_type: 'erc20' | 'erc721' | 'erc1155';
	chain_id: number;
	balance: string;  // String to handle big numbers
	last_updated: string;
}

/**
 * API response format for linked wallets
 */
export interface LinkedWalletResponse {
	id: string;
	address: string;
	type: WalletType;
	chainId: number;
	label: string | null;
	ensName: string | null;
	ensAvatar: string | null;
	isPrimary: boolean;
	linkedAt: string;
	lastUsedAt: string | null;
}

/**
 * Request body for linking a wallet
 */
export interface WalletLinkRequest {
	walletAddress: string;
	signature: string;
	message: string;
	walletType?: WalletType;
	chainId?: number;
	label?: string;
}