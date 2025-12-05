import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import CryptID from './CryptID';

interface LoginButtonProps {
  className?: string;
}

const LoginButton: React.FC<LoginButtonProps> = ({ className = '' }) => {
  const [showLogin, setShowLogin] = useState(false);
  const { session } = useAuth();
  const { addNotification } = useNotifications();

  const handleLoginClick = () => {
    setShowLogin(true);
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
  };

  const handleLoginCancel = () => {
    setShowLogin(false);
  };

  // Don't show login button if user is already authenticated
  if (session.authed) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleLoginClick}
        className={`toolbar-btn login-button ${className}`}
        title="Sign in to save your work and access additional features"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M6 3.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 0-1 0v2A1.5 1.5 0 0 0 6.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-8A1.5 1.5 0 0 0 5 3.5v2a.5.5 0 0 0 1 0v-2z"/>
          <path fillRule="evenodd" d="M11.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5H1.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"/>
        </svg>
        <span>Sign In</span>
      </button>

      {showLogin && (
        <div className="login-overlay">
          <div className="login-modal">
            <CryptID
              onSuccess={handleLoginSuccess}
              onCancel={handleLoginCancel}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default LoginButton; 