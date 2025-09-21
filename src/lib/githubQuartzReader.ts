/**
 * GitHub Quartz Reader
 * Reads Quartz content directly from GitHub repository using the GitHub API
 */

export interface GitHubQuartzConfig {
  token: string
  owner: string
  repo: string
  branch?: string
  contentPath?: string
}

export interface GitHubFile {
  name: string
  path: string
  sha: string
  size: number
  url: string
  html_url: string
  git_url: string
  download_url: string
  type: 'file' | 'dir'
  content?: string
  encoding?: string
}

export interface QuartzNoteFromGitHub {
  id: string
  title: string
  content: string
  tags: string[]
  frontmatter: Record<string, any>
  filePath: string
  lastModified: string
  htmlUrl: string
  rawUrl: string
}

export class GitHubQuartzReader {
  private config: GitHubQuartzConfig

  constructor(config: GitHubQuartzConfig) {
    this.config = {
      branch: 'main',
      contentPath: 'content',
      ...config
    }
  }

  /**
   * Get all Markdown files from the Quartz repository
   */
  async getAllNotes(): Promise<QuartzNoteFromGitHub[]> {
    try {
      console.log('🔍 Fetching Quartz notes from GitHub...')
      console.log(`📁 Repository: ${this.config.owner}/${this.config.repo}`)
      console.log(`🌿 Branch: ${this.config.branch}`)
      console.log(`📂 Content path: ${this.config.contentPath}`)

      // Get the content directory
      const contentFiles = await this.getDirectoryContents(this.config.contentPath || '')
      
      // Filter for Markdown files
      const markdownFiles = contentFiles.filter(file => 
        file.type === 'file' && 
        (file.name.endsWith('.md') || file.name.endsWith('.markdown'))
      )

      console.log(`📄 Found ${markdownFiles.length} Markdown files`)

      // Fetch content for each file
      const notes: QuartzNoteFromGitHub[] = []
      for (const file of markdownFiles) {
        try {
          console.log(`🔍 Fetching content for file: ${file.path}`)
          // Get the actual file contents (not just metadata)
          const fileWithContent = await this.getFileContents(file.path)
          const note = await this.getNoteFromFile(fileWithContent)
          if (note) {
            notes.push(note)
          }
        } catch (error) {
          console.warn(`Failed to process file ${file.path}:`, error)
        }
      }

      console.log(`✅ Successfully loaded ${notes.length} notes from GitHub`)
      return notes
    } catch (error) {
      console.error('❌ Failed to fetch notes from GitHub:', error)
      throw error
    }
  }

  /**
   * Get a specific note by file path
   */
  async getNoteByPath(filePath: string): Promise<QuartzNoteFromGitHub | null> {
    try {
      const fullPath = filePath.startsWith(this.config.contentPath || '') 
        ? filePath 
        : `${this.config.contentPath}/${filePath}`

      const file = await this.getFileContents(fullPath)
      return this.getNoteFromFile(file)
    } catch (error) {
      console.error(`Failed to get note ${filePath}:`, error)
      return null
    }
  }

  /**
   * Search notes by query
   */
  async searchNotes(query: string): Promise<QuartzNoteFromGitHub[]> {
    const allNotes = await this.getAllNotes()
    
    const searchTerm = query.toLowerCase()
    return allNotes.filter(note => 
      note.title.toLowerCase().includes(searchTerm) ||
      note.content.toLowerCase().includes(searchTerm) ||
      note.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    )
  }

  /**
   * Get directory contents from GitHub
   */
  private async getDirectoryContents(path: string): Promise<GitHubFile[]> {
    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${this.config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Canvas-Website-Quartz-Reader'
      }
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    const files: GitHubFile[] = await response.json()
    return files
  }

