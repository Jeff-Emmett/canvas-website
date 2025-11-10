/**
 * Obsidian Vault Importer
 * Handles reading and processing markdown files from a local Obsidian vault
 */

import { GitHubQuartzReader, GitHubQuartzConfig } from './githubQuartzReader'
import { getClientConfig } from './clientConfig'

export interface ObsidianObsNote {
  id: string
  title: string
  content: string
  filePath: string
  tags: string[]
  created: Date | string
  modified: Date | string
  links: string[]
  backlinks: string[]
  frontmatter: Record<string, any>
  vaultPath?: string
}

export interface FolderNode {
  name: string
  path: string
  children: FolderNode[]
  notes: ObsidianObsNote[]
  isExpanded: boolean
  level: number
}

export interface ObsidianVault {
  name: string
  path: string
  obs_notes: ObsidianObsNote[]
  totalObsNotes: number
  lastImported: Date
  folderTree: FolderNode
}

export interface ObsidianVaultRecord {
  id: string
  typeName: 'obsidian_vault'
  name: string
  path: string
  obs_notes: ObsidianObsNote[]
  totalObsNotes: number
  lastImported: Date
  folderTree: FolderNode
  meta: Record<string, any>
}

export class ObsidianImporter {
  private vault: ObsidianVault | null = null

  /**
   * Import notes from a directory (simulated file picker for now)
   * In a real implementation, this would use the File System Access API
   */
  async importFromDirectory(directoryPath: string): Promise<ObsidianVault> {
    try {
      // For now, we'll simulate this with a demo vault
      // In a real implementation, you'd use the File System Access API
      
      // Simulate reading files (in real implementation, use File System Access API)
      const mockObsNotes = await this.createMockObsNotes()
      
      this.vault = {
        name: this.extractVaultName(directoryPath),
        path: directoryPath,
        obs_notes: mockObsNotes,
        totalObsNotes: mockObsNotes.length,
        lastImported: new Date(),
        folderTree: this.buildFolderTree(mockObsNotes)
      }

      return this.vault
    } catch (error) {
      console.error('Error importing Obsidian vault:', error)
      throw new Error('Failed to import Obsidian vault')
    }
  }

  /**
   * Import notes from a Quartz URL using GitHub API
   */
  async importFromQuartzUrl(quartzUrl: string): Promise<ObsidianVault> {
    try {
      // Ensure URL has protocol
      const url = quartzUrl.startsWith('http') ? quartzUrl : `https://${quartzUrl}`
      
      // Try to get GitHub repository info from environment or URL
      const githubConfig = this.getGitHubConfigFromUrl(url)
      
      if (githubConfig) {
        const obs_notes = await this.importFromGitHub(githubConfig)
        
        this.vault = {
          name: this.extractVaultNameFromUrl(url),
          path: url,
          obs_notes,
          totalObsNotes: obs_notes.length,
          lastImported: new Date(),
          folderTree: this.buildFolderTree(obs_notes)
        }

        return this.vault
      } else {
        // Fallback to the old method
        const obs_notes = await this.discoverQuartzContent(url)
        
        this.vault = {
          name: this.extractVaultNameFromUrl(url),
          path: url,
          obs_notes,
          totalObsNotes: obs_notes.length,
          lastImported: new Date(),
          folderTree: this.buildFolderTree(obs_notes)
        }

        return this.vault
      }
    } catch (error) {
      console.error('Error importing from Quartz URL:', error)
      throw new Error('Failed to import from Quartz URL')
    }
  }

  /**
   * Import notes using File System Access API (modern browsers)
   */
  async importFromFileSystem(): Promise<ObsidianVault> {
    try {
      // Check if File System Access API is supported
      if (!('showDirectoryPicker' in window)) {
        throw new Error('File System Access API not supported in this browser')
      }

      // Request directory access
      const directoryHandle = await (window as any).showDirectoryPicker({
        mode: 'read'
      })

      const obs_notes: ObsidianObsNote[] = []
      await this.readDirectoryRecursively(directoryHandle, obs_notes, '')

      this.vault = {
        name: directoryHandle.name,
        path: directoryHandle.name, // File System Access API doesn't expose full path
        obs_notes,
        totalObsNotes: obs_notes.length,
        lastImported: new Date(),
        folderTree: this.buildFolderTree(obs_notes)
      }

      return this.vault
    } catch (error) {
      console.error('Error importing Obsidian vault via File System Access API:', error)
      throw new Error('Failed to import Obsidian vault')
    }
  }

