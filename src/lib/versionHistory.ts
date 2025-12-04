/**
 * Version History System
 *
 * Tracks user's last-seen board state and computes diffs to highlight
 * new, modified, and deleted shapes. Integrates with R2 backups for
 * coarse-grained history and Automerge CRDT for fine-grained history.
 */

import { TLShape, TLShapeId } from 'tldraw';

// === Types ===

export interface UserBoardState {
  userId: string;
  boardId: string;
  lastSeenTimestamp: number;
  shapeIds: string[];
  shapeHashes: Record<string, string>;
}

export interface ShapeDiff {
  newShapes: TLShapeId[];           // Shapes added since last visit
  deletedShapes: DeletedShape[];    // Shapes removed since last visit
  modifiedShapes: TLShapeId[];      // Shapes changed since last visit
}

export interface DeletedShape {
  id: TLShapeId;
  type: string;
  x: number;
  y: number;
  props: Record<string, unknown>;
  deletedAt: number;
  deletedBy?: string;
}

export interface VersionSnapshot {
  id: string;
  timestamp: number;
  source: 'automerge' | 'r2';
  shapeCount: number;
  label?: string;
  actorId?: string;  // For Automerge heads
}

// === Storage Keys ===

const STORAGE_PREFIX = 'canvas_version_';

function getStateKey(userId: string, boardId: string): string {
  return `${STORAGE_PREFIX}state_${userId}_${boardId}`;
}

function getDeletedKey(userId: string, boardId: string): string {
  return `${STORAGE_PREFIX}deleted_${userId}_${boardId}`;
}

// === Hash Utilities ===

/**
 * Generate a simple hash for a shape's content to detect modifications
 */
function hashShape(shape: TLShape): string {
  // Create a deterministic string from shape properties that matter
  const relevant = {
    type: shape.type,
    x: Math.round(shape.x * 100) / 100,
    y: Math.round(shape.y * 100) / 100,
    rotation: shape.rotation,
    props: shape.props,
  };
  return simpleHash(JSON.stringify(relevant));
}

/**
 * Simple string hash for quick comparison (DJB2 algorithm)
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// === State Management ===

/**
 * Get the user's last-seen state for a board
 */
export function getLastSeenState(userId: string, boardId: string): UserBoardState | null {
  try {
    const key = getStateKey(userId, boardId);
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error reading last-seen state:', error);
    return null;
  }
}

/**
 * Save the current state as the user's last-seen state
 */
export function saveLastSeenState(
  userId: string,
  boardId: string,
  shapes: TLShape[]
): void {
  try {
    const state: UserBoardState = {
      userId,
      boardId,
      lastSeenTimestamp: Date.now(),
      shapeIds: shapes.map(s => s.id),
      shapeHashes: shapes.reduce((acc, shape) => {
        acc[shape.id] = hashShape(shape);
        return acc;
      }, {} as Record<string, string>),
    };

    const key = getStateKey(userId, boardId);
    localStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving last-seen state:', error);
  }
}

/**
 * Store a deleted shape for potential restoration
 */
export function storeDeletedShape(
  userId: string,
  boardId: string,
  shape: TLShape,
  deletedBy?: string
): void {
  try {
    const key = getDeletedKey(userId, boardId);
    const stored = localStorage.getItem(key);
    const deletedShapes: DeletedShape[] = stored ? JSON.parse(stored) : [];

    // Add the newly deleted shape
    deletedShapes.push({
      id: shape.id,
      type: shape.type,
      x: shape.x,
      y: shape.y,
      props: shape.props as Record<string, unknown>,
      deletedAt: Date.now(),
      deletedBy,
    });

    // Keep only last 100 deleted shapes per board to prevent storage bloat
    const trimmed = deletedShapes.slice(-100);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Error storing deleted shape:', error);
  }
}

/**
 * Get deleted shapes that can be restored
 */
export function getDeletedShapes(userId: string, boardId: string): DeletedShape[] {
  try {
    const key = getDeletedKey(userId, boardId);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error reading deleted shapes:', error);
    return [];
  }
}

/**
 * Remove a deleted shape from storage (after restoration)
 */
export function removeDeletedShape(userId: string, boardId: string, shapeId: TLShapeId): void {
  try {
    const key = getDeletedKey(userId, boardId);
    const stored = localStorage.getItem(key);
    if (!stored) return;

    const deletedShapes: DeletedShape[] = JSON.parse(stored);
    const filtered = deletedShapes.filter(s => s.id !== shapeId);
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing deleted shape:', error);
  }
}

// === Diff Computation ===

/**
 * Compute the difference between last-seen state and current shapes
 */
export function computeShapeDiff(
  userId: string,
  boardId: string,
  currentShapes: TLShape[]
): ShapeDiff {
  const lastSeen = getLastSeenState(userId, boardId);

  // If no last-seen state, nothing is "new" - first visit
  if (!lastSeen) {
    return {
      newShapes: [],
      deletedShapes: [],
      modifiedShapes: [],
    };
  }

  const lastSeenIds = new Set(lastSeen.shapeIds);
  const currentIds = new Set(currentShapes.map(s => s.id));

  // Find new shapes (in current but not in last-seen)
  const newShapes = currentShapes
    .filter(s => !lastSeenIds.has(s.id))
    .map(s => s.id);

  // Find modified shapes (in both, but hash changed)
  const modifiedShapes = currentShapes
    .filter(s => {
      if (!lastSeenIds.has(s.id)) return false;
      const oldHash = lastSeen.shapeHashes[s.id];
      const newHash = hashShape(s);
      return oldHash !== newHash;
    })
    .map(s => s.id);

  // Get stored deleted shapes (shapes that were in last-seen but removed)
  const deletedShapes = getDeletedShapes(userId, boardId)
    .filter(d => lastSeenIds.has(d.id) && !currentIds.has(d.id));

  return {
    newShapes,
    deletedShapes,
    modifiedShapes,
  };
}

// === Version Snapshot Management ===

/**
 * Format a timestamp into a human-readable relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

/**
 * Format a timestamp into a readable date string
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// === Effect Duration ===

// How long new shape glow should last (in ms)
export const NEW_SHAPE_GLOW_DURATION = 30000; // 30 seconds

// How long to show deleted shapes before auto-hiding
export const DELETED_SHAPE_VISIBLE_DURATION = 60000; // 1 minute