  /**
   * Get file contents from GitHub
   */
  private async getFileContents(filePath: string): Promise<GitHubFile> {
    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${filePath}?ref=${this.config.branch}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${this.config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Canvas-Website-Quartz-Reader'
      }
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Convert GitHub file to Quartz note
   */
  private async getNoteFromFile(file: GitHubFile): Promise<QuartzNoteFromGitHub | null> {
    try {
      console.log(`🔍 Processing file: ${file.path}`)
      console.log(`🔍 File size: ${file.size} bytes`)
      console.log(`🔍 Has content: ${!!file.content}`)
      console.log(`🔍 Content length: ${file.content?.length || 0}`)
      console.log(`🔍 Encoding: ${file.encoding}`)
      
      // Decode base64 content
      let content = ''
      if (file.content) {
        try {
          // Handle different encoding types
          if (file.encoding === 'base64') {
            content = atob(file.content)
          } else {
            // Try direct decoding if not base64
            content = file.content
          }
          console.log(`🔍 Decoded content length: ${content.length}`)
          console.log(`🔍 Content preview: ${content.substring(0, 200)}...`)
        } catch (decodeError) {
          console.error(`🔍 Failed to decode content for ${file.path}:`, decodeError)
          // Try alternative decoding methods
          try {
            content = decodeURIComponent(escape(atob(file.content)))
            console.log(`🔍 Alternative decode successful, length: ${content.length}`)
          } catch (altError) {
            console.error(`🔍 Alternative decode also failed:`, altError)
            return null
          }
        }
      } else {
        console.warn(`🔍 No content available for file: ${file.path}`)
        return null
      }
      
      // Parse frontmatter and content
      const { frontmatter, content: markdownContent } = this.parseMarkdownWithFrontmatter(content)
      console.log(`🔍 Parsed markdown content length: ${markdownContent.length}`)
      console.log(`🔍 Frontmatter keys: ${Object.keys(frontmatter).join(', ')}`)
      
      // Extract title
      const title = frontmatter.title || this.extractTitleFromPath(file.name) || 'Untitled'
      
      // Extract tags
      const tags = this.extractTags(frontmatter, markdownContent)
      
      // Generate note ID
      const id = this.generateNoteId(file.path, title)

      const result = {
        id,
        title,
        content: markdownContent,
        tags,
        frontmatter,
        filePath: file.path,
        lastModified: file.sha, // Using SHA as last modified indicator
        htmlUrl: file.html_url,
        rawUrl: file.download_url || file.git_url
      }
      
      console.log(`🔍 Final note: ${title} (${markdownContent.length} chars)`)
      return result
    } catch (error) {
      console.error(`Failed to parse file ${file.path}:`, error)
      return null
    }
  }

  /**
   * Parse Markdown content with frontmatter
   */
  private parseMarkdownWithFrontmatter(content: string): { frontmatter: Record<string, any>, content: string } {
    console.log(`🔍 Parsing markdown with frontmatter, content length: ${content.length}`)
    
    // More flexible frontmatter regex that handles different formats
    const frontmatterRegex = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/m
    const match = content.match(frontmatterRegex)
    
    if (match) {
      const frontmatterText = match[1]
      const markdownContent = match[2].trim() // Remove leading/trailing whitespace
      
      console.log(`🔍 Found frontmatter, length: ${frontmatterText.length}`)
      console.log(`🔍 Markdown content length: ${markdownContent.length}`)
      console.log(`🔍 Markdown preview: ${markdownContent.substring(0, 100)}...`)
      
      // Parse YAML frontmatter (simplified but more robust)
      const frontmatter: Record<string, any> = {}
      const lines = frontmatterText.split(/\r?\n/)
      
      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine || trimmedLine.startsWith('#')) continue // Skip empty lines and comments
        
        const colonIndex = trimmedLine.indexOf(':')
        if (colonIndex > 0) {
          const key = trimmedLine.substring(0, colonIndex).trim()
          let value = trimmedLine.substring(colonIndex + 1).trim()
          
          // Remove quotes
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
          }
          
          // Parse arrays
          if (value.startsWith('[') && value.endsWith(']')) {
            const arrayValue = value.slice(1, -1).split(',').map(item => 
              item.trim().replace(/^["']|["']$/g, '')
            )
            frontmatter[key] = arrayValue
            continue
          }
          
          // Parse boolean values
          if (value.toLowerCase() === 'true') {
            frontmatter[key] = true
          } else if (value.toLowerCase() === 'false') {
            frontmatter[key] = false
          } else {
            frontmatter[key] = value
          }
        }
      }
      
      console.log(`🔍 Parsed frontmatter:`, frontmatter)
      return { frontmatter, content: markdownContent }
    }
    
    console.log(`🔍 No frontmatter found, using entire content`)
    return { frontmatter: {}, content: content.trim() }
  }

  /**
   * Extract title from file path
   */
  private extractTitleFromPath(fileName: string): string {
    return fileName
      .replace(/\.(md|markdown)$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
  }

  /**
   * Extract tags from frontmatter and content
   */
  private extractTags(frontmatter: Record<string, any>, content: string): string[] {
    const tags: string[] = []
    
    // From frontmatter
    if (frontmatter.tags) {
      if (Array.isArray(frontmatter.tags)) {
        tags.push(...frontmatter.tags)
      } else if (typeof frontmatter.tags === 'string') {
        tags.push(frontmatter.tags)
      }
    }
    
    // From content (hashtags)
    const hashtagMatches = content.match(/#[\w-]+/g)
    if (hashtagMatches) {
      tags.push(...hashtagMatches.map(tag => tag.substring(1)))
    }
    
    return [...new Set(tags)] // Remove duplicates
  }

  /**
   * Generate note ID
   */
  private generateNoteId(filePath: string, title: string): string {
    // Use filePath as primary identifier, with title as fallback for uniqueness
    const baseId = filePath || title
    return baseId
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase()
  }

  /**
   * Validate GitHub configuration
   */
  static validateConfig(config: Partial<GitHubQuartzConfig>): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (!config.token) {
      errors.push('GitHub token is required')
    }
    
    if (!config.owner) {
      errors.push('Repository owner is required')
    }
    
    if (!config.repo) {
      errors.push('Repository name is required')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
}
