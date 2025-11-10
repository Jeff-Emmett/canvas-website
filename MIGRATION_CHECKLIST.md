# Vercel → Cloudflare Pages Migration Checklist

## ✅ Completed Setup

- [x] Created `_redirects` file for SPA routing (in `src/public/`)
- [x] Updated `package.json` to remove Vercel from deploy script
- [x] Created migration guide (`CLOUDFLARE_PAGES_MIGRATION.md`)
- [x] Updated deployment documentation

## 📋 Action Items

### 1. Create Cloudflare Pages Project
- [ ] Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
- [ ] Navigate to **Pages** → **Create a project**
- [ ] Connect GitHub repository: `Jeff-Emmett/canvas-website`
- [ ] Configure:
  - **Project name**: `canvas-website`
  - **Production branch**: `main`
  - **Build command**: `npm run build`
  - **Build output directory**: `dist`
  - **Root directory**: `/` (leave empty)

### 2. Set Environment Variables
- [ ] Go to Pages project → **Settings** → **Environment variables**
- [ ] Add all `VITE_*` variables from Vercel:
  - `VITE_WORKER_ENV=production` (for production)
  - `VITE_WORKER_ENV=dev` (for preview)
  - Any other `VITE_*` variables you use
- [ ] Set different values for **Production** and **Preview** if needed

### 3. Test First Deployment
- [ ] Wait for first deployment to complete
- [ ] Visit Pages URL (e.g., `canvas-website.pages.dev`)
- [ ] Test routes:
  - [ ] `/board`
  - [ ] `/inbox`
  - [ ] `/contact`
  - [ ] `/presentations`
  - [ ] `/dashboard`
- [ ] Verify canvas app connects to Worker
- [ ] Test real-time collaboration

### 4. Configure Custom Domain (if applicable)
- [ ] Go to Pages project → **Custom domains**
- [ ] Add your domain (e.g., `jeffemmett.com`)
- [ ] Update DNS records to point to Cloudflare Pages
- [ ] Wait for DNS propagation

### 5. Clean Up Vercel (after confirming Cloudflare works)
- [ ] Verify everything works on Cloudflare Pages
- [ ] Go to Vercel Dashboard
- [ ] Disconnect repository or delete project
- [ ] Update DNS records if using custom domain

## 🔍 Verification Steps

After migration, verify:
- ✅ All routes work (no 404s)
- ✅ Canvas app loads and connects to Worker
- ✅ Real-time collaboration works
- ✅ Environment variables are accessible
- ✅ Assets load correctly
- ✅ No console errors

## 📝 Notes

- The `_redirects` file is in `src/public/` and will be copied to `dist/` during build
- Worker deployment is separate and unchanged
- Environment variables must start with `VITE_` to be accessible in the browser
- Cloudflare Pages automatically deploys on push to `main` branch

## 🆘 If Something Goes Wrong

1. Check Cloudflare Pages build logs
2. Check browser console for errors
3. Verify environment variables are set
4. Verify Worker is accessible
5. Check `_redirects` file is in `dist/` after build