  /**
   * Recursively read directory and process markdown files
   */
  private async readDirectoryRecursively(
    directoryHandle: any,
    obs_notes: ObsidianObsNote[],
    relativePath: string
  ): Promise<void> {
    for await (const [name, handle] of directoryHandle.entries()) {
      const currentPath = relativePath ? `${relativePath}/${name}` : name

      if (handle.kind === 'directory') {
        // Skip hidden directories and .obsidian
        if (!name.startsWith('.') && name !== 'node_modules') {
          await this.readDirectoryRecursively(handle, obs_notes, currentPath)
        }
      } else if (handle.kind === 'file' && name.endsWith('.md')) {
        try {
          const file = await handle.getFile()
          const content = await file.text()
          const obs_note = this.parseMarkdownFile(content, currentPath, file.lastModified)
          obs_notes.push(obs_note)
        } catch (error) {
          console.warn(`Failed to read file ${currentPath}:`, error)
        }
      }
    }
  }

  /**
   * Parse a markdown file and extract metadata
   */
  private parseMarkdownFile(content: string, filePath: string, lastModified: number): ObsidianObsNote {
    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    let frontmatter: Record<string, any> = {}
    let body = content

    if (frontmatterMatch) {
      try {
        const frontmatterText = frontmatterMatch[1]
        // Simple YAML parsing (in production, use a proper YAML parser)
        frontmatter = this.parseSimpleYaml(frontmatterText)
        body = frontmatterMatch[2]
      } catch (error) {
        console.warn('Failed to parse frontmatter:', error)
      }
    }

    // Extract title from frontmatter or first heading
    const title = frontmatter.title || this.extractTitle(body) || this.extractFileName(filePath)

    // Extract tags
    const tags = this.extractTags(body, frontmatter)

    // Extract links
    const links = this.extractLinks(body, '')

    // Generate unique ID
    const id = this.generateNoteId(filePath)

    return {
      id,
      title,
      content: body,
      filePath,
      tags,
      created: new Date(frontmatter.created || lastModified),
      modified: new Date(lastModified),
      links,
      backlinks: [], // Would need to be calculated by analyzing all notes
      frontmatter
    }
  }

  /**
   * Extract title from markdown content
   */
  private extractTitle(content: string): string | null {
    const headingMatch = content.match(/^#\s+(.+)$/m)
    return headingMatch ? headingMatch[1].trim() : null
  }

  /**
   * Extract filename without extension
   */
  private extractFileName(filePath: string): string {
    const fileName = filePath.split('/').pop() || filePath
    return fileName.replace(/\.md$/, '')
  }

  /**
   * Extract tags from content and frontmatter
   */
  private extractTags(content: string, frontmatter: Record<string, any>): string[] {
    const tags = new Set<string>()

    // Extract from frontmatter
    if (frontmatter.tags) {
      if (Array.isArray(frontmatter.tags)) {
        frontmatter.tags.forEach((tag: string) => tags.add(tag))
      } else if (typeof frontmatter.tags === 'string') {
        frontmatter.tags.split(',').forEach((tag: string) => tags.add(tag.trim()))
      }
    }

    // Extract from content (#tag format)
    const tagMatches = content.match(/#[a-zA-Z0-9_-]+/g)
    if (tagMatches) {
      tagMatches.forEach(tag => tags.add(tag))
    }

    return Array.from(tags)
  }


  /**
   * Generate unique ID for note
   */
  private generateNoteId(filePath: string): string {
    return `note_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`
  }

  /**
   * Simple YAML parser for frontmatter
   */
  private parseSimpleYaml(yamlText: string): Record<string, any> {
    const result: Record<string, any> = {}
    const lines = yamlText.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const colonIndex = trimmed.indexOf(':')
        if (colonIndex > 0) {
          const key = trimmed.substring(0, colonIndex).trim()
          let value = trimmed.substring(colonIndex + 1).trim()
          
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
          }

          // Parse arrays
          if (value.startsWith('[') && value.endsWith(']')) {
            try {
              value = JSON.parse(value)
            } catch {
              // If JSON parsing fails, treat as string
            }
          }

          result[key] = value
        }
      }
    }

