/**
 * UserSearchModal Component
 *
 * Modal for searching and connecting with other users.
 * Features:
 * - Fuzzy search by username/display name
 * - Shows connection status
 * - One-click connect/disconnect
 * - Shows mutual connections count
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { searchUsers, type UserSearchResult } from '../../lib/networking';

// =============================================================================
// Types
// =============================================================================

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (userId: string) => Promise<void>;
  onDisconnect?: (userId: string) => Promise<void>;
  currentUserId?: string;
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    backgroundColor: 'var(--color-background, #fff)',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '480px',
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--color-border, #e0e0e0)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
    color: 'var(--color-text, #1a1a2e)',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: 'var(--color-text-secondary, #666)',
    padding: '4px',
    lineHeight: 1,
  },
  searchContainer: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--color-border, #e0e0e0)',
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    border: '1px solid var(--color-border, #e0e0e0)',
    borderRadius: '8px',
    outline: 'none',
    backgroundColor: 'var(--color-surface, #f5f5f5)',
    color: 'var(--color-text, #1a1a2e)',
  },
  results: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '8px 0',
  },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 20px',
    gap: '12px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  resultItemHover: {
    backgroundColor: 'var(--color-surface, #f5f5f5)',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  username: {
    fontSize: '15px',
    fontWeight: 500,
    color: 'var(--color-text, #1a1a2e)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  displayName: {
    fontSize: '13px',
    color: 'var(--color-text-secondary, #666)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  mutualBadge: {
    fontSize: '11px',
    color: 'var(--color-text-tertiary, #999)',
    marginTop: '2px',
  },
  connectButton: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
    flexShrink: 0,
  },
  connectButtonConnect: {
    backgroundColor: 'var(--color-primary, #4f46e5)',
    color: '#fff',
  },
  connectButtonConnected: {
    backgroundColor: 'var(--color-success, #22c55e)',
    color: '#fff',
  },
  connectButtonMutual: {
    backgroundColor: 'var(--color-accent, #8b5cf6)',
    color: '#fff',
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center' as const,
    color: 'var(--color-text-secondary, #666)',
  },
  loadingState: {
    padding: '40px 20px',
    textAlign: 'center' as const,
    color: 'var(--color-text-secondary, #666)',
  },
};

// =============================================================================
// Component
// =============================================================================

export function UserSearchModal({
  isOpen,
  onClose,
  onConnect,
  onDisconnect,
  currentUserId,
}: UserSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 2) {
      setResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const users = await searchUsers(query);
        // Filter out current user
        setResults(users.filter(u => u.id !== currentUserId));
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, currentUserId]);

  // Handle connect/disconnect
  const handleConnect = useCallback(async (user: UserSearchResult) => {
    setConnectingId(user.id);
    try {
      if (user.isConnected && onDisconnect) {
        await onDisconnect(user.id);
        // Update local state
        setResults(prev => prev.map(u =>
          u.id === user.id ? { ...u, isConnected: false } : u
        ));
      } else {
        await onConnect(user.id);
        // Update local state
        setResults(prev => prev.map(u =>
          u.id === user.id ? { ...u, isConnected: true } : u
        ));
      }
    } catch (error) {
      console.error('Connection action failed:', error);
    } finally {
      setConnectingId(null);
    }
  }, [onConnect, onDisconnect]);

  // Handle escape key - use a ref to avoid stale closure issues
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  if (!isOpen) return null;

  const getButtonStyle = (user: UserSearchResult) => {
    if (user.isConnected && user.isConnectedBack) {
      return { ...styles.connectButton, ...styles.connectButtonMutual };
    }
    if (user.isConnected) {
      return { ...styles.connectButton, ...styles.connectButtonConnected };
    }
    return { ...styles.connectButton, ...styles.connectButtonConnect };
  };

  const getButtonText = (user: UserSearchResult) => {
    if (connectingId === user.id) return '...';
    if (user.isConnected && user.isConnectedBack) return 'Mutual';
    if (user.isConnected) return 'Connected';
    return 'Connect';
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Find People</h2>
          <button style={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={styles.searchContainer}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search by username..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.results}>
          {isLoading ? (
            <div style={styles.loadingState}>Searching...</div>
          ) : results.length === 0 ? (
            <div style={styles.emptyState}>
              {query.length < 2
                ? 'Type at least 2 characters to search'
                : 'No users found'
              }
            </div>
          ) : (
            results.map(user => (
              <div
                key={user.id}
                style={{
                  ...styles.resultItem,
                  ...(hoveredId === user.id ? styles.resultItemHover : {}),
                }}
                onMouseEnter={() => setHoveredId(user.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div
                  style={{
                    ...styles.avatar,
                    backgroundColor: user.avatarColor || '#6366f1',
                  }}
                >
                  {(user.displayName || user.username).charAt(0).toUpperCase()}
                </div>

                <div style={styles.userInfo}>
                  <div style={styles.username}>@{user.username}</div>
                  {user.displayName && user.displayName !== user.username && (
                    <div style={styles.displayName}>{user.displayName}</div>
                  )}
                  {user.isConnectedBack && !user.isConnected && (
                    <div style={styles.mutualBadge}>Follows you</div>
                  )}
                  {user.mutualConnections > 0 && (
                    <div style={styles.mutualBadge}>
                      {user.mutualConnections} mutual connection{user.mutualConnections !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                <button
                  style={getButtonStyle(user)}
                  onClick={() => handleConnect(user)}
                  disabled={connectingId === user.id}
                >
                  {getButtonText(user)}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default UserSearchModal;
