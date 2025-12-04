/**
 * useVersionHistory Hook
 *
 * Manages version history state, tracks shape changes, and applies
 * visual effects to highlight new, modified, and deleted shapes.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Editor, TLShape, TLShapeId, TLRecord } from 'tldraw';
import {
  computeShapeDiff,
  saveLastSeenState,
  getLastSeenState,
  storeDeletedShape,
  removeDeletedShape,
  getDeletedShapes,
  ShapeDiff,
  DeletedShape,
  NEW_SHAPE_GLOW_DURATION,
} from '../lib/versionHistory';

export interface VersionHistoryState {
  diff: ShapeDiff;
  deletedShapes: DeletedShape[];
  showNewShapeGlow: boolean;
  showDeletedShapes: boolean;
  isFirstVisit: boolean;
  lastSeenTimestamp: number | null;
}

export interface UseVersionHistoryOptions {
  userId: string;
  boardId: string;
  editor: Editor | null;
  autoSaveOnChange?: boolean;
}

export interface UseVersionHistoryReturn extends VersionHistoryState {
  markAsSeen: () => void;
  toggleNewShapeGlow: (show: boolean) => void;
  toggleDeletedShapes: (show: boolean) => void;
  restoreShape: (deletedShape: DeletedShape) => void;
  navigateToShape: (shapeId: TLShapeId) => void;
  refreshDiff: () => void;
}

/**
 * Hook to manage version history and visual diff highlighting
 */
