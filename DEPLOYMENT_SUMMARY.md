# Deployment Summary

## Current Setup

### ✅ Frontend: Cloudflare Pages
- **Deployment**: Automatic on push to `main` branch
- **Build**: `npm run build`
- **Output**: `dist/`
- **Configuration**: Set in Cloudflare Pages dashboard
- **Environment Variables**: Set in Cloudflare Pages dashboard (VITE_* variables)

### ✅ Worker: Cloudflare Native Git Integration
- **Production**: Automatic deployment on push to `main` branch → uses `wrangler.toml`
- **Preview**: Automatic deployment for pull requests → uses `wrangler.toml` (or can be configured for dev)
- **Build Status**: Integrated with GitHub (commit statuses, PR comments)
- **Configuration**: Managed in Cloudflare Dashboard → Settings → Builds & Deployments

### ❌ Vercel: Can be disabled
- Frontend is now on Cloudflare Pages
- Worker was never on Vercel
- You can safely disconnect/delete the Vercel project

## Why Cloudflare Native Deployment?

**Cloudflare's native Git integration provides:**

1. ✅ **Simplicity**: No workflow files to maintain, automatic setup
2. ✅ **Integration**: Build status directly in GitHub (commit statuses, PR comments)
3. ✅ **Resource Provisioning**: Automatically provisions KV, R2, Durable Objects
4. ✅ **Environment Support**: Production and preview environments
5. ✅ **Dashboard Integration**: All deployments visible in Cloudflare dashboard
6. ✅ **No GitHub Actions Minutes**: Free deployment, no usage limits

**Note:** GitHub Actions workflow has been deprecated (see `.github/workflows/deploy-worker.yml.disabled`) but kept as backup if needed.

## Environment Switching

### For Local Development

You can switch between dev and prod workers locally using:

```bash
# Switch to production worker
./switch-worker-env.sh production

# Switch to dev worker  
./switch-worker-env.sh dev

# Switch to local worker (requires local worker running)
./switch-worker-env.sh local
```

This updates `.env.local` with `VITE_WORKER_ENV=production` or `VITE_WORKER_ENV=dev`.

**Default**: Now set to `production` (changed from `dev`)

### For Cloudflare Pages

Set environment variables in Cloudflare Pages dashboard:
- **Production**: `VITE_WORKER_ENV=production`
- **Preview**: `VITE_WORKER_ENV=dev` (for testing)

## Deployment Workflow

### Frontend (Cloudflare Pages)
1. Push to `main` → Auto-deploys to production
2. Create PR → Auto-deploys to preview environment
3. Environment variables set in Cloudflare dashboard

### Worker (Cloudflare Native)
1. **Production**: Push to `main` → Auto-deploys to production worker
2. **Preview**: Create PR → Auto-deploys to preview environment (optional)
3. **Manual**: Deploy via `wrangler deploy` command or Cloudflare dashboard

## Testing Both Environments

### Local Testing
```bash
# Test with production worker
./switch-worker-env.sh production
npm run dev

# Test with dev worker
./switch-worker-env.sh dev
npm run dev
```

### Remote Testing
- **Production**: Visit your production Cloudflare Pages URL
- **Dev**: Visit your dev worker URL directly or use preview deployment

## Next Steps

1. ✅ **Disable Vercel**: Go to Vercel dashboard → Disconnect repository
2. ✅ **Verify Cloudflare Pages**: Ensure it's deploying correctly
3. ✅ **Test Worker Deployments**: Push to main and verify production worker updates
4. ✅ **Test Dev Worker**: Push to `automerge/test` branch and verify dev worker updates



