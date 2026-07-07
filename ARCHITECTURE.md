# canvas-website (jeffemmett.com) Architecture

Jeff Emmett's personal site: a collaborative infinite-canvas whiteboard built on
[tldraw](https://tldraw.dev), with an embedded standalone terminal-sharing tool
(`multmux`) living in the same repo but deployed separately.

## Mental model

The app is a React SPA (`src/App.tsx`, mounted via `index.html`) that renders
tldraw boards at `/b/:roomId` (`src/routes/Board.tsx`). Each board's shape data
lives in an **Automerge CRDT document**; `src/automerge/useAutomergeSyncRepo.ts`
(re-exported as `useAutomergeSync`) wires an `@automerge/automerge-repo` `Repo`
with an `IndexedDBStorageAdapter` (local persistence) and a `CloudflareNetworkAdapter`
WebSocket client (`CloudflareAdapter.ts`) that talks to a Cloudflare Worker
(`worker/worker.ts`). The Worker exports one `AutomergeDurableObject` per room:
it holds the live document + WebSocket clients in memory, runs the Automerge
sync protocol (`worker/automerge-sync-manager.ts`), and periodically persists
the doc to the `TLDRAW_BUCKET` R2 bucket. A separate D1 database (`CRYPTID_DB`)
backs an independent auth/identity system ("CryptID": device keys, wallet
linking, board permissions, a social/networking graph) — this is plain
Cloudflare CRUD, not CRDT-synced. Around the tldraw editor sit ~30 custom shape
types (`src/shapes/`) and ~24 tools (`src/tools/`) that embed everything from
maps, calendars, and Markdown/Obsidian notes to AI image/video generation
(RunPod, fal.ai — proxied through the Worker so API keys stay server-side) and
a `multmux` collaborative-terminal iframe. `multmux/` itself is an unrelated
npm-workspace sub-project (tmux-over-WebSocket) with its own Dockerfile and
deploy script; it is not part of the Automerge sync path.

## Structure

| Path | Purpose |
|------|---------|
| `index.html` → `src/App.tsx` | Vite entry; React Router routes (`Default`, `Board`, `Contact`, `Inbox`, `Presentations`, `Resilience`, `Dashboard`), all lazy-loaded. |
| `src/routes/Board.tsx` | The canvas route — wires tldraw `Editor`, `useAutomergeSync`, custom shapes/tools, collections, camera/lock UI. |
| `src/automerge/` | Sync layer: `useAutomergeSyncRepo.ts` (real hook impl, wraps `Repo` + `useAutomergeStoreV2`), `useAutomergeSync.ts` (re-export shim), `useAutomergeStoreV2.ts` (TLStore lifecycle/presence), `AutomergeToTLStore.ts` / `TLStoreToAutomerge.ts` (bidirectional patch translation), `CloudflareAdapter.ts` (WebSocket network adapter, `ConnectionState`), `documentIdMapping.ts` (room-slug ↔ Automerge doc-id, stored in an IndexedDB `canvas-document-mappings` DB), `default_store.ts` (seed doc for new rooms). |
| `worker/worker.ts` | Cloudflare Worker entry (itty-router `AutoRouter`); mounts asset upload/download, networking (social graph), board-permissions, CryptID auth, and wallet-auth routes; exports `AutomergeDurableObject`. |
| `worker/AutomergeDurableObject.ts` | One Durable Object instance per room; in-memory doc + WebSocket clients; persists to R2 via `automerge-r2-storage.ts`; sync protocol in `automerge-sync-manager.ts`. |
| `worker/schema.sql`, `worker/migrations/*.sql` | D1 schema/migrations for `CRYPTID_DB` (users, device keys, protected boards, global admins, linked wallets) — unrelated to the `[[migrations]]` blocks in `wrangler.toml`, which are Durable Object **class** migrations (`AutomergeDurableObject` v1/v2), not SQL. |
| `worker/shapes/` | Server-side counterparts for 8 of the 30 shape types that need Worker-side logic (chat, embed, markdown, mycrozine template, prompt, shared piano, slide, video chat) — kept in sync with `src/shapes/` manually. |
| `src/shapes/`, `src/tools/` | Custom tldraw `ShapeUtil`/`Tool` pairs — one per embedded mini-app (maps, calendar, Fathom meetings, Google items, Obsidian notes/vault, Miro import, image/video gen, transcription, workflow blocks, holon browser, multmux terminal, shared piano, blockchain transaction builder, etc). |
| `src/collections/` | `BaseCollection` (explicitly documented in-source as a "PoC abstract collections class") + `CollectionProvider`/`useCollection`; membership is derived client-side from the editor's shape map, not itself a synced CRDT structure. Currently used by `src/graph/GraphLayoutCollection.tsx`, registered in `Board.tsx`'s `collections` array. |
| `src/graph/`, `src/propagators/` | Reactive layer over tldraw shapes: `propagators/` (`WorkflowPropagator`, `SpatialIndex`, `Geo`, `DeltaTime`, `tlgraph.ts`) recompute derived shape data when inputs change; `graph/GraphUi.tsx` + `GraphLayoutCollection` present it as a graph-layout view. |
| `src/open-mapping/` | Self-contained mapping/routing module (MapLibre GL base layers, OSRM/Valhalla routing, layers/lenses/presence) exported via `src/open-mapping/index.ts`; integrates into the canvas as its own component tree. |
| `src/components/auth/`, `worker/cryptidAuth.ts`, `worker/walletAuth.ts`, `worker/boardPermissions.ts`, `worker/networkingApi.ts` | CryptID identity system: passwordless email-token auth, device keys, wallet linking, per-board permissions/protected-boards, and a user connection/trust graph — backed by D1 (`CRYPTID_DB`), independent of the Automerge doc. |
| `src/lib/` | Non-React utilities: `aiOrchestrator.ts`/`canvasAI.ts` (AI feature glue), `runpodApi.ts` (RunPod proxy client for image/video/text/whisper endpoints), `obsidianImporter.ts`, `quartzSync.ts`, `starredBoards.ts`, `visitedBoards.ts`, `auth/`, `google/`, `blockchain/`. |
| `src/context/`, `src/providers/` | React context: `AuthContext`, `ConnectionContext`, `AutomergeHandleContext`, `FileSystemContext`, `NotificationContext`; `Web3Provider` for wallet/wagmi integration. |
| `src/ui/` | tldraw editor UI overrides: `CustomToolbar.tsx`, `CustomMainMenu.tsx`, `CustomContextMenu.tsx`, `CommandPalette.tsx`, `SettingsDialog.tsx`, `overrides.tsx`. |
| `multmux/` | Standalone npm-workspace sub-project (`multmux/packages/cli`, `multmux/packages/server`) — a tmux-over-WebSocket collaborative terminal with token-based invite auth. Has its own `Dockerfile`/`docker-compose.yml`/`infrastructure/deploy.sh`; deployed independently of the main Cloudflare Pages/Worker deploy. Embedded on the canvas only via `MultmuxShapeUtil.tsx`/`MultmuxTool.ts`. |
| `tests/unit/`, `tests/worker/`, `tests/e2e/`, `tests/mocks/` | Vitest unit tests, Vitest-pool-workers tests (`vitest.worker.config.ts`) for `worker/`, and Playwright e2e (`playwright.config.ts`). |
| `dev-dist/` | Generated PWA service-worker build output (Workbox); do not hand-edit. |

## Persistence model

- **Automerge CRDT doc** — the canvas/shape state for a room. Client-side copy
  lives in IndexedDB (via `automerge-repo-storage-indexeddb`); the Worker's
  `AutomergeDurableObject` holds the authoritative in-memory copy per room and
  snapshots it to the `TLDRAW_BUCKET` R2 bucket (see `automerge-r2-storage.ts`).
- **D1 (`CRYPTID_DB`)** — CryptID users/device-keys/verification-tokens, board
  permissions/protected-boards, linked wallets. Plain relational CRUD, not CRDT.
- **`BOARD_BACKUPS_BUCKET`** (R2) — separate bucket for board backups.
- Cloudflare bindings (D1/R2/Durable Object) are declared in `wrangler.toml`;
  `[env.dev]` points at preview-suffixed R2 buckets for local/dev Worker runs.

## Deploy

- Frontend: `npm run build` (`tsc` + `vite build`) → deployed as Cloudflare
  Pages (`deploy:pages` script); the Worker is deployed separately via
  `wrangler deploy` (`deploy:worker`), reading `wrangler.toml`.
- Local full-stack dev: `npm run dev` runs Vite, `wrangler dev` (local, port
  5172), and the multmux dev server concurrently (`concurrently` in the `dev`
  script).
- `multmux/` deploys independently via its own `infrastructure/deploy.sh` to a
  separate server — running it does not touch the Cloudflare Pages/Worker
  deploy.

## Conventions & gotchas

1. **Import `useAutomergeSync`, not tldraw's `useSync`.** `src/automerge/useAutomergeSync.ts`
   is a one-line re-export of `useAutomergeSyncRepo`; tldraw's own `useSync`
   bypasses Automerge entirely and breaks offline support. The APIs look similar.
2. **`worker/shapes/` vs `src/shapes/`** — only 8 of the 30 shape types have a
   Worker-side counterpart, and there is no shared package between them; keep
   both in sync by hand when changing those shape types' data contracts.
3. **Two separate migration systems in `wrangler.toml`.** The `[[migrations]]`
   blocks are Durable Object *class* migrations (`AutomergeDurableObject`
   v1/v2). `worker/migrations/*.sql` and `worker/schema.sql` are D1 migrations
   for the unrelated `CRYPTID_DB` auth database. Don't confuse the two when
   adding a new migration.
4. **`default_store.ts` is the new-room baseline.** Changing the seed shape
   structure for new documents means updating this file; existing rooms are
   not retroactively migrated by it.
5. **Collections are a PoC, not a synced primitive.** `src/collections/` derives
   group membership from the already-synced tldraw shape map on each client
   independently — it is not itself part of the Automerge document, so don't
   rely on it carrying state that must appear identically for every peer.
6. **`dev-dist/` is generated** (Vite PWA/Workbox build output) — don't edit or
   hand-commit changes here.
7. **AI provider keys never reach the browser.** `src/lib/runpodApi.ts` and the
   fal.ai client call the Worker, which holds `RUNPOD_API_KEY`/`FAL_API_KEY` as
   `wrangler secret`s; client code only knows Worker proxy URLs
   (`src/lib/clientConfig.ts`).
8. **`main` vs local dev config** — `wrangler.toml` is the production Worker
   config (`main = "worker/worker.ts"`); `wrangler.dev.toml` is used for
   `wrangler dev` during local development. Check which one a script targets
   before assuming a change is live.