export function useVersionHistory({
  userId,
  boardId,
  editor,
  autoSaveOnChange = false,
}: UseVersionHistoryOptions): UseVersionHistoryReturn {
  const [diff, setDiff] = useState<ShapeDiff>({
    newShapes: [],
    deletedShapes: [],
    modifiedShapes: [],
  });
  const [deletedShapes, setDeletedShapes] = useState<DeletedShape[]>([]);
  const [showNewShapeGlow, setShowNewShapeGlow] = useState(true);
  const [showDeletedShapes, setShowDeletedShapes] = useState(true);
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<number | null>(null);

  // Track shapes that should lose their glow effect after timeout
  const glowTimeoutRef = useRef<Map<TLShapeId, NodeJS.Timeout>>(new Map());
  const previousShapeIdsRef = useRef<Set<TLShapeId>>(new Set());

  // Compute initial diff on mount
  useEffect(() => {
    if (!editor || !userId || !boardId) return;

    const lastSeen = getLastSeenState(userId, boardId);
    setIsFirstVisit(!lastSeen);
    setLastSeenTimestamp(lastSeen?.lastSeenTimestamp || null);

    const shapes = editor.getCurrentPageShapes();
    const computed = computeShapeDiff(userId, boardId, shapes);
    setDiff(computed);

    const deleted = getDeletedShapes(userId, boardId);
    setDeletedShapes(deleted);

    // Store current shape IDs for tracking deletions
    previousShapeIdsRef.current = new Set(shapes.map(s => s.id));
  }, [editor, userId, boardId]);

  // Listen for store changes to detect new/deleted shapes
  useEffect(() => {
    if (!editor || !userId || !boardId) return;

    const handleStoreChange = () => {
      const shapes = editor.getCurrentPageShapes();
      const currentIds = new Set(shapes.map(s => s.id));
      const previousIds = previousShapeIdsRef.current;

      // Detect newly deleted shapes (were in previous, not in current)
      previousIds.forEach(id => {
        if (!currentIds.has(id)) {
          // Shape was deleted - try to get its last known state
          // Note: The shape is already gone from the editor, so we can't get it
          // This is handled by the deletion tracking in the shape lifecycle
        }
      });

      // Update previous IDs
      previousShapeIdsRef.current = currentIds;

      // Recompute diff
      const computed = computeShapeDiff(userId, boardId, shapes);
      setDiff(computed);

      // Auto-save if enabled
      if (autoSaveOnChange) {
        saveLastSeenState(userId, boardId, shapes);
      }
    };

    const unsubscribe = editor.store.listen(handleStoreChange, {
      source: 'all',
      scope: 'document',
    });

    return () => {
      unsubscribe();
    };
  }, [editor, userId, boardId, autoSaveOnChange]);

  // Apply visual classes to new shapes
  useEffect(() => {
    if (!editor || !showNewShapeGlow) return;

    // Apply glow class to new shapes
    diff.newShapes.forEach(shapeId => {
      const element = document.querySelector(`[data-shape-id="${shapeId}"]`);
      if (element) {
        element.classList.add('shape-new');

        // Set up timeout to remove glow after duration
        const existingTimeout = glowTimeoutRef.current.get(shapeId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        const timeout = setTimeout(() => {
          element.classList.add('glow-fading');
          setTimeout(() => {
            element.classList.remove('shape-new', 'glow-fading');
          }, 3000); // Match CSS animation duration
          glowTimeoutRef.current.delete(shapeId);
        }, NEW_SHAPE_GLOW_DURATION);

        glowTimeoutRef.current.set(shapeId, timeout);
      }
    });

    return () => {
      // Cleanup timeouts
      glowTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, [editor, diff.newShapes, showNewShapeGlow]);

  // Listen for custom events from the panel
  useEffect(() => {
    const handleToggleGlow = (event: CustomEvent<boolean>) => {
      setShowNewShapeGlow(event.detail);
    };

    const handleToggleDeleted = (event: CustomEvent<boolean>) => {
      setShowDeletedShapes(event.detail);
    };

    const handleShapeRestored = (event: CustomEvent<TLShapeId>) => {
      removeDeletedShape(userId, boardId, event.detail);
      setDeletedShapes(prev => prev.filter(s => s.id !== event.detail));
    };

    window.addEventListener('toggle-new-shape-glow', handleToggleGlow as EventListener);
    window.addEventListener('toggle-deleted-shapes', handleToggleDeleted as EventListener);
    window.addEventListener('shape-restored', handleShapeRestored as EventListener);

    return () => {
      window.removeEventListener('toggle-new-shape-glow', handleToggleGlow as EventListener);
      window.removeEventListener('toggle-deleted-shapes', handleToggleDeleted as EventListener);
      window.removeEventListener('shape-restored', handleShapeRestored as EventListener);
    };
  }, [userId, boardId]);

  // Mark current state as seen
  const markAsSeen = useCallback(() => {
    if (!editor) return;
    const shapes = editor.getCurrentPageShapes();
    saveLastSeenState(userId, boardId, shapes);
    setDiff({
      newShapes: [],
      deletedShapes: [],
      modifiedShapes: [],
    });
    setLastSeenTimestamp(Date.now());
    setIsFirstVisit(false);
  }, [editor, userId, boardId]);

  // Toggle glow visibility
  const toggleNewShapeGlow = useCallback((show: boolean) => {
    setShowNewShapeGlow(show);
    if (!show) {
      // Remove glow from all shapes
      document.querySelectorAll('.shape-new').forEach(el => {
        el.classList.remove('shape-new', 'glow-fading');
      });
    }
  }, []);

  // Toggle deleted shapes visibility
  const toggleDeletedShapes = useCallback((show: boolean) => {
    setShowDeletedShapes(show);
  }, []);

  // Restore a deleted shape
  const restoreShape = useCallback((deletedShape: DeletedShape) => {
    if (!editor) return;

    try {
      editor.createShape({
        id: deletedShape.id,
        type: deletedShape.type,
        x: deletedShape.x,
        y: deletedShape.y,
        props: deletedShape.props,
      } as any);

      removeDeletedShape(userId, boardId, deletedShape.id);
      setDeletedShapes(prev => prev.filter(s => s.id !== deletedShape.id));
    } catch (error) {
      console.error('Error restoring shape:', error);
    }
  }, [editor, userId, boardId]);

  // Navigate to a shape
  const navigateToShape = useCallback((shapeId: TLShapeId) => {
    if (!editor) return;

    const shape = editor.getShape(shapeId);
    if (!shape) return;

    const bounds = editor.getShapePageBounds(shape);
    if (bounds) {
      editor.zoomToBounds(bounds, {
        animation: { duration: 300 },
        inset: 100,
      });
    }

    editor.setSelectedShapes([shapeId]);
  }, [editor]);

  // Refresh diff manually
  const refreshDiff = useCallback(() => {
    if (!editor) return;
    const shapes = editor.getCurrentPageShapes();
    const computed = computeShapeDiff(userId, boardId, shapes);
    setDiff(computed);
  }, [editor, userId, boardId]);

  return {
    diff,
    deletedShapes,
    showNewShapeGlow,
    showDeletedShapes,
    isFirstVisit,
    lastSeenTimestamp,
    markAsSeen,
    toggleNewShapeGlow,
    toggleDeletedShapes,
    restoreShape,
    navigateToShape,
    refreshDiff,
  };
}

/**
 * Track shape deletions by intercepting the delete operation
 * This is meant to be called from the Editor's onMount or similar
 */
export function trackShapeDeletions(
  editor: Editor,
  userId: string,
  boardId: string
): () => void {
  // Store shapes before they're deleted
  const handleBeforeDelete = (records: TLRecord[]) => {
    records.forEach(record => {
      if (record.typeName === 'shape') {
        const shape = record as TLShape;
        storeDeletedShape(userId, boardId, shape);
      }
    });
  };

  // Listen for store changes with before state
  const unsubscribe = editor.store.listen(
    (entry) => {
      // Check for deleted shapes
      if (entry.changes.removed) {
        const removedRecords = Object.values(entry.changes.removed);
        handleBeforeDelete(removedRecords as TLRecord[]);
      }
    },
    { source: 'user', scope: 'document' }
  );

  return unsubscribe;
}
