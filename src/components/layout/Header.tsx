import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Profile } from '../auth/Profile';

export const Header: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="site-header">
      <div className="header-container">
        <div className="logo">
          <Link to="/">Canvas Website</Link>
        </div>
        
        <nav className="main-nav">
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            {session.authed ? (
              <li>
                <Link to="/inbox">Inbox</Link>
              </li>
            ) : null}
            <li>
              <Link to="/contact">Contact</Link>
            </li>
          </ul>
        </nav>
        
        <div className="auth-section">
          {session.authed ? (
            <Profile onLogout={() => navigate('/')} />
          ) : (
            <button 
              className="login-button"
              onClick={() => navigate('/auth')}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};