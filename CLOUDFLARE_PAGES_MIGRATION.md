# Migrating from Vercel to Cloudflare Pages

This guide will help you migrate your site from Vercel to Cloudflare Pages.

## Overview

**Current Setup:**
- ✅ Frontend: Vercel (static site)
- ✅ Backend: Cloudflare Worker (`jeffemmett-canvas.jeffemmett.workers.dev`)

**Target Setup:**
- ✅ Frontend: Cloudflare Pages (`canvas-website.pages.dev`)
- ✅ Backend: Cloudflare Worker (unchanged)

## Step 1: Configure Cloudflare Pages

### In Cloudflare Dashboard:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Pages** → **Create a project**
3. Connect your GitHub repository: `Jeff-Emmett/canvas-website`
4. Configure build settings:
   - **Project name**: `canvas-website` (or your preferred name)
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (leave empty)

5. Click **Save and Deploy**

## Step 2: Configure Environment Variables

### In Cloudflare Pages Dashboard:

1. Go to your Pages project → **Settings** → **Environment variables**
2. Add all your `VITE_*` environment variables from Vercel:

   **Required variables** (if you use them):
   ```
   VITE_WORKER_ENV=production
   VITE_GITHUB_TOKEN=...
   VITE_QUARTZ_REPO=...
   VITE_QUARTZ_BRANCH=...
   VITE_CLOUDFLARE_API_KEY=...
   VITE_CLOUDFLARE_ACCOUNT_ID=...
   VITE_QUARTZ_API_URL=...
   VITE_QUARTZ_API_KEY=...
   VITE_DAILY_API_KEY=...
   ```

   **Note**: Only add variables that start with `VITE_` (these are exposed to the browser)

3. Set different values for **Production** and **Preview** environments if needed

## Step 3: Configure Custom Domain (Optional)

If you have a custom domain:

1. Go to **Pages** → Your project → **Custom domains**
2. Click **Set up a custom domain**
3. Add your domain (e.g., `jeffemmett.com`)
4. Follow DNS instructions to add the CNAME record

## Step 4: Verify Routing

The `_redirects` file has been created to handle SPA routing. This replaces the `rewrites` from `vercel.json`.

**Routes configured:**
- `/board/*` → serves `index.html`
- `/inbox` → serves `index.html`
- `/contact` → serves `index.html`
- `/presentations` → serves `index.html`
- `/dashboard` → serves `index.html`
- All other routes → serves `index.html` (SPA fallback)

## Step 5: Update Worker URL for Production

Make sure your production environment uses the production worker:

1. In Cloudflare Pages → **Settings** → **Environment variables**
2. Set `VITE_WORKER_ENV=production` for **Production** environment
3. This will make the frontend connect to: `https://jeffemmett-canvas.jeffemmett.workers.dev`

## Step 6: Test the Deployment

1. After the first deployment completes, visit your Pages URL
2. Test all routes:
   - `/board`
   - `/inbox`
   - `/contact`
   - `/presentations`
   - `/dashboard`
3. Verify the canvas app connects to the Worker
4. Test real-time collaboration features

## Step 7: Update DNS (If Using Custom Domain)

If you're using a custom domain:

1. Update your DNS records to point to Cloudflare Pages
2. Remove Vercel DNS records
3. Wait for DNS propagation (can take up to 48 hours)

## Step 8: Disable Vercel Deployment (Optional)

Once everything is working on Cloudflare Pages:

1. Go to Vercel Dashboard
2. Navigate to your project → **Settings** → **Git**
3. Disconnect the repository or delete the project

## Differences from Vercel

### Headers
- **Vercel**: Configured in `vercel.json`
- **Cloudflare Pages**: Configured in `_headers` file (if needed) or via Cloudflare dashboard

### Redirects/Rewrites
- **Vercel**: Configured in `vercel.json` → `rewrites`
- **Cloudflare Pages**: Configured in `_redirects` file ✅ (already created)

### Environment Variables
- **Vercel**: Set in Vercel dashboard
- **Cloudflare Pages**: Set in Cloudflare Pages dashboard (same process)

### Build Settings
- **Vercel**: Auto-detected from `vercel.json`
- **Cloudflare Pages**: Configured in dashboard (already set above)

## Troubleshooting

### Issue: Routes return 404
**Solution**: Make sure `_redirects` file is in the `dist` folder after build, or configure it in Cloudflare Pages dashboard

### Issue: Environment variables not working
**Solution**: 
- Make sure variables start with `VITE_`
- Rebuild after adding variables
- Check browser console for errors

### Issue: Worker connection fails
**Solution**:
- Verify `VITE_WORKER_ENV=production` is set
- Check Worker is deployed and accessible
- Check CORS settings in Worker

## Files Changed

- ✅ Created `_redirects` file (replaces `vercel.json` rewrites)
- ✅ Created this migration guide
- ⚠️ `vercel.json` can be kept for reference or removed

## Next Steps

1. ✅ Configure Cloudflare Pages project
2. ✅ Add environment variables
3. ✅ Test deployment
4. ⏳ Update DNS (if using custom domain)
5. ⏳ Disable Vercel (once confirmed working)

## Support

If you encounter issues:
- Check Cloudflare Pages build logs
- Check browser console for errors
- Verify Worker is accessible
- Check environment variables are set correctly

