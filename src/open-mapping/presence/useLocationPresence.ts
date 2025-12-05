/**
 * React Hook for Location Presence
 *
 * Provides real-time location sharing with privacy controls
 * for use in the tldraw canvas.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  UserPresence,
  PresenceView,
  PresenceStatus,
  PresenceEvent,
  PresenceBroadcast,
  PresenceChannelConfig,
} from './types';
import { PresenceManager, createPresenceManager } from './manager';
import type { TrustLevel } from '../privacy/types';

// =============================================================================
// Hook Configuration
// =============================================================================

export interface UseLocationPresenceConfig {
  /** Channel/room ID */
  channelId: string;

  /** User identity */
  user: {
    pubKey: string;
    privKey: string;
    displayName: string;
    color: string;
  };

  /** Broadcast function (from Automerge adapter or WebSocket) */
  broadcastFn?: (data: any) => void;

  /** Whether to start location watch automatically */
  autoStartLocation?: boolean;

  /** Additional config options */
  config?: Partial<Omit<PresenceChannelConfig, 'channelId' | 'userPubKey' | 'userPrivKey' | 'displayName' | 'color'>>;
}

export interface UseLocationPresenceReturn {
  /** Current connection state */
  connectionState: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

  /** Own presence data */
  self: UserPresence;

  /** Views of other users (with trust-based precision) */
  views: PresenceView[];

  /** Online user count */
  onlineCount: number;

  /** Start sharing location */
  startSharing: () => void;

  /** Stop sharing location */
  stopSharing: () => void;

  /** Whether currently sharing location */
  isSharing: boolean;

  /** Set manual location */
  setLocation: (lat: number, lng: number) => Promise<void>;

  /** Clear location */
  clearLocation: () => void;

  /** Set status */
  setStatus: (status: PresenceStatus, message?: string) => void;

  /** Set trust level for a user */
  setTrustLevel: (pubKey: string, level: TrustLevel) => void;

  /** Get trust level for a user */
  getTrustLevel: (pubKey: string) => TrustLevel;

  /** Handle incoming broadcast (call this with data from network) */
  handleBroadcast: (broadcast: PresenceBroadcast) => void;

  /** Get users nearby */
  getNearbyUsers: (maxDistance?: 'here' | 'nearby' | 'same-area' | 'same-city') => PresenceView[];

