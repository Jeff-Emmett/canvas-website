# Cloudflare Worker Native Deployment Setup

This guide explains how to set up Cloudflare's native Git integration for automatic worker deployments.

## Quick Setup Steps

### 1. Enable Git Integration in Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** → **jeffemmett-canvas**
3. Go to **Settings** → **Builds & Deployments**
4. Click **"Connect to Git"** or **"Set up Git integration"**
5. Authorize Cloudflare to access your GitHub repository
6. Select your repository: `Jeff-Emmett/canvas-website`
7. Configure:
   - **Production branch**: `main`
   - **Build command**: Leave empty (wrangler automatically detects and builds from `wrangler.toml`)
   - **Root directory**: `/` (or leave empty)

### 2. Configure Build Settings

Cloudflare will automatically:
- Detect `wrangler.toml` in the root directory
- Build and deploy the worker on every push to `main`
- Show build status in GitHub (commit statuses, PR comments)

### 3. Environment Variables

Set environment variables in Cloudflare Dashboard:
1. Go to **Workers & Pages** → **jeffemmett-canvas** → **Settings** → **Variables**
2. Add any required environment variables
3. These are separate from `wrangler.toml` (which should only have non-sensitive config)

### 4. Verify Deployment

After setup:
1. Push a commit to `main` branch
2. Check Cloudflare Dashboard → **Workers & Pages** → **jeffemmett-canvas** → **Deployments**
3. You should see a new deployment triggered by the Git push
4. Check GitHub commit status - you should see Cloudflare build status

## How It Works

- **On push to `main`**: Automatically deploys to production using `wrangler.toml`
- **On pull request**: Can optionally deploy to preview environment
- **Build status**: Appears in GitHub as commit status and PR comments
- **Deployments**: All visible in Cloudflare Dashboard

## Environment Configuration

### Production (main branch)
- Uses `wrangler.toml` from root directory
- Worker name: `jeffemmett-canvas`
- R2 buckets: `jeffemmett-canvas`, `board-backups`

### Development/Preview
- For dev environment, you can:
  - Use a separate worker with `wrangler.dev.toml` (requires manual deployment)
  - Or configure preview deployments in Cloudflare dashboard
  - Or use the deprecated GitHub Action (see `.github/workflows/deploy-worker.yml.disabled`)

## Manual Deployment (if needed)

If you need to deploy manually:

```bash
# Production
npm run deploy:worker
# or
wrangler deploy

# Development
npm run deploy:worker:dev
# or
wrangler deploy --config wrangler.dev.toml
```

## Troubleshooting

### Build fails
- Check Cloudflare Dashboard → Deployments → View logs
- Ensure `wrangler.toml` is in root directory
- Verify all required environment variables are set in Cloudflare dashboard

### Not deploying automatically
- Verify Git integration is connected in Cloudflare dashboard
- Check that "Automatically deploy from Git" is enabled
- Ensure you're pushing to the configured branch (`main`)

### Need to revert to GitHub Actions
- Rename `.github/workflows/deploy-worker.yml.disabled` back to `deploy-worker.yml`
- Disable Git integration in Cloudflare dashboard

## Benefits of Native Deployment

✅ **Simpler**: No workflow files to maintain  
✅ **Integrated**: Build status in GitHub  
✅ **Automatic**: Resource provisioning (KV, R2, Durable Objects)  
✅ **Free**: No GitHub Actions minutes usage  
✅ **Visible**: All deployments in Cloudflare dashboard  

