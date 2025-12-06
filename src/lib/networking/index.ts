/**
 * User Networking Module
 *
 * Provides social graph functionality for the canvas:
 * - User search by username
 * - One-way connections (following)
 * - Private edge metadata (labels, notes, colors)
 * - Network graph visualization
 */

// Types
export type {
  UserProfile,
  UserSearchResult,
  Connection,
  ConnectionWithMetadata,
  EdgeMetadata,
  GraphNode,
  GraphEdge,
  NetworkGraph,
  RoomNetworkGraph,
  NetworkEvent,
  NetworkEventType,
  TrustLevel,
} from './types';

// Constants
export { TRUST_LEVEL_COLORS, TRUST_LEVEL_PERMISSIONS } from './types';

// Connection Service API
export {
  // User search
  searchUsers,
  getUserProfile,
  updateMyProfile,
  // Connection management
  createConnection,
  updateTrustLevel,
  removeConnection,
  getConnection,
  getMyConnections,
  getMyFollowers,
  isConnectedTo,
  // Edge metadata
  updateEdgeMetadata,
  getEdgeMetadata,
  // Network graph
  getMyNetworkGraph,
  getRoomNetworkGraph,
  getMutualConnections,
  // Graph building helpers
  buildGraphNode,
  buildGraphEdge,
  // Cache
  getCachedGraph,
  setCachedGraph,
  clearGraphCache,
} from './connectionService';
