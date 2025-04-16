import React, { useState } from 'react';
import { isUsernameValid, isUsernameAvailable, register, loadAccount } from '../../lib/auth/account';
import { useAuth } from '../../context/AuthContext';
import { saveSession } from '../../lib/auth/init';

interface LoginProps {
  onSuccess?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { updateSession } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Validate username format
      const valid = await isUsernameValid(username);
      if (!valid) {
        setError('Username must be 3-20 characters and can only contain letters, numbers, underscores, and hyphens');
        setIsLoading(false);
        return;
      }

      if (isRegistering) {
        // Registration flow
        const available = await isUsernameAvailable(username);
        if (!available) {
          setError('Username is already taken');
          setIsLoading(false);
          return;
        }

        const success = await register(username);
        if (success) {
          // Update session state
          const newSession = {
            username,
            authed: true,
            loading: false,
            backupCreated: false,
          };
          
          updateSession(newSession);
          saveSession(newSession);
          
          if (onSuccess) onSuccess();
        } else {
          setError('Registration failed');
        }
      } else {
        // Login flow
        const success = await loadAccount(username);
        if (success) {
          // Update session state
          const newSession = {
            username,
            authed: true,
            loading: false,
            backupCreated: true,
          };
          
          updateSession(newSession);
          saveSession(newSession);
          
          if (onSuccess) onSuccess();
        } else {
          setError('User not found');
        }
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>{isRegistering ? 'Create Account' : 'Sign In'}</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            required
            disabled={isLoading}
          />
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <button type="submit" disabled={isLoading} className="auth-button">
          {isLoading ? 'Processing...' : isRegistering ? 'Register' : 'Login'}
        </button>
      </form>
      
      <div className="auth-toggle">
        <button onClick={() => setIsRegistering(!isRegistering)} disabled={isLoading}>
          {isRegistering ? 'Already have an account? Sign in' : 'Need an account? Register'}
        </button>
      </div>
    </div>
  );
};