import React, { createContext, useContext, ReactNode } from 'react'
import { ConnectionState } from '@/automerge/CloudflareAdapter'

interface ConnectionContextValue {
  connectionState: ConnectionState
  isNetworkOnline: boolean
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null)

interface ConnectionProviderProps {
  connectionState: ConnectionState
  isNetworkOnline: boolean
  children: ReactNode
}

export function ConnectionProvider({
  connectionState,
  isNetworkOnline,
  children,
}: ConnectionProviderProps) {
  return (
    <ConnectionContext.Provider value={{ connectionState, isNetworkOnline }}>
      {children}
    </ConnectionContext.Provider>
  )
}

export function useConnectionStatus() {
  const context = useContext(ConnectionContext)
  if (!context) {
    // Return default values when not in provider (e.g., during SSR or outside Board)
    return {
      connectionState: 'connected' as ConnectionState,
      isNetworkOnline: true,
    }
  }
  return context
}
