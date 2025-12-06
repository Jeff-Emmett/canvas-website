/**
 * User Networking / Social Graph Types
 *
 * These types are used for the client-side networking features:
 * - User search and profiles
 * - One-way connections (following)
 * - Edge metadata (private labels/notes on connections)
 * - Network graph visualization
 */

// =============================================================================
// User Profile Types
// =============================================================================

/**
 * Public user profile for search results and graph nodes
 */
export interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarColor: string | null;
  bio: string | null;
}

/**
 * Extended profile with connection status (for search results)
 */
export interface UserSearchResult extends UserProfile {
  isConnected: boolean;       // Am I following them?
  isConnectedBack: boolean;   // Are they following me?
  mutualConnections: number;  // Count of shared connections
}

// =============================================================================
// Trust Levels
// =============================================================================

/**
 * Trust levels for connections:
 * - 'connected': Yellow, grants view permission on shared data
 * - 'trusted': Green, grants edit permission on shared data
 *
 * Unconnected users (grey) have no permissions.
 * The user themselves has admin access.
 */
export type TrustLevel = 'connected' | 'trusted';

/**
 * Color mapping for trust levels
 */
export const TRUST_LEVEL_COLORS: Record<TrustLevel | 'unconnected', string> = {
  unconnected: '#9ca3af', // grey
  connected: '#eab308',   // yellow
  trusted: '#22c55e',     // green
};

/**
 * Permission mapping for trust levels
 */
export const TRUST_LEVEL_PERMISSIONS: Record<TrustLevel | 'unconnected', 'none' | 'view' | 'edit'> = {
  unconnected: 'none',
  connected: 'view',
  trusted: 'edit',
};

// =============================================================================
// Connection Types
// =============================================================================

/**
 * A one-way connection from one user to another
 */
export interface Connection {
  id: string;
  fromUserId: string;
  toUserId: string;
  trustLevel: TrustLevel;
  createdAt: string;
  isMutual: boolean;  // True if both users follow each other
  // The highest trust level between both directions (if mutual)
  effectiveTrustLevel: TrustLevel | null;
}

/**
 * Private metadata for a connection edge
 * Each party on an edge can have their own metadata
 */
export interface EdgeMetadata {
  label: string | null;       // Short label (e.g., "Met at ETHDenver")
  notes: string | null;       // Private notes
  color: string | null;       // Custom edge color (hex)
  strength: number;           // 1-10 connection strength
}

/**
 * Full connection with optional metadata
 */
export interface ConnectionWithMetadata extends Connection {
  metadata?: EdgeMetadata;
}

// =============================================================================
// Graph Types (for visualization)
// =============================================================================

/**
 * Node in the network graph
 */
export interface GraphNode {
  id: string;
  username: string;
  displayName: string | null;
  avatarColor: string | null;
  // Connection state (from current user's perspective)
  trustLevelTo?: TrustLevel;    // Trust level I've granted to this user
  trustLevelFrom?: TrustLevel;  // Trust level they've granted to me
  // Visualization state
  isInRoom: boolean;          // Currently in the same room
  roomPresenceColor?: string; // Color from room presence (if in room)
  isCurrentUser: boolean;     // Is this the logged-in user
}

/**
 * Edge in the network graph
 */
export interface GraphEdge {
  id: string;
  source: string;             // from user ID
  target: string;             // to user ID
  trustLevel: TrustLevel;     // Trust level of this direction
  isMutual: boolean;          // Both directions exist
  // The highest trust level between both directions (if mutual)
  effectiveTrustLevel: TrustLevel | null;
  // Only included if current user is on this edge
  metadata?: EdgeMetadata;
  // Visualization state
  isVisible: boolean;         // Should be rendered (based on privacy)
}

/**
 * Complete network graph for visualization
 */
export interface NetworkGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  myConnections: string[];  // User IDs the current user is connected to
}

/**
 * Room-scoped graph (subset of network that's in current room)
 */
export interface RoomNetworkGraph extends NetworkGraph {
  roomId: string;
  // All room participants (even if not in your network)
  roomParticipants: string[];
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface SearchUsersRequest {
  query: string;
  limit?: number;
}

export interface SearchUsersResponse {
  users: UserSearchResult[];
  total: number;
}

export interface CreateConnectionRequest {
  toUserId: string;
}

export interface CreateConnectionResponse {
  connection: Connection;
}

export interface UpdateEdgeMetadataRequest {
  connectionId: string;
  metadata: Partial<EdgeMetadata>;
}

export interface GetNetworkGraphRequest {
  userId?: string;            // If not provided, returns current user's network
  roomParticipants?: string[]; // If provided, marks which nodes are in room
}

export interface GetNetworkGraphResponse {
  graph: NetworkGraph;
  myConnections: string[];    // User IDs I'm connected to
}

// =============================================================================
// Real-time Events
// =============================================================================

export type NetworkEventType =
  | 'connection:created'
  | 'connection:removed'
  | 'metadata:updated'
  | 'user:joined_room'
  | 'user:left_room';

export interface NetworkEvent {
  type: NetworkEventType;
  payload: unknown;
  timestamp: number;
}

export interface ConnectionCreatedEvent {
  type: 'connection:created';
  payload: {
    connection: Connection;
  };
}

export interface ConnectionRemovedEvent {
  type: 'connection:removed';
  payload: {
    connectionId: string;
    fromUserId: string;
    toUserId: string;
  };
}

export interface MetadataUpdatedEvent {
  type: 'metadata:updated';
  payload: {
    connectionId: string;
    userId: string;  // Who updated their metadata
  };
}
