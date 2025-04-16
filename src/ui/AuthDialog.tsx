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
import React, { useState } from "react"
import { useAuth } from "../context/AuthContext"
import { isUsernameValid, isUsernameAvailable, register, loadAccount } from '../lib/auth/account'
import { saveSession } from '../lib/auth/init'

export function AuthDialog({ onClose }: TLUiDialogProps) {
  const [username, setUsername] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { updateSession } = useAuth()
  const { removeDialog } = useDialogs()

  const handleSubmit = async () => {
    if (!username.trim()) {
      setError('Username is required')
      return
    }
    
    setError(null)
    setIsLoading(true)

    try {
      // Validate username format
      if (!isUsernameValid(username)) {
        setError('Username must be 3-20 characters and can only contain letters, numbers, underscores, and hyphens')
        setIsLoading(false)
        return
      }

      if (isRegistering) {
        // Registration flow
        const available = await isUsernameAvailable(username)
        if (!available) {
          setError('Username is already taken')
          setIsLoading(false)
          return
        }

        const success = await register(username)
        if (success) {
          // Update session state
          const newSession = {
            username,
            authed: true,
            loading: false,
            backupCreated: false,
          }
          
          updateSession(newSession)
          saveSession(newSession)
          
          // Close the dialog safely
          removeDialog("auth")
          if (onClose) onClose()
        } else {
          setError('Registration failed')
        }
      } else {
        // Login flow
        const success = await loadAccount(username)
        if (success) {
          // Update session state
          const newSession = {
            username,
            authed: true,
            loading: false,
            backupCreated: true,
          }
          
          updateSession(newSession)
          saveSession(newSession)
          
          // Close the dialog safely
          removeDialog("auth")
          if (onClose) onClose()
        } else {
          setError('User not found')
        }
      }
    } catch (err) {
      console.error('Authentication error:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>{isRegistering ? 'Create Account' : 'Sign In'}</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody style={{ maxWidth: 350 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label>Username</label>
            <TldrawUiInput
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
      </TldrawUiDialogBody>
    </>
  )
} 