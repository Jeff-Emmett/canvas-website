# Deployment Guide

## Frontend Deployment (Cloudflare Pages)

The frontend is deployed to **Cloudflare Pages** (migrated from Vercel).

### Configuration
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **SPA routing**: Handled by `_redirects` file

### Environment Variables
Set in Cloudflare Pages dashboard → Settings → Environment variables:
- All `VITE_*` variables needed for the frontend
- `VITE_WORKER_ENV=production` for production

See `CLOUDFLARE_PAGES_MIGRATION.md` for detailed migration guide.

## Worker Deployment Strategy

**Using Cloudflare's Native Git Integration** for automatic deployments.

### Current Setup
- ✅ **Cloudflare Workers Builds**: Automatic deployment on push to `main` branch
- ✅ **Build Status**: Integrated with GitHub (commit statuses, PR comments)
- ✅ **Environment Support**: Production and preview environments

### How to Configure Cloudflare Native Deployment

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** → **jeffemmett-canvas**
3. Go to **Settings** → **Builds & Deployments**
4. Ensure **"Automatically deploy from Git"** is enabled
5. Configure build settings:
   - **Build command**: Leave empty (wrangler handles this automatically)
   - **Root directory**: `/` (or leave empty)
   - **Environment variables**: Set in Cloudflare dashboard (not in wrangler.toml)

### Why Use Cloudflare Native Deployment?

**Advantages:**
- ✅ Simpler setup (no workflow files to maintain)
- ✅ Integrated with Cloudflare dashboard
- ✅ Automatic resource provisioning (KV, R2, Durable Objects)
- ✅ Build status in GitHub (commit statuses, PR comments)
- ✅ No GitHub Actions minutes usage
- ✅ Less moving parts, easier to debug

**Note:** The GitHub Action workflow has been deprecated (see `.github/workflows/deploy-worker.yml.disabled`) but kept as backup.

### Migration Fix

The worker now includes a migration to rename `TldrawDurableObject` → `AutomergeDurableObject`:

```toml
[[migrations]]
tag = "v2"
renamed_classes = [
  { from = "TldrawDurableObject", to = "AutomergeDurableObject" }
]
```

This fixes the error: "New version of script does not export class 'TldrawDurableObject'"

### Manual Deployment (if needed)

If you need to deploy manually:

```bash
# Production
npm run deploy:worker

# Development
npm run deploy:worker:dev
```

Or directly:
```bash
wrangler deploy                    # Production (uses wrangler.toml)
wrangler deploy --config wrangler.dev.toml  # Dev
```

## Pages Deployment

Pages deployment is separate and should be configured in Cloudflare Pages dashboard:
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (or leave empty)

**Note**: `wrangler.toml` is for Workers only, not Pages.


