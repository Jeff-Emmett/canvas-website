/**
 * VersionHistoryPanel Component
 *
 * Displays version history timeline with diff visualization.
 * - Shows timeline of changes
 * - Highlights additions (green) and deletions (red)
 * - Allows reverting to previous versions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { WORKER_URL } from '../../constants/workerUrl';

// =============================================================================
// Types
// =============================================================================

interface HistoryEntry {
  hash: string;
  timestamp: string | null;
  message: string | null;
  actor: string;
}

interface SnapshotDiff {
  added: Record<string, any>;
  removed: Record<string, any>;
  modified: Record<string, { before: any; after: any }>;
}

interface VersionHistoryPanelProps {
  roomId: string;
  onClose: () => void;
  onRevert?: (hash: string) => void;
  isDarkMode?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return 'Unknown time';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than 1 minute ago
  if (diff < 60000) return 'Just now';

  // Less than 1 hour ago
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  }

  // Less than 24 hours ago
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }

  // Less than 7 days ago
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }

  // Older - show full date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getShapeLabel(record: any): string {
  if (record?.typeName === 'shape') {
    const type = record.type || 'shape';
    const name = record.props?.name || record.props?.text?.slice?.(0, 20) || '';
    if (name) return `${type}: "${name}"`;
    return type;
  }
  if (record?.typeName === 'page') {
    return `Page: ${record.name || 'Untitled'}`;
  }
  return record?.typeName || 'Record';
}

// =============================================================================
// Component
// =============================================================================

export function VersionHistoryPanel({
  roomId,
  onClose,
  onRevert,
  isDarkMode = false,
}: VersionHistoryPanelProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [showConfirmRevert, setShowConfirmRevert] = useState(false);

  // Fetch history on mount
  useEffect(() => {
    fetchHistory();
  }, [roomId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${WORKER_URL}/room/${roomId}/history`);
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json() as { history?: HistoryEntry[] };
      setHistory(data.history || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDiff = async (entry: HistoryEntry, prevEntry: HistoryEntry | null) => {
    setIsLoadingDiff(true);
    try {
      const response = await fetch(`${WORKER_URL}/room/${roomId}/diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromHash: prevEntry?.hash || null,
          toHash: entry.hash,
        }),
      });
      if (!response.ok) throw new Error('Failed to fetch diff');
      const data = await response.json() as { diff?: SnapshotDiff };
      setDiff(data.diff || null);
    } catch (err) {
      console.error('Failed to fetch diff:', err);
      setDiff(null);
    } finally {
      setIsLoadingDiff(false);
    }
  };

  const handleEntryClick = (entry: HistoryEntry, index: number) => {
    setSelectedEntry(entry);
    const prevEntry = index < history.length - 1 ? history[index + 1] : null;
    fetchDiff(entry, prevEntry);
  };

  const handleRevert = async () => {
    if (!selectedEntry) return;

    setIsReverting(true);
    try {
      const response = await fetch(`${WORKER_URL}/room/${roomId}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: selectedEntry.hash }),
      });

      if (!response.ok) throw new Error('Failed to revert');

      // Notify parent
      onRevert?.(selectedEntry.hash);
      setShowConfirmRevert(false);

      // Refresh history
      await fetchHistory();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsReverting(false);
    }
  };

  // Styles
  const theme = {
    bg: isDarkMode ? '#1e1e1e' : '#ffffff',
    bgSecondary: isDarkMode ? '#2d2d2d' : '#f5f5f5',
    text: isDarkMode ? '#e0e0e0' : '#333333',
    textMuted: isDarkMode ? '#888888' : '#666666',
    border: isDarkMode ? '#404040' : '#e0e0e0',
    accent: '#8b5cf6',
    green: isDarkMode ? '#4ade80' : '#16a34a',
    red: isDarkMode ? '#f87171' : '#dc2626',
    greenBg: isDarkMode ? 'rgba(74, 222, 128, 0.15)' : 'rgba(22, 163, 74, 0.1)',
    redBg: isDarkMode ? 'rgba(248, 113, 113, 0.15)' : 'rgba(220, 38, 38, 0.1)',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '400px',
        height: '100vh',
        backgroundColor: theme.bg,
        borderLeft: `1px solid ${theme.border}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 2000,
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span style={{ fontWeight: 600, color: theme.text, fontSize: '16px' }}>
            Version History
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: theme.textMuted,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {isLoading ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: theme.textMuted,
            }}
          >
            Loading history...
          </div>
        ) : error ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.red,
            }}
          >
            {error}
            <button
              onClick={fetchHistory}
              style={{
                display: 'block',
                margin: '10px auto 0',
                padding: '8px 16px',
                backgroundColor: theme.accent,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : history.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: theme.textMuted,
            }}
          >
            No version history available
          </div>
        ) : (
          <>
            {/* Timeline */}
            <div style={{ flex: '0 0 auto', maxHeight: '40%', overflow: 'auto', padding: '12px 0' }}>
              {history.map((entry, index) => (
                <div
                  key={entry.hash}
                  onClick={() => handleEntryClick(entry, index)}
                  style={{
                    padding: '12px 20px',
                    cursor: 'pointer',
                    borderLeft: `3px solid ${
                      selectedEntry?.hash === entry.hash ? theme.accent : 'transparent'
                    }`,
                    backgroundColor:
                      selectedEntry?.hash === entry.hash ? theme.bgSecondary : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedEntry?.hash !== entry.hash) {
                      e.currentTarget.style.backgroundColor = theme.bgSecondary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedEntry?.hash !== entry.hash) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: theme.text,
                      marginBottom: '4px',
                    }}
                  >
                    {entry.message || `Change ${entry.hash.slice(0, 8)}`}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: theme.textMuted,
                    }}
                  >
                    {formatTimestamp(entry.timestamp)}
                  </div>
                </div>
              ))}
            </div>

            {/* Diff View */}
            {selectedEntry && (
              <div
                style={{
                  flex: 1,
                  borderTop: `1px solid ${theme.border}`,
                  overflow: 'auto',
                  padding: '16px 20px',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: theme.textMuted,
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Changes in this version
                </div>

                {isLoadingDiff ? (
                  <div style={{ color: theme.textMuted, fontSize: '13px' }}>
                    Loading diff...
                  </div>
                ) : diff ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Added */}
                    {Object.entries(diff.added).length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: theme.green,
                            marginBottom: '6px',
                          }}
                        >
                          + Added ({Object.entries(diff.added).filter(([id]) => id.startsWith('shape:')).length} shapes)
                        </div>
                        {Object.entries(diff.added)
                          .filter(([id]) => id.startsWith('shape:'))
                          .slice(0, 10)
                          .map(([id, record]) => (
                            <div
                              key={id}
                              style={{
                                padding: '8px 12px',
                                backgroundColor: theme.greenBg,
                                borderLeft: `3px solid ${theme.green}`,
                                borderRadius: '4px',
                                marginBottom: '4px',
                                fontSize: '12px',
                                color: theme.text,
                              }}
                            >
                              {getShapeLabel(record)}
                            </div>
                          ))}
                        {Object.entries(diff.added).filter(([id]) => id.startsWith('shape:')).length > 10 && (
                          <div style={{ fontSize: '11px', color: theme.textMuted, marginLeft: '12px' }}>
                            ...and {Object.entries(diff.added).filter(([id]) => id.startsWith('shape:')).length - 10} more
                          </div>
                        )}
                      </div>
                    )}

                    {/* Removed */}
                    {Object.entries(diff.removed).length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: theme.red,
                            marginBottom: '6px',
                          }}
                        >
                          - Removed ({Object.entries(diff.removed).filter(([id]) => id.startsWith('shape:')).length} shapes)
                        </div>
                        {Object.entries(diff.removed)
                          .filter(([id]) => id.startsWith('shape:'))
                          .slice(0, 10)
                          .map(([id, record]) => (
                            <div
                              key={id}
                              style={{
                                padding: '8px 12px',
                                backgroundColor: theme.redBg,
                                borderLeft: `3px solid ${theme.red}`,
                                borderRadius: '4px',
                                marginBottom: '4px',
                                fontSize: '12px',
                                color: theme.text,
                              }}
                            >
                              {getShapeLabel(record)}
                            </div>
                          ))}
                        {Object.entries(diff.removed).filter(([id]) => id.startsWith('shape:')).length > 10 && (
                          <div style={{ fontSize: '11px', color: theme.textMuted, marginLeft: '12px' }}>
                            ...and {Object.entries(diff.removed).filter(([id]) => id.startsWith('shape:')).length - 10} more
                          </div>
                        )}
                      </div>
                    )}

                    {/* Modified */}
                    {Object.entries(diff.modified).length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: theme.accent,
                            marginBottom: '6px',
                          }}
                        >
                          ~ Modified ({Object.entries(diff.modified).filter(([id]) => id.startsWith('shape:')).length} shapes)
                        </div>
                        {Object.entries(diff.modified)
                          .filter(([id]) => id.startsWith('shape:'))
                          .slice(0, 5)
                          .map(([id, { after }]) => (
                            <div
                              key={id}
                              style={{
                                padding: '8px 12px',
                                backgroundColor: theme.bgSecondary,
                                borderLeft: `3px solid ${theme.accent}`,
                                borderRadius: '4px',
                                marginBottom: '4px',
                                fontSize: '12px',
                                color: theme.text,
                              }}
                            >
                              {getShapeLabel(after)}
                            </div>
                          ))}
                        {Object.entries(diff.modified).filter(([id]) => id.startsWith('shape:')).length > 5 && (
                          <div style={{ fontSize: '11px', color: theme.textMuted, marginLeft: '12px' }}>
                            ...and {Object.entries(diff.modified).filter(([id]) => id.startsWith('shape:')).length - 5} more
                          </div>
                        )}
                      </div>
                    )}

                    {/* No visible changes */}
                    {Object.entries(diff.added).filter(([id]) => id.startsWith('shape:')).length === 0 &&
                      Object.entries(diff.removed).filter(([id]) => id.startsWith('shape:')).length === 0 &&
                      Object.entries(diff.modified).filter(([id]) => id.startsWith('shape:')).length === 0 && (
                        <div style={{ color: theme.textMuted, fontSize: '13px' }}>
                          No visible shape changes in this version
                        </div>
                      )}
                  </div>
                ) : (
                  <div style={{ color: theme.textMuted, fontSize: '13px' }}>
                    Select a version to see changes
                  </div>
                )}

                {/* Revert Button */}
                {selectedEntry && history.indexOf(selectedEntry) !== 0 && (
                  <div style={{ marginTop: '20px' }}>
                    {showConfirmRevert ? (
                      <div
                        style={{
                          padding: '12px',
                          backgroundColor: theme.redBg,
                          borderRadius: '8px',
                          border: `1px solid ${theme.red}`,
                        }}
                      >
                        <div style={{ fontSize: '13px', color: theme.text, marginBottom: '12px' }}>
                          Are you sure you want to revert to this version? This will restore the board to this point in time.
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={handleRevert}
                            disabled={isReverting}
                            style={{
                              flex: 1,
                              padding: '8px 16px',
                              backgroundColor: theme.red,
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: isReverting ? 'not-allowed' : 'pointer',
                              opacity: isReverting ? 0.7 : 1,
                              fontWeight: 500,
                            }}
                          >
                            {isReverting ? 'Reverting...' : 'Yes, Revert'}
                          </button>
                          <button
                            onClick={() => setShowConfirmRevert(false)}
                            style={{
                              flex: 1,
                              padding: '8px 16px',
                              backgroundColor: theme.bgSecondary,
                              color: theme.text,
                              border: `1px solid ${theme.border}`,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowConfirmRevert(true)}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          backgroundColor: 'transparent',
                          color: theme.accent,
                          border: `1px solid ${theme.accent}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 500,
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme.accent;
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = theme.accent;
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                        Revert to this version
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default VersionHistoryPanel;
