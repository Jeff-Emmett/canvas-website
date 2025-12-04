// the contents of the environment should mostly be determined by wrangler.toml. These entries match
// the bindings defined there.
/// <reference types="@cloudflare/workers-types" />

export interface Environment {
	TLDRAW_BUCKET: R2Bucket
	BOARD_BACKUPS_BUCKET: R2Bucket
	AUTOMERGE_DURABLE_OBJECT: DurableObjectNamespace
	CRYPTID_DB: D1Database
	DAILY_API_KEY: string;
	DAILY_DOMAIN: string;
	SENDGRID_API_KEY: string;
	CRYPTID_EMAIL_FROM: string;
	APP_URL: string;
}

// CryptID Database Types
export interface User {
	id: string;
	cryptid_username: string;
	email: string | null;
	email_verified: number;
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
	email: string;
	token: string;
	token_type: 'email_verify' | 'device_link';
	public_key: string | null;
	device_name: string | null;
	user_agent: string | null;
	expires_at: string;
	used: number;
	created_at: string;
}
