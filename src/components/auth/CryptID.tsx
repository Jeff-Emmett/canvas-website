import React, { useState, useEffect } from 'react';
import { CryptoAuthService } from '../../lib/auth/cryptoAuthService';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { checkBrowserSupport, isSecureContext } from '../../lib/utils/browser';

interface CryptIDProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * CryptID - WebCryptoAPI-based authentication component
 */
const CryptID: React.FC<CryptIDProps> = ({ onSuccess, onCancel }) => {
  const [username, setUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [existingUsers, setExistingUsers] = useState<string[]>([]);
  const [suggestedUsername, setSuggestedUsername] = useState<string>('');
  const [browserSupport, setBrowserSupport] = useState<{
    supported: boolean;
    secure: boolean;
    webcrypto: boolean;
  }>({ supported: false, secure: false, webcrypto: false });
  
  const { setSession } = useAuth();
  const { addNotification } = useNotifications();

  // Check browser support and existing users on mount
  useEffect(() => {
    const checkSupport = () => {
      const supported = checkBrowserSupport();
      const secure = isSecureContext();
      const webcrypto = typeof window !== 'undefined' && 
                       typeof window.crypto !== 'undefined' && 
                       typeof window.crypto.subtle !== 'undefined';
      
      setBrowserSupport({ supported, secure, webcrypto });
      
      if (!supported) {
        setError('Your browser does not support the required features for cryptographic authentication.');
        addNotification('Browser not supported for cryptographic authentication', 'warning');
      } else if (!secure) {
        setError('Cryptographic authentication requires a secure context (HTTPS).');
        addNotification('Secure context required for cryptographic authentication', 'warning');
      } else if (!webcrypto) {
        setError('WebCryptoAPI is not available in your browser.');
        addNotification('WebCryptoAPI not available', 'warning');
      }
    };
    
    const checkExistingUsers = () => {
      try {
        // Get registered users from localStorage
        const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        
        // Filter users to only include those with valid authentication keys
        const validUsers = users.filter((user: string) => {
          // Check if public key exists
          const publicKey = localStorage.getItem(`${user}_publicKey`);
          if (!publicKey) return false;
          
          // Check if authentication data exists
          const authData = localStorage.getItem(`${user}_authData`);
          if (!authData) return false;
          
          // Verify the auth data is valid JSON and has required fields
          try {
            const parsed = JSON.parse(authData);
            return parsed.challenge && parsed.signature && parsed.timestamp;
          } catch (e) {
            console.warn(`Invalid auth data for user ${user}:`, e);
            return false;
          }
        });
        
        setExistingUsers(validUsers);
        
        // If there are valid users, suggest the first one for login
        if (validUsers.length > 0) {
          setSuggestedUsername(validUsers[0]);
          setUsername(validUsers[0]); // Pre-fill the username field
          setIsRegistering(false); // Default to login mode if users exist
        } else {
          setIsRegistering(true); // Default to registration mode if no users exist
        }
        
        // Log for debugging
        if (users.length !== validUsers.length) {
          console.log(`Found ${users.length} registered users, but only ${validUsers.length} have valid keys`);
        }
      } catch (error) {
        console.error('Error checking existing users:', error);
        setExistingUsers([]);
      }
    };
    
    checkSupport();
    checkExistingUsers();
  }, [addNotification]);

  /**
   * Handle form submission for both login and registration
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!browserSupport.supported || !browserSupport.secure || !browserSupport.webcrypto) {
        setError('Browser does not support cryptographic authentication');
        setIsLoading(false);
        return;
      }

      if (isRegistering) {
        // Registration flow using CryptoAuthService
        const result = await CryptoAuthService.register(username);
        if (result.success && result.session) {
          setSession(result.session);
          if (onSuccess) onSuccess();
        } else {
          setError(result.error || 'Registration failed');
          addNotification('Registration failed. Please try again.', 'error');
        }
      } else {
        // Login flow using CryptoAuthService
        const result = await CryptoAuthService.login(username);
        if (result.success && result.session) {
          setSession(result.session);
          if (onSuccess) onSuccess();
        } else {
          setError(result.error || 'User not found or authentication failed');
          addNotification('Login failed. Please check your username.', 'error');
        }
      }
    } catch (err) {
      console.error('Cryptographic authentication error:', err);
      setError('An unexpected error occurred during authentication');
      addNotification('Authentication error. Please try again later.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!browserSupport.supported) {
    return (
      <div className="crypto-login-container">
        <h2>Browser Not Supported</h2>
        <p>Your browser does not support the required features for cryptographic authentication.</p>
        <p>Please use a modern browser with WebCryptoAPI support.</p>
        {onCancel && (
          <button onClick={onCancel} className="cancel-button">
            Go Back
          </button>
        )}
      </div>
    );
  }

  if (!browserSupport.secure) {
    return (
      <div className="crypto-login-container">
        <h2>Secure Context Required</h2>
        <p>Cryptographic authentication requires a secure context (HTTPS).</p>
        <p>Please access this application over HTTPS.</p>
        {onCancel && (
          <button onClick={onCancel} className="cancel-button">
            Go Back
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="crypto-login-container">
      <h2>{isRegistering ? 'Create CryptID Account' : 'CryptID Sign In'}</h2>
      
      {/* Show existing users if available */}
      {existingUsers.length > 0 && !isRegistering && (
        <div className="existing-users">
          <h3>Available Accounts with Valid Keys</h3>
          <div className="user-list">
            {existingUsers.map((user) => (
              <button
                key={user}
                onClick={() => {
                  setUsername(user);
                  setError(null);
                }}
                className={`user-option ${username === user ? 'selected' : ''}`}
                disabled={isLoading}
              >
                <span className="user-icon">🔐</span>
                <span className="user-name">{user}</span>
                <span className="user-status">Cryptographic keys available</span>
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="crypto-info">
        <p>
          {isRegistering
            ? 'Create a new CryptID account using WebCryptoAPI for secure authentication.'
            : existingUsers.length > 0
              ? 'Select an account above or enter a different username to sign in.'
              : 'Sign in using your CryptID credentials.'
          }
        </p>
        <div className="crypto-features">
          <span className="feature">✓ ECDSA P-256 Key Pairs</span>
          <span className="feature">✓ Challenge-Response Authentication</span>
          <span className="feature">✓ Secure Key Storage</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={existingUsers.length > 0 ? "Enter username or select from above" : "Enter username"}
            required
            disabled={isLoading}
            autoComplete="username"
            minLength={3}
            maxLength={20}
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button 
          type="submit" 
          disabled={isLoading || !username.trim()} 
          className="crypto-auth-button"
        >
          {isLoading ? 'Processing...' : isRegistering ? 'Create Account' : 'Sign In'}
        </button>
      </form>

      <div className="auth-toggle">
        <button 
          onClick={() => {
            setIsRegistering(!isRegistering);
            setError(null);
            // Clear username when switching modes
            if (!isRegistering) {
              setUsername('');
            } else if (existingUsers.length > 0) {
              setUsername(existingUsers[0]);
            }
          }} 
          disabled={isLoading}
          className="toggle-button"
        >
          {isRegistering ? 'Already have an account? Sign in' : 'Need an account? Register'}
        </button>
      </div>

      {onCancel && (
        <button onClick={onCancel} className="cancel-button">
          Cancel
        </button>
      )}
    </div>
  );
};

export default CryptID; 