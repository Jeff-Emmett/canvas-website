/**
 * useVersionHistory Hook
 *
 * Provides version history functionality for a board.
 */

import { useState, useCallback } from 'react';
import { WORKER_URL } from '../../constants/workerUrl';

export interface HistoryEntry {
  hash: string;
  timestamp: string | null;
  message: string | null;
  actor: string;
}

export interface SnapshotDiff {
  added: Record<string, any>;
  removed: Record<string, any>;
  modified: Record<string, { before: any; after: any }>;
}

export interface UseVersionHistoryReturn {
  history: HistoryEntry[];
  isLoading: boolean;
  error: string | null;
  fetchHistory: () => Promise<void>;
  fetchDiff: (fromHash: string | null, toHash: string | null) => Promise<SnapshotDiff | null>;
  revert: (hash: string) => Promise<boolean>;
}

export function useVersionHistory(roomId: string): UseVersionHistoryReturn {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!roomId) return;

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
  }, [roomId]);

  const fetchDiff = useCallback(
    async (fromHash: string | null, toHash: string | null): Promise<SnapshotDiff | null> => {
      if (!roomId) return null;

      try {
        const response = await fetch(`${WORKER_URL}/room/${roomId}/diff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromHash, toHash }),
        });
        if (!response.ok) throw new Error('Failed to fetch diff');
        const data = await response.json() as { diff?: SnapshotDiff };
        return data.diff || null;
      } catch (err) {
        console.error('Failed to fetch diff:', err);
        return null;
      }
    },
    [roomId]
  );

  const revert = useCallback(
    async (hash: string): Promise<boolean> => {
      if (!roomId) return false;

      try {
        const response = await fetch(`${WORKER_URL}/room/${roomId}/revert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hash }),
        });
        if (!response.ok) throw new Error('Failed to revert');
        return true;
      } catch (err) {
        setError((err as Error).message);
        return false;
      }
    },
    [roomId]
  );

  return {
    history,
    isLoading,
    error,
    fetchHistory,
    fetchDiff,
    revert,
  };
}
