import React, { useState, useEffect } from 'react';
import { isUsernameValid, isUsernameAvailable } from '../../lib/auth/account';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

interface LoginProps {
  onSuccess?: () => void;
}

/**
 * Combined Login/Register component
 * 
 * Handles both login and registration flows based on user selection
 */
const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [usernameValid, setUsernameValid] = useState<boolean | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  
  const { login, register } = useAuth();
  const { addNotification } = useNotifications();

  /**
   * Validate username when it changes and we're in registration mode
   */
  useEffect(() => {
    if (!isRegistering || !username || username.length < 3) {
      setUsernameValid(null);
      setUsernameAvailable(null);
      return;
    }

    const validateUsername = async () => {
      setIsCheckingUsername(true);
      
      try {
        // Check username validity
        const valid = await isUsernameValid(username);
        setUsernameValid(valid);
        
        if (!valid) {
          setUsernameAvailable(null);
          setIsCheckingUsername(false);
          return;
        }
        
        // Check username availability
        const available = await isUsernameAvailable(username);
        setUsernameAvailable(available);
      } catch (error) {
        console.error('Username validation error:', error);
        setUsernameValid(false);
        setUsernameAvailable(null);
      } finally {
        setIsCheckingUsername(false);
      }
    };
    
    validateUsername();
  }, [username, isRegistering]);

  /**
   * Handle form submission for both login and registration
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegistering) {
        // Registration flow
        if (!usernameValid) {
          setError('Invalid username format');
          setIsLoading(false);
          return;
        }
        
        if (!usernameAvailable) {
          setError('Username is already taken');
          setIsLoading(false);
          return;
        }

        const success = await register(username);
        if (success) {
          addNotification(`Welcome, ${username}! Your account has been created.`, 'success');
          if (onSuccess) onSuccess();
        } else {
          setError('Registration failed');
          addNotification('Registration failed. Please try again.', 'error');
        }
      } else {
        // Login flow
        const success = await login(username);
        if (success) {
          addNotification(`Welcome back, ${username}!`, 'success');
          if (onSuccess) onSuccess();
        } else {
          setError('User not found or login failed');
          addNotification('Login failed. Please check your username.', 'error');
        }
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError('An unexpected error occurred');
      addNotification('Authentication error. Please try again later.', 'error');
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
            autoComplete="username"
            minLength={3}
            maxLength={20}
          />
          
          {/* Username validation feedback */}
          {isRegistering && username.length >= 3 && (
            <div className="validation-feedback">
              {isCheckingUsername && (
                <span className="checking">Checking username...</span>
              )}
              
              {!isCheckingUsername && usernameValid === false && (
                <span className="invalid">
                  Username must be 3-20 characters and contain only letters, numbers, underscores, or hyphens
                </span>
              )}
              
              {!isCheckingUsername && usernameValid === true && usernameAvailable === false && (
                <span className="unavailable">Username is already taken</span>
              )}
              
              {!isCheckingUsername && usernameValid === true && usernameAvailable === true && (
                <span className="available">Username is available</span>
              )}
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <button 
          type="submit" 
          disabled={isLoading || (isRegistering && (!usernameValid || !usernameAvailable))} 
          className="auth-button"
        >
          {isLoading ? 'Processing...' : isRegistering ? 'Register' : 'Login'}
        </button>
      </form>

      <div className="auth-toggle">
        <button 
          onClick={() => {
            setIsRegistering(!isRegistering);
            setError(null);
          }} 
          disabled={isLoading}
          className="toggle-button"
        >
          {isRegistering ? 'Already have an account? Sign in' : 'Need an account? Register'}
        </button>
      </div>
    </div>
  );
};

export default Login;