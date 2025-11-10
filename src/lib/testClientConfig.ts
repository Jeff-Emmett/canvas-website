/**
 * Test client configuration
 * This file can be used to test if the client config is working properly
 */

import { getClientConfig, isGitHubConfigured, getGitHubConfig } from './clientConfig'

export function testClientConfig() {
  console.log('🧪 Testing client configuration...')
  
  const config = getClientConfig()
  console.log('📋 Client config:', {
    hasGithubToken: !!config.githubToken,
    hasQuartzRepo: !!config.quartzRepo,
    githubTokenLength: config.githubToken?.length || 0,
    quartzRepo: config.quartzRepo
  })
  
  const isConfigured = isGitHubConfigured()
  console.log('✅ GitHub configured:', isConfigured)
  
  const githubConfig = getGitHubConfig()
  console.log('🔧 GitHub config:', githubConfig)
  
  return {
    config,
    isConfigured,
    githubConfig
  }
}

// Auto-run test in browser
if (typeof window !== 'undefined') {
  testClientConfig()
}
