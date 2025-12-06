/**
 * Connection Service
 *
 * Client-side API for user networking features:
 * - User search
 * - Connection management (follow/unfollow)
 * - Edge metadata (labels, notes, colors)
 * - Network graph retrieval
 */

import type {
  UserProfile,
  UserSearchResult,
  Connection,
  ConnectionWithMetadata,
  EdgeMetadata,
  NetworkGraph,
  GraphNode,
  GraphEdge,
  TrustLevel,
} from './types';

// =============================================================================
// Configuration
// =============================================================================

const API_BASE = '/api/networking';

// =============================================================================
// Helper Functions
// =============================================================================

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}

function generateId(): string {
  return crypto.randomUUID();
}

// =============================================================================
// User Search
// =============================================================================

/**
 * Search for users by username or display name
 */
export async function searchUsers(
  query: string,
  limit: number = 20
): Promise<UserSearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return fetchJson<UserSearchResult[]>(`${API_BASE}/users/search?${params}`);
}

/**
 * Get a user's public profile
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    return await fetchJson<UserProfile>(`${API_BASE}/users/${userId}`);
  } catch (error) {
    if ((error as Error).message.includes('404')) {
      return null;
    }
    throw error;
  }
}

/**
 * Update current user's profile
 */
export async function updateMyProfile(updates: Partial<{
  displayName: string;
  bio: string;
  avatarColor: string;
}>): Promise<UserProfile> {
  return fetchJson<UserProfile>(`${API_BASE}/users/me`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// =============================================================================
// Connection Management
// =============================================================================

/**
 * Create a connection (follow a user)
 * @param toUserId - The user to connect to
 * @param trustLevel - 'connected' (yellow, view) or 'trusted' (green, edit)
 */
export async function createConnection(
  toUserId: string,
  trustLevel: TrustLevel = 'connected'
): Promise<Connection> {
  return fetchJson<Connection>(`${API_BASE}/connections`, {
    method: 'POST',
    body: JSON.stringify({ toUserId, trustLevel }),
  });
}

/**
 * Update trust level for an existing connection
 */
export async function updateTrustLevel(
  connectionId: string,
  trustLevel: TrustLevel
): Promise<Connection> {
  return fetchJson<Connection>(`${API_BASE}/connections/${connectionId}/trust`, {
    method: 'PUT',
    body: JSON.stringify({ trustLevel }),
  });
}

/**
 * Remove a connection (unfollow a user)
 */
export async function removeConnection(connectionId: string): Promise<void> {
  await fetch(`${API_BASE}/connections/${connectionId}`, {
    method: 'DELETE',
  });
}

/**
 * Get a specific connection by ID
 */
export async function getConnection(connectionId: string): Promise<ConnectionWithMetadata | null> {
  try {
    return await fetchJson<ConnectionWithMetadata>(`${API_BASE}/connections/${connectionId}`);
  } catch (error) {
    if ((error as Error).message.includes('404')) {
      return null;
    }
    throw error;
  }
}

/**
 * Get all connections for current user
 */
export async function getMyConnections(): Promise<ConnectionWithMetadata[]> {
  return fetchJson<ConnectionWithMetadata[]>(`${API_BASE}/connections`);
}

/**
 * Get users who are connected to current user (followers)
 */
export async function getMyFollowers(): Promise<Connection[]> {
  return fetchJson<Connection[]>(`${API_BASE}/connections/followers`);
}

/**
 * Check if current user is connected to a specific user
 */
export async function isConnectedTo(userId: string): Promise<boolean> {
  try {
    const result = await fetchJson<{ connected: boolean }>(
      `${API_BASE}/connections/check/${userId}`
    );
    return result.connected;
  } catch {
    return false;
  }
}

// =============================================================================
// Edge Metadata
// =============================================================================

/**
 * Update metadata for a connection edge
 */
export async function updateEdgeMetadata(
  connectionId: string,
  metadata: Partial<EdgeMetadata>
): Promise<EdgeMetadata> {
  return fetchJson<EdgeMetadata>(`${API_BASE}/connections/${connectionId}/metadata`, {
    method: 'PUT',
    body: JSON.stringify(metadata),
  });
}

/**
 * Get metadata for a connection edge
 */
export async function getEdgeMetadata(connectionId: string): Promise<EdgeMetadata | null> {
  try {
    return await fetchJson<EdgeMetadata>(`${API_BASE}/connections/${connectionId}/metadata`);
  } catch (error) {
    if ((error as Error).message.includes('404')) {
      return null;
    }
    throw error;
  }
}

// =============================================================================
// Network Graph
// =============================================================================

/**
 * Get the full network graph for current user
 */
export async function getMyNetworkGraph(): Promise<NetworkGraph> {
  return fetchJson<NetworkGraph>(`${API_BASE}/graph`);
}

/**
 * Get network graph scoped to room participants
 * Returns full network in grey, room participants colored
 */
export async function getRoomNetworkGraph(
  roomParticipants: string[]
): Promise<NetworkGraph> {
  return fetchJson<NetworkGraph>(`${API_BASE}/graph/room`, {
    method: 'POST',
    body: JSON.stringify({ participants: roomParticipants }),
  });
}

/**
 * Get mutual connections between current user and another user
 */
export async function getMutualConnections(userId: string): Promise<UserProfile[]> {
  return fetchJson<UserProfile[]>(`${API_BASE}/connections/mutual/${userId}`);
}

// =============================================================================
// Graph Building Helpers (Client-side)
// =============================================================================

/**
 * Build a GraphNode from a UserProfile and room state
 */
export function buildGraphNode(
  profile: UserProfile,
  options: {
    isInRoom: boolean;
    roomPresenceColor?: string;
    isCurrentUser: boolean;
  }
): GraphNode {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarColor: profile.avatarColor,
    isInRoom: options.isInRoom,
    roomPresenceColor: options.roomPresenceColor,
    isCurrentUser: options.isCurrentUser,
  };
}

/**
 * Build a GraphEdge from a Connection
 */
export function buildGraphEdge(
  connection: ConnectionWithMetadata,
  currentUserId: string
): GraphEdge {
  const isOnEdge = connection.fromUserId === currentUserId || connection.toUserId === currentUserId;

  return {
    id: connection.id,
    source: connection.fromUserId,
    target: connection.toUserId,
    trustLevel: connection.trustLevel,
    effectiveTrustLevel: connection.effectiveTrustLevel,
    isMutual: connection.isMutual,
    metadata: isOnEdge ? connection.metadata : undefined,
    isVisible: true,
  };
}

// =============================================================================
// Local Storage Cache (for offline/fast loading)
// =============================================================================

const CACHE_KEY = 'network_graph_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedGraph {
  graph: NetworkGraph;
  timestamp: number;
}

export function getCachedGraph(): NetworkGraph | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { graph, timestamp }: CachedGraph = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return graph;
  } catch {
    return null;
  }
}

export function setCachedGraph(graph: NetworkGraph): void {
  try {
    const cached: CachedGraph = {
      graph,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore storage errors
  }
}

export function clearGraphCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore
  }
}
