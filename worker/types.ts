// the contents of the environment should mostly be determined by wrangler.toml. These entries match
// the bindings defined there.
/// <reference types="@cloudflare/workers-types" />

export interface Environment {
	TLDRAW_BUCKET: R2Bucket
	TLDRAW_BUCKET_NAME: 'jeffemmett-canvas'
	TLDRAW_BACKUP_BUCKET: R2Bucket
	TLDRAW_BACKUP_BUCKET_NAME: 'board-backups'
	TLDRAW_DURABLE_OBJECT: DurableObjectNamespace
	DAILY_API_KEY: string;
	DAILY_DOMAIN: string;
	DEV: boolean;
}

// export interface BoardVersion {
// 	timestamp: number
// 	snapshot: RoomSnapshot
// 	version: number
// 	dateKey: string // YYYY-MM-DD format
// }