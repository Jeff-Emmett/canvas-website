import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { WORKER_URL } from '../constants/workerUrl';
import * as crypto from '../lib/auth/crypto';

interface BoardSettingsDropdownProps {
  className?: string;
}

interface BoardInfo {
  id: string;
  name: string | null;
  isProtected: boolean;
  ownerUsername: string | null;
}

interface Editor {
  userId: string;
  username: string;
  email: string;
  permission: string;
  grantedAt: string;
}

const BoardSettingsDropdown: React.FC<BoardSettingsDropdownProps> = ({ className = '' }) => {
  const { slug } = useParams<{ slug: string }>();
  const { session } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [boardInfo, setBoardInfo] = useState<BoardInfo | null>(null);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [requestingAdmin, setRequestingAdmin] = useState(false);
  const [adminRequestSent, setAdminRequestSent] = useState(false);
  const [adminRequestError, setAdminRequestError] = useState<string | null>(null);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);

  const boardId = slug || 'mycofi33';

  // Get auth headers
  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session.authed && session.username) {
      const publicKey = crypto.getPublicKey(session.username);
      if (publicKey) {
        headers['X-CryptID-PublicKey'] = publicKey;
      }
    }
    return headers;
  };

  // Fetch board info and admin status
  const fetchBoardData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();

      // Fetch board info
      const infoRes = await fetch(`${WORKER_URL}/boards/${boardId}/info`, { headers });
      const infoData = await infoRes.json() as { board?: BoardInfo };
      if (infoData.board) {
        setBoardInfo(infoData.board);
      }

      // Fetch permission to check if admin
      const permRes = await fetch(`${WORKER_URL}/boards/${boardId}/permission`, { headers });
      const permData = await permRes.json() as { permission?: string; isGlobalAdmin?: boolean };
      setIsAdmin(permData.permission === 'admin');
      setIsGlobalAdmin(permData.isGlobalAdmin || false);

      // If admin, fetch editors list
      if (permData.permission === 'admin') {
        const editorsRes = await fetch(`${WORKER_URL}/boards/${boardId}/editors`, { headers });
        const editorsData = await editorsRes.json() as { editors?: Editor[] };
        setEditors(editorsData.editors || []);
      }
    } catch (error) {
      console.error('Failed to fetch board data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle board protection
  const toggleProtection = async () => {
    if (!boardInfo || updating) return;

    setUpdating(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${WORKER_URL}/boards/${boardId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isProtected: !boardInfo.isProtected }),
      });

      if (res.ok) {
        setBoardInfo(prev => prev ? { ...prev, isProtected: !prev.isProtected } : null);
      }
    } catch (error) {
      console.error('Failed to toggle protection:', error);
    } finally {
      setUpdating(false);
    }
  };

  // Request admin access
  const requestAdminAccess = async () => {
    if (requestingAdmin || adminRequestSent) return;

    setRequestingAdmin(true);
    setAdminRequestError(null);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${WORKER_URL}/admin/request`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: `Requesting admin access for board: ${boardId}` }),
      });

      const data = await res.json() as { success?: boolean; message?: string; error?: string };

      if (res.ok && data.success) {
        setAdminRequestSent(true);
      } else {
        setAdminRequestError(data.error || data.message || 'Failed to send request');
      }
    } catch (error) {
      console.error('Failed to request admin:', error);
      setAdminRequestError('Network error - please try again');
    } finally {
      setRequestingAdmin(false);
    }
  };

  // Invite user as editor
  const inviteEditor = async () => {
    if (!inviteInput.trim() || inviteStatus === 'sending') return;

    setInviteStatus('sending');
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${WORKER_URL}/boards/${boardId}/permissions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          usernameOrEmail: inviteInput.trim(),
          permission: 'edit',
        }),
      });

      if (res.ok) {
        setInviteStatus('sent');
        setInviteInput('');
        // Refresh editors list
        fetchBoardData();
        setTimeout(() => setInviteStatus('idle'), 2000);
      } else {
        setInviteStatus('error');
        setTimeout(() => setInviteStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Failed to invite editor:', error);
      setInviteStatus('error');
      setTimeout(() => setInviteStatus('idle'), 3000);
    }
  };

  // Remove editor
  const removeEditor = async (userId: string) => {
    try {
      const headers = getAuthHeaders();
      await fetch(`${WORKER_URL}/boards/${boardId}/permissions/${userId}`, {
        method: 'DELETE',
        headers,
      });
      setEditors(prev => prev.filter(e => e.userId !== userId));
    } catch (error) {
      console.error('Failed to remove editor:', error);
    }
  };

  // Update dropdown position when it opens
  useEffect(() => {
    if (showDropdown && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
      fetchBoardData();
    }
  }, [showDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
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
      document.addEventListener('keydown', handleKeyDown, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [showDropdown]);

  return (
    <div ref={dropdownRef} style={{ pointerEvents: 'all' }}>
      <button
        ref={triggerRef}
        onClick={() => setShowDropdown(!showDropdown)}
        className={`board-settings-button ${className}`}
        title="Board Settings"
        style={{
          background: showDropdown ? 'var(--color-muted-2)' : 'none',
          border: 'none',
          padding: '6px',
          cursor: 'pointer',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-1)',
          opacity: showDropdown ? 1 : 0.7,
          transition: 'opacity 0.15s, background 0.15s',
          pointerEvents: 'all',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.background = 'var(--color-muted-2)';
        }}
        onMouseLeave={(e) => {
          if (!showDropdown) {
            e.currentTarget.style.opacity = '0.7';
            e.currentTarget.style.background = 'none';
          }
        }}
      >
        {/* Settings gear icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {showDropdown && dropdownPosition && createPortal(
        <div
          ref={dropdownMenuRef}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            right: dropdownPosition.right,
            width: '320px',
            maxHeight: '80vh',
            overflowY: 'auto',
            background: 'var(--color-panel)',
            border: '1px solid var(--color-panel-contrast)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 100000,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          }}
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--color-panel-contrast)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>&#9881;</span> Board Settings
            </span>
            <button
              onClick={() => setShowDropdown(false)}
              style={{
                background: 'var(--color-muted-2)',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                color: 'var(--color-text-3)',
                fontSize: '11px',
                fontFamily: 'inherit',
                borderRadius: '4px',
              }}
            >
              &#10005;
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-3)' }}>
              Loading...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>

              {/* Board Info Section */}
              <div style={{ padding: '14px', background: 'var(--color-muted-2)', borderBottom: '1px solid var(--color-panel-contrast)' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  Board Info
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-1)' }}>
                  <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--color-text-3)', minWidth: '50px' }}>ID:</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{boardId}</span>
                  </div>
                  {boardInfo?.ownerUsername && (
                    <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--color-text-3)', minWidth: '50px' }}>Owner:</span>
                      <span>@{boardInfo.ownerUsername}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--color-text-3)', minWidth: '50px' }}>Status:</span>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      background: boardInfo?.isProtected ? '#fef3c7' : '#d1fae5',
                      color: boardInfo?.isProtected ? '#92400e' : '#065f46',
                    }}>
                      {boardInfo?.isProtected ? 'Protected' : 'Open'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Admin Section - Protection Settings */}
              {isAdmin && (
                <>
                  <div style={{ padding: '14px', background: 'var(--color-panel)', borderBottom: '1px solid var(--color-panel-contrast)' }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      marginBottom: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                      Protection {isGlobalAdmin && <span style={{ color: '#3b82f6', fontWeight: 500, fontSize: '10px' }}>(Global Admin)</span>}
                    </div>

                    {/* Protection Toggle */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--color-muted-2)',
                      borderRadius: '8px',
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)' }}>
                          View-only Mode
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>
                          Only listed editors can make changes
                        </div>
                      </div>
                      <button
                        onClick={toggleProtection}
                        disabled={updating}
                        style={{
                          width: '44px',
                          height: '24px',
                          borderRadius: '12px',
                          border: 'none',
                          cursor: updating ? 'not-allowed' : 'pointer',
                          background: boardInfo?.isProtected ? '#3b82f6' : '#d1d5db',
                          position: 'relative',
                          transition: 'background 0.2s',
                        }}
                      >
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '10px',
                          background: 'white',
                          position: 'absolute',
                          top: '2px',
                          left: boardInfo?.isProtected ? '22px' : '2px',
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </button>
                    </div>
                  </div>

                  {/* Editor Management (only when protected) */}
                  {boardInfo?.isProtected && (
                    <div style={{ padding: '14px', background: 'var(--color-muted-2)', borderBottom: '1px solid var(--color-panel-contrast)' }}>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--color-text)',
                        marginBottom: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        Editors ({editors.length})
                      </div>

                      {/* Add Editor Input */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        <input
                          type="text"
                          placeholder="Username or email..."
                          value={inviteInput}
                          onChange={(e) => setInviteInput(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') inviteEditor();
                          }}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            fontSize: '12px',
                            fontFamily: 'inherit',
                            border: '1px solid var(--color-panel-contrast)',
                            borderRadius: '6px',
                            background: 'var(--color-panel)',
                            color: 'var(--color-text)',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={inviteEditor}
                          disabled={!inviteInput.trim() || inviteStatus === 'sending'}
                          style={{
                            padding: '8px 14px',
                            backgroundColor: inviteStatus === 'sent' ? '#10b981' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: !inviteInput.trim() || inviteStatus === 'sending' ? 'not-allowed' : 'pointer',
                            fontSize: '11px',
                            fontWeight: 500,
                            fontFamily: 'inherit',
                            opacity: !inviteInput.trim() ? 0.5 : 1,
                          }}
                        >
                          {inviteStatus === 'sending' ? '...' : inviteStatus === 'sent' ? 'Added' : 'Add'}
                        </button>
                      </div>

                      {/* Editor List */}
                      <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                        {editors.length === 0 ? (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-3)', textAlign: 'center', padding: '10px' }}>
                            No editors added yet
                          </div>
                        ) : (
                          editors.map((editor) => (
                            <div
                              key={editor.userId}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                marginBottom: '4px',
                                background: 'var(--color-panel)',
                              }}
                            >
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)' }}>
                                  @{editor.username}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>
                                  {editor.permission}
                                </div>
                              </div>
                              <button
                                onClick={() => removeEditor(editor.userId)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#ef4444',
                                  fontSize: '14px',
                                  padding: '4px',
                                }}
                                title="Remove editor"
                              >
                                &#10005;
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Request Admin Access (for non-admins) */}
              {!isAdmin && session.authed && (
                <div style={{ padding: '14px', background: 'var(--color-panel)', borderBottom: '1px solid var(--color-panel-contrast)' }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="8.5" cy="7" r="4"/>
                      <line x1="20" y1="8" x2="20" y2="14"/>
                      <line x1="23" y1="11" x2="17" y2="11"/>
                    </svg>
                    Admin Access
                  </div>
                  <button
                    onClick={requestAdminAccess}
                    disabled={requestingAdmin || adminRequestSent}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: adminRequestSent ? '#10b981' : adminRequestError ? '#ef4444' : 'var(--color-muted-2)',
                      color: adminRequestSent || adminRequestError ? 'white' : 'var(--color-text)',
                      border: '1px solid var(--color-panel-contrast)',
                      borderRadius: '8px',
                      cursor: requestingAdmin || adminRequestSent ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                      fontFamily: 'inherit',
                    }}
                  >
                    {requestingAdmin ? 'Sending request...' : adminRequestSent ? 'Request Sent!' : adminRequestError ? 'Retry Request' : 'Request Admin Access'}
                  </button>
                  {adminRequestError && (
                    <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '6px', textAlign: 'center' }}>
                      {adminRequestError}
                    </div>
                  )}
                  <div style={{ fontSize: '10px', color: 'var(--color-text-3)', marginTop: '6px', textAlign: 'center' }}>
                    Admin requests are sent to jeffemmett@gmail.com
                  </div>
                </div>
              )}

              {/* Sign in prompt for anonymous users */}
              {!session.authed && (
                <div style={{ padding: '14px', background: 'var(--color-muted-2)', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
                    Sign in to access board settings
                  </div>
                </div>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default BoardSettingsDropdown;
