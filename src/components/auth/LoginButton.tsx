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
        className={`login-button ${className}`}
        title="Sign in to save your work and access additional features"
      >
        Sign In
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