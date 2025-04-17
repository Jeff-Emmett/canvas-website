import {
    TLUiDialogProps,
    TldrawUiButton,
    TldrawUiButtonLabel,
    TldrawUiDialogBody,
    TldrawUiDialogCloseButton,
    TldrawUiDialogFooter,
    TldrawUiDialogHeader,
    TldrawUiDialogTitle,
    TldrawUiInput,
    useDialogs
  } from "tldraw"
  import React, { useState, useEffect, useRef, FormEvent } from "react"
  import { useAuth } from "../context/AuthContext"
  
  interface AuthDialogProps extends TLUiDialogProps {
    autoFocus?: boolean
  }
  
  export function AuthDialog({ onClose, autoFocus = false }: AuthDialogProps) {
    const [username, setUsername] = useState('')
    const [isRegistering, setIsRegistering] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const { login, register } = useAuth()
    const { removeDialog } = useDialogs()
    const inputRef = useRef<HTMLInputElement>(null)
  
    useEffect(() => {
      if (autoFocus && inputRef.current) {
        setTimeout(() => {
          inputRef.current?.focus()
        }, 100)
      }
    }, [autoFocus])
  
    const handleSubmit = async () => {
      if (!username.trim()) {
        setError('Username is required')
        return
      }
  
      setError(null)
      setIsLoading(true)
  
      try {
        let success = false
        
        if (isRegistering) {
          success = await register(username)
        } else {
          success = await login(username)
        }
        
        if (success) {
          removeDialog("auth")
          if (onClose) onClose()
        } else {
          setError(isRegistering ? 'Registration failed' : 'Login failed')
        }
      } catch (err) {
        console.error('Authentication error:', err)
        setError('An unexpected error occurred')
      } finally {
        setIsLoading(false)
      }
    }
  
    // Handle form submission (triggered by Enter key or submit button)
    const handleFormSubmit = (e: FormEvent) => {
      e.preventDefault()
      handleSubmit()
    }
  
    return (
      <>
        <TldrawUiDialogHeader>
          <TldrawUiDialogTitle>{isRegistering ? 'Create Account' : 'Sign In'}</TldrawUiDialogTitle>
          <TldrawUiDialogCloseButton />
        </TldrawUiDialogHeader>
        <TldrawUiDialogBody style={{ maxWidth: 350 }}>
          <form onSubmit={handleFormSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label>Username</label>
                <TldrawUiInput
                  ref={inputRef}
                  value={username}
                  placeholder="Enter username"
                  onValueChange={setUsername}
                  disabled={isLoading}
                />
              </div>
  
              {error && <div style={{ color: 'red' }}>{error}</div>}
  
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <TldrawUiButton 
                  type="normal" 
                  onClick={() => setIsRegistering(!isRegistering)}
                  disabled={isLoading}
                >
                  <TldrawUiButtonLabel>
                    {isRegistering ? 'Already have an account?' : 'Need an account?'}
                  </TldrawUiButtonLabel>
                </TldrawUiButton>
  
                <TldrawUiButton 
                  type="primary" 
                  onClick={handleSubmit}
                  disabled={isLoading}
                >
                  <TldrawUiButtonLabel>
                    {isLoading ? 'Processing...' : isRegistering ? 'Register' : 'Login'}
                  </TldrawUiButtonLabel>
                </TldrawUiButton>
              </div>
            </div>
          </form>
        </TldrawUiDialogBody>
      </>
    )
  } 