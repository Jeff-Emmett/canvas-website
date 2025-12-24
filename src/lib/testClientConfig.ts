/**
 * Test client configuration
 * This file can be used to test if the client config is working properly
 */

import { getClientConfig, isGitHubConfigured, getGitHubConfig } from './clientConfig'

export function testClientConfig() {
  
  const config = getClientConfig()
    hasGithubToken: !!config.githubToken,
    hasQuartzRepo: !!config.quartzRepo,
    githubTokenLength: config.githubToken?.length || 0,
    quartzRepo: config.quartzRepo
  })
  
  const isConfigured = isGitHubConfigured()
  
  const githubConfig = getGitHubConfig()
  
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
