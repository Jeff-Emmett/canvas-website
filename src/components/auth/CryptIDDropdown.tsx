import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEditor, useValue } from 'tldraw';
import CryptID from './CryptID';
import { GoogleDataService, type GoogleService } from '../../lib/google';
import { GoogleExportBrowser } from '../GoogleExportBrowser';
import { getFathomApiKey, saveFathomApiKey, removeFathomApiKey, isFathomApiKeyConfigured } from '../../lib/fathomApiKey';
import { getMyConnections, createConnection, removeConnection, updateTrustLevel, updateEdgeMetadata } from '../../lib/networking/connectionService';
import { TRUST_LEVEL_COLORS, type TrustLevel, type UserConnectionWithProfile, type EdgeMetadata } from '../../lib/networking/types';

interface CryptIDDropdownProps {
  isDarkMode?: boolean;
}

/**
 * CryptID dropdown component for the top-right corner.
 * Shows logged-in user with dropdown containing account info and integrations.
 */
const CryptIDDropdown: React.FC<CryptIDDropdownProps> = ({ isDarkMode = false }) => {
  const { session, logout, updateSession } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCryptIDModal, setShowCryptIDModal] = useState(false);
  const [showGoogleBrowser, setShowGoogleBrowser] = useState(false);
  const [showObsidianModal, setShowObsidianModal] = useState(false);
  const [obsidianVaultUrl, setObsidianVaultUrl] = useState('');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleCounts, setGoogleCounts] = useState<Record<GoogleService, number>>({
    gmail: 0,
    drive: 0,
    photos: 0,
    calendar: 0,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Expanded sections (only integrations and connections now)
  const [expandedSection, setExpandedSection] = useState<'none' | 'integrations' | 'connections'>('none');

  // Fathom API key state
  const [hasFathomApiKey, setHasFathomApiKey] = useState(false);
  const [showFathomInput, setShowFathomInput] = useState(false);
  const [fathomKeyInput, setFathomKeyInput] = useState('');

  // Connections state
  const [connections, setConnections] = useState<UserConnectionWithProfile[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [editingMetadata, setEditingMetadata] = useState<Partial<EdgeMetadata>>({});
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [connectingUserId, setConnectingUserId] = useState<string | null>(null);

  // Try to get editor (may not exist if outside tldraw context)
  let editor: any = null;
  let collaborators: any[] = [];
  try {
    editor = useEditor();
    collaborators = useValue('collaborators', () => editor?.getCollaborators() || [], [editor]) || [];
  } catch {
    // Not inside tldraw context
  }

  // Canvas users with their connection status
  interface CanvasUser {
    id: string;
    name: string;
    color: string;
    connectionStatus: 'trusted' | 'connected' | 'unconnected';
    connectionId?: string;
  }

  const canvasUsers: CanvasUser[] = useMemo(() => {
    if (!collaborators || collaborators.length === 0) return [];

    return collaborators.map((c: any) => {
      const userId = c.userId || c.id || c.instanceId;
      const connection = connections.find(conn => conn.toUserId === userId);

      return {
        id: userId,
        name: c.userName || c.name || 'Anonymous',
        color: c.color || '#888',
        connectionStatus: (connection?.trustLevel || 'unconnected') as CanvasUser['connectionStatus'],
        connectionId: connection?.id,
      };
    }).filter((user) => user.name !== session.username);
  }, [collaborators, connections, session.username]);

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

  // Check Fathom API key
  useEffect(() => {
    if (session.authed && session.username) {
      setHasFathomApiKey(isFathomApiKeyConfigured(session.username));
    }
  }, [session.authed, session.username]);

  // Load connections when authenticated
  useEffect(() => {
    const loadConnections = async () => {
      if (!session.authed || !session.username) return;
      setConnectionsLoading(true);
      try {
        const myConnections = await getMyConnections();
        setConnections(myConnections as UserConnectionWithProfile[]);
      } catch (error) {
        console.error('Failed to load connections:', error);
      } finally {
        setConnectionsLoading(false);
      }
    };
    loadConnections();
  }, [session.authed, session.username]);

  // Connection handlers
  const handleConnect = async (userId: string, trustLevel: TrustLevel) => {
    if (!session.authed || !session.username) return;
    setConnectingUserId(userId);
    try {
      const newConnection = await createConnection(userId, trustLevel);
      if (newConnection) {
        setConnections(prev => [...prev, newConnection as UserConnectionWithProfile]);
      }
    } catch (error) {
      console.error('Failed to create connection:', error);
    } finally {
      setConnectingUserId(null);
    }
  };

  const handleDisconnect = async (connectionId: string, userId: string) => {
    setConnectingUserId(userId);
    try {
      await removeConnection(connectionId);
      setConnections(prev => prev.filter(c => c.id !== connectionId));
    } catch (error) {
      console.error('Failed to remove connection:', error);
    } finally {
      setConnectingUserId(null);
    }
  };

  const handleChangeTrust = async (connectionId: string, userId: string, newLevel: TrustLevel) => {
    setConnectingUserId(userId);
    try {
      const updated = await updateTrustLevel(connectionId, newLevel);
      if (updated) {
        setConnections(prev => prev.map(c => c.id === connectionId ? updated : c));
      }
    } catch (error) {
      console.error('Failed to update trust level:', error);
    } finally {
      setConnectingUserId(null);
    }
  };

  const handleSaveMetadata = async (connectionId: string) => {
    setSavingMetadata(true);
    try {
      const updatedMetadata = await updateEdgeMetadata(connectionId, editingMetadata);
      if (updatedMetadata) {
        setConnections(prev => prev.map(c =>
          c.id === connectionId ? { ...c, metadata: updatedMetadata } : c
        ));
      }
      setEditingConnectionId(null);
      setEditingMetadata({});
    } catch (error) {
      console.error('Failed to save metadata:', error);
    } finally {
      setSavingMetadata(false);
    }
  };

  // Close dropdown when clicking outside or pressing ESC
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      // Use capture phase to intercept before tldraw
      document.addEventListener('keydown', handleKeyDown, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [showDropdown]);

  const handleGoogleConnect = async () => {
    setGoogleLoading(true);
    try {
      const service = GoogleDataService.getInstance();
      await service.authenticate(['gmail', 'drive', 'photos', 'calendar']);
      setGoogleConnected(true);
      const counts = await service.getStoredCounts();
      setGoogleCounts(counts);
      // After successful connection, open the Google Export Browser
      setShowGoogleBrowser(true);
      setShowDropdown(false);
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
    <div ref={dropdownRef} className="cryptid-dropdown" style={{ position: 'relative', pointerEvents: 'all' }}>
      {/* Trigger button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        onPointerDown={(e) => e.stopPropagation()}
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
          pointerEvents: 'all',
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
            maxHeight: 'calc(100vh - 100px)',
            background: 'var(--color-panel)',
            border: '1px solid var(--color-panel-contrast)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 100000,
            overflowY: 'auto',
            overflowX: 'hidden',
            pointerEvents: 'all',
          }}
          onWheel={(e) => {
            // Stop wheel events from propagating to canvas when over menu
            e.stopPropagation();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
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

              {/* Quick actions */}
              <div style={{ padding: '8px 0', borderBottom: '1px solid var(--color-panel-contrast)' }}>
                <a
                  href="/dashboard/"
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--color-text)',
                    textDecoration: 'none',
                    transition: 'background 0.15s, transform 0.15s',
                    borderRadius: '6px',
                    margin: '0 8px',
                    pointerEvents: 'all',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-muted-2)';
                    e.currentTarget.style.transform = 'translateX(2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  My Saved Boards
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', opacity: 0.5 }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </a>
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
                          onPointerDown={(e) => e.stopPropagation()}
                          style={{
                            flex: 1,
                            padding: '8px 14px',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #4285F4, #34A853)',
                            color: 'white',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(66, 133, 244, 0.3)',
                            pointerEvents: 'all',
                          }}
                        >
                          Browse Data
                        </button>
                        <button
                          onClick={handleGoogleDisconnect}
                          onPointerDown={(e) => e.stopPropagation()}
                          style={{
                            padding: '8px 14px',
                            fontSize: '12px',
                            fontWeight: 500,
                            borderRadius: '6px',
                            border: '1px solid var(--color-panel-contrast)',
                            backgroundColor: 'var(--color-muted-2)',
                            color: 'var(--color-text)',
                            cursor: 'pointer',
                            pointerEvents: 'all',
                          }}
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleGoogleConnect}
                        onPointerDown={(e) => e.stopPropagation()}
                        disabled={googleLoading}
                        style={{
                          flex: 1,
                          padding: '8px 16px',
                          fontSize: '12px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #4285F4, #34A853)',
                          color: 'white',
                          cursor: googleLoading ? 'wait' : 'pointer',
                          opacity: googleLoading ? 0.7 : 1,
                          transition: 'transform 0.15s, box-shadow 0.15s',
                          boxShadow: '0 2px 8px rgba(66, 133, 244, 0.3)',
                          pointerEvents: 'all',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(66, 133, 244, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(66, 133, 244, 0.3)';
                        }}
                      >
                        {googleLoading ? 'Connecting...' : 'Connect Google'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Obsidian Vault */}
                <div style={{ padding: '8px 16px', borderTop: '1px solid var(--color-panel-contrast)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                    }}>
                      📁
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                        Obsidian Vault
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
                        {session.obsidianVaultName || 'Not connected'}
                      </div>
                    </div>
                    {session.obsidianVaultName && (
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#22c55e',
                      }} />
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowObsidianModal(true);
                      setShowDropdown(false);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      background: session.obsidianVaultName
                        ? 'var(--color-muted-2)'
                        : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                      color: session.obsidianVaultName ? 'var(--color-text)' : 'white',
                      cursor: 'pointer',
                      boxShadow: session.obsidianVaultName ? 'none' : '0 2px 8px rgba(124, 58, 237, 0.3)',
                      pointerEvents: 'all',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!session.obsidianVaultName) {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = session.obsidianVaultName ? 'none' : '0 2px 8px rgba(124, 58, 237, 0.3)';
                    }}
                  >
                    {session.obsidianVaultName ? 'Change Vault' : 'Connect Vault'}
                  </button>
                </div>

                {/* Fathom Meetings */}
                <div style={{ padding: '8px 16px', borderTop: '1px solid var(--color-panel-contrast)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                    }}>
                      🎥
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                        Fathom Meetings
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
                        {hasFathomApiKey ? 'Connected' : 'Not connected'}
                      </div>
                    </div>
                    {hasFathomApiKey && (
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#22c55e',
                      }} />
                    )}
                  </div>
                  {showFathomInput ? (
                    <div>
                      <input
                        type="password"
                        value={fathomKeyInput}
                        onChange={(e) => setFathomKeyInput(e.target.value)}
                        placeholder="Enter Fathom API key..."
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          fontSize: '11px',
                          border: '1px solid var(--color-panel-contrast)',
                          borderRadius: '4px',
                          marginBottom: '6px',
                          background: 'var(--color-panel)',
                          color: 'var(--color-text)',
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && fathomKeyInput.trim()) {
                            saveFathomApiKey(fathomKeyInput.trim(), session.username);
                            setHasFathomApiKey(true);
                            setShowFathomInput(false);
                            setFathomKeyInput('');
                          } else if (e.key === 'Escape') {
                            setShowFathomInput(false);
                            setFathomKeyInput('');
                          }
                        }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            if (fathomKeyInput.trim()) {
                              saveFathomApiKey(fathomKeyInput.trim(), session.username);
                              setHasFathomApiKey(true);
                              setShowFathomInput(false);
                              setFathomKeyInput('');
                            }
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            pointerEvents: 'all',
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setShowFathomInput(false);
                            setFathomKeyInput('');
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            fontSize: '11px',
                            fontWeight: 500,
                            backgroundColor: 'var(--color-muted-2)',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: 'var(--color-text)',
                            pointerEvents: 'all',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setShowFathomInput(true);
                          const currentKey = getFathomApiKey(session.username);
                          if (currentKey) setFathomKeyInput(currentKey);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          padding: '8px 16px',
                          fontSize: '12px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: 'none',
                          background: hasFathomApiKey
                            ? 'var(--color-muted-2)'
                            : 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                          color: hasFathomApiKey ? 'var(--color-text)' : 'white',
                          cursor: 'pointer',
                          boxShadow: hasFathomApiKey ? 'none' : '0 2px 8px rgba(239, 68, 68, 0.3)',
                          pointerEvents: 'all',
                          transition: 'transform 0.15s, box-shadow 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!hasFathomApiKey) {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = hasFathomApiKey ? 'none' : '0 2px 8px rgba(239, 68, 68, 0.3)';
                        }}
                      >
                        {hasFathomApiKey ? 'Change Key' : 'Add API Key'}
                      </button>
                      {hasFathomApiKey && (
                        <button
                          onClick={() => {
                            removeFathomApiKey(session.username);
                            setHasFathomApiKey(false);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          style={{
                            padding: '8px 14px',
                            fontSize: '12px',
                            fontWeight: 500,
                            borderRadius: '6px',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            border: 'none',
                            cursor: 'pointer',
                            pointerEvents: 'all',
                          }}
                        >
                          Disconnect
                        </button>
                      )}
                    </div>
                  )}
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

      {/* Obsidian Vault Connection Modal */}
      {showObsidianModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100001,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowObsidianModal(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-panel)',
              borderRadius: '16px',
              padding: '24px',
              width: '400px',
              maxWidth: '90vw',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
              }}>
                📁
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--color-text)' }}>
                  Connect Obsidian Vault
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-3)' }}>
                  Import your notes to the canvas
                </p>
              </div>
            </div>

            {session.obsidianVaultName && (
              <div style={{
                padding: '12px',
                backgroundColor: 'rgba(124, 58, 237, 0.1)',
                borderRadius: '8px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <span style={{ color: '#22c55e', fontSize: '16px' }}>✓</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                    Currently connected
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>
                    {session.obsidianVaultName}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Option 1: Select Local Folder */}
              <button
                onClick={async () => {
                  try {
                    // Use File System Access API
                    const dirHandle = await (window as any).showDirectoryPicker({
                      mode: 'read',
                    });
                    const vaultName = dirHandle.name;
                    updateSession({
                      obsidianVaultPath: 'folder-selected',
                      obsidianVaultName: vaultName,
                    });
                    setShowObsidianModal(false);
                    // Dispatch event to open browser on canvas
                    window.dispatchEvent(new CustomEvent('open-obsidian-browser'));
                  } catch (err: any) {
                    if (err.name !== 'AbortError') {
                      console.error('Failed to select folder:', err);
                    }
                  }
                }}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                Select Local Folder
              </button>

              {/* Option 2: Enter URL */}
              <div style={{ position: 'relative' }}>
                <input
                  type="url"
                  placeholder="Or enter Quartz/Obsidian Publish URL..."
                  value={obsidianVaultUrl}
                  onChange={(e) => setObsidianVaultUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && obsidianVaultUrl.trim()) {
                      updateSession({
                        obsidianVaultPath: obsidianVaultUrl.trim(),
                        obsidianVaultName: new URL(obsidianVaultUrl.trim()).hostname,
                      });
                      setShowObsidianModal(false);
                      setObsidianVaultUrl('');
                      window.dispatchEvent(new CustomEvent('open-obsidian-browser'));
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-panel-contrast)',
                    background: 'var(--color-panel)',
                    color: 'var(--color-text)',
                    outline: 'none',
                  }}
                />
                {obsidianVaultUrl && (
                  <button
                    onClick={() => {
                      if (obsidianVaultUrl.trim()) {
                        try {
                          updateSession({
                            obsidianVaultPath: obsidianVaultUrl.trim(),
                            obsidianVaultName: new URL(obsidianVaultUrl.trim()).hostname,
                          });
                          setShowObsidianModal(false);
                          setObsidianVaultUrl('');
                          window.dispatchEvent(new CustomEvent('open-obsidian-browser'));
                        } catch (err) {
                          console.error('Invalid URL:', err);
                        }
                      }
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      background: '#7c3aed',
                      color: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    Connect
                  </button>
                )}
              </div>

              {session.obsidianVaultName && (
                <button
                  onClick={() => {
                    updateSession({
                      obsidianVaultPath: undefined,
                      obsidianVaultName: undefined,
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    cursor: 'pointer',
                  }}
                >
                  Disconnect Vault
                </button>
              )}
            </div>

            <button
              onClick={() => setShowObsidianModal(false)}
              style={{
                width: '100%',
                marginTop: '16px',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--color-muted-2)',
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CryptIDDropdown;
