import React from 'react';
import { useAuth } from '../../../src/context/AuthContext';
import { clearSession } from '../../lib/init';

interface ProfileProps {
  onLogout?: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ onLogout }) => {
  const { session, updateSession } = useAuth();

  const handleLogout = () => {
    // Clear the session
    clearSession();
    
    // Update the auth context
    updateSession({
      username: '',
      authed: false,
      backupCreated: null,
    });
    
    // Call the onLogout callback if provided
    if (onLogout) onLogout();
  };

  if (!session.authed || !session.username) {
    return null;
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h3>Welcome, {session.username}!</h3>
      </div>
      
      <div className="profile-actions">
        <button onClick={handleLogout} className="logout-button">
          Sign Out
        </button>
      </div>
      
      {!session.backupCreated && (
        <div className="backup-reminder">
          <p>Remember to back up your encryption keys to prevent data loss!</p>
        </div>
      )}
    </div>
  );
};