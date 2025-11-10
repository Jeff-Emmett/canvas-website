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
      // Get the content directory
      const contentFiles = await this.getDirectoryContents(this.config.contentPath || '')
      
      // Filter for Markdown files
      const markdownFiles = contentFiles.filter(file => {
        return file.type === 'file' && 
          file.name && 
          (file.name.endsWith('.md') || file.name.endsWith('.markdown'))
      })

      // Fetch content for each file
      const notes: QuartzNoteFromGitHub[] = []
      for (const file of markdownFiles) {
        try {
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
      // Validate file object
      if (!file || !file.path) {
        return null
      }
      
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
        } catch (decodeError) {
          // Try alternative decoding methods
          try {
            content = decodeURIComponent(escape(atob(file.content)))
          } catch (altError) {
            console.error(`Failed to decode content for ${file.path}:`, altError)
            return null
          }
        }
      }
      
      // Parse frontmatter and content
      const { frontmatter, content: markdownContent } = this.parseMarkdownWithFrontmatter(content)
      
      // Extract title
      const fileName = file.name || file.path.split('/').pop() || 'untitled'
      const title = frontmatter.title || this.extractTitleFromPath(fileName) || 'Untitled'
      
      // Extract tags
      const tags = this.extractTags(frontmatter, markdownContent)
      
      // Generate note ID
      const id = this.generateNoteId(file.path, title)

      return {
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
    } catch (error) {
      console.error(`Failed to parse file ${file.path}:`, error)
      return null
    }
  }

  /**
   * Parse Markdown content with frontmatter
   */
  private parseMarkdownWithFrontmatter(content: string): { frontmatter: Record<string, any>, content: string } {
    // More flexible frontmatter regex that handles different formats
    const frontmatterRegex = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/m
    const match = content.match(frontmatterRegex)
    
    if (match) {
      const frontmatterText = match[1]
      const markdownContent = match[2].trim() // Remove leading/trailing whitespace
      
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
      
      return { frontmatter, content: markdownContent }
    }
    
    return { frontmatter: {}, content: content.trim() }
  }

  /**
   * Extract title from file path
   */
  private extractTitleFromPath(fileName: string): string {
    if (!fileName) {
      return 'Untitled'
    }
    
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
