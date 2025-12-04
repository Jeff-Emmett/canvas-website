import React, { useState, useEffect, useMemo } from 'react';
import { useEditor, TLShape, TLShapeId } from 'tldraw';
import {
  computeShapeDiff,
  getDeletedShapes,
  saveLastSeenState,
  formatRelativeTime,
  formatTimestamp,
  DeletedShape,
  VersionSnapshot,
} from '../lib/versionHistory';
import { WORKER_URL } from '../constants/workerUrl';
import { usePermissions } from '../hooks/usePermissions';

interface VersionHistoryPanelProps {
  boardId: string;
  userId: string;
  onClose: () => void;
}

type TabType = 'changes' | 'versions' | 'deleted';

/**
 * Version History Panel - shows recent changes, version snapshots, and deleted shapes
 */
export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  boardId,
  userId,
  onClose,
}) => {
  const editor = useEditor();
  const { canRevert, canRestoreDeleted, canMarkAsSeen, role } = usePermissions(boardId);
  const [activeTab, setActiveTab] = useState<TabType>('changes');
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewShapeGlow, setShowNewShapeGlow] = useState(true);
  const [showDeletedShapes, setShowDeletedShapes] = useState(true);

  // Compute current diff
  const diff = useMemo(() => {
    if (!editor) return { newShapes: [], deletedShapes: [], modifiedShapes: [] };
    const shapes = editor.getCurrentPageShapes();
    return computeShapeDiff(userId, boardId, shapes);
  }, [editor, userId, boardId]);

  // Get deleted shapes
  const deletedShapes = useMemo(() => {
    return getDeletedShapes(userId, boardId);
  }, [userId, boardId]);

  // Fetch R2 version snapshots
  useEffect(() => {
    const fetchVersions = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${WORKER_URL}/api/versions/${boardId}`);
        if (response.ok) {
          const data = await response.json() as { versions?: VersionSnapshot[] };
          setVersions(data.versions || []);
        }
      } catch (error) {
        console.error('Error fetching versions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (activeTab === 'versions') {
      fetchVersions();
    }
  }, [boardId, activeTab]);

  // Toggle new shape highlighting
  const handleToggleNewShapeGlow = () => {
    setShowNewShapeGlow(!showNewShapeGlow);
    // Dispatch event to toggle visual effects
    window.dispatchEvent(new CustomEvent('toggle-new-shape-glow', { detail: !showNewShapeGlow }));
  };

  // Toggle deleted shape visibility
  const handleToggleDeletedShapes = () => {
    setShowDeletedShapes(!showDeletedShapes);
    window.dispatchEvent(new CustomEvent('toggle-deleted-shapes', { detail: !showDeletedShapes }));
  };

  // Mark current state as "seen"
  const handleMarkAsSeen = () => {
    if (!editor) return;
    const shapes = editor.getCurrentPageShapes();
    saveLastSeenState(userId, boardId, shapes);
    // Force re-render by closing and reopening
    onClose();
  };

  // Restore a deleted shape
  const handleRestoreShape = (deletedShape: DeletedShape) => {
    if (!editor) return;

    try {
      // Create a new shape with the deleted shape's properties
      editor.createShape({
        id: deletedShape.id,
        type: deletedShape.type,
        x: deletedShape.x,
        y: deletedShape.y,
        props: deletedShape.props,
      } as any);

      // Remove from deleted list
      window.dispatchEvent(new CustomEvent('shape-restored', { detail: deletedShape.id }));
    } catch (error) {
      console.error('Error restoring shape:', error);
    }
  };

  // Navigate to a shape
  const handleNavigateToShape = (shapeId: TLShapeId) => {
    if (!editor) return;

    const shape = editor.getShape(shapeId);
    if (!shape) return;

    // Center viewport on the shape
    const bounds = editor.getShapePageBounds(shape);
    if (bounds) {
      editor.zoomToBounds(bounds, {
        animation: { duration: 300 },
        inset: 100,
      });
    }

    // Select the shape
    editor.setSelectedShapes([shapeId]);
  };

  // Revert to a version
  const handleRevertToVersion = async (version: VersionSnapshot) => {
    if (!editor || !version) return;

    const confirmRevert = window.confirm(
      `Revert to version from ${formatTimestamp(version.timestamp)}?\n\nThis will replace the current board state with the selected version.`
    );

    if (!confirmRevert) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${WORKER_URL}/api/versions/${boardId}/${version.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert' }),
      });

      if (response.ok) {
        // Reload the page to get the reverted state
        window.location.reload();
      } else {
        console.error('Failed to revert version');
      }
    } catch (error) {
      console.error('Error reverting to version:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="version-history-panel"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: '320px',
        maxHeight: '70vh',
        backgroundColor: 'var(--bg-color, #fff)',
        border: '1px solid var(--border-color, #e1e4e8)',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        zIndex: 100000,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color, #e1e4e8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
            Version History
          </h3>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: role === 'admin' ? '#8b5cf6' : role === 'editor' ? '#3b82f6' : '#6b7280',
              color: 'white',
              textTransform: 'capitalize',
            }}
          >
            {role}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            opacity: 0.6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color, #e1e4e8)',
        }}
      >
        {(['changes', 'versions', 'deleted'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: activeTab === tab ? 'var(--color-muted-2, #f5f5f5)' : 'transparent',
              borderBottom: activeTab === tab ? '2px solid var(--color-primary, #3b82f6)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeTab === tab ? 600 : 400,
              textTransform: 'capitalize',
            }}
          >
            {tab}
            {tab === 'changes' && diff.newShapes.length > 0 && (
              <span
                style={{
                  marginLeft: '4px',
                  backgroundColor: '#fbbf24',
                  color: '#000',
                  borderRadius: '10px',
                  padding: '2px 6px',
                  fontSize: '10px',
                }}
              >
                {diff.newShapes.length}
              </span>
            )}
            {tab === 'deleted' && deletedShapes.length > 0 && (
              <span
                style={{
                  marginLeft: '4px',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '2px 6px',
                  fontSize: '10px',
                }}
              >
                {deletedShapes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {/* Changes Tab */}
        {activeTab === 'changes' && (
          <div>
            {/* Controls */}
            <div style={{ marginBottom: '12px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginBottom: '8px',
                }}
              >
                <input
                  type="checkbox"
                  checked={showNewShapeGlow}
                  onChange={handleToggleNewShapeGlow}
                />
                Highlight new shapes
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={showDeletedShapes}
                  onChange={handleToggleDeletedShapes}
                />
                Show deleted shapes
              </label>
            </div>

            {/* New Shapes */}
            {diff.newShapes.length > 0 ? (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '11px', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
                  New Shapes ({diff.newShapes.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {diff.newShapes.map((shapeId) => {
                    const shape = editor?.getShape(shapeId);
                    return (
                      <button
                        key={shapeId}
                        onClick={() => handleNavigateToShape(shapeId)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          border: '1px solid #fbbf24',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(251, 191, 36, 0.1)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>
                          {shape?.type === 'draw' ? '✏️' :
                           shape?.type === 'text' ? '📝' :
                           shape?.type === 'image' ? '🖼️' :
                           shape?.type === 'embed' ? '🔗' :
                           '📦'}
                        </span>
                        <span style={{ fontSize: '12px', flex: 1 }}>
                          {shape?.type || 'Shape'}
                        </span>
                        <span style={{ fontSize: '10px', color: '#666' }}>→</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: '#666', textAlign: 'center', padding: '20px' }}>
                No new shapes since your last visit
              </p>
            )}

            {/* Mark as Seen Button */}
            {canMarkAsSeen && (
              <button
                onClick={handleMarkAsSeen}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'var(--color-primary, #3b82f6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                Mark All as Seen
              </button>
            )}
          </div>
        )}

        {/* Versions Tab */}
        {activeTab === 'versions' && (
          <div>
            {isLoading ? (
              <p style={{ fontSize: '12px', color: '#666', textAlign: 'center', padding: '20px' }}>
                Loading versions...
              </p>
            ) : versions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {versions.map((version) => (
                  <div
                    key={version.id}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid var(--border-color, #e1e4e8)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-muted-2, #f9f9f9)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 500, margin: 0 }}>
                          {formatRelativeTime(version.timestamp)}
                        </p>
                        <p style={{ fontSize: '10px', color: '#666', margin: '2px 0 0 0' }}>
                          {formatTimestamp(version.timestamp)} • {version.shapeCount} shapes
                        </p>
                      </div>
                      {canRevert && (
                        <button
                          onClick={() => handleRevertToVersion(version)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '10px',
                            backgroundColor: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          Revert
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: '#666', textAlign: 'center', padding: '20px' }}>
                No saved versions available
              </p>
            )}
          </div>
        )}

        {/* Deleted Tab */}
        {activeTab === 'deleted' && (
          <div>
            {deletedShapes.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {deletedShapes.map((deleted) => (
                  <div
                    key={deleted.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      border: '1px solid #ef4444',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    }}
                  >
                    <span style={{ fontSize: '14px', opacity: 0.5 }}>
                      {deleted.type === 'draw' ? '✏️' :
                       deleted.type === 'text' ? '📝' :
                       deleted.type === 'image' ? '🖼️' :
                       deleted.type === 'embed' ? '🔗' :
                       '📦'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '12px', margin: 0 }}>{deleted.type}</p>
                      <p style={{ fontSize: '10px', color: '#666', margin: '2px 0 0 0' }}>
                        Deleted {formatRelativeTime(deleted.deletedAt)}
                      </p>
                    </div>
                    {canRestoreDeleted && (
                      <button
                        onClick={() => handleRestoreShape(deleted)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '10px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: '#666', textAlign: 'center', padding: '20px' }}>
                No recently deleted shapes
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
