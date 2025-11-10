# Cloudflare Pages Configuration

## Issue
Cloudflare Pages cannot use the same `wrangler.toml` file as Workers because:
- `wrangler.toml` contains Worker-specific configuration (main, account_id, triggers, etc.)
- Pages projects have different configuration requirements
- Pages cannot have both `main` and `pages_build_output_dir` in the same file

## Solution: Configure in Cloudflare Dashboard

Since `wrangler.toml` is for Workers only, configure Pages settings in the Cloudflare Dashboard:

### Steps:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Pages** → Your Project
3. Go to **Settings** → **Builds & deployments**
4. Configure:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (or leave empty)
5. Save settings

### Alternative: Use Environment Variables
If you need to configure Pages via code, you can set environment variables in the Cloudflare Pages dashboard under **Settings** → **Environment variables**.

## Worker Deployment
Workers are deployed separately using:
```bash
npm run deploy:worker
```
or
```bash
wrangler deploy
```

The `wrangler.toml` file is used only for Worker deployments, not Pages.

