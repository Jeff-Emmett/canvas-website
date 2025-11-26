/**
 * AI Orchestrator Client
 * Smart routing between local RS 8000 CPU and RunPod GPU
 */

export interface AIJob {
  job_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  result?: any
  cost?: number
  provider?: string
  processing_time?: number
  error?: string
}

export interface TextGenerationOptions {
  model?: string
  priority?: 'low' | 'normal' | 'high'
  userId?: string
  wait?: boolean
}

export interface ImageGenerationOptions {
  model?: string
  priority?: 'low' | 'normal' | 'high'
  size?: string
  userId?: string
  wait?: boolean
}

export interface VideoGenerationOptions {
  model?: string
  duration?: number
  userId?: string
  wait?: boolean
}

export interface CodeGenerationOptions {
  language?: string
  priority?: 'low' | 'normal' | 'high'
  userId?: string
  wait?: boolean
}

export interface QueueStatus {
  queues: {
    text_local: number
    text_runpod: number
    image_local: number
    image_runpod: number
    video_runpod: number
    code_local: number
  }
  total_pending: number
  timestamp: string
}

export interface CostSummary {
  today: {
    local: number
    runpod: number
    total: number
  }
  this_month: {
    local: number
    runpod: number
    total: number
  }
  breakdown: {
    text: number
    image: number
    video: number
    code: number
  }
}

export class AIOrchestrator {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ||
      import.meta.env.VITE_AI_ORCHESTRATOR_URL ||
      'http://159.195.32.209:8000'
  }

  /**
   * Generate text using LLM
   * Routes to local Ollama (FREE) by default
   */
  async generateText(
    prompt: string,
    options: TextGenerationOptions = {}
  ): Promise<AIJob> {
    const response = await fetch(`${this.baseUrl}/generate/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: options.model || 'llama3-70b',
        priority: options.priority || 'normal',
        user_id: options.userId,
        wait: options.wait || false
      })
    })

    if (!response.ok) {
      throw new Error(`AI Orchestrator error: ${response.status} ${response.statusText}`)
    }

    const job = await response.json() as AIJob

    if (options.wait) {
      return this.waitForJob(job.job_id)
    }

    return job
  }

  /**
   * Generate image
   * Low priority → Local SD CPU (slow but FREE)
   * High priority → RunPod GPU (fast, $0.02)
   */
  async generateImage(
    prompt: string,
    options: ImageGenerationOptions = {}
  ): Promise<AIJob> {
    const response = await fetch(`${this.baseUrl}/generate/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: options.model || 'sdxl',
        priority: options.priority || 'normal',
        size: options.size || '1024x1024',
        user_id: options.userId,
        wait: options.wait || false
      })
    })

    if (!response.ok) {
      throw new Error(`AI Orchestrator error: ${response.status} ${response.statusText}`)
    }

    const job = await response.json() as AIJob

    if (options.wait) {
      return this.waitForJob(job.job_id)
    }

    return job
  }

  /**
   * Generate video
   * Always uses RunPod GPU with Wan2.1 model
   */
  async generateVideo(
    prompt: string,
    options: VideoGenerationOptions = {}
  ): Promise<AIJob> {
    const response = await fetch(`${this.baseUrl}/generate/video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: options.model || 'wan2.1-i2v',
        duration: options.duration || 3,
        user_id: options.userId,
        wait: options.wait || false
      })
    })

    if (!response.ok) {
      throw new Error(`AI Orchestrator error: ${response.status} ${response.statusText}`)
    }

    const job = await response.json() as AIJob

    if (options.wait) {
      return this.waitForJob(job.job_id)
    }

    return job
  }

  /**
   * Generate code
   * Always uses local Ollama with CodeLlama (FREE)
   */
  async generateCode(
    prompt: string,
    options: CodeGenerationOptions = {}
  ): Promise<AIJob> {
    const response = await fetch(`${this.baseUrl}/generate/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        language: options.language || 'python',
        priority: options.priority || 'normal',
        user_id: options.userId,
        wait: options.wait || false
      })
    })

    if (!response.ok) {
      throw new Error(`AI Orchestrator error: ${response.status} ${response.statusText}`)
    }

    const job = await response.json() as AIJob

    if (options.wait) {
      return this.waitForJob(job.job_id)
    }

    return job
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<AIJob> {
    const response = await fetch(`${this.baseUrl}/job/${jobId}`)

    if (!response.ok) {
      throw new Error(`Failed to get job status: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Wait for job to complete
   */
  async waitForJob(
    jobId: string,
    maxAttempts: number = 120,
    pollInterval: number = 1000
  ): Promise<AIJob> {
    for (let i = 0; i < maxAttempts; i++) {
      const job = await this.getJobStatus(jobId)

      if (job.status === 'completed') {
        return job
      }

      if (job.status === 'failed') {
        throw new Error(`Job failed: ${job.error || 'Unknown error'}`)
      }

      // Still queued or processing, wait and retry
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error(`Job ${jobId} timed out after ${maxAttempts} attempts`)
  }

  /**
   * Get current queue status
   */
  async getQueueStatus(): Promise<QueueStatus> {
    const response = await fetch(`${this.baseUrl}/queue/status`)

    if (!response.ok) {
      throw new Error(`Failed to get queue status: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get cost summary
   */
  async getCostSummary(): Promise<CostSummary> {
    const response = await fetch(`${this.baseUrl}/costs/summary`)

    if (!response.ok) {
      throw new Error(`Failed to get cost summary: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Check if AI Orchestrator is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// Singleton instance
export const aiOrchestrator = new AIOrchestrator()

/**
 * Helper function to check if AI Orchestrator is configured and available
 */
export async function isAIOrchestratorAvailable(): Promise<boolean> {
  const url = import.meta.env.VITE_AI_ORCHESTRATOR_URL

  if (!url) {
    console.log('🔍 AI Orchestrator URL not configured')
    return false
  }

  try {
    const available = await aiOrchestrator.isAvailable()
    if (available) {
      console.log('✅ AI Orchestrator is available at', url)
    } else {
      console.log('⚠️ AI Orchestrator configured but not responding at', url)
    }
    return available
  } catch (error) {
    console.log('❌ Error checking AI Orchestrator availability:', error)
    return false
  }
}
