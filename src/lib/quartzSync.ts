/**
 * Quartz Sync Integration
 * Provides multiple approaches for syncing notes back to Quartz sites
 */

export interface QuartzSyncConfig {
  githubToken?: string
  githubRepo?: string
  quartzUrl?: string
  cloudflareApiKey?: string
  cloudflareAccountId?: string
}

export interface QuartzNote {
  id: string
  title: string
  content: string
  tags: string[]
  frontmatter: Record<string, any>
  filePath: string
  lastModified: Date
}

export class QuartzSync {
  private config: QuartzSyncConfig

  constructor(config: QuartzSyncConfig) {
    this.config = config
  }

  /**
   * Approach 1: GitHub API Integration
   * Sync directly to the GitHub repository that powers the Quartz site
   */
  async syncToGitHub(note: QuartzNote): Promise<boolean> {
    if (!this.config.githubToken || !this.config.githubRepo) {
      throw new Error('GitHub token and repository required for GitHub sync')
    }

    try {
      const { githubToken, githubRepo } = this.config
      const [owner, repo] = githubRepo.split('/')
      
      console.log('🔧 GitHub sync details:', {
        owner,
        repo,
        noteTitle: note.title,
        noteFilePath: note.filePath
      })
      
      // Get the current file content to check if it exists
      const filePath = `content/${note.filePath}`
      let sha: string | undefined
      
      console.log('🔍 Checking for existing file:', filePath)
      
      try {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`
        console.log('🌐 Making API call to:', apiUrl)
        
        const existingFile = await fetch(apiUrl, {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        })
        
        console.log('📡 API response status:', existingFile.status)
        
        if (existingFile.ok) {
          const fileData = await existingFile.json() as { sha: string }
          sha = fileData.sha
          console.log('✅ File exists, will update with SHA:', sha)
        } else {
          console.log('ℹ️ File does not exist, will create new one')
        }
      } catch (error) {
        // File doesn't exist, that's okay
        console.log('ℹ️ File does not exist, will create new one:', error)
      }

      // Create the markdown content
      const frontmatter = Object.entries(note.frontmatter)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n')
      
      const content = `---
${frontmatter}
---

${note.content}`

      // Encode content to base64
      const encodedContent = btoa(unescape(encodeURIComponent(content)))

      // Create or update the file
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Update note: ${note.title}`,
            content: encodedContent,
            ...(sha && { sha }) // Include SHA if updating existing file
          })
        }
      )

      if (response.ok) {
        const result = await response.json() as { commit: { sha: string } }
        console.log('✅ Successfully synced note to GitHub:', note.title)
        console.log('📁 File path:', filePath)
        console.log('🔗 Commit SHA:', result.commit.sha)
        return true
      } else {
        const error = await response.text()
        let errorMessage = `GitHub API error: ${response.status}`
        
        try {
          const errorData = JSON.parse(error)
          if (errorData.message) {
            errorMessage += ` - ${errorData.message}`
          }
        } catch (e) {
          errorMessage += ` - ${error}`
        }
        
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('❌ Failed to sync to GitHub:', error)
      throw error
    }
  }

  /**
   * Approach 2: Cloudflare R2 + Durable Objects
   * Use the existing Cloudflare infrastructure for persistent storage
   */
  async syncToCloudflare(note: QuartzNote): Promise<boolean> {
    if (!this.config.cloudflareApiKey || !this.config.cloudflareAccountId) {
      throw new Error('Cloudflare credentials required for Cloudflare sync')
    }

    try {
      // Store in Cloudflare R2
      const response = await fetch('/api/quartz/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.cloudflareApiKey}`
        },
        body: JSON.stringify({
          note,
          accountId: this.config.cloudflareAccountId
        })
      })

      if (response.ok) {
        console.log('✅ Successfully synced note to Cloudflare:', note.title)
        return true
      } else {
        throw new Error(`Cloudflare sync failed: ${response.statusText}`)
      }
    } catch (error) {
      console.error('❌ Failed to sync to Cloudflare:', error)
      throw error
    }
  }

  /**
   * Approach 3: Direct Quartz API (if available)
   * Some Quartz sites may expose APIs for content updates
   */
  async syncToQuartzAPI(note: QuartzNote): Promise<boolean> {
    if (!this.config.quartzUrl) {
      throw new Error('Quartz URL required for API sync')
    }

    try {
      const response = await fetch(`${this.config.quartzUrl}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(note)
      })

      if (response.ok) {
        console.log('✅ Successfully synced note to Quartz API:', note.title)
        return true
      } else {
        throw new Error(`Quartz API error: ${response.statusText}`)
      }
    } catch (error) {
      console.error('❌ Failed to sync to Quartz API:', error)
      throw error
    }
  }

  /**
   * Approach 4: Webhook Integration
   * Send updates to a webhook that can process and sync to Quartz
   */
  async syncViaWebhook(note: QuartzNote, webhookUrl: string): Promise<boolean> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'note_update',
          note,
          timestamp: new Date().toISOString()
        })
      })

      if (response.ok) {
        console.log('✅ Successfully sent note to webhook:', note.title)
        return true
      } else {
        throw new Error(`Webhook error: ${response.statusText}`)
      }
    } catch (error) {
      console.error('❌ Failed to sync via webhook:', error)
      throw error
    }
  }

  /**
   * Smart sync - tries multiple approaches in order of preference
   * Prioritizes GitHub integration for Quartz sites
   */
  async smartSync(note: QuartzNote): Promise<boolean> {
    console.log('🔄 Starting smart sync for note:', note.title)
    console.log('🔧 Sync config available:', {
      hasGitHubToken: !!this.config.githubToken,
      hasGitHubRepo: !!this.config.githubRepo,
      hasCloudflareApiKey: !!this.config.cloudflareApiKey,
      hasCloudflareAccountId: !!this.config.cloudflareAccountId,
      hasQuartzUrl: !!this.config.quartzUrl
    })
    
    // Check if GitHub integration is available and preferred
    if (this.config.githubToken && this.config.githubRepo) {
      try {
        console.log('🔄 Attempting GitHub sync (preferred method)')
        const result = await this.syncToGitHub(note)
        if (result) {
          console.log('✅ GitHub sync successful!')
          return true
        }
      } catch (error) {
        console.warn('⚠️ GitHub sync failed, trying other methods:', error)
        console.warn('⚠️ GitHub sync error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace'
        })
      }
    } else {
      console.log('⚠️ GitHub sync not available - missing token or repo')
    }

    // Fallback to other methods
    const fallbackMethods = [
      () => this.syncToCloudflare(note),
      () => this.syncToQuartzAPI(note)
    ]

    for (const syncMethod of fallbackMethods) {
      try {
        const result = await syncMethod()
        if (result) return true
      } catch (error) {
        console.warn('Sync method failed, trying next:', error)
        continue
      }
    }

    throw new Error('All sync methods failed')
  }
}

/**
 * Utility function to create a Quartz note from an ObsNote shape
 */
export function createQuartzNoteFromShape(shape: any): QuartzNote {
  const title = shape.props.title || 'Untitled'
  const content = shape.props.content || ''
  const tags = shape.props.tags || []
  
  return {
    id: shape.props.noteId || title,
    title,
    content,
    tags: tags.map((tag: string) => tag.replace('#', '')),
    frontmatter: {
      title: title,
      tags: tags.map((tag: string) => tag.replace('#', '')),
      created: new Date().toISOString(),
      modified: new Date().toISOString()
    },
    filePath: `${title}.md`,
    lastModified: new Date()
  }
}
