import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAccountLinkingConsumer } from '../../lib/auth/linking'
import * as account from '@oddjs/odd/account'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'

const LinkDevice: React.FC = () => {
  const [username, setUsername] = useState('')
  const [displayPin, setDisplayPin] = useState('')
  const [view, setView] = useState<'enter-username' | 'show-pin' | 'load-filesystem'>('enter-username')
  const [accountLinkingConsumer, setAccountLinkingConsumer] = useState<account.AccountLinkingConsumer | null>(null)
  const navigate = useNavigate()
  const { login } = useAuth()
  const { addNotification } = useNotifications()

  const initAccountLinkingConsumer = async () => {
    try {
      const consumer = await createAccountLinkingConsumer(username)
      setAccountLinkingConsumer(consumer)

      consumer.on('challenge', ({ pin }: { pin: number[] }) => {
        setDisplayPin(pin.join(''))
        setView('show-pin')
      })

      consumer.on('link', async ({ approved, username }: { approved: boolean, username: string }) => {
        if (approved) {
          setView('load-filesystem')

          const success = await login(username)
          
          if (success) {
            addNotification("You're now connected!", "success")
            navigate('/')
          } else {
            addNotification("Connection successful but login failed", "error")
            navigate('/login')
          }
        } else {
          addNotification('The connection attempt was cancelled', "warning")
          navigate('/')
        }
      })
    } catch (error) {
      console.error('Error initializing account linking consumer:', error)
      addNotification('Failed to initialize device linking', "error")
    }
  }

  const handleSubmitUsername = (e: React.FormEvent) => {
    e.preventDefault()
    initAccountLinkingConsumer()
  }

  // Clean up consumer on unmount
  useEffect(() => {
    return () => {
      if (accountLinkingConsumer) {
        accountLinkingConsumer.destroy()
      }
    }
  }, [accountLinkingConsumer])

  return (
    <div className="link-device-container">
      {view === 'enter-username' && (
        <>
          <h2>Link a New Device</h2>
          <form onSubmit={handleSubmitUsername}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={!username}>Continue</button>
          </form>
        </>
      )}

      {view === 'show-pin' && (
        <div className="pin-display">
          <h2>Enter this PIN on your other device</h2>
          <div className="pin-code">{displayPin}</div>
        </div>
      )}

      {view === 'load-filesystem' && (
        <div className="loading">
          <h2>Loading your filesystem...</h2>
          <p>Please wait while we connect to your account.</p>
        </div>
      )}
    </div>
  )
}

export default LinkDevice