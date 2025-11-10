import React, { createContext, useContext, ReactNode } from 'react'
import { DocHandle } from '@automerge/automerge-repo'

interface AutomergeHandleContextType {
  handle: DocHandle<any> | null
}

const AutomergeHandleContext = createContext<AutomergeHandleContextType>({
  handle: null,
})

export const AutomergeHandleProvider: React.FC<{
  handle: DocHandle<any> | null
  children: ReactNode
}> = ({ handle, children }) => {
  return (
    <AutomergeHandleContext.Provider value={{ handle }}>
      {children}
    </AutomergeHandleContext.Provider>
  )
}

export const useAutomergeHandle = (): DocHandle<any> | null => {
  const context = useContext(AutomergeHandleContext)
  return context.handle
}

