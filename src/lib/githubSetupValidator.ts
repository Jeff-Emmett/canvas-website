/**
 * GitHub Setup Validator
 * Helps users validate their GitHub integration setup
 */

import { getClientConfig } from './clientConfig'

export interface GitHubSetupStatus {
  isValid: boolean
  issues: string[]
  warnings: string[]
  suggestions: string[]
}

export function validateGitHubSetup(): GitHubSetupStatus {
  const issues: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []

  // Check for required environment variables using client config
  const config = getClientConfig()
  const githubToken = config.githubToken
  const quartzRepo = config.quartzRepo

  if (!githubToken) {
    issues.push('NEXT_PUBLIC_GITHUB_TOKEN is not set')
    suggestions.push('Create a GitHub Personal Access Token and add it to your .env.local file')
  } else if (githubToken === 'your_github_token_here') {
    issues.push('NEXT_PUBLIC_GITHUB_TOKEN is still set to placeholder value')
    suggestions.push('Replace the placeholder with your actual GitHub token')
  }

  if (!quartzRepo) {
    issues.push('NEXT_PUBLIC_QUARTZ_REPO is not set')
    suggestions.push('Add your Quartz repository name (format: username/repo-name) to .env.local')
  } else if (quartzRepo === 'your_username/your-quartz-repo') {
    issues.push('NEXT_PUBLIC_QUARTZ_REPO is still set to placeholder value')
    suggestions.push('Replace the placeholder with your actual repository name')
  } else if (!quartzRepo.includes('/')) {
    issues.push('NEXT_PUBLIC_QUARTZ_REPO format is invalid')
    suggestions.push('Use format: username/repository-name')
  }

  // Check for optional but recommended settings
  const quartzBranch = config.quartzBranch
  if (!quartzBranch) {
    warnings.push('NEXT_PUBLIC_QUARTZ_BRANCH not set, defaulting to "main"')
  }

  // Validate GitHub token format (basic check)
  if (githubToken && githubToken !== 'your_github_token_here') {
    if (!githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
      warnings.push('GitHub token format looks unusual')
      suggestions.push('Make sure you copied the token correctly from GitHub')
    }
  }

  // Validate repository name format
  if (quartzRepo && quartzRepo !== 'your_username/your-quartz-repo' && quartzRepo.includes('/')) {
    const [owner, repo] = quartzRepo.split('/')
    if (!owner || !repo) {
      issues.push('Invalid repository name format')
      suggestions.push('Use format: username/repository-name')
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    suggestions
  }
}

export function getGitHubSetupInstructions(): string[] {
  return [
    '1. Create a GitHub Personal Access Token:',
    '   - Go to https://github.com/settings/tokens',
    '   - Click "Generate new token" → "Generate new token (classic)"',
    '   - Select "repo" and "workflow" scopes',
    '   - Copy the token immediately',
    '',
    '2. Set up your Quartz repository:',
    '   - Create a new repository or use an existing one',
    '   - Set up Quartz in that repository',
    '   - Enable GitHub Pages in repository settings',
    '',
    '3. Configure environment variables:',
    '   - Create a .env.local file in your project root',
    '   - Add NEXT_PUBLIC_GITHUB_TOKEN=your_token_here',
    '   - Add NEXT_PUBLIC_QUARTZ_REPO=username/repo-name',
    '',
    '4. Test the integration:',
    '   - Start your development server',
    '   - Import or create notes',
    '   - Edit a note and click "Sync Updates"',
    '   - Check your GitHub repository for changes'
  ]
}

export function logGitHubSetupStatus(): void {
  const status = validateGitHubSetup()
  
  
}
