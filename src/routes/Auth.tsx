import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CryptID from '../components/auth/CryptID';
import { useAuth } from '../context/AuthContext';

export const Auth: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  // Redirect to home if already authenticated
  useEffect(() => {
    if (session.authed) {
      navigate('/');
    }
  }, [session.authed, navigate]);

  if (session.loading) {
    return (
      <div className="auth-page">
        <div className="auth-container loading">
          <p>Loading authentication system...</p>
        </div>
      </div>
    );
  }

  if (session.error) {
    return (
      <div className="auth-page">
        <div className="auth-container error">
          <h2>Authentication Error</h2>
          <p>{session.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <CryptID onSuccess={() => navigate('/')} />
    </div>
  );
};