import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import CryptID from './CryptID';
import { GoogleDataService, type GoogleService } from '../../lib/google';
import { GoogleExportBrowser } from '../GoogleExportBrowser';

interface CryptIDDropdownProps {
  isDarkMode?: boolean;
}

/**
 * CryptID dropdown component for the top-right corner.
 * Shows logged-in user with dropdown containing account info and integrations.
 */
const CryptIDDropdown: React.FC<CryptIDDropdownProps> = ({ isDarkMode = false }) => {
  const { session, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCryptIDModal, setShowCryptIDModal] = useState(false);
  const [showGoogleBrowser, setShowGoogleBrowser] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleCounts, setGoogleCounts] = useState<Record<GoogleService, number>>({
    gmail: 0,
    drive: 0,
    photos: 0,
    calendar: 0,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check Google connection on mount
  useEffect(() => {
    const checkGoogleStatus = async () => {
      try {
        const service = GoogleDataService.getInstance();
        const isAuthed = await service.isAuthenticated();
        setGoogleConnected(isAuthed);
        if (isAuthed) {
          const counts = await service.getStoredCounts();
          setGoogleCounts(counts);
        }
      } catch (error) {
        console.warn('Failed to check Google status:', error);
      }
    };
    checkGoogleStatus();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleGoogleConnect = async () => {
    setGoogleLoading(true);
    try {
      const service = GoogleDataService.getInstance();
      await service.authenticate(['gmail', 'drive', 'photos', 'calendar']);
      setGoogleConnected(true);
      const counts = await service.getStoredCounts();
      setGoogleCounts(counts);
    } catch (error) {
      console.error('Google auth failed:', error);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    try {
      const service = GoogleDataService.getInstance();
      await service.signOut();
      setGoogleConnected(false);
      setGoogleCounts({ gmail: 0, drive: 0, photos: 0, calendar: 0 });
    } catch (error) {
      console.error('Google disconnect failed:', error);
    }
  };

  const handleAddToCanvas = async (items: any[], position: { x: number; y: number }) => {
    // Emit event for canvas to handle
    window.dispatchEvent(new CustomEvent('add-google-items-to-canvas', {
      detail: { items, position }
    }));
    setShowGoogleBrowser(false);
    setShowDropdown(false);
  };

  const totalGoogleItems = Object.values(googleCounts).reduce((a, b) => a + b, 0);

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  // If showing CryptID modal
  if (showCryptIDModal) {
    return (
      <div className="cryptid-modal-overlay">
        <div className="cryptid-modal">
          <CryptID
            onSuccess={() => setShowCryptIDModal(false)}
            onCancel={() => setShowCryptIDModal(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="cryptid-dropdown" style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="cryptid-trigger"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: showDropdown ? 'var(--color-muted-2)' : 'none',
          border: 'none',
          padding: '4px 8px',
          borderRadius: '6px',
          cursor: 'pointer',
          color: 'var(--color-text-1)',
          transition: 'background 0.15s',
        }}
        title={session.authed ? session.username : 'Sign in with CryptID'}
      >
        {session.authed ? (
          <>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 600,
                color: 'white',
              }}
            >
              {getInitials(session.username)}
            </div>
            <span style={{ fontSize: '13px', fontWeight: 500, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {session.username}
            </span>
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>Sign In</span>
          </>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {/* Dropdown menu */}
      {showDropdown && (
        <div
          className="cryptid-dropdown-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: '260px',
            background: 'var(--color-panel)',
            border: '1px solid var(--color-panel-contrast)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 100000,
            overflow: 'hidden',
          }}
        >
          {session.authed ? (
            <>
              {/* Account section */}
              <div style={{ padding: '16px', borderBottom: '1px solid var(--color-panel-contrast)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: 600,
                      color: 'white',
                    }}
                  >
                    {getInitials(session.username)}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                      {session.username}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: '#22c55e' }}>&#x1F512;</span> CryptID secured
                    </div>
                  </div>
                </div>
              </div>

              {/* Integrations section */}
              <div style={{ padding: '8px 0' }}>
                <div style={{
                  padding: '8px 16px',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--color-text-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Integrations
                </div>

                {/* Google Workspace */}
                <div style={{ padding: '8px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'linear-gradient(135deg, #4285F4, #34A853, #FBBC04, #EA4335)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'white',
                    }}>
                      G
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                        Google Workspace
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
                        {googleConnected ? `${totalGoogleItems} items imported` : 'Not connected'}
                      </div>
                    </div>
                    {googleConnected && (
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#22c55e',
                      }} />
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {googleConnected ? (
                      <>
                        <button
                          onClick={() => {
                            setShowGoogleBrowser(true);
                            setShowDropdown(false);
                          }}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 500,
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#4285F4',
                            color: 'white',
                            cursor: 'pointer',
                          }}
                        >
                          Browse Data
                        </button>
                        <button
                          onClick={handleGoogleDisconnect}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 500,
                            borderRadius: '6px',
                            border: '1px solid var(--color-panel-contrast)',
                            backgroundColor: 'transparent',
                            color: 'var(--color-text-3)',
                            cursor: 'pointer',
                          }}
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleGoogleConnect}
                        disabled={googleLoading}
                        style={{
                          flex: 1,
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 500,
                          borderRadius: '6px',
                          border: '1px solid var(--color-panel-contrast)',
                          backgroundColor: 'transparent',
                          color: 'var(--color-text)',
                          cursor: googleLoading ? 'wait' : 'pointer',
                          opacity: googleLoading ? 0.7 : 1,
                        }}
                      >
                        {googleLoading ? 'Connecting...' : 'Connect Google'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sign out */}
              <div style={{ padding: '8px 16px', borderTop: '1px solid var(--color-panel-contrast)' }}>
                <button
                  onClick={async () => {
                    await logout();
                    setShowDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--color-text-3)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-muted-2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
                  Sign in with CryptID
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-3)', lineHeight: 1.4 }}>
                  Create a username to edit boards and sync your data across devices.
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCryptIDModal(true);
                  setShowDropdown(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Create or Sign In
              </button>
            </div>
          )}
        </div>
      )}

      {/* Google Export Browser Modal */}
      {showGoogleBrowser && (
        <GoogleExportBrowser
          isOpen={showGoogleBrowser}
          onClose={() => setShowGoogleBrowser(false)}
          onAddToCanvas={handleAddToCanvas}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};

export default CryptIDDropdown;