  /** Presence manager instance (for advanced use) */
  manager: PresenceManager | null;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useLocationPresence(
  config: UseLocationPresenceConfig
): UseLocationPresenceReturn {
  const { channelId, user, broadcastFn, autoStartLocation = false } = config;

  // State
  const [connectionState, setConnectionState] = useState<UseLocationPresenceReturn['connectionState']>('connecting');
  const [self, setSelf] = useState<UserPresence | null>(null);
  const [views, setViews] = useState<PresenceView[]>([]);
  const [isSharing, setIsSharing] = useState(false);

  // Refs
  const managerRef = useRef<PresenceManager | null>(null);
  const broadcastFnRef = useRef(broadcastFn);

  // Keep broadcast function ref updated
  useEffect(() => {
    broadcastFnRef.current = broadcastFn;
  }, [broadcastFn]);

  // Initialize manager
  useEffect(() => {
    const manager = createPresenceManager({
      channelId,
      userPubKey: user.pubKey,
      userPrivKey: user.privKey,
      displayName: user.displayName,
      color: user.color,
      ...config.config,
    });

    managerRef.current = manager;

    // Subscribe to events
    const unsubscribe = manager.on((event: PresenceEvent) => {
      switch (event.type) {
        case 'connection:changed':
          setConnectionState(event.state);
          break;

        case 'user:joined':
        case 'user:left':
        case 'user:updated':
        case 'location:updated':
        case 'status:changed':
          // Update views
          setViews(manager.getViews());
          break;

        case 'proximity:detected':
          // Could trigger notifications here
          break;

        case 'error':
          console.error('Presence error:', event.error);
          break;
      }
    });

    // Start manager with broadcast callback
    manager.start((broadcast) => {
      if (broadcastFnRef.current) {
        broadcastFnRef.current({
          type: 'location-presence',
          payload: broadcast,
        });
      }
    });

    // Set initial self
    setSelf(manager.getSelf());

    // Auto-start location if configured
    if (autoStartLocation) {
      manager.startLocationWatch();
      setIsSharing(true);
    }

    return () => {
      unsubscribe();
      manager.stop();
      managerRef.current = null;
    };
  }, [channelId, user.pubKey, user.privKey, user.displayName, user.color, autoStartLocation]);

  // Update self periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (managerRef.current) {
        setSelf(managerRef.current.getSelf());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Actions
  const startSharing = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.startLocationWatch();
      setIsSharing(true);
    }
  }, []);

  const stopSharing = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.stopLocationWatch();
      managerRef.current.clearLocation();
      setIsSharing(false);
    }
  }, []);

  const setLocation = useCallback(async (lat: number, lng: number) => {
    if (managerRef.current) {
      await managerRef.current.setLocation(lat, lng, 'manual');
      setSelf(managerRef.current.getSelf());
    }
  }, []);

  const clearLocation = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.clearLocation();
      setSelf(managerRef.current.getSelf());
    }
  }, []);

  const setStatus = useCallback((status: PresenceStatus, message?: string) => {
    if (managerRef.current) {
      managerRef.current.setStatus(status, message);
      setSelf(managerRef.current.getSelf());
    }
  }, []);

  const setTrustLevel = useCallback((pubKey: string, level: TrustLevel) => {
    if (managerRef.current) {
      managerRef.current.setTrustLevel(pubKey, level);
      setViews(managerRef.current.getViews());
    }
  }, []);

  const getTrustLevel = useCallback((pubKey: string): TrustLevel => {
    if (managerRef.current) {
      return managerRef.current.getTrustLevel(pubKey);
    }
    return 'public';
  }, []);

  const handleBroadcast = useCallback((broadcast: PresenceBroadcast) => {
    if (managerRef.current) {
      managerRef.current.handleBroadcast(broadcast);
    }
  }, []);

  const getNearbyUsers = useCallback((maxDistance: 'here' | 'nearby' | 'same-area' | 'same-city' = 'same-area') => {
    if (managerRef.current) {
      return managerRef.current.getUsersNearby(maxDistance);
    }
    return [];
  }, []);

  // Computed values
  const onlineCount = useMemo(() => {
    return views.filter((v) => v.status === 'online' || v.status === 'away').length;
  }, [views]);

  return {
    connectionState,
    self: self ?? {
      pubKey: user.pubKey,
      displayName: user.displayName,
      color: user.color,
      location: null,
      status: 'online',
      lastSeen: new Date(),
      isMoving: false,
      deviceType: 'unknown',
    },
    views,
    onlineCount,
    startSharing,
    stopSharing,
    isSharing,
    setLocation,
    clearLocation,
    setStatus,
    setTrustLevel,
    getTrustLevel,
    handleBroadcast,
    getNearbyUsers,
    manager: managerRef.current,
  };
}

// =============================================================================
// Presence Indicator Component Data
// =============================================================================

/**
 * Get data for rendering a presence indicator on the map
 */
export interface PresenceIndicatorData {
  id: string;
  displayName: string;
  color: string;
  position: { lat: number; lng: number };
  uncertaintyRadius: number;
  isMoving: boolean;
  heading?: number;
  status: PresenceStatus;
  trustLevel: TrustLevel;
  isVerified: boolean;
  lastSeen: Date;
}

/**
 * Convert presence views to indicator data for map rendering
 */
export function viewsToIndicators(views: PresenceView[]): PresenceIndicatorData[] {
  return views
    .filter((v) => v.location !== null)
    .map((v) => ({
      id: v.user.pubKey,
      displayName: v.user.displayName,
      color: v.user.color,
      position: {
        lat: v.location!.center.latitude,
        lng: v.location!.center.longitude,
      },
      uncertaintyRadius: v.location!.uncertaintyRadius,
      isMoving: v.location!.isMoving,
      heading: v.location!.heading,
      status: v.status,
      trustLevel: v.trustLevel,
      isVerified: v.isVerified,
      lastSeen: v.lastSeen,
    }));
}
