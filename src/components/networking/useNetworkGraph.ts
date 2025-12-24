/**
 * useNetworkGraph Hook
 *
 * Manages the network graph state for visualization:
 * - Fetches user's network from the API
 * - Integrates with room presence to mark active participants
 * - Provides real-time updates when connections change
 * - Caches graph for fast loading
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getMyNetworkGraph,
  getRoomNetworkGraph,
  createConnection,
  removeConnection,
  getCachedGraph,
  setCachedGraph,
  clearGraphCache,
  type NetworkGraph,
  type GraphNode,
  type GraphEdge,
  type TrustLevel,
} from '../../lib/networking';

// =============================================================================
// Types
// =============================================================================

export interface RoomParticipant {
  id: string;
  username: string;
  color: string; // Presence color from tldraw
}

export interface NetworkGraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  myConnections: string[];
  isLoading: boolean;
  error: string | null;
}

export interface UseNetworkGraphOptions {
  // Room participants to highlight (from tldraw presence)
  roomParticipants?: RoomParticipant[];
  // Auto-refresh interval (ms), 0 to disable
  refreshInterval?: number;
  // Whether to use cached data initially
  useCache?: boolean;
}

export interface UseNetworkGraphReturn extends NetworkGraphState {
  // Refresh the graph from the server
  refresh: () => Promise<void>;
  // Connect to a user with optional trust level
  connect: (userId: string, trustLevel?: TrustLevel) => Promise<void>;
  // Disconnect from a user
  disconnect: (connectionId: string) => Promise<void>;
  // Check if connected to a user
  isConnectedTo: (userId: string) => boolean;
  // Get node by ID
  getNode: (userId: string) => GraphNode | undefined;
  // Get edges for a node
  getEdgesForNode: (userId: string) => GraphEdge[];
  // Nodes that are in the current room
  roomNodes: GraphNode[];
  // Nodes that are not in the room (shown in grey)
  networkNodes: GraphNode[];
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useNetworkGraph(options: UseNetworkGraphOptions = {}): UseNetworkGraphReturn {
  const {
    roomParticipants = [],
    refreshInterval = 0,
    useCache = true,
  } = options;

  const { session } = useAuth();
  const [state, setState] = useState<NetworkGraphState>({
    nodes: [],
    edges: [],
    myConnections: [],
    isLoading: true,
    error: null,
  });

  // Create a map of room participant IDs to their colors
  const participantColorMap = useMemo(() => {
    const map = new Map<string, string>();
    roomParticipants.forEach(p => map.set(p.id, p.color));
    return map;
  }, [roomParticipants]);

  const participantIds = useMemo(() =>
    roomParticipants.map(p => p.id),
    [roomParticipants]
  );

  // Fetch the network graph
  const fetchGraph = useCallback(async (skipCache = false) => {
    // For unauthenticated users, just show room participants without network connections
    if (!session.authed || !session.username) {
      // Create nodes from room participants for anonymous users
      const anonymousNodes: GraphNode[] = roomParticipants.map(participant => ({
        id: participant.id,
        username: participant.username,
        displayName: participant.username,
        avatarColor: participant.color,
        isInRoom: true,
        roomPresenceColor: participant.color,
        isCurrentUser: participant.id === roomParticipants[0]?.id, // First participant is current user
        isAnonymous: true,
        trustLevelTo: undefined,
        trustLevelFrom: undefined,
      }));

      setState({
        nodes: anonymousNodes,
        edges: [],
        myConnections: [],
        isLoading: false,
        error: null,
      });
      return;
    }

    // Try cache first
    if (useCache && !skipCache) {
      const cached = getCachedGraph();
      if (cached) {
        setState(prev => ({
          ...prev,
          nodes: cached.nodes.map(n => ({
            ...n,
            isInRoom: participantIds.includes(n.id),
            roomPresenceColor: participantColorMap.get(n.id),
            isCurrentUser: n.username === session.username,
            isAnonymous: false,
          })),
          edges: cached.edges,
          myConnections: (cached as any).myConnections || [],
          isLoading: false,
          error: null,
        }));
        // Still fetch in background to update
      }
    }

    try {
      setState(prev => ({ ...prev, isLoading: !prev.nodes.length }));

      // Double-check authentication before making API calls
      // This handles race conditions where session state might not be updated yet
      const currentUserId = (() => {
        try {
          // Session is stored as 'canvas_auth_session' by sessionPersistence.ts
          const sessionStr = localStorage.getItem('canvas_auth_session');
          if (sessionStr) {
            const s = JSON.parse(sessionStr);
            if (s.authed && s.username) return s.username;
          }
        } catch { /* ignore */ }
        return null;
      })();

      if (!currentUserId) {
        // Not authenticated - use room participants only
        const anonymousNodes: GraphNode[] = roomParticipants.map(participant => ({
          id: participant.id,
          username: participant.username,
          displayName: participant.username,
          avatarColor: participant.color,
          isInRoom: true,
          roomPresenceColor: participant.color,
          isCurrentUser: participant.id === roomParticipants[0]?.id,
          isAnonymous: true,
          trustLevelTo: undefined,
          trustLevelFrom: undefined,
        }));

        setState({
          nodes: anonymousNodes,
          edges: [],
          myConnections: [],
          isLoading: false,
          error: null,
        });
        return;
      }

      // Fetch graph, optionally scoped to room
      let graph: NetworkGraph;
      try {
        if (participantIds.length > 0) {
          graph = await getRoomNetworkGraph(participantIds);
        } else {
          graph = await getMyNetworkGraph();
        }
      } catch (apiError: any) {
        // If API call fails (e.g., 401 Unauthorized), fall back to showing room participants
        // Only log if it's not a 401 (which is expected for auth issues)
        if (!apiError.message?.includes('401')) {
          console.warn('Network graph API failed, falling back to room participants:', apiError.message);
        }
        const fallbackNodes: GraphNode[] = roomParticipants.map(participant => ({
          id: participant.id,
          username: participant.username,
          displayName: participant.username,
          avatarColor: participant.color,
          isInRoom: true,
          roomPresenceColor: participant.color,
          isCurrentUser: participant.id === session.username || participant.id === roomParticipants[0]?.id,
          isAnonymous: false,
          trustLevelTo: undefined,
          trustLevelFrom: undefined,
        }));

        setState({
          nodes: fallbackNodes,
          edges: [],
          myConnections: [],
          isLoading: false,
          error: null, // Don't show error to user - graceful degradation
        });
        return;
      }

      // Enrich nodes with room status, current user flag, and anonymous status
      const graphNodeIds = new Set(graph.nodes.map(n => n.id));

      const enrichedNodes = graph.nodes.map(node => ({
        ...node,
        isInRoom: participantIds.includes(node.id),
        roomPresenceColor: participantColorMap.get(node.id),
        isCurrentUser: node.username === session.username,
        isAnonymous: false, // Nodes from the graph are authenticated
      }));

      // Always ensure the current user is in the graph, even if they have no connections
      const currentUserInGraph = enrichedNodes.some(n => n.isCurrentUser);
      if (!currentUserInGraph) {
        // Find current user in room participants
        const currentUserParticipant = roomParticipants.find(p => p.id === session.username);
        if (currentUserParticipant) {
          enrichedNodes.push({
            id: currentUserParticipant.id,
            username: currentUserParticipant.username,
            displayName: currentUserParticipant.username,
            avatarColor: currentUserParticipant.color,
            isInRoom: true,
            roomPresenceColor: currentUserParticipant.color,
            isCurrentUser: true,
            isAnonymous: false,
            trustLevelTo: undefined,
            trustLevelFrom: undefined,
          });
        }
      }

      // Add room participants who are not in the network graph as anonymous nodes
      roomParticipants.forEach(participant => {
        if (!graphNodeIds.has(participant.id) && participant.id !== session.username) {
          // Check if this looks like an anonymous/guest ID
          const isAnonymous = participant.username.startsWith('Guest') ||
                             participant.username === 'Anonymous' ||
                             !participant.id.match(/^[a-zA-Z0-9_-]+$/); // CryptID usernames are alphanumeric

          enrichedNodes.push({
            id: participant.id,
            username: participant.username,
            displayName: participant.username,
            avatarColor: participant.color,
            isInRoom: true,
            roomPresenceColor: participant.color,
            isCurrentUser: false,
            isAnonymous,
            trustLevelTo: undefined,
            trustLevelFrom: undefined,
          });
        }
      });

      setState({
        nodes: enrichedNodes,
        edges: graph.edges,
        myConnections: graph.myConnections,
        isLoading: false,
        error: null,
      });

      // Cache the result
      setCachedGraph(graph);
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message,
      }));
    }
  }, [session.authed, session.username, participantIds, participantColorMap, useCache, roomParticipants]);

  // Initial fetch
  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Listen for session-cleared event to immediately clear graph state
  useEffect(() => {
    const handleSessionCleared = () => {
      clearGraphCache();
      setState({
        nodes: [],
        edges: [],
        myConnections: [],
        isLoading: false,
        error: null,
      });
    };

    window.addEventListener('session-cleared', handleSessionCleared);
    return () => window.removeEventListener('session-cleared', handleSessionCleared);
  }, []);

  // Refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => fetchGraph(true), refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchGraph]);

  // Update room status when participants change AND add new participants immediately
  useEffect(() => {
    setState(prev => {
      const existingNodeIds = new Set(prev.nodes.map(n => n.id));

      // Update existing nodes with room status
      const updatedNodes = prev.nodes.map(node => ({
        ...node,
        isInRoom: participantIds.includes(node.id),
        roomPresenceColor: participantColorMap.get(node.id),
      }));

      // Add any new room participants that aren't in the graph yet
      roomParticipants.forEach(participant => {
        if (!existingNodeIds.has(participant.id)) {
          // Check if this is the current user
          const isCurrentUser = participant.id === session.username;

          // Check if this looks like an anonymous/guest ID
          const isAnonymous = !isCurrentUser && (
            participant.username.startsWith('Guest') ||
            participant.username === 'Anonymous' ||
            !participant.id.match(/^[a-zA-Z0-9_-]+$/)
          );

          updatedNodes.push({
            id: participant.id,
            username: participant.username,
            displayName: participant.username,
            avatarColor: participant.color,
            isInRoom: true,
            roomPresenceColor: participant.color,
            isCurrentUser,
            isAnonymous,
            trustLevelTo: undefined,
            trustLevelFrom: undefined,
          });
        }
      });

      return {
        ...prev,
        nodes: updatedNodes,
      };
    });
  }, [participantIds, participantColorMap, roomParticipants, session.username]);

  // Connect to a user
  const connect = useCallback(async (userId: string, trustLevel: TrustLevel = 'connected') => {
    try {
      await createConnection(userId, trustLevel);
      // Refresh the graph to get updated state
      await fetchGraph(true);
      clearGraphCache();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: (error as Error).message,
      }));
      throw error;
    }
  }, [fetchGraph]);

  // Disconnect from a user
  const disconnect = useCallback(async (connectionId: string) => {
    try {
      await removeConnection(connectionId);
      // Refresh the graph to get updated state
      await fetchGraph(true);
      clearGraphCache();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: (error as Error).message,
      }));
      throw error;
    }
  }, [fetchGraph]);

  // Check if connected to a user
  const isConnectedTo = useCallback((userId: string) => {
    return state.myConnections.includes(userId);
  }, [state.myConnections]);

  // Get node by ID
  const getNode = useCallback((userId: string) => {
    return state.nodes.find(n => n.id === userId);
  }, [state.nodes]);

  // Get edges for a node
  const getEdgesForNode = useCallback((userId: string) => {
    return state.edges.filter(e => e.source === userId || e.target === userId);
  }, [state.edges]);

  // Split nodes into room vs network
  const roomNodes = useMemo(() =>
    state.nodes.filter(n => n.isInRoom),
    [state.nodes]
  );

  const networkNodes = useMemo(() =>
    state.nodes.filter(n => !n.isInRoom),
    [state.nodes]
  );

  return {
    ...state,
    refresh: () => fetchGraph(true),
    connect,
    disconnect,
    isConnectedTo,
    getNode,
    getEdgesForNode,
    roomNodes,
    networkNodes,
  };
}

// =============================================================================
// Helper Hook: Extract room participants from tldraw editor
// =============================================================================

/**
 * Extract room participants from tldraw collaborators
 * Use this to get the roomParticipants for useNetworkGraph
 */
export function useRoomParticipantsFromEditor(editor: any): RoomParticipant[] {
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);

  useEffect(() => {
    if (!editor) return;

    const updateParticipants = () => {
      try {
        const collaborators = editor.getCollaborators();
        const currentUser = editor.user;

        const ps: RoomParticipant[] = [
          // Add current user
          {
            id: currentUser.getId(),
            username: currentUser.getName(),
            color: currentUser.getColor(),
          },
          // Add collaborators
          ...collaborators.map((c: any) => ({
            id: c.id || c.instanceId,
            username: c.userName || 'Anonymous',
            color: c.color,
          })),
        ];

        setParticipants(ps);
      } catch (e) {
        console.warn('Failed to get collaborators:', e);
      }
    };

    // Initial update
    updateParticipants();

    // Listen for changes
    // Note: tldraw doesn't have a great event for this, so we poll
    const interval = setInterval(updateParticipants, 2000);

    return () => clearInterval(interval);
  }, [editor]);

  return participants;
}
