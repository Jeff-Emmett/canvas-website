import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBlockchain } from '../../context/BlockchainContext';
import { useNotifications } from '../../context/NotificationContext';
import { unlinkAccount } from '../../lib/auth/blockchainLinking';

interface ProfileProps {
  onLogout?: () => void;
  onOpenVaultBrowser?: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ onLogout, onOpenVaultBrowser }) => {
  const { session, updateSession, clearSession } = useAuth();
  const { wallet, linkedAccount, isConnecting, connect, linkWebCryptoAccount, disconnect } = useBlockchain();
  const { addNotification } = useNotifications();
  const [vaultPath, setVaultPath] = useState(session.obsidianVaultPath || '');
  const [isEditingVault, setIsEditingVault] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

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
    console.log('🔧 Vault disconnected from profile');
  };

  const handleChangeVault = () => {
    if (onOpenVaultBrowser) {
      onOpenVaultBrowser();
    }
  };

  const handleConnectWallet = async () => {
    try {
      await connect();
      addNotification('Wallet connected successfully', 'success');
    } catch (error: any) {
      addNotification(error.message || 'Failed to connect wallet', 'error');
    }
  };

  const handleLinkAccount = async () => {
    if (!wallet) {
      addNotification('Please connect your wallet first', 'error');
      return;
    }

    setIsLinking(true);
    try {
      const result = await linkWebCryptoAccount(session.username);
      if (result.success) {
        addNotification('Account linked successfully!', 'success');
      } else {
        addNotification(result.error || 'Failed to link account', 'error');
      }
    } catch (error: any) {
      addNotification(error.message || 'Failed to link account', 'error');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkAccount = () => {
    if (unlinkAccount(session.username)) {
      disconnect();
      addNotification('Account unlinked successfully', 'success');
    } else {
      addNotification('Failed to unlink account', 'error');
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
        <h3>Welcome, {session.username}!</h3>
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

      {/* Blockchain Wallet Section */}
      <div className="profile-settings">
        <h4>Blockchain Wallet</h4>
        
        {/* Current Wallet Display */}
        <div className="current-vault-section">
          {wallet ? (
            <div className="vault-info">
              <div className="vault-name">
                <span className="vault-label">Connected Wallet:</span>
                <span className="vault-name-text">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
              </div>
              <div className="vault-path-info">
                Chain ID: {wallet.chainId}
              </div>
              {linkedAccount && (
                <div className="vault-path-info" style={{ marginTop: '8px', color: '#10b981' }}>
                  ✓ Linked to Web Crypto account
                </div>
              )}
            </div>
          ) : (
            <div className="no-vault-info">
              <span className="no-vault-text">No wallet connected</span>
            </div>
          )}
        </div>

        {/* Wallet Actions */}
        <div className="vault-actions-section">
          {!wallet ? (
            <button 
              onClick={handleConnectWallet} 
              disabled={isConnecting}
              className="change-vault-button"
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          ) : (
            <>
              {!linkedAccount ? (
                <button 
                  onClick={handleLinkAccount} 
                  disabled={isLinking}
                  className="change-vault-button"
                >
                  {isLinking ? 'Linking...' : 'Link to Web Crypto Account'}
                </button>
              ) : (
                <button 
                  onClick={handleUnlinkAccount}
                  className="disconnect-vault-button"
                >
                  🔌 Unlink Wallet
                </button>
              )}
              <button 
                onClick={disconnect}
                className="disconnect-vault-button"
                style={{ marginLeft: '8px' }}
              >
                Disconnect Wallet
              </button>
            </>
          )}
        </div>

        {/* Linked Account Details */}
        {linkedAccount && (
          <details className="advanced-vault-settings" style={{ marginTop: '16px' }}>
            <summary>Wallet Details</summary>
            <div className="vault-settings">
              <div className="vault-display">
                <div className="vault-path-display">
                  <p><strong>Ethereum Address:</strong></p>
                  <code style={{ 
                    display: 'block', 
                    padding: '8px', 
                    background: '#f8f9fa', 
                    borderRadius: '4px',
                    wordBreak: 'break-all',
                    fontSize: '12px'
                  }}>
                    {linkedAccount.ethereumAddress}
                  </code>
                  {linkedAccount.proxyContractAddress && (
                    <>
                      <p style={{ marginTop: '12px' }}><strong>Proxy Contract:</strong></p>
                      <code style={{ 
                        display: 'block', 
                        padding: '8px', 
                        background: '#f8f9fa', 
                        borderRadius: '4px',
                        wordBreak: 'break-all',
                        fontSize: '12px'
                      }}>
                        {linkedAccount.proxyContractAddress}
                      </code>
                    </>
                  )}
                  <p style={{ marginTop: '12px', fontSize: '12px', color: '#6c757d' }}>
                    Linked on {new Date(linkedAccount.linkedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </details>
        )}
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