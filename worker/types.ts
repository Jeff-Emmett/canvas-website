// the contents of the environment should mostly be determined by wrangler.toml. These entries match
// the bindings defined there.
/// <reference types="@cloudflare/workers-types" />

export interface Environment {
	TLDRAW_BUCKET: R2Bucket
	BOARD_BACKUPS_BUCKET: R2Bucket
	TLDRAW_DURABLE_OBJECT: DurableObjectNamespace
	DAILY_API_KEY: string;
	DAILY_DOMAIN: string;
}