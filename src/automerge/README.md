# Automerge Integration for TLdraw

This directory contains the Automerge-based sync implementation that replaces the TLdraw sync system.

## Files

- `AutomergeToTLStore.ts` - Converts Automerge patches to TLdraw store updates
- `TLStoreToAutomerge.ts` - Converts TLdraw store changes to Automerge document updates
- `useAutomergeStore.ts` - React hook for managing Automerge document state
- `useAutomergeSync.ts` - Main sync hook that replaces `useSync` from TLdraw
- `CloudflareAdapter.ts` - Adapter for Cloudflare Durable Objects and R2 storage
- `default_store.ts` - Default TLdraw store structure for new documents
- `index.ts` - Main exports

## Benefits over TLdraw Sync

1. **Better Conflict Resolution**: Automerge's CRDT nature handles concurrent edits more elegantly
2. **Offline-First**: Works seamlessly offline and syncs when reconnected
3. **Smaller Sync Payloads**: Only sends changes (patches) rather than full state
4. **Cross-Session Persistence**: Better handling of data across different devices/sessions
5. **Automatic Merging**: No manual conflict resolution needed

## Usage

Replace the TLdraw sync import:

```typescript
// Old
import { useSync } from "@tldraw/sync"

// New
import { useAutomergeSync } from "@/automerge/useAutomergeSync"
```

The API is identical, so no other changes are needed in your components.

## Cloudflare Integration

The system uses:
- **Durable Objects**: For real-time WebSocket connections and document state management
- **R2 Storage**: For persistent document storage
- **Automerge Network Adapter**: Custom adapter for Cloudflare's infrastructure

## Migration

To switch from TLdraw sync to Automerge sync:

1. Update the Board component to use `useAutomergeSync`
2. Deploy the new worker with Automerge Durable Object
3. Update the URI to use `/automerge/connect/` instead of `/connect/`

The migration is backward compatible - existing TLdraw sync will continue to work while you test the new system.
