import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useEditor, useValue } from 'tldraw';
import CryptID from './CryptID';
import { GoogleDataService, type GoogleService } from '../../lib/google';
import { GoogleExportBrowser } from '../GoogleExportBrowser';
import { getFathomApiKey, saveFathomApiKey, removeFathomApiKey, isFathomApiKeyConfigured } from '../../lib/fathomApiKey';
import { isMiroApiKeyConfigured } from '../../lib/miroApiKey';
import { MiroIntegrationModal } from '../MiroIntegrationModal';
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
  const [showMiroModal, setShowMiroModal] = useState(false);
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
  const dropdownMenuRef = useRef<HTMLDivElement>(null);

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

  // Get editor - will throw if outside tldraw context, but that's handled by ErrorBoundary
  // Note: These hooks must always be called unconditionally
  const editorFromHook = useEditor();
  const collaborators = useValue('collaborators', () => editorFromHook?.getCollaborators() || [], [editorFromHook]) || [];

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

  // Load connections when authenticated, clear when logged out
  useEffect(() => {
    const loadConnections = async () => {
      if (!session.authed || !session.username) {
        // Clear connections state when user logs out
        setConnections([]);
        setConnectionsLoading(false);
        return;
      }
      setConnectionsLoading(true);
      try {
        const myConnections = await getMyConnections();
        setConnections(myConnections as UserConnectionWithProfile[]);
      } catch (error) {
        // Don't log as error - this is expected when worker isn't running
        if (import.meta.env.DEV) {
          console.warn('Connections API unavailable (worker may not be running)');
        }
        setConnections([]); // Clear on error too
      } finally {
        setConnectionsLoading(false);
      }
    };
    loadConnections();
  }, [session.authed, session.username]);

  // Listen for session-cleared event to immediately clear connections state
  useEffect(() => {
    const handleSessionCleared = () => {
      setConnections([]);
      setConnectionsLoading(false);
      setShowDropdown(false);
      setShowCryptIDModal(false);
      setExpandedSection('none');
      setEditingConnectionId(null);
      setEditingMetadata({});
    };

    window.addEventListener('session-cleared', handleSessionCleared);
    return () => window.removeEventListener('session-cleared', handleSessionCleared);
  }, []);

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
      const target = e.target as Node;
      // Check if click is inside trigger button OR the portal dropdown menu
      const isInsideTrigger = dropdownRef.current && dropdownRef.current.contains(target);
      const isInsideMenu = dropdownMenuRef.current && dropdownMenuRef.current.contains(target);
      if (!isInsideTrigger && !isInsideMenu) {
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

  // Ref for the trigger button to calculate dropdown position
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);

  // Update dropdown position when it opens
  useEffect(() => {
    if (showDropdown && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [showDropdown]);

  // Close dropdown when user logs out
  useEffect(() => {
    if (!session.authed) {
      setShowDropdown(false);
    }
  }, [session.authed]);

  return (
    <div ref={dropdownRef} className="cryptid-dropdown" style={{ pointerEvents: 'all' }}>
      {/* Trigger button - opens modal directly for unauthenticated users, dropdown for authenticated */}
      <button
        ref={triggerRef}
        onClick={() => {
          if (session.authed) {
            setShowDropdown(!showDropdown);
          } else {
            setShowCryptIDModal(true);
          }
        }}
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
            {/* Locked lock icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span style={{ fontSize: '13px', fontWeight: 500, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {session.username}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </>
        ) : (
          <>
            {/* Unlocked lock icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
            </svg>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>Sign In</span>
          </>
        )}
      </button>


      {/* Dropdown menu - rendered via portal to break out of parent container */}
      {showDropdown && dropdownPosition && createPortal(
        <div
          ref={dropdownMenuRef}
          className="cryptid-dropdown-menu"
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            right: dropdownPosition.right,
            minWidth: '260px',
            maxHeight: 'calc(100vh - 100px)',
            background: 'var(--color-background, #ffffff)',
            backgroundColor: 'var(--color-background, #ffffff)',
            border: '1px solid var(--color-grid)',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.08)',
            zIndex: 100000,
            overflowY: 'auto',
            overflowX: 'hidden',
            pointerEvents: 'all',
            fontFamily: 'var(--tl-font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
            backdropFilter: 'none',
            opacity: 1,
          }}
          onWheel={(e) => {
            // Stop wheel events from propagating to canvas when over menu
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {session.authed ? (
            <>
              {/* Account section */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-grid)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '6px',
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'white',
                    }}
                  >
                    {getInitials(session.username)}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                      {session.username}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="#22c55e" stroke="#22c55e" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      CryptID secured
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div style={{ padding: '8px', borderBottom: '1px solid var(--color-grid)' }}>
                <a
                  href="/dashboard/"
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'white',
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                    borderRadius: '6px',
                    pointerEvents: 'all',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(99, 102, 241, 0.4)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(99, 102, 241, 0.3)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  My Saved Boards
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"/>
                    <polyline points="7 7 17 7 17 17"/>
                  </svg>
                </a>
              </div>

              {/* Integrations section */}
              <div style={{ padding: '4px' }}>
                <div style={{
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'var(--color-text-2)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}>
                  Integrations
                </div>

                {/* Google Workspace - Coming Soon */}
                <div style={{ padding: '6px 10px', opacity: 0.6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      background: 'linear-gradient(135deg, #4285F4, #34A853, #FBBC04, #EA4335)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'white',
                    }}>
                      G
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                        Google Workspace
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-2)' }}>
                        Coming soon
                      </div>
                    </div>
                  </div>

                  <button
                    disabled
                    style={{
                      width: '100%',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: 'none',
                      background: '#9ca3af',
                      color: 'white',
                      cursor: 'not-allowed',
                      pointerEvents: 'none',
                    }}
                  >
                    Coming Soon
                  </button>
                </div>

                {/* Obsidian Vault */}
                <div style={{ padding: '6px 10px', borderTop: '1px solid var(--color-grid)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      background: '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                    }}>
                      📁
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                        Obsidian Vault
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-2)' }}>
                        {session.obsidianVaultName || 'Not connected'}
                      </div>
                    </div>
                    {session.obsidianVaultName && (
                      <span style={{
                        width: '6px',
                        height: '6px',
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
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: 'none',
                      background: session.obsidianVaultName
                        ? '#6b7280'
                        : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                      color: 'white',
                      cursor: 'pointer',
                      pointerEvents: 'all',
                      transition: 'all 0.15s',
                      boxShadow: session.obsidianVaultName
                        ? 'none'
                        : '0 2px 4px rgba(139, 92, 246, 0.3)',
                    }}
                    onMouseEnter={(e) => {
                      if (session.obsidianVaultName) {
                        e.currentTarget.style.background = '#4b5563';
                      } else {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(139, 92, 246, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (session.obsidianVaultName) {
                        e.currentTarget.style.background = '#6b7280';
                      } else {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(139, 92, 246, 0.3)';
                      }
                    }}
                  >
                    {session.obsidianVaultName ? 'Change Vault' : 'Connect Vault'}
                  </button>
                </div>

                {/* Fathom Meetings */}
                <div style={{ padding: '6px 10px', borderTop: '1px solid var(--color-grid)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      background: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                    }}>
                      🎥
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                        Fathom Meetings
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-2)' }}>
                        {hasFathomApiKey ? 'Connected' : 'Not connected'}
                      </div>
                    </div>
                    {hasFathomApiKey && (
                      <span style={{
                        width: '6px',
                        height: '6px',
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
                          border: '1px solid var(--color-grid)',
                          borderRadius: '4px',
                          marginBottom: '6px',
                          background: 'var(--color-background)',
                          color: 'var(--color-text)',
                          boxSizing: 'border-box',
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
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 500,
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: '1px solid #2563eb',
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
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 500,
                            backgroundColor: 'var(--color-low)',
                            border: '1px solid var(--color-grid)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: 'var(--color-text)',
                            pointerEvents: 'all',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--color-muted-2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--color-low)';
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => {
                          setShowFathomInput(true);
                          const currentKey = getFathomApiKey(session.username);
                          if (currentKey) setFathomKeyInput(currentKey);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          borderRadius: '4px',
                          border: 'none',
                          background: hasFathomApiKey
                            ? '#6b7280'
                            : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                          color: 'white',
                          cursor: 'pointer',
                          pointerEvents: 'all',
                          transition: 'all 0.15s',
                          boxShadow: hasFathomApiKey
                            ? 'none'
                            : '0 2px 4px rgba(139, 92, 246, 0.3)',
                        }}
                        onMouseEnter={(e) => {
                          if (hasFathomApiKey) {
                            e.currentTarget.style.background = '#4b5563';
                          } else {
                            e.currentTarget.style.background = 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(139, 92, 246, 0.4)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (hasFathomApiKey) {
                            e.currentTarget.style.background = '#6b7280';
                          } else {
                            e.currentTarget.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(139, 92, 246, 0.3)';
                          }
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
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 500,
                            borderRadius: '4px',
                            border: 'none',
                            background: '#6b7280',
                            color: 'white',
                            cursor: 'pointer',
                            pointerEvents: 'all',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#4b5563';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#6b7280';
                          }}
                        >
                          Disconnect
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Miro Board Import - Coming Soon */}
                <div style={{ padding: '6px 10px', borderTop: '1px solid var(--color-grid)', opacity: 0.6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      background: 'linear-gradient(135deg, #ffd02f 0%, #f2c94c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M17.5 3H21V21H17.5L14 12L17.5 3Z" fill="#050038"/>
                        <path d="M10.5 3H14L10.5 12L14 21H10.5L7 12L10.5 3Z" fill="#050038"/>
                        <path d="M3 3H6.5L3 12L6.5 21H3V3Z" fill="#050038"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                        Miro Boards
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-2)' }}>
                        Coming soon
                      </div>
                    </div>
                  </div>
                  <button
                    disabled
                    style={{
                      width: '100%',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: 'none',
                      background: '#9ca3af',
                      color: 'white',
                      cursor: 'not-allowed',
                      pointerEvents: 'none',
                    }}
                  >
                    Coming Soon
                  </button>
                </div>
              </div>

              {/* Sign out */}
              <div style={{ padding: '8px 10px', borderTop: '1px solid var(--color-grid)' }}>
                <button
                  onClick={async () => {
                    await logout();
                    setShowDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#4b5563';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#6b7280';
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Sign out
                </button>
              </div>
            </>
          ) : null}
        </div>,
        document.body
      )}

      {/* Google Export Browser Modal */}
      {showGoogleBrowser && createPortal(
        <GoogleExportBrowser
          isOpen={showGoogleBrowser}
          onClose={() => setShowGoogleBrowser(false)}
          onAddToCanvas={handleAddToCanvas}
          isDarkMode={isDarkMode}
        />,
        document.body
      )}

      {/* Obsidian Vault Connection Modal */}
      {showObsidianModal && createPortal(
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
        </div>,
        document.body
      )}

      {/* Miro Integration Modal */}
      {showMiroModal && createPortal(
        <MiroIntegrationModal
          isOpen={showMiroModal}
          onClose={() => setShowMiroModal(false)}
          username={session.username}
        />,
        document.body
      )}

      {/* CryptID Sign In Modal - rendered via portal */}
      {showCryptIDModal && createPortal(
        <div
          className="cryptid-modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCryptIDModal(false);
            }
          }}
        >
          <div
            className="cryptid-modal"
            style={{
              backgroundColor: 'var(--color-panel, #ffffff)',
              borderRadius: '16px',
              padding: '0',
              maxWidth: '580px',
              width: '95vw',
              maxHeight: '90vh',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.4)',
              overflow: 'auto',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowCryptIDModal(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'var(--color-muted-2, #f3f4f6)',
                border: 'none',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-2, #6b7280)',
                fontSize: '16px',
                zIndex: 1,
              }}
            >
              ×
            </button>

            <CryptID
              onSuccess={() => setShowCryptIDModal(false)}
              onCancel={() => setShowCryptIDModal(false)}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CryptIDDropdown;
