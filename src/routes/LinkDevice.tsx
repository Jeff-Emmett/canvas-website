import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { completeDeviceLink } from '../lib/auth/cryptidEmailService';
import { useAuth } from '../context/AuthContext';

/**
 * Device Link Page
 * Handles the callback when user clicks device verification link
 */
export const LinkDevice: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [cryptidUsername, setCryptidUsername] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No device link token provided.');
      return;
    }

    const linkDevice = async () => {
      const result = await completeDeviceLink(token);

      if (result.success) {
        setStatus('success');
        setCryptidUsername(result.cryptidUsername || '');
        setMessage('This device has been linked to your CryptID account!');

        // Set the session - user is now logged in
        if (result.cryptidUsername) {
          setSession({
            username: result.cryptidUsername,
            authed: true,
            loading: false,
            backupCreated: null
          });
        }

        // Redirect to home after 3 seconds
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(result.error || 'Device link failed. The link may have expired.');
      }
    };

    linkDevice();
  }, [searchParams, navigate, setSession]);

  return (
    <div className="link-device-page">
      <div className="link-device-container">
        {status === 'loading' && (
          <>
            <div className="loading-spinner" />
            <h2>Linking Device...</h2>
            <p>Please wait while we link this device to your account.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="success-icon">&#10003;</div>
            <h2>Device Linked!</h2>
            <p>{message}</p>
            {cryptidUsername && (
              <p className="cryptid-username">
                Signed in as: <strong>{cryptidUsername}</strong>
              </p>
            )}
            <p className="redirect-notice">Redirecting to homepage...</p>
            <button onClick={() => navigate('/')} className="continue-button">
              Continue Now
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="error-icon">&#10007;</div>
            <h2>Link Failed</h2>
            <p>{message}</p>
            <p className="error-hint">
              Make sure you click the link from the same device and browser
              where you requested to sign in.
            </p>
            <button onClick={() => navigate('/login/')} className="retry-button">
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LinkDevice;
