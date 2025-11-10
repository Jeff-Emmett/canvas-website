# GitHub Integration Setup for Quartz Sync

## Quick Setup Guide

### 1. Create GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Configure:
   - **Note:** "Canvas Website Quartz Sync"
   - **Expiration:** 90 days (or your preference)
   - **Scopes:** 
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows)
4. Click "Generate token" and **copy it immediately**

### 2. Set Up Your Quartz Repository

For the Jeff-Emmett/quartz repository, you can either:

**Option A: Use the existing Jeff-Emmett/quartz repository**
- Fork the repository to your GitHub account
- Clone your fork locally
- Set up the environment variables to point to your fork

**Option B: Create a new Quartz repository**
```bash
# Create a new Quartz site
git clone https://github.com/jackyzha0/quartz.git your-quartz-site
cd your-quartz-site
npm install
npx quartz create

# Push to GitHub
git add .
git commit -m "Initial Quartz setup"
git remote add origin https://github.com/your-username/your-quartz-repo.git
git push -u origin main
```

### 3. Configure Environment Variables

Create a `.env.local` file in your project root:

```bash
# GitHub Integration for Quartz Sync
NEXT_PUBLIC_GITHUB_TOKEN=your_github_token_here
NEXT_PUBLIC_QUARTZ_REPO=Jeff-Emmett/quartz
NEXT_PUBLIC_QUARTZ_BRANCH=main
```

### 4. Enable GitHub Pages

1. Go to your repository → Settings → Pages
2. Source: "GitHub Actions"
3. This will automatically deploy your Quartz site when you push changes

### 5. Test the Integration

1. Start your development server: `npm run dev`
2. Import some Obsidian notes or create new ones
3. Edit a note and click "Sync Updates"
4. Check your GitHub repository - you should see new/updated files in the `content/` directory
5. Your Quartz site should automatically rebuild and show the changes

## How It Works

1. **When you sync a note:**
   - The system creates/updates a Markdown file in your GitHub repository
   - File is placed in the `content/` directory with proper frontmatter
   - GitHub Actions automatically rebuilds and deploys your Quartz site

2. **File structure in your repository:**
   ```
   your-quartz-repo/
   ├── content/
   │   ├── note-1.md
   │   ├── note-2.md
   │   └── ...
   ├── .github/workflows/
   │   └── quartz-sync.yml
   └── ...
   ```

3. **Automatic deployment:**
   - Changes trigger GitHub Actions workflow
   - Quartz site rebuilds automatically
   - Changes appear on your live site within minutes

## Troubleshooting

### Common Issues

1. **"GitHub API error: 401 Unauthorized"**
   - Check your GitHub token is correct
   - Verify the token has `repo` permissions

2. **"Repository not found"**
   - Check the repository name format: `username/repo-name`
   - Ensure the repository exists and is accessible

3. **"Sync successful but no changes on site"**
   - Check GitHub Actions tab for workflow status
   - Verify GitHub Pages is enabled
   - Wait a few minutes for the build to complete

### Debug Mode

Check the browser console for detailed sync logs:
- Look for "✅ Successfully synced to Quartz!" messages
- Check for any error messages in red

## Security Notes

- Never commit your `.env.local` file to version control
- Use fine-grained tokens with minimal required permissions
- Regularly rotate your GitHub tokens

## Next Steps

Once set up, you can:
- Edit notes directly in the canvas
- Sync changes to your Quartz site
- Share your live Quartz site with others
- Use GitHub's version control for your notes
