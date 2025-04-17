import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Login } from '../components/auth/Login';
import { useAuth } from '../context/AuthContext';
import { errorToMessage } from '../lib/auth/types';

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
          <p>{errorToMessage(session.error)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <Login onSuccess={() => navigate('/')} />
    </div>
  );
};