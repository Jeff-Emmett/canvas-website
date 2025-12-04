/**
 * useCollaboration - Hook for real-time collaborative map editing via Y.js
 */

import { useState, useEffect, useCallback } from 'react';
import type { CollaborationSession, Participant, Route, Waypoint, MapLayer, Coordinate } from '../types';

interface UseCollaborationOptions {
  sessionId?: string;
  userId: string;
  userName: string;
  userColor?: string;
  serverUrl?: string;
  onParticipantJoin?: (participant: Participant) => void;
  onParticipantLeave?: (participantId: string) => void;
}

export function useCollaboration({
  sessionId, userId, userName, userColor = '#3B82F6', serverUrl,
}: UseCollaborationOptions) {
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    // TODO: Initialize Y.js (Phase 3)
    setIsConnected(true);
    return () => { setIsConnected(false); };
  }, [sessionId, serverUrl]);

  const createSession = useCallback(async (name: string) => {
    const newSessionId = `session-${Date.now()}`;
    return newSessionId;
  }, []);

  const joinSession = useCallback(async (sessionIdToJoin: string) => {
    console.log('Joining session', sessionIdToJoin);
  }, []);

  const leaveSession = useCallback(() => {
    setSession(null); setParticipants([]); setIsConnected(false);
  }, []);

  const updateCursor = useCallback((coordinate: Coordinate) => {}, []);
  const broadcastRouteChange = useCallback((route: Route) => {}, []);
  const broadcastWaypointChange = useCallback((waypoint: Waypoint) => {}, []);
  const broadcastLayerChange = useCallback((layer: MapLayer) => {}, []);

  return {
    session, participants, isConnected, createSession, joinSession, leaveSession,
    updateCursor, broadcastRouteChange, broadcastWaypointChange, broadcastLayerChange,
  };
}

export default useCollaboration;
