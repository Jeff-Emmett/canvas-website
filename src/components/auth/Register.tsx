import React, { useState } from 'react'
import { register } from '../../lib/auth/account'

const Register: React.FC = () => {
  const [username, setUsername] = useState('')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [initializingFilesystem, setInitializingFilesystem] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (checkingUsername) {
      return
    }

    setInitializingFilesystem(true)
    setError(null)

    try {
      const success = await register(username)
      
      if (!success) {
        setError('Registration failed. Username may be taken.')
        setInitializingFilesystem(false)
      }
    } catch (err) {
      setError('An error occurred during registration')
      setInitializingFilesystem(false)
      console.error(err)
    }
  }

  return (
    <div className="register-container">
      <h2>Create an Account</h2>
      
      <form onSubmit={handleRegister}>
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={initializingFilesystem}
            required
          />
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <button 
          type="submit" 
          disabled={initializingFilesystem || !username}
        >
          {initializingFilesystem ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
    </div>
  )
}

export default Register