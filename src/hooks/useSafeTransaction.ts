/**
 * useSafeTransaction - Hooks for interacting with Safe treasury API
 *
 * Provides data fetching and mutation hooks for Safe multisig operations.
 * Talks to the treasury-service REST API on payment-infra.
 */

import { useState, useEffect, useCallback } from 'react'

const TREASURY_API = import.meta.env.VITE_TREASURY_API_URL || 'http://localhost:3006'

// =============================================================================
// Types
// =============================================================================

export interface SafeInfo {
  address: string
  chainId: number
  threshold: number
  owners: string[]
  nonce: number
  modules: string[]
  guard: string
  fallbackHandler: string
  version: string
}

export interface SafeBalance {
  tokenAddress: string | null
  token: {
    name: string
    symbol: string
    decimals: number
    logoUri?: string
  } | null
  balance: string
  fiatBalance?: string
}

export interface SafeConfirmation {
  owner: string
  signature: string
  signatureType: string
  submissionDate: string
}

export interface SafeTransaction {
  safeTxHash: string
  to: string
  value: string
  data: string | null
  operation: number
  nonce: number
  confirmations: SafeConfirmation[]
  confirmationsRequired: number
  isExecuted: boolean
  isSuccessful: boolean | null
  executionDate: string | null
  transactionHash: string | null
  submissionDate: string
  proposer: string
}

// =============================================================================
// Helper
// =============================================================================

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as Record<string, string>).error || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// =============================================================================
// useSafeInfo
// =============================================================================

export function useSafeInfo() {
  const [data, setData] = useState<SafeInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const info = await fetchJson<SafeInfo>(`${TREASURY_API}/api/treasury/safe`)
      setData(info)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  return { data, isLoading, error, refetch: fetch_ }
}

// =============================================================================
// useSafeBalances
// =============================================================================

export function useSafeBalances() {
  const [data, setData] = useState<{ balances: SafeBalance[] } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchJson<{ balances: SafeBalance[] }>(`${TREASURY_API}/api/treasury/balance`)
      setData(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  return { data, isLoading, error, refetch: fetch_ }
}

// =============================================================================
// usePendingTransactions
// =============================================================================

export function usePendingTransactions(pollInterval = 15000) {
  const [data, setData] = useState<SafeTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    try {
      const result = await fetchJson<{ transactions: SafeTransaction[] }>(`${TREASURY_API}/api/treasury/pending`)
      setData(result.transactions)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch_()
    const interval = setInterval(fetch_, pollInterval)
    return () => clearInterval(interval)
  }, [fetch_, pollInterval])

  return { data, isLoading, error, refetch: fetch_ }
}

// =============================================================================
// useTransactionHistory
// =============================================================================

export function useTransactionHistory(page = 1, limit = 20) {
  const [data, setData] = useState<SafeTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchJson<{
        transactions: SafeTransaction[]
        pagination: { total: number }
      }>(`${TREASURY_API}/api/treasury/transactions?page=${page}&limit=${limit}`)
      setData(result.transactions)
      setTotal(result.pagination.total)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [page, limit])

  useEffect(() => { fetch_() }, [fetch_])

  return { data, total, isLoading, error, refetch: fetch_ }
}

// =============================================================================
// useProposeTransaction (mutation)
// =============================================================================

export function useProposeTransaction() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const propose = useCallback(async (params: {
    recipientAddress: string
    amount: string
    tokenAddress?: string
    title?: string
    description?: string
    signerPrivateKey: string
  }) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchJson<{ safeTxHash: string }>(`${TREASURY_API}/api/treasury/propose`, {
        method: 'POST',
        body: JSON.stringify(params),
      })
      return result
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { propose, isLoading, error }
}

// =============================================================================
// useConfirmTransaction (mutation)
// =============================================================================

export function useConfirmTransaction() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = useCallback(async (safeTxHash: string, signerPrivateKey: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchJson<SafeTransaction>(
        `${TREASURY_API}/api/treasury/confirm/${safeTxHash}`,
        {
          method: 'POST',
          body: JSON.stringify({ signerPrivateKey }),
        }
      )
      return result
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { confirm, isLoading, error }
}

// =============================================================================
// useExecuteTransaction (mutation)
// =============================================================================

export function useExecuteTransaction() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async (safeTxHash: string, signerPrivateKey: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchJson<{ transactionHash: string }>(
        `${TREASURY_API}/api/treasury/execute/${safeTxHash}`,
        {
          method: 'POST',
          body: JSON.stringify({ signerPrivateKey }),
        }
      )
      return result
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { execute, isLoading, error }
}
