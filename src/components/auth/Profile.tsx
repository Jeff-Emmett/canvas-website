import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  linkEmailToAccount,
  checkEmailStatus,
  getLinkedDevices,
  revokeDevice,
  Device
} from '../../lib/auth/cryptidEmailService';

interface ProfileProps {
  onLogout?: () => void;
  onOpenVaultBrowser?: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ onLogout, onOpenVaultBrowser }) => {
  const { session, updateSession, clearSession } = useAuth();
  const [vaultPath, setVaultPath] = useState(session.obsidianVaultPath || '');
  const [isEditingVault, setIsEditingVault] = useState(false);

  // Email linking state
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<{
    linked: boolean;
    verified: boolean;
    email?: string;
  }>({ linked: false, verified: false });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Linked devices state
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [showDevices, setShowDevices] = useState(false);

  // Check email status on mount
  useEffect(() => {
    if (session.authed && session.username) {
      checkEmailStatusHandler();
    }
  }, [session.authed, session.username]);

  const checkEmailStatusHandler = async () => {
    if (!session.username) return;

    const status = await checkEmailStatus(session.username);
    if (status.found) {
      setEmailStatus({
        linked: true,
        verified: status.emailVerified || false,
        email: status.email
      });
    }
  };

  const handleLinkEmail = async () => {
    if (!session.username || !email) return;

    setEmailLoading(true);
    setEmailError(null);
    setEmailSuccess(null);

    const result = await linkEmailToAccount(email, session.username);

    setEmailLoading(false);

    if (result.success) {
      if (result.emailVerified) {
        setEmailSuccess('Email already verified!');
        setEmailStatus({ linked: true, verified: true, email });
      } else if (result.emailSent) {
        setEmailSuccess('Verification email sent! Check your inbox.');
        setEmailStatus({ linked: true, verified: false, email });
      } else {
        setEmailSuccess('Email linked but verification email failed to send.');
        setEmailStatus({ linked: true, verified: false, email });
      }
      setShowEmailForm(false);
    } else {
      setEmailError(result.error || 'Failed to link email');
    }
  };

  const loadDevices = async () => {
    if (!session.username) return;

    setDevicesLoading(true);
    const deviceList = await getLinkedDevices(session.username);
    setDevices(deviceList);
    setDevicesLoading(false);
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!session.username) return;

    const confirmed = window.confirm('Are you sure you want to revoke this device? It will no longer be able to access your account.');
    if (!confirmed) return;

    const result = await revokeDevice(session.username, deviceId);
    if (result.success) {
      loadDevices(); // Reload device list
    } else {
      alert(result.error || 'Failed to revoke device');
    }
  };

  const toggleDevices = () => {
    if (!showDevices) {
      loadDevices();
    }
    setShowDevices(!showDevices);
  };

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
        <h3>CryptID: {session.username}</h3>
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

      {/* Email & Multi-Device Section */}
      <div className="profile-settings email-settings">
        <h4>Email & Devices</h4>

        {/* Email Status */}
        <div className="email-status-section">
          {emailStatus.linked ? (
            <div className="email-linked">
              <div className="email-info">
                <span className="email-label">Linked Email:</span>
                <span className="email-value">{emailStatus.email}</span>
                {emailStatus.verified ? (
                  <span className="email-verified-badge">Verified</span>
                ) : (
                  <span className="email-pending-badge">Pending Verification</span>
                )}
              </div>
              {!emailStatus.verified && (
                <p className="email-hint">Check your inbox for the verification email.</p>
              )}
              {emailStatus.verified && (
                <p className="email-hint">
                  You can now sign in on other devices using this email.
                </p>
              )}
            </div>
          ) : (
            <div className="email-not-linked">
              {!showEmailForm ? (
                <>
                  <p className="email-description">
                    Link an email to access your CryptID from multiple devices.
                  </p>
                  <button
                    onClick={() => setShowEmailForm(true)}
                    className="link-email-button"
                  >
                    Link Email Address
                  </button>
                </>
              ) : (
                <div className="email-form">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email..."
                    className="email-input"
                    disabled={emailLoading}
                  />
                  <div className="email-form-actions">
                    <button
                      onClick={handleLinkEmail}
                      className="save-button"
                      disabled={emailLoading || !email}
                    >
                      {emailLoading ? 'Linking...' : 'Link Email'}
                    </button>
                    <button
                      onClick={() => {
                        setShowEmailForm(false);
                        setEmail('');
                        setEmailError(null);
                      }}
                      className="cancel-button"
                      disabled={emailLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {emailError && <p className="email-error">{emailError}</p>}
          {emailSuccess && <p className="email-success">{emailSuccess}</p>}
        </div>

        {/* Linked Devices */}
        {emailStatus.linked && emailStatus.verified && (
          <div className="devices-section">
            <button onClick={toggleDevices} className="toggle-devices-button">
              {showDevices ? 'Hide Linked Devices' : 'View Linked Devices'}
            </button>

            {showDevices && (
              <div className="devices-list">
                {devicesLoading ? (
                  <p className="devices-loading">Loading devices...</p>
                ) : devices.length === 0 ? (
                  <p className="no-devices">No devices linked yet.</p>
                ) : (
                  <ul className="device-list">
                    {devices.map((device) => (
                      <li key={device.id} className={`device-item ${device.isCurrentDevice ? 'current-device' : ''}`}>
                        <div className="device-info">
                          <span className="device-name">
                            {device.deviceName}
                            {device.isCurrentDevice && <span className="current-badge"> (this device)</span>}
                          </span>
                          <span className="device-meta">
                            Added: {new Date(device.createdAt).toLocaleDateString()}
                            {device.lastUsed && ` | Last used: ${new Date(device.lastUsed).toLocaleDateString()}`}
                          </span>
                        </div>
                        {!device.isCurrentDevice && (
                          <button
                            onClick={() => handleRevokeDevice(device.id)}
                            className="revoke-device-button"
                            title="Revoke this device"
                          >
                            Revoke
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
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