import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface ProfileProps {
  onLogout?: () => void;
  onOpenVaultBrowser?: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ onLogout, onOpenVaultBrowser }) => {
  const { session, updateSession, clearSession } = useAuth();
  const [vaultPath, setVaultPath] = useState(session.obsidianVaultPath || '');
  const [isEditingVault, setIsEditingVault] = useState(false);

  const handleVaultPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVaultPath(e.target.value);
  };

  const handleSaveVaultPath = () => {
    updateSession({ obsidianVaultPath: vaultPath });
    setIsEditingVault(false);
  };

  const handleCancelVaultEdit = () => {
    setVaultPath(session.obsidianVaultPath || '');
    setIsEditingVault(false);
  };

  const handleDisconnectVault = () => {
    setVaultPath('');
    updateSession({ 
      obsidianVaultPath: undefined,
      obsidianVaultName: undefined
    });
    setIsEditingVault(false);
  };

  const handleChangeVault = () => {
    if (onOpenVaultBrowser) {
      onOpenVaultBrowser();
    }
  };

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
        <h3>enCryptID: {session.username}</h3>
      </div>
      
      <div className="profile-settings">
        <h4>Obsidian Vault</h4>
        
        {/* Current Vault Display */}
        <div className="current-vault-section">
          {session.obsidianVaultName ? (
            <div className="vault-info">
              <div className="vault-name">
                <span className="vault-label">Current Vault:</span>
                <span className="vault-name-text">{session.obsidianVaultName}</span>
              </div>
              <div className="vault-path-info">
                {session.obsidianVaultPath === 'folder-selected' 
                  ? 'Folder selected (path not available)' 
                  : session.obsidianVaultPath}
              </div>
            </div>
          ) : (
            <div className="no-vault-info">
              <span className="no-vault-text">No Obsidian vault configured</span>
            </div>
          )}
        </div>

        {/* Change Vault Button */}
        <div className="vault-actions-section">
          <button onClick={handleChangeVault} className="change-vault-button">
            {session.obsidianVaultName ? 'Change Obsidian Vault' : 'Set Obsidian Vault'}
          </button>
          {session.obsidianVaultPath && (
            <button onClick={handleDisconnectVault} className="disconnect-vault-button">
              🔌 Disconnect Vault
            </button>
          )}
        </div>

        {/* Advanced Settings (Collapsible) */}
        <details className="advanced-vault-settings">
          <summary>Advanced Settings</summary>
          <div className="vault-settings">
            {isEditingVault ? (
              <div className="vault-edit-form">
                <input
                  type="text"
                  value={vaultPath}
                  onChange={handleVaultPathChange}
                  placeholder="Enter Obsidian vault path..."
                  className="vault-path-input"
                />
                <div className="vault-edit-actions">
                  <button onClick={handleSaveVaultPath} className="save-button">
                    Save
                  </button>
                  <button onClick={handleCancelVaultEdit} className="cancel-button">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="vault-display">
                <div className="vault-path-display">
                  {session.obsidianVaultPath ? (
                    <span className="vault-path-text" title={session.obsidianVaultPath}>
                      {session.obsidianVaultPath === 'folder-selected' 
                        ? 'Folder selected (path not available)' 
                        : session.obsidianVaultPath}
                    </span>
                  ) : (
                    <span className="no-vault-text">No vault configured</span>
                  )}
                </div>
                <div className="vault-actions">
                  <button onClick={() => setIsEditingVault(true)} className="edit-button">
                    Edit Path
                  </button>
                </div>
              </div>
            )}
          </div>
        </details>
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