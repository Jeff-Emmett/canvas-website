/**
 * Real-Time Location Presence System
 *
 * Privacy-preserving location sharing for collaborative mapping.
 * Each user's location is shared at different precision levels
 * based on their trust circle configuration.
 *
 * Features:
 * - zkGPS commitment-based location hiding
 * - Trust circle precision controls (intimate → public)
 * - Real-time broadcasting and receiving
 * - Proximity detection without exact location
 * - React hooks for easy integration
 * - Map visualization components
 *
 * IMPORTANT: Location sharing is OPT-IN by default. Users must explicitly
 * click "Share Location" to start broadcasting. GPS is never accessed
 * without user consent.
 *
 * Usage:
 * ```typescript
 * import { useLocationPresence, PresenceLayer } from './presence';
 *
 * function MapWithPresence() {
 *   const presence = useLocationPresence({
 *     channelId: 'my-map-room',
 *     user: {
 *       pubKey: myPublicKey,
 *       privKey: myPrivateKey,
 *       displayName: 'Alice',
 *       color: '#3b82f6',
 *     },
 *     broadcastFn: (data) => sendToNetwork(data),
 *     // autoStartLocation: false (DEFAULT - location is OPT-IN)
 *   });
 *
 *   // Handle incoming broadcasts from network
 *   useEffect(() => {
 *     const unsub = subscribeToNetwork((msg) => {
 *       if (msg.type === 'location-presence') {
 *         presence.handleBroadcast(msg.payload);
 *       }
 *     });
 *     return unsub;
 *   }, [presence.handleBroadcast]);
 *
 *   return (
 *     <div>
 *       <Map>
 *         <PresenceLayer
 *           views={presence.views}
 *           project={(lat, lng) => map.project([lng, lat])}
 *           zoom={map.getZoom()}
 *         />
 *       </Map>
 *
 *       {/* Location sharing toggle - user must opt-in *\/}
 *       {!presence.isSharing ? (
 *         <button onClick={presence.startSharing}>
 *           Share My Location (zkGPS)
 *         </button>
 *       ) : (
 *         <button onClick={presence.stopSharing}>
 *           Stop Sharing
 *         </button>
 *       )}
 *
 *       <PresenceList
 *         views={presence.views}
 *         onTrustLevelChange={presence.setTrustLevel}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */

// Types
export type {
  UserPresence,
  LocationPresence,
  PresenceStatus,
  LocationSource,
  PresenceBroadcast,
  LocationBroadcastPayload,
  StatusBroadcastPayload,
  ProximityBroadcastPayload,
  PrecisionLevel,
  PresenceView,
  ViewableLocation,
  ProximityInfo,
  PresenceChannelConfig,
  PresenceChannelState,
  PresenceEvent,
  PresenceEventListener,
} from './types';

export {
  DEFAULT_PRESENCE_CONFIG,
  GEOHASH_PRECISION_RADIUS,
  TRUST_LEVEL_PRECISION,
  getRadiusForPrecision,
  getPrecisionForTrustLevel,
} from './types';

// Manager
export {
  PresenceManager,
  createPresenceManager,
} from './manager';

// React hook
export {
  useLocationPresence,
  viewsToIndicators,
  type UseLocationPresenceConfig,
  type UseLocationPresenceReturn,
  type PresenceIndicatorData,
} from './useLocationPresence';

// Components
export {
  PresenceLayer,
  PresenceList,
  type PresenceLayerProps,
  type PresenceListProps,
} from './PresenceLayer';
