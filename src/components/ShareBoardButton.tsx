import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

interface ShareBoardButtonProps {
  className?: string;
}

type PermissionType = 'view' | 'edit' | 'admin';

const PERMISSION_LABELS: Record<PermissionType, { label: string; description: string; color: string }> = {
  view: { label: 'View', description: 'Can view but not edit', color: '#6b7280' },
  edit: { label: 'Edit', description: 'Can view and edit', color: '#3b82f6' },
  admin: { label: 'Admin', description: 'Full control', color: '#10b981' },
};

const ShareBoardButton: React.FC<ShareBoardButtonProps> = ({ className = '' }) => {
  const { slug } = useParams<{ slug: string }>();
  const [showDropdown, setShowDropdown] = useState(false);

  // Detect dark mode
  const [isDarkMode, setIsDarkMode] = useState(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDarkMode(document.documentElement.classList.contains('dark'));
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);
  const [copied, setCopied] = useState(false);
  const [permission, setPermission] = useState<PermissionType>('edit');
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'writing' | 'success' | 'error' | 'unsupported'>('idle');
  const [nfcMessage, setNfcMessage] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);

  const boardSlug = slug || 'mycofi33';
  const boardUrl = `${window.location.origin}/board/${boardSlug}`;

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

  // Generate URL with permission parameter
  const getShareUrl = () => {
    const url = new URL(boardUrl);
    url.searchParams.set('access', permission);
    return url.toString();
  };

  // Check NFC support on mount
  useEffect(() => {
    if (!('NDEFReader' in window)) {
      setNfcStatus('unsupported');
    }
  }, []);

  // Close dropdown when clicking outside or pressing ESC
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check if click is inside trigger OR the portal dropdown menu
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

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleInvite = async () => {
    if (!inviteInput.trim()) return;

    setInviteStatus('sending');
    try {
      // TODO: Implement actual invite API call
      // For now, simulate sending invite
      await new Promise(resolve => setTimeout(resolve, 1000));
      setInviteStatus('sent');
      setInviteInput('');
      setTimeout(() => setInviteStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to send invite:', err);
      setInviteStatus('error');
      setTimeout(() => setInviteStatus('idle'), 3000);
    }
  };

  const handleNfcWrite = async () => {
    if (!('NDEFReader' in window)) {
      setNfcStatus('unsupported');
      setNfcMessage('NFC is not supported on this device');
      return;
    }

    try {
      setNfcStatus('writing');
      setNfcMessage('Hold your NFC tag near the device...');

      const ndef = new (window as any).NDEFReader();
      await ndef.write({
        records: [
          { recordType: "url", data: getShareUrl() }
        ]
      });

      setNfcStatus('success');
      setNfcMessage('Board URL written to NFC tag!');
      setTimeout(() => {
        setNfcStatus('idle');
        setNfcMessage('');
      }, 3000);
    } catch (err: any) {
      console.error('NFC write error:', err);
      setNfcStatus('error');
      if (err.name === 'NotAllowedError') {
        setNfcMessage('NFC permission denied. Please allow NFC access.');
      } else if (err.name === 'NotSupportedError') {
        setNfcMessage('NFC is not supported on this device');
      } else {
        setNfcMessage(`Failed to write NFC tag: ${err.message || 'Unknown error'}`);
      }
    }
  };

  // Detect if we're in share-panel (compact) vs toolbar (full button)
  const isCompact = className.includes('share-panel-btn');

  if (isCompact) {
    // Icon-only version for the top-right share panel with dropdown
    return (
      <div ref={dropdownRef} style={{ pointerEvents: 'all' }}>
        <button
          ref={triggerRef}
          onClick={() => setShowDropdown(!showDropdown)}
          className={`share-board-button ${className}`}
          title="Invite others to this board"
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
          {/* User with plus icon (invite/add person) */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* User outline */}
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            {/* Plus sign */}
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="16" y1="11" x2="22" y2="11" />
          </svg>
        </button>

        {/* Dropdown - rendered via portal to break out of parent container */}
        {showDropdown && dropdownPosition && createPortal(
          <div
            ref={dropdownMenuRef}
            style={{
              position: 'fixed',
              top: dropdownPosition.top,
              right: dropdownPosition.right,
              width: '340px',
              background: isDarkMode ? '#2d2d2d' : '#ffffff',
              backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
              backdropFilter: 'none',
              opacity: 1,
              border: `1px solid ${isDarkMode ? '#404040' : '#e5e5e5'}`,
              borderRadius: '12px',
              boxShadow: isDarkMode ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.2)',
              zIndex: 100000,
              overflow: 'hidden',
              pointerEvents: 'all',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
            onWheel={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Compact Header */}
            <div style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--color-panel-contrast)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>👥</span> Share Board
              </span>
              <button
                onClick={() => setShowDropdown(false)}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  background: 'var(--color-muted-2)',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  color: 'var(--color-text-3)',
                  fontSize: '11px',
                  fontFamily: 'inherit',
                  lineHeight: 1,
                  borderRadius: '4px',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Invite by username/email */}
              <div>
                <div style={{
                  display: 'flex',
                  gap: '8px',
                }}>
                  <input
                    type="text"
                    placeholder="Username or email..."
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') handleInvite();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
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
                    onClick={handleInvite}
                    onPointerDown={(e) => e.stopPropagation()}
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
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {inviteStatus === 'sending' ? '...' : inviteStatus === 'sent' ? '✓ Sent' : 'Invite'}
                  </button>
                </div>
                {inviteStatus === 'error' && (
                  <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>
                    Failed to send invite. Please try again.
                  </p>
                )}
              </div>

              {/* Divider with "or share link" */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-panel-contrast)' }} />
                <span style={{ fontSize: '11px', color: 'var(--color-text-3)', fontWeight: 500 }}>or share link</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-panel-contrast)' }} />
              </div>

              {/* Permission selector - pill style */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['view', 'edit', 'admin'] as PermissionType[]).map((perm) => {
                  const isActive = permission === perm;
                  const { label, description } = PERMISSION_LABELS[perm];
                  return (
                    <button
                      key={perm}
                      onClick={() => setPermission(perm)}
                      onPointerDown={(e) => e.stopPropagation()}
                      title={description}
                      style={{
                        flex: 1,
                        padding: '8px 6px',
                        border: 'none',
                        background: isActive ? '#3b82f6' : 'var(--color-muted-2)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 500,
                        fontFamily: 'inherit',
                        color: isActive ? 'white' : 'var(--color-text)',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                    >
                      <span>{label}</span>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 400,
                        opacity: 0.8,
                        color: isActive ? 'rgba(255,255,255,0.9)' : 'var(--color-text-3)',
                      }}>
                        {perm === 'view' ? 'Read only' : perm === 'edit' ? 'Can edit' : 'Full access'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* QR Code and URL - larger and side by side */}
              <div style={{
                display: 'flex',
                gap: '14px',
                padding: '14px',
                backgroundColor: 'var(--color-muted-2)',
                borderRadius: '10px',
              }}>
                {/* QR Code - larger */}
                <div style={{
                  padding: '10px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <QRCodeSVG
                    value={getShareUrl()}
                    size={100}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                {/* URL and Copy - stacked */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px' }}>
                  <div style={{
                    padding: '10px 12px',
                    backgroundColor: 'var(--color-panel)',
                    borderRadius: '6px',
                    border: '1px solid var(--color-panel-contrast)',
                    wordBreak: 'break-all',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: 'var(--color-text)',
                    lineHeight: 1.4,
                  }}>
                    {getShareUrl()}
                  </div>
                  <button
                    onClick={handleCopyUrl}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: copied ? '#10b981' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 500,
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {copied ? (
                      <>✓ Copied!</>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Advanced options (collapsible) */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontFamily: 'inherit',
                    color: 'var(--color-text-3)',
                    padding: '6px 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    background: 'var(--color-muted-2)',
                  }}>
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      style={{ transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                    >
                      <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                    </svg>
                  </span>
                  More options
                </button>

                {showAdvanced && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                    {/* NFC Button */}
                    <button
                      onClick={handleNfcWrite}
                      onPointerDown={(e) => e.stopPropagation()}
                      disabled={nfcStatus === 'unsupported' || nfcStatus === 'writing'}
                      style={{
                        flex: 1,
                        padding: '10px',
                        fontFamily: 'inherit',
                        backgroundColor: nfcStatus === 'unsupported' ? 'var(--color-muted-2)' :
                                        nfcStatus === 'success' ? '#d1fae5' :
                                        nfcStatus === 'error' ? '#fee2e2' :
                                        nfcStatus === 'writing' ? '#e0e7ff' : 'var(--color-panel)',
                        border: '1px solid var(--color-panel-contrast)',
                        borderRadius: '6px',
                        cursor: nfcStatus === 'unsupported' || nfcStatus === 'writing' ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        opacity: nfcStatus === 'unsupported' ? 0.5 : 1,
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>
                        {nfcStatus === 'success' ? '✓' : nfcStatus === 'error' ? '!' : '📡'}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--color-text)', fontWeight: 500 }}>
                        {nfcStatus === 'writing' ? 'Writing...' :
                         nfcStatus === 'success' ? 'Written!' :
                         nfcStatus === 'unsupported' ? 'NFC N/A' :
                         'NFC Tag'}
                      </span>
                    </button>

                    {/* Audio Button (coming soon) */}
                    <button
                      disabled
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{
                        flex: 1,
                        padding: '10px',
                        fontFamily: 'inherit',
                        backgroundColor: 'var(--color-muted-2)',
                        border: '1px solid var(--color-panel-contrast)',
                        borderRadius: '6px',
                        cursor: 'not-allowed',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        opacity: 0.5,
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>🔊</span>
                      <span style={{ fontSize: '10px', color: 'var(--color-text)', fontWeight: 500 }}>
                        Audio (Soon)
                      </span>
                    </button>
                  </div>
                )}
                {nfcMessage && (
                  <p style={{
                    marginTop: '6px',
                    fontSize: '10px',
                    color: nfcStatus === 'error' ? '#ef4444' :
                           nfcStatus === 'success' ? '#10b981' : 'var(--color-text-3)',
                    textAlign: 'center',
                  }}>
                    {nfcMessage}
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // Full button version for other contexts (toolbar, etc.)
  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`share-board-button ${className}`}
        title="Invite others to this board"
        style={{
          padding: "4px 8px",
          borderRadius: "4px",
          background: "#3b82f6",
          color: "white",
          border: "none",
          cursor: "pointer",
          fontWeight: 500,
          transition: "background 0.2s ease",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          whiteSpace: "nowrap",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          height: "22px",
          minHeight: "22px",
          boxSizing: "border-box",
          fontSize: "0.75rem",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#2563eb";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#3b82f6";
        }}
      >
        {/* User with plus icon (invite/add person) */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="16" y1="11" x2="22" y2="11" />
        </svg>
      </button>
    </div>
  );
};

export default ShareBoardButton;
