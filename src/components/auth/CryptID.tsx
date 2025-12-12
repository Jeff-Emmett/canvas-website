import React, { useState, useEffect } from 'react';
import { CryptoAuthService } from '../../lib/auth/cryptoAuthService';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { checkBrowserSupport, isSecureContext } from '../../lib/utils/browser';
import { WORKER_URL } from '../../constants/workerUrl';
import '../../css/crypto-auth.css'; // For spin animation

interface CryptIDProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

type RegistrationStep = 'welcome' | 'username' | 'email' | 'success';

/**
 * CryptID - WebCryptoAPI-based authentication component
 * Enhanced with multi-step registration and email backup
 */
const CryptID: React.FC<CryptIDProps> = ({ onSuccess, onCancel }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<RegistrationStep>('welcome');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [existingUsers, setExistingUsers] = useState<string[]>([]);
  const [suggestedUsername, setSuggestedUsername] = useState<string>('');
  const [emailSent, setEmailSent] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [browserSupport, setBrowserSupport] = useState<{
    supported: boolean;
    secure: boolean;
    webcrypto: boolean;
  }>({ supported: false, secure: false, webcrypto: false });

  const { setSession, updateSession } = useAuth();
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
        const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');

        const validUsers = users.filter((user: string) => {
          const publicKey = localStorage.getItem(`${user}_publicKey`);
          if (!publicKey) return false;

          const authData = localStorage.getItem(`${user}_authData`);
          if (!authData) return false;

          try {
            const parsed = JSON.parse(authData);
            return parsed.challenge && parsed.signature && parsed.timestamp;
          } catch (e) {
            return false;
          }
        });

        setExistingUsers(validUsers);

        if (validUsers.length > 0) {
          setSuggestedUsername(validUsers[0]);
          setUsername(validUsers[0]);
          setIsRegistering(false);
        } else {
          setIsRegistering(true);
          setRegistrationStep('welcome');
        }
      } catch (error) {
        console.error('Error checking existing users:', error);
        setExistingUsers([]);
      }
    };

    checkSupport();
    checkExistingUsers();
  }, [addNotification]);

  // Check username availability with debounce
  useEffect(() => {
    // Only check when registering and on username step
    if (!isRegistering || registrationStep !== 'username') {
      return;
    }

    // Reset availability when username changes
    setUsernameAvailable(null);
    setError(null);

    // Don't check if username is too short
    if (username.length < 3) {
      return;
    }

    // Debounce the check
    const timeoutId = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const response = await fetch(`${WORKER_URL}/api/auth/check-username?username=${encodeURIComponent(username)}`);
        const data = await response.json() as { available: boolean; error?: string };

        setUsernameAvailable(data.available);
        if (!data.available && data.error) {
          setError(data.error);
        }
      } catch (err) {
        console.error('Error checking username:', err);
        // On network error, allow proceeding (server will validate on registration)
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [username, isRegistering, registrationStep]);

  /**
   * Send backup email with magic link
   */
  const sendBackupEmail = async (userEmail: string, userName: string) => {
    setIsLoading(true);
    try {
      // Call the Worker API to send backup email
      const response = await fetch(`${WORKER_URL}/api/auth/send-backup-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, username: userName }),
      });

      if (response.ok) {
        setEmailSent(true);
        // Update session with email
        updateSession({ email: userEmail, backupCreated: true });
        addNotification('Backup email sent! Check your inbox.', 'success');
      } else {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || 'Failed to send email');
      }
    } catch (err) {
      console.error('Failed to send backup email:', err);
      // Don't block registration if email fails
      addNotification('Could not send backup email, but your account is created.', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle registration
   */
  const handleRegister = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await CryptoAuthService.register(username);
      if (result.success && result.session) {
        setSession(result.session);

        // Move to email step if email provided, otherwise success
        if (email) {
          await sendBackupEmail(email, username);
        }
        setRegistrationStep('success');
      } else {
        setError(result.error || 'Registration failed');
        addNotification('Registration failed. Please try again.', 'error');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('An unexpected error occurred during registration');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle login
   */
  const handleLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await CryptoAuthService.login(username);
      if (result.success && result.session) {
        setSession(result.session);
        if (onSuccess) onSuccess();
      } else {
        setError(result.error || 'User not found or authentication failed');
        addNotification('Login failed. Please check your username.', 'error');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  // Browser not supported
  if (!browserSupport.supported || !browserSupport.secure) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <div style={styles.errorIcon}>⚠️</div>
          <h2 style={styles.title}>
            {!browserSupport.supported ? 'Browser Not Supported' : 'Secure Connection Required'}
          </h2>
          <p style={styles.description}>
            {!browserSupport.supported
              ? 'Your browser does not support the required features for cryptographic authentication. Please use a modern browser.'
              : 'CryptID requires a secure connection (HTTPS) to protect your cryptographic keys.'}
          </p>
          {onCancel && (
            <button onClick={onCancel} style={styles.secondaryButton}>
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  // Registration flow
  if (isRegistering) {
    return (
      <div style={styles.container}>
        {/* Step indicator */}
        <div style={styles.stepIndicator}>
          {['welcome', 'username', 'email', 'success'].map((step, index) => (
            <React.Fragment key={step}>
              <div style={{
                ...styles.stepDot,
                backgroundColor:
                  registrationStep === step ? '#8b5cf6' :
                  ['welcome', 'username', 'email', 'success'].indexOf(registrationStep) > index ? '#22c55e' : '#e5e7eb'
              }}>
                {['welcome', 'username', 'email', 'success'].indexOf(registrationStep) > index ? '✓' : index + 1}
              </div>
              {index < 3 && <div style={styles.stepLine} />}
            </React.Fragment>
          ))}
        </div>

        {/* Welcome Step */}
        {registrationStep === 'welcome' && (
          <div style={styles.card}>
            <div style={styles.iconLarge}>🔐</div>
            <h2 style={styles.title}>Welcome to CryptID</h2>
            <p style={styles.subtitle}>Passwordless, secure authentication</p>

            <div style={styles.explainerBox}>
              <h3 style={styles.explainerTitle}>How does passwordless login work?</h3>
              <div style={styles.explainerContent}>
                <div style={styles.explainerItem}>
                  <span style={styles.explainerIcon}>🔑</span>
                  <div>
                    <strong>No Password Needed</strong>
                    <p style={styles.explainerText}>
                      Encrypted keys are created directly on your device using the{' '}
                      <a href="https://w3c.github.io/webcrypto/" target="_blank" rel="noopener noreferrer" style={{ color: '#8b5cf6' }}>
                        W3C Web Cryptography API
                      </a>{' '}
                      standard. Your identity and data are secured locally - no passwords to remember or leak.
                    </p>
                  </div>
                </div>
                <div style={styles.explainerItem}>
                  <span style={styles.explainerIcon}>💾</span>
                  <div>
                    <strong>Secure Browser Storage</strong>
                    <p style={styles.explainerText}>
                      Your cryptographic keys encrypt your data locally using local-first architecture.
                      This means you control what you share - your data sovereignty is protected by default
                      for individuals and groups alike.
                    </p>
                  </div>
                </div>
                <div style={styles.explainerItem}>
                  <span style={styles.explainerIcon}>📧</span>
                  <div>
                    <strong>Link Your Email</strong>
                    <p style={styles.explainerText}>
                      Add an email address to connect to your account from other devices.
                      We'll send you a secure link to establish trust between devices.
                    </p>
                  </div>
                </div>
                <div style={styles.explainerItem}>
                  <span style={styles.explainerIcon}>📱</span>
                  <div>
                    <strong>Multi-Device Access</strong>
                    <p style={styles.explainerText}>
                      Add a mobile device or tablet and link keys for one streamlined identity across all your devices.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.featureList}>
              <div style={styles.featureItem}>
                <span style={{ color: '#22c55e' }}>✓</span> Built on W3C cryptography standards
              </div>
              <div style={styles.featureItem}>
                <span style={{ color: '#22c55e' }}>✓</span> Local-first data sovereignty
              </div>
              <div style={styles.featureItem}>
                <span style={{ color: '#22c55e' }}>✓</span> Phishing-resistant authentication
              </div>
            </div>

            <button
              onClick={() => setRegistrationStep('username')}
              style={styles.primaryButton}
            >
              Get Started
            </button>

            <button
              onClick={() => {
                setIsRegistering(false);
                if (existingUsers.length > 0) {
                  setUsername(existingUsers[0]);
                }
              }}
              style={{ ...styles.linkButton, marginTop: '20px' }}
            >
              Already have an account? Sign in
            </button>
          </div>
        )}

        {/* Username Step */}
        {registrationStep === 'username' && (
          <div style={styles.card}>
            <div style={styles.iconLarge}>👤</div>
            <h2 style={styles.title}>Choose Your Username</h2>
            <p style={styles.subtitle}>This is your unique identity on the platform</p>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (usernameAvailable !== false && !checkingUsername) {
                setRegistrationStep('email');
              }
            }}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Username</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="e.g., alex_smith"
                    style={{
                      ...styles.input,
                      paddingRight: '40px',
                      borderColor: username.length >= 3
                        ? (usernameAvailable === true ? '#22c55e'
                          : usernameAvailable === false ? '#ef4444'
                          : undefined)
                        : undefined,
                    }}
                    required
                    minLength={3}
                    maxLength={20}
                    autoFocus
                  />
                  {/* Availability indicator */}
                  {username.length >= 3 && (
                    <div style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {checkingUsername ? (
                        <div style={{
                          width: '18px',
                          height: '18px',
                          border: '2px solid #a0a0b0',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }} />
                      ) : usernameAvailable === true ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : usernameAvailable === false ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      ) : null}
                    </div>
                  )}
                </div>
                <p style={{
                  ...styles.hint,
                  color: usernameAvailable === true ? '#22c55e'
                    : usernameAvailable === false ? '#ef4444'
                    : undefined,
                }}>
                  {usernameAvailable === true
                    ? 'Username is available!'
                    : usernameAvailable === false
                    ? 'Username is already taken'
                    : '3-20 characters, lowercase letters, numbers, _ and -'}
                </p>
              </div>

              {error && !usernameAvailable && <div style={styles.error}>{error}</div>}

              <div style={styles.buttonGroup}>
                <button
                  type="button"
                  onClick={() => setRegistrationStep('welcome')}
                  style={styles.secondaryButton}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={username.length < 3 || usernameAvailable === false || checkingUsername}
                  style={{
                    ...styles.primaryButton,
                    opacity: (username.length < 3 || usernameAvailable === false || checkingUsername) ? 0.5 : 1,
                    cursor: (username.length < 3 || usernameAvailable === false || checkingUsername) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {checkingUsername ? 'Checking...' : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Email Step */}
        {registrationStep === 'email' && (
          <div style={styles.card}>
            <div style={styles.iconLarge}>📧</div>
            <h2 style={styles.title}>Backup Your Account</h2>
            <p style={styles.subtitle}>Add an email to access your account on other devices</p>

            <div style={styles.infoBox}>
              <span style={styles.infoIcon}>💡</span>
              <p style={styles.infoText}>
                We'll send you a secure link to set up your account on another device
                (like your phone). This ensures you can always access your data,
                even if you lose access to this browser.
              </p>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Email Address (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={styles.input}
              />
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.buttonGroup}>
              <button
                type="button"
                onClick={() => setRegistrationStep('username')}
                style={styles.secondaryButton}
              >
                Back
              </button>
              <button
                onClick={handleRegister}
                disabled={isLoading}
                style={styles.primaryButton}
              >
                {isLoading ? 'Creating Account...' : email ? 'Create & Send Backup' : 'Create Account'}
              </button>
            </div>

            {!email && (
              <button
                onClick={() => {
                  setEmail('');
                  handleRegister();
                }}
                style={styles.linkButton}
                disabled={isLoading}
              >
                Skip for now
              </button>
            )}
          </div>
        )}

        {/* Success Step */}
        {registrationStep === 'success' && (
          <div style={styles.card}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={styles.title}>Welcome, {username}!</h2>
            <p style={styles.subtitle}>Your CryptID account is ready</p>

            <div style={styles.successBox}>
              <div style={styles.successItem}>
                <span style={styles.successCheck}>✓</span>
                <span>Cryptographic keys generated</span>
              </div>
              <div style={styles.successItem}>
                <span style={styles.successCheck}>✓</span>
                <span>Keys stored securely in this browser</span>
              </div>
              {emailSent && (
                <div style={styles.successItem}>
                  <span style={styles.successCheck}>✓</span>
                  <span>Backup email sent to {email}</span>
                </div>
              )}
            </div>

            {emailSent && (
              <div style={styles.infoBox}>
                <span style={styles.infoIcon}>📱</span>
                <p style={styles.infoText}>
                  <strong>Next step:</strong> Check your email and open the backup link
                  on your phone or another device to complete multi-device setup.
                </p>
              </div>
            )}

            <button
              onClick={() => onSuccess?.()}
              style={styles.primaryButton}
            >
              Start Using Canvas
            </button>
          </div>
        )}

      </div>
    );
  }

  // Login flow
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconLarge}>🔐</div>
        <h2 style={styles.title}>Sign In with CryptID</h2>

        {existingUsers.length > 0 ? (
          <>
            <div style={styles.existingUsers}>
              <p style={styles.existingUsersLabel}>Select your account:</p>
              <div style={styles.userList}>
                {existingUsers.map((user) => (
                  <button
                    key={user}
                    onClick={() => setUsername(user)}
                    style={{
                      ...styles.userButton,
                      borderColor: username === user ? '#8b5cf6' : '#e5e7eb',
                      backgroundColor: username === user ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                    }}
                    disabled={isLoading}
                  >
                    <span style={styles.userIcon}>🔑</span>
                    <span style={styles.userName}>{user}</span>
                    {username === user && <span style={styles.selectedBadge}>Selected</span>}
                  </button>
                ))}
              </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <button
              onClick={handleLogin}
              disabled={isLoading || !username.trim()}
              style={{
                ...styles.primaryButton,
                opacity: (isLoading || !username.trim()) ? 0.5 : 1,
                cursor: (isLoading || !username.trim()) ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ ...styles.subtitle, marginBottom: '16px' }}>
              No accounts found on this device.
            </p>
            <p style={{ ...styles.hint, marginBottom: '20px' }}>
              Create a new CryptID or use a backup link from another device to sign in here.
            </p>
          </div>
        )}

        <button
          onClick={() => {
            setIsRegistering(true);
            setRegistrationStep('welcome');
            setUsername('');
            setError(null);
          }}
          style={existingUsers.length > 0 ? { ...styles.linkButton, marginTop: '20px' } : styles.primaryButton}
          disabled={isLoading}
        >
          {existingUsers.length > 0 ? 'Need an account? Create one' : 'Create a CryptID'}
        </button>
      </div>
    </div>
  );
};

// Styles - compact layout to fit on one screen (updated 2025-12-12)
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    maxWidth: '540px',
    margin: '0 auto',
  },
  card: {
    width: '100%',
    backgroundColor: 'var(--color-panel, #fff)',
    borderRadius: '16px',
    padding: '20px',
    textAlign: 'center',
  },
  errorCard: {
    width: '100%',
    backgroundColor: '#fef2f2',
    borderRadius: '16px',
    padding: '20px',
    textAlign: 'center',
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    gap: '0',
  },
  stepDot: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 600,
    color: 'white',
  },
  stepLine: {
    width: '32px',
    height: '2px',
    backgroundColor: '#e5e7eb',
  },
  iconLarge: {
    fontSize: '36px',
    marginBottom: '12px',
  },
  errorIcon: {
    fontSize: '36px',
    marginBottom: '12px',
  },
  successIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
    color: 'white',
    fontSize: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--color-text, #1f2937)',
    marginBottom: '4px',
    margin: '0 0 4px 0',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--color-text-3, #6b7280)',
    marginBottom: '16px',
    margin: '0 0 16px 0',
  },
  description: {
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: 1.5,
    marginBottom: '16px',
  },
  explainerBox: {
    backgroundColor: 'var(--color-muted-2, #f9fafb)',
    borderRadius: '10px',
    padding: '14px',
    marginBottom: '16px',
    textAlign: 'left',
  },
  explainerTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--color-text, #1f2937)',
    marginBottom: '12px',
    margin: '0 0 12px 0',
  },
  explainerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  explainerItem: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
  },
  explainerIcon: {
    fontSize: '16px',
    flexShrink: 0,
  },
  explainerText: {
    fontSize: '11px',
    color: 'var(--color-text-3, #6b7280)',
    margin: '2px 0 0 0',
    lineHeight: 1.4,
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '16px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--color-text, #374151)',
  },
  infoBox: {
    display: 'flex',
    gap: '10px',
    padding: '12px',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: '8px',
    marginBottom: '14px',
    textAlign: 'left',
  },
  infoIcon: {
    fontSize: '16px',
    flexShrink: 0,
  },
  infoText: {
    fontSize: '12px',
    color: 'var(--color-text, #374151)',
    margin: 0,
    lineHeight: 1.4,
  },
  successBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: '8px',
    marginBottom: '14px',
  },
  successItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'var(--color-text, #374151)',
  },
  successCheck: {
    color: '#22c55e',
    fontWeight: 600,
  },
  inputGroup: {
    marginBottom: '14px',
    textAlign: 'left',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--color-text, #374151)',
    marginBottom: '4px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '2px solid var(--color-panel-contrast, #e5e7eb)',
    borderRadius: '8px',
    backgroundColor: 'var(--color-panel, #fff)',
    color: 'var(--color-text, #1f2937)',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: '10px',
    color: 'var(--color-text-3, #9ca3af)',
    marginTop: '4px',
    margin: '6px 0 0 0',
  },
  error: {
    padding: '10px',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    borderRadius: '6px',
    fontSize: '12px',
    marginBottom: '12px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
  },
  primaryButton: {
    flex: 1,
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'white',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
  },
  secondaryButton: {
    flex: 1,
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text, #374151)',
    backgroundColor: 'var(--color-muted-2, #f3f4f6)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  linkButton: {
    marginTop: '12px',
    padding: '6px',
    fontSize: '12px',
    color: '#8b5cf6',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  existingUsers: {
    marginBottom: '14px',
    textAlign: 'left',
  },
  existingUsersLabel: {
    fontSize: '12px',
    color: 'var(--color-text-3, #6b7280)',
    marginBottom: '8px',
    margin: '0 0 8px 0',
  },
  userList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  userButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
    width: '100%',
    textAlign: 'left',
  },
  userIcon: {
    fontSize: '16px',
  },
  userName: {
    flex: 1,
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text, #374151)',
  },
  selectedBadge: {
    fontSize: '10px',
    padding: '2px 6px',
    backgroundColor: '#8b5cf6',
    color: 'white',
    borderRadius: '8px',
    fontWeight: 500,
  },
};

export default CryptID;
