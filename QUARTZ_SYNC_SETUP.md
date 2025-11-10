# Quartz Database Setup Guide

This guide explains how to set up a Quartz database with read/write permissions for your canvas website. Based on the [Quartz static site generator](https://quartz.jzhao.xyz/) architecture, there are several approaches available.

## Overview

Quartz is a static site generator that transforms Markdown content into websites. To enable read/write functionality, we've implemented multiple sync approaches that work with Quartz's architecture.

## Setup Options

### 1. GitHub Integration (Recommended)

This is the most natural approach since Quartz is designed to work with GitHub repositories.`

#### Prerequisites
- A GitHub repository containing your Quartz site
- A GitHub Personal Access Token with repository write permissions

#### Setup Steps

1. **Create a GitHub Personal Access Token:**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate a new token with `repo` permissions for the Jeff-Emmett/quartz repository
   - Copy the token

2. **Configure Environment Variables:**
   Create a `.env.local` file in your project root with:
   ```bash
   # GitHub Integration for Jeff-Emmett/quartz
   NEXT_PUBLIC_GITHUB_TOKEN=your_github_token_here
   NEXT_PUBLIC_QUARTZ_REPO=Jeff-Emmett/quartz
   ```
   
   **Important:** Replace `your_github_token_here` with your actual GitHub Personal Access Token.

3. **Set up GitHub Actions (Optional):**
   - The included `.github/workflows/quartz-sync.yml` will automatically rebuild your Quartz site when content changes
   - Make sure your repository has GitHub Pages enabled

#### How It Works
- When you sync a note, it creates/updates a Markdown file in your GitHub repository
- The file is placed in the `content/` directory with proper frontmatter
- GitHub Actions automatically rebuilds and deploys your Quartz site
- Your changes appear on your live Quartz site within minutes

### 2. Cloudflare Integration

Uses your existing Cloudflare infrastructure for persistent storage.

#### Prerequisites
- Cloudflare account with R2 and Durable Objects enabled
- API token with appropriate permissions

#### Setup Steps

1. **Create Cloudflare API Token:**
   - Go to Cloudflare Dashboard → My Profile → API Tokens
   - Create a token with `Cloudflare R2:Edit` and `Durable Objects:Edit` permissions
   - Note your Account ID

2. **Configure Environment Variables:**
   ```bash
   # Add to your .env.local file
   NEXT_PUBLIC_CLOUDFLARE_API_KEY=your_api_key_here
   NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID=your_account_id_here
   NEXT_PUBLIC_CLOUDFLARE_R2_BUCKET=your-bucket-name
   ```

3. **Deploy the API Endpoint:**
   - The `src/pages/api/quartz/sync.ts` endpoint handles Cloudflare storage
   - Deploy this to your Cloudflare Workers or Vercel

#### How It Works
- Notes are stored in Cloudflare R2 for persistence
- Durable Objects handle real-time sync across devices
- The API endpoint manages note storage and retrieval
- Changes are immediately available to all connected clients

### 3. Direct Quartz API

If your Quartz site exposes an API for content updates.

#### Setup Steps

1. **Configure Environment Variables:**
   ```bash
   # Add to your .env.local file
   NEXT_PUBLIC_QUARTZ_API_URL=https://your-quartz-site.com/api
   NEXT_PUBLIC_QUARTZ_API_KEY=your_api_key_here
   ```

2. **Implement API Endpoints:**
   - Your Quartz site needs to expose `/api/notes` endpoints
   - See the example implementation in the sync code

### 4. Webhook Integration

Send updates to a webhook that processes and syncs to Quartz.

#### Setup Steps

1. **Configure Environment Variables:**
   ```bash
   # Add to your .env.local file
   NEXT_PUBLIC_QUARTZ_WEBHOOK_URL=https://your-webhook-endpoint.com/quartz-sync
   NEXT_PUBLIC_QUARTZ_WEBHOOK_SECRET=your_webhook_secret_here
   ```

2. **Set up Webhook Handler:**
   - Create an endpoint that receives note updates
   - Process the updates and sync to your Quartz site
   - Implement proper authentication using the webhook secret

## Configuration

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# GitHub Integration
NEXT_PUBLIC_GITHUB_TOKEN=your_github_token
NEXT_PUBLIC_QUARTZ_REPO=username/repo-name

# Cloudflare Integration
NEXT_PUBLIC_CLOUDFLARE_API_KEY=your_api_key
NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID=your_account_id
NEXT_PUBLIC_CLOUDFLARE_R2_BUCKET=your-bucket-name

# Quartz API Integration
NEXT_PUBLIC_QUARTZ_API_URL=https://your-site.com/api
NEXT_PUBLIC_QUARTZ_API_KEY=your_api_key

# Webhook Integration
NEXT_PUBLIC_QUARTZ_WEBHOOK_URL=https://your-webhook.com/sync
NEXT_PUBLIC_QUARTZ_WEBHOOK_SECRET=your_secret
```

### Runtime Configuration

You can also configure sync settings at runtime:

```typescript
import { saveQuartzSyncSettings } from '@/config/quartzSync'

// Enable/disable specific sync methods
saveQuartzSyncSettings({
  github: { enabled: true },
  cloudflare: { enabled: false },
  webhook: { enabled: true }
})
```

## Usage

### Basic Sync

The sync functionality is automatically integrated into your ObsNote shapes. When you edit a note and click "Sync Updates", it will:

1. Try the configured sync methods in order of preference
2. Fall back to local storage if all methods fail
3. Provide feedback on the sync status

### Advanced Sync

For more control, you can use the QuartzSync class directly:

```typescript
import { QuartzSync, createQuartzNoteFromShape } from '@/lib/quartzSync'

const sync = new QuartzSync({
  githubToken: 'your_token',
  githubRepo: 'username/repo'
})

const note = createQuartzNoteFromShape(shape)
await sync.smartSync(note)
```

## Troubleshooting

### Common Issues

1. **"No vault configured for sync"**
   - Make sure you've selected a vault in the Obsidian Vault Browser
   - Check that the vault path is properly saved in your session

2. **GitHub API errors**
   - Verify your GitHub token has the correct permissions
   - Check that the repository name is correct (username/repo-name format)

3. **Cloudflare sync failures**
   - Ensure your API key has the necessary permissions
   - Verify the account ID and bucket name are correct

4. **Environment variables not loading**
   - Make sure your `.env.local` file is in the project root
   - Restart your development server after adding new variables

### Debug Mode

Enable debug logging by opening the browser console. The sync process provides detailed logs for troubleshooting.

## Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **GitHub Tokens**: Use fine-grained tokens with minimal required permissions
3. **Webhook Secrets**: Always use strong, unique secrets for webhook authentication
4. **CORS**: Configure CORS properly for API endpoints

## Best Practices

1. **Start with GitHub Integration**: It's the most reliable and well-supported approach
2. **Use Fallbacks**: Always have local storage as a fallback option
3. **Monitor Sync Status**: Check the console logs for sync success/failure
4. **Test Thoroughly**: Verify sync works with different types of content
5. **Backup Important Data**: Don't rely solely on sync for critical content

## Support

For issues or questions:
1. Check the console logs for detailed error messages
2. Verify your environment variables are set correctly
3. Test with a simple note first
4. Check the GitHub repository for updates and issues

## References

- [Quartz Documentation](https://quartz.jzhao.xyz/)
- [Quartz GitHub Repository](https://github.com/jackyzha0/quartz)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
