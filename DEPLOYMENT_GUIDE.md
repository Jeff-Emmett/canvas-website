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

**Recommendation: Use GitHub Actions only** to avoid conflicts and duplication.

### Current Setup
- ✅ **GitHub Actions**: Deploys worker on push to `main` branch
- ❌ **Cloudflare Workers Builds**: Also deploying (causing conflicts)

### How to Disable Cloudflare Workers Builds

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** → **jeffemmett-canvas**
3. Go to **Settings** → **Builds & Deployments**
4. **Disable** "Automatically deploy from Git" or remove the Git integration
5. Alternatively, go to **Settings** → **Integrations** and disconnect GitHub if connected

### Why Use GitHub Actions?

**Advantages:**
- ✅ Single source of truth for deployments
- ✅ Better control over deployment process
- ✅ Can add tests, checks, and conditional deployments
- ✅ Version tracking in GitHub
- ✅ No conflicts between two deployment systems

**Cloudflare Workers Builds:**
- ❌ Can conflict with GitHub Actions
- ❌ Less control over the process
- ❌ Harder to debug when issues occur

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


