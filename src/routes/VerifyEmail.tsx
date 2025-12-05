import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyEmail } from '../lib/auth/cryptidEmailService';

/**
 * Email Verification Page
 * Handles the callback when user clicks email verification link
 */
export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    const verify = async () => {
      const result = await verifyEmail(token);

      if (result.success) {
        setStatus('success');
        setEmail(result.email || '');
        setMessage('Your email has been verified successfully!');

        // Redirect to home after 3 seconds
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(result.error || 'Verification failed. The link may have expired.');
      }
    };

    verify();
  }, [searchParams, navigate]);

  return (
    <div className="verify-email-page">
      <div className="verify-email-container">
        {status === 'loading' && (
          <>
            <div className="loading-spinner" />
            <h2>Verifying your email...</h2>
            <p>Please wait while we verify your email address.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="success-icon">&#10003;</div>
            <h2>Email Verified!</h2>
            <p>{message}</p>
            {email && <p className="verified-email">{email}</p>}
            <p className="redirect-notice">Redirecting to homepage...</p>
            <button onClick={() => navigate('/')} className="continue-button">
              Continue Now
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="error-icon">&#10007;</div>
            <h2>Verification Failed</h2>
            <p>{message}</p>
            <button onClick={() => navigate('/login/')} className="retry-button">
              Go to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
