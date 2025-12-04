import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, TLShapeId } from 'tldraw';
import { useAuth } from '../context/AuthContext';
import { useParams } from 'react-router-dom';
import {
  getDeletedShapes,
  removeDeletedShape,
  DeletedShape,
  formatRelativeTime,
} from '../lib/versionHistory';
import { usePermissions } from '../hooks/usePermissions';

interface DeletedShapesOverlayProps {
  show?: boolean;
}

/**
 * DeletedShapesOverlay - Shows ghost representations of deleted shapes
 * and provides a floating indicator with restore options
 */
export const DeletedShapesOverlay: React.FC<DeletedShapesOverlayProps> = ({
  show = true,
}) => {
  const editor = useEditor();
  const { session } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const { canRestoreDeleted } = usePermissions(slug || '');
  const [deletedShapes, setDeletedShapes] = useState<DeletedShape[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [visible, setVisible] = useState(show);

  // Load deleted shapes
  useEffect(() => {
    if (!session.authed || !session.username || !slug) return;
    const deleted = getDeletedShapes(session.username, slug);
    setDeletedShapes(deleted);
  }, [session.authed, session.username, slug]);

  // Listen for toggle events
  useEffect(() => {
    const handleToggle = (event: CustomEvent<boolean>) => {
      setVisible(event.detail);
    };

    const handleShapeRestored = (event: CustomEvent<TLShapeId>) => {
      if (!session.username || !slug) return;
      removeDeletedShape(session.username, slug, event.detail);
      setDeletedShapes(prev => prev.filter(s => s.id !== event.detail));
    };

    window.addEventListener('toggle-deleted-shapes', handleToggle as EventListener);
    window.addEventListener('shape-restored', handleShapeRestored as EventListener);

    return () => {
      window.removeEventListener('toggle-deleted-shapes', handleToggle as EventListener);
      window.removeEventListener('shape-restored', handleShapeRestored as EventListener);
    };
  }, [session.username, slug]);

  // Restore a deleted shape
  const handleRestore = useCallback((deletedShape: DeletedShape) => {
    if (!editor || !session.username || !slug) return;

    try {
      editor.createShape({
        id: deletedShape.id,
        type: deletedShape.type,
        x: deletedShape.x,
        y: deletedShape.y,
        props: deletedShape.props,
      } as any);

      // Remove from deleted list
      removeDeletedShape(session.username, slug, deletedShape.id);
      setDeletedShapes(prev => prev.filter(s => s.id !== deletedShape.id));

      // Close panel if no more deleted shapes
      if (deletedShapes.length <= 1) {
        setShowPanel(false);
      }
    } catch (error) {
      console.error('Error restoring shape:', error);
    }
  }, [editor, session.username, slug, deletedShapes.length]);

  // Restore all deleted shapes
  const handleRestoreAll = useCallback(() => {
    if (!editor || !session.username || !slug) return;

    deletedShapes.forEach(deletedShape => {
      try {
        editor.createShape({
          id: deletedShape.id,
          type: deletedShape.type,
          x: deletedShape.x,
          y: deletedShape.y,
          props: deletedShape.props,
        } as any);
        removeDeletedShape(session.username, slug, deletedShape.id);
      } catch (error) {
        console.error('Error restoring shape:', error);
      }
    });

    setDeletedShapes([]);
    setShowPanel(false);
  }, [editor, session.username, slug, deletedShapes]);

  // Dismiss all deleted shapes (clear from storage)
  const handleDismissAll = useCallback(() => {
    if (!session.username || !slug) return;

    deletedShapes.forEach(d => {
      removeDeletedShape(session.username!, slug!, d.id);
    });
    setDeletedShapes([]);
    setShowPanel(false);
  }, [session.username, slug, deletedShapes]);

  // Don't render if no deleted shapes or not visible
  if (!visible || deletedShapes.length === 0 || !session.authed) {
    return null;
  }

  return (
    <>
      {/* Floating Indicator */}
      <button
        className="deleted-shapes-floating-indicator"
        onClick={() => setShowPanel(!showPanel)}
        title={`${deletedShapes.length} deleted shape${deletedShapes.length > 1 ? 's' : ''} can be restored`}
      >
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/>
        </svg>
        <span>{deletedShapes.length} deleted</span>
      </button>

      {/* Restore Panel */}
      {showPanel && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
            }}
            onClick={() => setShowPanel(false)}
          />

          {/* Panel */}
          <div
            style={{
              position: 'fixed',
              bottom: '130px',
              right: '20px',
              width: '280px',
              maxHeight: '400px',
              backgroundColor: 'var(--bg-color, #fff)',
              border: '1px solid var(--border-color, #e1e4e8)',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              zIndex: 10001,
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
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                Deleted Shapes
              </h3>
              <button
                onClick={() => setShowPanel(false)}
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

            {/* Deleted shapes list */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {deletedShapes.map((deleted) => (
                  <div
                    key={deleted.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      border: '1px solid #ef4444',
                      borderRadius: '6px',
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {deleted.type}
                      </p>
                      <p style={{ fontSize: '10px', color: '#666', margin: '2px 0 0 0' }}>
                        {formatRelativeTime(deleted.deletedAt)}
                      </p>
                    </div>
                    {canRestoreDeleted && (
                      <button
                        onClick={() => handleRestore(deleted)}
                        style={{
                          padding: '4px 8px',
                          fontSize: '10px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                padding: '12px',
                borderTop: '1px solid var(--border-color, #e1e4e8)',
                display: 'flex',
                gap: '8px',
              }}
            >
              {canRestoreDeleted && (
                <button
                  onClick={handleRestoreAll}
                  style={{
                    flex: 1,
                    padding: '8px',
                    fontSize: '12px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Restore All
                </button>
              )}
              <button
                onClick={handleDismissAll}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  backgroundColor: 'transparent',
                  color: '#666',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  flex: canRestoreDeleted ? undefined : 1,
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};