    return result
  }

  /**
   * Extract vault name from path
   */
  private extractVaultName(path: string): string {
    const parts = path.split('/')
    return parts[parts.length - 1] || 'Obsidian Vault'
  }

  /**
   * Create mock obs_notes for demonstration
   */
  private async createMockObsNotes(): Promise<ObsidianObsNote[]> {
    return [
      {
        id: 'note_1',
        title: 'Welcome to Obsidian',
        content: `# Welcome to Obsidian

This is a sample note from your Obsidian vault. You can drag this note onto the canvas to create a new rectangle shape.

## Features
- [[Note Linking]]
- #tags
- [External Links](https://obsidian.md)

## Tasks
- [x] Set up vault
- [ ] Import notes
- [ ] Organize content`,
        filePath: 'Welcome to Obsidian.md',
        tags: ['#welcome', '#getting-started'],
        created: new Date('2024-01-01'),
        modified: new Date('2024-01-15'),
        links: ['Note Linking', 'https://obsidian.md'],
        backlinks: [],
        frontmatter: {
          title: 'Welcome to Obsidian',
          tags: ['welcome', 'getting-started'],
          created: '2024-01-01'
        }
      },
      {
        id: 'note_2',
        title: 'Project Ideas',
        content: `# Project Ideas

A collection of creative project ideas and concepts.

## Web Development
- Canvas-based drawing app
- Real-time collaboration tools
- AI-powered content generation

## Design
- Interactive data visualizations
- User experience improvements
- Mobile-first design patterns`,
        filePath: 'Project Ideas.md',
        tags: ['#projects', '#ideas', '#development'],
        created: new Date('2024-01-05'),
        modified: new Date('2024-01-20'),
        links: [],
        backlinks: [],
        frontmatter: {
          title: 'Project Ideas',
          tags: ['projects', 'ideas', 'development']
        }
      },
      {
        id: 'note_3',
        title: 'Meeting Notes',
        content: `# Meeting Notes - January 15, 2024

## Attendees
- John Doe
- Jane Smith
- Bob Johnson

## Agenda
1. Project status update
2. Budget review
3. Timeline discussion

## Action Items
- [ ] Complete budget analysis by Friday
- [ ] Schedule follow-up meeting
- [ ] Update project documentation`,
        filePath: 'Meetings/2024-01-15 Meeting Notes.md',
        tags: ['#meetings', '#2024'],
        created: new Date('2024-01-15'),
        modified: new Date('2024-01-15'),
        links: [],
        backlinks: [],
        frontmatter: {
          title: 'Meeting Notes - January 15, 2024',
          date: '2024-01-15',
          tags: ['meetings', '2024']
        }
      }
    ]
  }

  /**
   * Get the current vault
   */
  getVault(): ObsidianVault | null {
    return this.vault
  }

  /**
   * Search obs_notes in the vault
   */
  searchObsNotes(query: string): ObsidianObsNote[] {
    if (!this.vault) return []

    const lowercaseQuery = query.toLowerCase()
    
    return this.vault.obs_notes.filter(obs_note => 
      obs_note.title.toLowerCase().includes(lowercaseQuery) ||
      obs_note.content.toLowerCase().includes(lowercaseQuery) ||
      obs_note.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    )
  }

  /**
   * Get obs_notes by tag
   */
  getObsNotesByTag(tag: string): ObsidianObsNote[] {
    if (!this.vault) return []

    return this.vault.obs_notes.filter(obs_note => 
      obs_note.tags.some(noteTag => noteTag.toLowerCase().includes(tag.toLowerCase()))
    )
  }

  /**
   * Get all unique tags
   */
  getAllTags(): string[] {
    if (!this.vault) return []

    const allTags = new Set<string>()
    this.vault.obs_notes.forEach(obs_note => {
      obs_note.tags.forEach(tag => allTags.add(tag))
    })

    return Array.from(allTags).sort()
  }

  /**
   * Build folder tree structure from obs_notes
   */
  buildFolderTree(obs_notes: ObsidianObsNote[]): FolderNode {
    const root: FolderNode = {
      name: 'Root',
      path: '',
      children: [],
      notes: [],
      isExpanded: true,
      level: 0
    }

    // Group notes by their folder paths
    const folderMap = new Map<string, { folders: string[], notes: ObsidianObsNote[] }>()
    
    obs_notes.forEach(note => {
      const pathParts = this.parseFilePath(note.filePath)
      const folderKey = pathParts.folders.join('/')
      
      if (!folderMap.has(folderKey)) {
        folderMap.set(folderKey, { folders: pathParts.folders, notes: [] })
      }
      folderMap.get(folderKey)!.notes.push(note)
    })

    // Build the tree structure
    folderMap.forEach(({ folders, notes }) => {
      this.addFolderToTree(root, folders, notes)
    })

    return root
  }

  /**
   * Parse file path into folder structure
   */
  private parseFilePath(filePath: string): { folders: string[], fileName: string } {
    // Handle both local paths and URLs
    let pathToParse = filePath
    
    if (filePath.startsWith('http')) {
      // Extract pathname from URL
      try {
        const url = new URL(filePath)
        pathToParse = url.pathname.replace(/^\//, '')
      } catch (e) {
        console.warn('Invalid URL:', filePath)
        return { folders: [], fileName: filePath }
      }
    }

    // Split path and filter out empty parts
    const parts = pathToParse.split('/').filter(part => part.length > 0)
    
    if (parts.length === 0) {
      return { folders: [], fileName: filePath }
    }

    const fileName = parts[parts.length - 1]
    const folders = parts.slice(0, -1)

    return { folders, fileName }
  }

  /**
   * Add folder to tree structure
   */
  private addFolderToTree(root: FolderNode, folderPath: string[], notes: ObsidianObsNote[]): void {
    let current = root
    
    for (let i = 0; i < folderPath.length; i++) {
      const folderName = folderPath[i]
      let existingFolder = current.children.find(child => child.name === folderName)
      
      if (!existingFolder) {
        const currentPath = folderPath.slice(0, i + 1).join('/')
        existingFolder = {
          name: folderName,
          path: currentPath,
          children: [],
          notes: [],
          isExpanded: false,
          level: i + 1
        }
        current.children.push(existingFolder)
      }
      
      current = existingFolder
    }
    
    // Add notes to the final folder
    current.notes.push(...notes)
  }

  /**
   * Get all notes from a folder tree (recursive)
   */
  getAllNotesFromTree(folder: FolderNode): ObsidianObsNote[] {
    let notes = [...folder.notes]
    
    folder.children.forEach(child => {
      notes.push(...this.getAllNotesFromTree(child))
    })
    
    return notes
  }

  /**
   * Find folder by path in tree
   */
  findFolderByPath(root: FolderNode, path: string): FolderNode | null {
    if (root.path === path) {
      return root
    }
    
    for (const child of root.children) {
      const found = this.findFolderByPath(child, path)
      if (found) {
        return found
      }
    }
    
    return null
  }

  /**
   * Convert vault to Automerge record format
   */
  vaultToRecord(vault: ObsidianVault): ObsidianVaultRecord {
    return {
      id: `obsidian_vault:${vault.name}`,
      typeName: 'obsidian_vault',
      name: vault.name,
      path: vault.path,
      obs_notes: vault.obs_notes,
      totalObsNotes: vault.totalObsNotes,
      lastImported: vault.lastImported,
      folderTree: vault.folderTree,
      meta: {}
    }
  }

  /**
   * Convert Automerge record to vault format
   */
  recordToVault(record: ObsidianVaultRecord): ObsidianVault {
    return {
      name: record.name,
      path: record.path,
      obs_notes: record.obs_notes,
      totalObsNotes: record.totalObsNotes,
      lastImported: record.lastImported,
      folderTree: record.folderTree
    }
  }

  /**
   * Search notes in the current vault
   */
  async searchNotes(query: string): Promise<ObsidianObsNote[]> {
    if (!this.vault) return []
    
    // If this is a GitHub-based Quartz vault, use GitHub search
    if (this.vault.path && (this.vault.path.startsWith('http') || this.vault.path.includes('github'))) {
      const githubConfig = this.getGitHubConfigFromUrl(this.vault.path)
      if (githubConfig) {
        try {
          const reader = new GitHubQuartzReader(githubConfig)
          const quartzNotes = await reader.searchNotes(query)
          
          // Convert to Obsidian format
          return quartzNotes.map(note => ({
            id: note.id,
            title: note.title,
            content: note.content,
            filePath: note.filePath,
            tags: note.tags,
            links: [],
            created: new Date().toISOString(),
            modified: note.lastModified,
            vaultPath: githubConfig.owner + '/' + githubConfig.repo,
            backlinks: [],
            frontmatter: note.frontmatter
          }))
        } catch (error) {
          console.error('GitHub search failed, falling back to local search:', error)
        }
      }
    }
    
    // Fallback to local search
    const searchTerm = query.toLowerCase()
    return this.vault.obs_notes.filter(note => 
      note.title.toLowerCase().includes(searchTerm) ||
      note.content.toLowerCase().includes(searchTerm) ||
      note.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    )
  }

  /**
   * Get GitHub configuration from client config
   */
  private getGitHubConfigFromUrl(_quartzUrl: string): GitHubQuartzConfig | null {
    const config = getClientConfig()
    const githubToken = config.githubToken
    const githubRepo = config.quartzRepo
    
    if (!githubToken || !githubRepo) {
      return null
    }
    
    if (githubToken === 'your_github_token_here' || githubRepo === 'your_username/your-quartz-repo') {
      return null
    }
    
    const [owner, repo] = githubRepo.split('/')
    if (!owner || !repo) {
      return null
    }
    
    return {
      token: githubToken,
      owner,
      repo,
      branch: config.quartzBranch || 'main',
      contentPath: 'content'
    }
  }

  /**
   * Import notes from GitHub repository
   */
  private async importFromGitHub(config: GitHubQuartzConfig): Promise<ObsidianObsNote[]> {
    try {
      const reader = new GitHubQuartzReader(config)
      const quartzNotes = await reader.getAllNotes()
      
      // Convert Quartz notes to Obsidian format and deduplicate by ID
      const notesMap = new Map<string, ObsidianObsNote>()
      
      quartzNotes
        .filter(note => note != null) // Filter out any null/undefined notes
        .forEach(note => {
          const obsNote: ObsidianObsNote = {
            id: note.id || 'unknown',
            title: note.title || 'Untitled',
            content: note.content || '',
            filePath: note.filePath || 'unknown',
            tags: note.tags || [],
            links: [], // Will be populated if needed
            created: new Date(),
            modified: new Date(note.lastModified || new Date().toISOString()),
            backlinks: [],
            frontmatter: note.frontmatter || {},
            vaultPath: config.owner + '/' + config.repo,
          }
          
          // If we already have a note with this ID, keep the one with the longer content
          // (assuming it's more complete) or prefer the one without quotes in the filename
          const existing = notesMap.get(obsNote.id)
          if (existing) {
            console.warn(`Duplicate note ID found: ${obsNote.id}. File paths: ${existing.filePath} vs ${obsNote.filePath}`)
            
            // Prefer the note without quotes in the filename
            const existingHasQuotes = existing.filePath.includes('"')
            const currentHasQuotes = obsNote.filePath.includes('"')
            
            if (currentHasQuotes && !existingHasQuotes) {
              return // Keep the existing one
            } else if (!currentHasQuotes && existingHasQuotes) {
              notesMap.set(obsNote.id, obsNote)
            } else {
              // Both have or don't have quotes, prefer the one with more content
              if (obsNote.content.length > existing.content.length) {
                notesMap.set(obsNote.id, obsNote)
              }
            }
          } else {
            notesMap.set(obsNote.id, obsNote)
          }
        })
      
      const uniqueNotes = Array.from(notesMap.values())
      
      return uniqueNotes
    } catch (error) {
      console.error('Failed to import from GitHub:', error)
      throw error
    }
  }

  /**
   * Discover content from a Quartz site (fallback method)
   */
  private async discoverQuartzContent(baseUrl: string): Promise<ObsidianObsNote[]> {
    const obs_notes: ObsidianObsNote[] = []
    
    try {
      // Try to find content through common Quartz patterns
      const contentUrls = await this.findQuartzContentUrls(baseUrl)
      
      if (contentUrls.length === 0) {
        return obs_notes
      }
      
      for (const contentUrl of contentUrls) {
        try {
          const response = await fetch(contentUrl)
          if (!response.ok) {
            continue
          }
          
          const content = await response.text()
          const obs_note = this.parseQuartzMarkdown(content, contentUrl, baseUrl)
          
          // Add all notes regardless of content length
          obs_notes.push(obs_note)
        } catch (error) {
          // Silently skip failed fetches
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to discover Quartz content:', error)
    }
    
    return obs_notes
  }

  /**
   * Find content URLs from a Quartz site
   */
  private async findQuartzContentUrls(baseUrl: string): Promise<string[]> {
    const urls: string[] = []
    
    try {
      // First, try to fetch the main page to discover content
      console.log('🔍 Fetching main page to discover content structure...')
      const mainPageResponse = await fetch(baseUrl)
      if (mainPageResponse.ok) {
        const mainPageContent = await mainPageResponse.text()
        urls.push(baseUrl) // Always include the main page
        
        // Look for navigation links and content links in the main page
        const discoveredUrls = this.extractContentUrlsFromPage(mainPageContent, baseUrl)
        urls.push(...discoveredUrls)
      }

      // Try to find a sitemap
      const sitemapUrl = `${baseUrl}/sitemap.xml`
      try {
        const response = await fetch(sitemapUrl)
        if (response.ok) {
          const sitemap = await response.text()
          const urlMatches = sitemap.match(/<loc>(.*?)<\/loc>/g)
          if (urlMatches) {
            const sitemapUrls = urlMatches.map(match => 
              match.replace(/<\/?loc>/g, '').trim()
            ).filter(url => url.endsWith('.html') || url.endsWith('.md') || url.includes(baseUrl))
            urls.push(...sitemapUrls)
          }
        }
      } catch (error) {
        console.warn('Failed to fetch sitemap:', error)
      }

      // Try to find content through common Quartz patterns
      const commonPaths = [
        '/', // Root page
        '/index.html',
        '/about',
        '/contact',
        '/notes',
        '/posts',
        '/content',
        '/pages',
        '/blog',
        '/articles'
      ]
      
      for (const path of commonPaths) {
        try {
          const url = path === '/' ? baseUrl : `${baseUrl}${path}`
          const response = await fetch(url)
          if (response.ok) {
            urls.push(url)
          }
        } catch (error) {
          // Ignore individual path failures
        }
      }
    } catch (error) {
      console.warn('Failed to find Quartz content URLs:', error)
    }
    
    // Remove duplicates and limit results
    const uniqueUrls = [...new Set(urls)]
    return uniqueUrls.slice(0, 50) // Limit to 50 pages to avoid overwhelming
  }

  /**
   * Extract content URLs from a page's HTML content
   */
  private extractContentUrlsFromPage(content: string, baseUrl: string): string[] {
    const urls: string[] = []
    
    try {
      // Look for navigation links
      const navLinks = content.match(/<nav[^>]*>[\s\S]*?<\/nav>/gi)
      if (navLinks) {
        navLinks.forEach(nav => {
          const links = nav.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)
          if (links) {
            links.forEach(link => {
              const urlMatch = link.match(/href=["']([^"']+)["']/i)
              if (urlMatch) {
                const url = urlMatch[1]
                if (url.startsWith('/') && !url.startsWith('//')) {
                  urls.push(`${baseUrl}${url}`)
                } else if (url.startsWith(baseUrl)) {
                  urls.push(url)
                }
              }
            })
          }
        })
      }
      
      // Look for any internal links
      const allLinks = content.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)
      if (allLinks) {
        allLinks.forEach(link => {
          const urlMatch = link.match(/href=["']([^"']+)["']/i)
          if (urlMatch) {
            const url = urlMatch[1]
            if (url.startsWith('/') && !url.startsWith('//') && !url.includes('#')) {
              urls.push(`${baseUrl}${url}`)
            } else if (url.startsWith(baseUrl) && !url.includes('#')) {
              urls.push(url)
            }
          }
        })
      }
    } catch (error) {
      console.warn('Error extracting URLs from page:', error)
    }
    
    return urls
  }

  /**
   * Parse Quartz markdown content
   */
  private parseQuartzMarkdown(content: string, url: string, baseUrl: string): ObsidianObsNote {
    // Extract title from URL or content
    const title = this.extractTitleFromUrl(url) || this.extractTitleFromContent(content)
    
    // Parse frontmatter
    const frontmatter = this.parseFrontmatter(content)
    
    // Extract tags
    const tags = this.extractTags(content, frontmatter)
    
    // Extract links
    const links = this.extractLinks(content, baseUrl)
    
    // Clean content (remove frontmatter and convert HTML to markdown-like text)
    let cleanContent = this.removeFrontmatter(content)
    
    // If content is HTML, convert it to a more readable format
    if (cleanContent.includes('<html') || cleanContent.includes('<body')) {
      cleanContent = this.convertHtmlToMarkdown(cleanContent)
    }
    
    return {
      id: this.generateId(url),
      title,
      content: cleanContent,
      filePath: url,
      tags,
      created: new Date(),
      modified: new Date(),
      links,
      backlinks: [],
      frontmatter
    }
  }

  /**
   * Convert HTML content to markdown-like text
   */
  private convertHtmlToMarkdown(html: string): string {
    let text = html
    
    // Remove script, style, and other non-content tags
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    text = text.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    
    // Try to extract main content area
    const mainMatch = text.match(/<main[^>]*>(.*?)<\/main>/is)
    if (mainMatch) {
      text = mainMatch[1]
    } else {
      // Try to find article or content div
      const articleMatch = text.match(/<article[^>]*>(.*?)<\/article>/is)
      if (articleMatch) {
        text = articleMatch[1]
      } else {
        // Try multiple content div patterns
        const contentPatterns = [
          /<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/is,
          /<div[^>]*class="[^"]*main[^"]*"[^>]*>(.*?)<\/div>/is,
          /<div[^>]*class="[^"]*post[^"]*"[^>]*>(.*?)<\/div>/is,
          /<div[^>]*class="[^"]*article[^"]*"[^>]*>(.*?)<\/div>/is,
          /<div[^>]*id="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/is,
          /<div[^>]*id="[^"]*main[^"]*"[^>]*>(.*?)<\/div>/is
        ]
        
        for (const pattern of contentPatterns) {
          const match = text.match(pattern)
          if (match) {
            text = match[1]
            break
          }
        }
      }
    }
    
    // Convert headers
    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    text = text.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    text = text.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
    
    // Convert paragraphs
    text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    
    // Convert links
    text = text.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    
    // Convert lists
    text = text.replace(/<ul[^>]*>/gi, '')
    text = text.replace(/<\/ul>/gi, '\n')
    text = text.replace(/<ol[^>]*>/gi, '')
    text = text.replace(/<\/ol>/gi, '\n')
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    
    // Convert emphasis
    text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    
    // Convert code
    text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    text = text.replace(/<pre[^>]*>(.*?)<\/pre>/gi, '```\n$1\n```\n')
    
    // Convert blockquotes
    text = text.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
    
    // Convert line breaks
    text = text.replace(/<br[^>]*>/gi, '\n')
    
    // Remove remaining HTML tags
    text = text.replace(/<[^>]+>/g, '')
    
    // Decode HTML entities
    text = text.replace(/&amp;/g, '&')
    text = text.replace(/&lt;/g, '<')
    text = text.replace(/&gt;/g, '>')
    text = text.replace(/&quot;/g, '"')
    text = text.replace(/&#39;/g, "'")
    text = text.replace(/&nbsp;/g, ' ')
    
    // Clean up whitespace
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n')
    text = text.replace(/^\s+|\s+$/g, '') // Trim start and end
    text = text.trim()
    
    // If we still don't have much content, try to extract any text from the original HTML
    if (text.length < 50) {
      let fallbackText = html
      
      // Remove script, style, and other non-content tags
      fallbackText = fallbackText.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      fallbackText = fallbackText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      fallbackText = fallbackText.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      fallbackText = fallbackText.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      fallbackText = fallbackText.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      fallbackText = fallbackText.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      
      // Convert basic HTML elements
      fallbackText = fallbackText.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '# $1\n\n')
      fallbackText = fallbackText.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      fallbackText = fallbackText.replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n')
      fallbackText = fallbackText.replace(/<span[^>]*>(.*?)<\/span>/gi, '$1')
      fallbackText = fallbackText.replace(/<[^>]+>/g, '')
      fallbackText = fallbackText.replace(/&amp;/g, '&')
      fallbackText = fallbackText.replace(/&lt;/g, '<')
      fallbackText = fallbackText.replace(/&gt;/g, '>')
      fallbackText = fallbackText.replace(/&quot;/g, '"')
      fallbackText = fallbackText.replace(/&#39;/g, "'")
      fallbackText = fallbackText.replace(/&nbsp;/g, ' ')
      fallbackText = fallbackText.replace(/\n\s*\n\s*\n/g, '\n\n')
      fallbackText = fallbackText.trim()
      
      if (fallbackText.length > text.length) {
        text = fallbackText
      }
    }
    
    // Final fallback: if we still don't have content, try to extract any text from the body
    if (text.length < 20) {
      const bodyMatch = html.match(/<body[^>]*>(.*?)<\/body>/is)
      if (bodyMatch) {
        let bodyText = bodyMatch[1]
        // Remove all HTML tags
        bodyText = bodyText.replace(/<[^>]+>/g, '')
        // Decode HTML entities
        bodyText = bodyText.replace(/&amp;/g, '&')
        bodyText = bodyText.replace(/&lt;/g, '<')
        bodyText = bodyText.replace(/&gt;/g, '>')
        bodyText = bodyText.replace(/&quot;/g, '"')
        bodyText = bodyText.replace(/&#39;/g, "'")
        bodyText = bodyText.replace(/&nbsp;/g, ' ')
        bodyText = bodyText.replace(/\s+/g, ' ').trim()
        
        if (bodyText.length > text.length) {
          text = bodyText
        }
      }
    }
    
    return text
  }

  /**
   * Extract title from URL
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const path = urlObj.pathname
      const segments = path.split('/').filter(segment => segment)
      const lastSegment = segments[segments.length - 1] || 'index'
      
      let title = lastSegment
        .replace(/\.(html|md)$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
      
      // If title is just "index" or empty, try to use the domain name
      if (title === 'Index' || title === '') {
        title = urlObj.hostname.replace('www.', '').replace('.com', '').replace('.xyz', '')
      }
      
      return title
    } catch (error) {
      // Fallback if URL parsing fails
      return url.split('/').pop() || 'Untitled'
    }
  }

  /**
   * Extract title from content
   */
  private extractTitleFromContent(content: string): string {
    // Look for title tag first
    const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i)
    if (titleMatch) {
      let title = titleMatch[1].replace(/<[^>]*>/g, '').trim()
      // Clean up common title suffixes
      title = title.replace(/\s*-\s*.*$/, '') // Remove " - Site Name" suffix
      title = title.replace(/\s*\|\s*.*$/, '') // Remove " | Site Name" suffix
      if (title && title !== 'Untitled') {
        return title
      }
    }
    
    // Look for h1 tag
    const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i)
    if (h1Match) {
      return h1Match[1].replace(/<[^>]*>/g, '').trim()
    }
    
    // Look for first heading
    const headingMatch = content.match(/^#\s+(.+)$/m)
    if (headingMatch) {
      return headingMatch[1].trim()
    }
    
    return 'Untitled'
  }

  /**
   * Extract vault name from URL
   */
  private extractVaultNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace('www.', '')
    } catch (error) {
      return 'Quartz Vault'
    }
  }

  /**
   * Generate ID from URL
   */
  private generateId(url: string): string {
    return url.replace(/[^a-zA-Z0-9]/g, '_')
  }

  /**
   * Parse frontmatter from content
   */
  private parseFrontmatter(content: string): Record<string, any> {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
    if (frontmatterMatch) {
      return this.parseSimpleYaml(frontmatterMatch[1])
    }
    return {}
  }

  /**
   * Remove frontmatter from content
   */
  private removeFrontmatter(content: string): string {
    return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '')
  }

  /**
   * Extract links from content with base URL
   */
  private extractLinks(content: string, baseUrl: string): string[] {
    const links: string[] = []
    
    // Extract markdown links [text](url)
    const markdownLinks = content.match(/\[([^\]]+)\]\(([^)]+)\)/g)
    if (markdownLinks) {
      markdownLinks.forEach(link => {
        const urlMatch = link.match(/\[([^\]]+)\]\(([^)]+)\)/)
        if (urlMatch) {
          const url = urlMatch[2]
          if (url.startsWith('http') || url.startsWith('/')) {
            links.push(url.startsWith('/') ? `${baseUrl}${url}` : url)
          }
        }
      })
    }
    
    // Extract HTML links <a href="url">
    const htmlLinks = content.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)
    if (htmlLinks) {
      htmlLinks.forEach(link => {
        const urlMatch = link.match(/href=["']([^"']+)["']/i)
        if (urlMatch) {
          const url = urlMatch[1]
          if (url.startsWith('http') || url.startsWith('/')) {
            links.push(url.startsWith('/') ? `${baseUrl}${url}` : url)
          }
        }
      })
    }
    
    return links
  }
}
