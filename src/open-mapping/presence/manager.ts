/**
 * Presence Manager
 *
 * Manages real-time location sharing with privacy controls.
 * Integrates with zkGPS for commitments and trust circles for
 * precision-based sharing.
 */

import type {
  UserPresence,
  LocationPresence,
  PresenceStatus,
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
  LocationSource,
} from './types';
import {
  DEFAULT_PRESENCE_CONFIG,
  TRUST_LEVEL_PRECISION,
  getRadiusForPrecision,
  getPrecisionForTrustLevel,
} from './types';
import type { TrustLevel, GeohashCommitment } from '../privacy/types';
import { TrustCircleManager, createTrustCircleManager } from '../privacy/trustCircles';
import { createCommitment } from '../privacy/commitments';
import { encodeGeohash, decodeGeohash, getGeohashBounds } from '../privacy/geohash';

// =============================================================================
// Presence Manager
// =============================================================================

/**
 * Manages presence for a channel
 */
export class PresenceManager {
  private config: PresenceChannelConfig;
  private state: PresenceChannelState;
  private trustCircles: TrustCircleManager;
  private listeners: Set<PresenceEventListener> = new Set();
  private updateTimer: ReturnType<typeof setInterval> | null = null;
  private locationWatchId: number | null = null;
  private lastLocationUpdate: number = 0;
  private broadcastCallback: ((broadcast: PresenceBroadcast) => void) | null = null;

  constructor(
    config: Partial<PresenceChannelConfig> & Pick<PresenceChannelConfig, 'channelId' | 'userPubKey' | 'userPrivKey' | 'displayName' | 'color'>
  ) {
    this.config = {
      ...DEFAULT_PRESENCE_CONFIG,
      ...config,
    };

    this.trustCircles = createTrustCircleManager(this.config.userPubKey);

    this.state = {
      config: this.config,
      self: {
        pubKey: this.config.userPubKey,
        displayName: this.config.displayName,
        color: this.config.color,
        location: null,
        status: 'online',
        lastSeen: new Date(),
        isMoving: false,
        deviceType: this.detectDeviceType(),
      },
      others: new Map(),
      views: new Map(),
      connectionState: 'connecting',
      lastSequence: 0,
    };
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Start presence sharing
   */
  start(broadcastCallback: (broadcast: PresenceBroadcast) => void): void {
    this.broadcastCallback = broadcastCallback;
    this.state.connectionState = 'connected';

    // Start periodic presence updates
    this.updateTimer = setInterval(() => {
      this.broadcastPresence();
    }, this.config.updateInterval);

    // Broadcast initial presence
    this.broadcastPresence();

    this.emit({ type: 'connection:changed', state: 'connected' });
  }

  /**
   * Stop presence sharing
   */
  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    this.stopLocationWatch();

    // Broadcast leave message
    if (this.broadcastCallback) {
      this.broadcastCallback(this.createBroadcast('leave', null));
    }

    this.state.connectionState = 'disconnected';
    this.emit({ type: 'connection:changed', state: 'disconnected' });
  }

  // ===========================================================================
  // Location Sharing
  // ===========================================================================

  /**
   * Start watching device location
   */
  startLocationWatch(): void {
    if (!navigator.geolocation) {
      console.warn('Geolocation not available');
      return;
    }

    this.locationWatchId = navigator.geolocation.watchPosition(
      (position) => this.handleLocationUpdate(position),
      (error) => this.handleLocationError(error),
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );
  }

  /**
   * Stop watching device location
   */
  stopLocationWatch(): void {
    if (this.locationWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }
  }

  /**
   * Handle location update from device
   */
  private async handleLocationUpdate(position: GeolocationPosition): Promise<void> {
    const now = Date.now();

    // Throttle updates
    if (now - this.lastLocationUpdate < this.config.locationThrottle) {
      return;
    }
    this.lastLocationUpdate = now;

    const coords = position.coords;

    // Determine if moving based on speed
    const isMoving = (coords.speed ?? 0) > 0.5; // > 0.5 m/s = moving

    // Create zkGPS commitment for the location
    const geohash = encodeGeohash(coords.latitude, coords.longitude, 12);
    const commitment = await createCommitment(
      coords.latitude,
      coords.longitude,
      12,
      this.config.userPubKey,
      this.config.userPrivKey
    );

    // Update self location
    this.state.self.location = {
      coordinates: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        altitude: coords.altitude ?? undefined,
        accuracy: coords.accuracy,
        heading: coords.heading ?? undefined,
        speed: coords.speed ?? undefined,
      },
      commitment,
      timestamp: new Date(position.timestamp),
      source: 'gps',
      isLive: true,
    };

    this.state.self.isMoving = isMoving;
    this.state.self.lastSeen = new Date();

    // Broadcast location update
    this.broadcastLocation();
  }

  /**
   * Handle location error
   */
  private handleLocationError(error: GeolocationPositionError): void {
    console.warn('Location error:', error.message);
    this.emit({ type: 'error', error: `Location error: ${error.message}` });
  }

  /**
   * Manually set location (for testing or manual input)
   */
  async setLocation(
    latitude: number,
    longitude: number,
    source: LocationSource = 'manual'
  ): Promise<void> {
    const commitment = await createCommitment(
      latitude,
      longitude,
      12,
      this.config.userPubKey,
      this.config.userPrivKey
    );

    this.state.self.location = {
      coordinates: {
        latitude,
        longitude,
      },
      commitment,
      timestamp: new Date(),
      source,
      isLive: source === 'gps',
    };

    this.state.self.lastSeen = new Date();
    this.broadcastLocation();
  }

  /**
   * Clear current location (stop sharing)
   */
  clearLocation(): void {
    this.state.self.location = null;
    this.broadcastPresence();
  }

  // ===========================================================================
  // Broadcasting
  // ===========================================================================

  /**
   * Broadcast current presence
   */
  private broadcastPresence(): void {
    if (!this.broadcastCallback) return;

    if (this.state.self.location) {
      this.broadcastLocation();
    } else {
      this.broadcastStatus();
    }
  }

  /**
   * Broadcast location update
   */
  private broadcastLocation(): void {
    if (!this.broadcastCallback || !this.state.self.location) return;

    const location = this.state.self.location;

    // Create precision levels for each trust level
    const precisionLevels: PrecisionLevel[] = [];
    const fullGeohash = location.commitment.geohash;

    for (const [level, precision] of Object.entries(TRUST_LEVEL_PRECISION)) {
      precisionLevels.push({
        trustLevel: level as TrustLevel,
        geohash: fullGeohash.substring(0, precision),
        precision,
      });
    }

    const payload: LocationBroadcastPayload = {
      commitment: location.commitment,
      precisionLevels,
      isMoving: this.state.self.isMoving,
      heading: location.coordinates.heading,
      speedCategory: this.getSpeedCategory(location.coordinates.speed),
    };

    const broadcast = this.createBroadcast('location', payload);
    this.broadcastCallback(broadcast);
  }

  /**
   * Broadcast status update
   */
  private broadcastStatus(): void {
    if (!this.broadcastCallback) return;

    const payload: StatusBroadcastPayload = {
      status: this.state.self.status,
      message: this.state.self.statusMessage,
      deviceType: this.state.self.deviceType,
    };

    const broadcast = this.createBroadcast('status', payload);
    this.broadcastCallback(broadcast);
  }

  /**
   * Create a broadcast message
   */
  private createBroadcast(
    type: PresenceBroadcast['type'],
    payload: PresenceBroadcast['payload']
  ): PresenceBroadcast {
    this.state.lastSequence++;

    return {
      senderPubKey: this.config.userPubKey,
      type,
      payload,
      signature: this.signBroadcast(type, payload),
      timestamp: new Date(),
      sequence: this.state.lastSequence,
      ttl: this.config.presenceTtl,
    };
  }

  /**
   * Sign a broadcast (simplified - in production use proper crypto)
   */
  private signBroadcast(type: string, payload: any): string {
    const message = JSON.stringify({ type, payload, key: this.config.userPrivKey });
    // In production, use proper signing
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      hash = (hash << 5) - hash + message.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  // ===========================================================================
  // Receiving
  // ===========================================================================

  /**
   * Handle incoming broadcast from another user
   */
  handleBroadcast(broadcast: PresenceBroadcast): void {
    // Ignore our own broadcasts
    if (broadcast.senderPubKey === this.config.userPubKey) return;

    // Check TTL
    const age = (Date.now() - broadcast.timestamp.getTime()) / 1000;
    if (age > broadcast.ttl) {
      return; // Expired
    }

    switch (broadcast.type) {
      case 'location':
        this.handleLocationBroadcast(broadcast);
        break;
      case 'status':
        this.handleStatusBroadcast(broadcast);
        break;
      case 'proximity':
        this.handleProximityBroadcast(broadcast);
        break;
      case 'leave':
        this.handleLeaveBroadcast(broadcast);
        break;
    }
  }

  /**
   * Handle location broadcast
   */
  private handleLocationBroadcast(broadcast: PresenceBroadcast): void {
    const payload = broadcast.payload as LocationBroadcastPayload;
    const senderKey = broadcast.senderPubKey;

    // Get or create user presence
    let user = this.state.others.get(senderKey);
    const isNew = !user;

    if (!user) {
      user = {
        pubKey: senderKey,
        displayName: senderKey.substring(0, 8) + '...',
        color: this.generateUserColor(senderKey),
        location: null,
        status: 'online',
        lastSeen: new Date(),
        isMoving: false,
        deviceType: 'unknown',
      };
      this.state.others.set(senderKey, user);
    }

    // Update user's location (we store the commitment, not decoded location)
    user.location = {
      coordinates: { latitude: 0, longitude: 0 }, // We don't know exact coords
      commitment: payload.commitment,
      timestamp: broadcast.timestamp,
      source: 'network' as LocationSource,
      isLive: true,
    };
    user.isMoving = payload.isMoving;
    user.lastSeen = broadcast.timestamp;
    user.status = 'online';

    // Create view for this user based on trust level
    const view = this.createPresenceView(user, payload);
    this.state.views.set(senderKey, view);

    if (isNew) {
      this.emit({ type: 'user:joined', user });
    } else {
      this.emit({ type: 'user:updated', user, changes: ['location'] });
    }

    if (view.location) {
      this.emit({ type: 'location:updated', pubKey: senderKey, location: view.location });
    }
  }

  /**
   * Handle status broadcast
   */
  private handleStatusBroadcast(broadcast: PresenceBroadcast): void {
    const payload = broadcast.payload as StatusBroadcastPayload;
    const senderKey = broadcast.senderPubKey;

    let user = this.state.others.get(senderKey);
    if (!user) {
      user = {
        pubKey: senderKey,
        displayName: senderKey.substring(0, 8) + '...',
        color: this.generateUserColor(senderKey),
        location: null,
        status: payload.status,
        lastSeen: broadcast.timestamp,
        isMoving: false,
        deviceType: payload.deviceType ?? 'unknown',
      };
      this.state.others.set(senderKey, user);
      this.emit({ type: 'user:joined', user });
    } else {
      user.status = payload.status;
      user.statusMessage = payload.message;
      user.lastSeen = broadcast.timestamp;
      if (payload.deviceType) user.deviceType = payload.deviceType;
      this.emit({ type: 'status:changed', pubKey: senderKey, status: payload.status });
    }
  }

  /**
   * Handle proximity broadcast
   */
  private handleProximityBroadcast(broadcast: PresenceBroadcast): void {
    const payload = broadcast.payload as ProximityBroadcastPayload;

    // Only process if we're the target
    if (payload.targetPubKey !== this.config.userPubKey) return;

    const senderKey = broadcast.senderPubKey;
    const view = this.state.views.get(senderKey);

    if (view) {
      view.proximity = {
        category: payload.distanceCategory,
        verified: true, // Has proof
        mutuallyVisible: true,
      };

      this.emit({ type: 'proximity:detected', pubKey: senderKey, proximity: view.proximity });
    }
  }

  /**
   * Handle leave broadcast
   */
  private handleLeaveBroadcast(broadcast: PresenceBroadcast): void {
    const senderKey = broadcast.senderPubKey;

    this.state.others.delete(senderKey);
    this.state.views.delete(senderKey);

    this.emit({ type: 'user:left', pubKey: senderKey });
  }

  /**
   * Create a presence view based on trust level
   */
  private createPresenceView(
    user: UserPresence,
    payload: LocationBroadcastPayload
  ): PresenceView {
    // Get trust level for this user
    const trustLevel = this.trustCircles.getTrustLevel(user.pubKey) ?? 'public';

    // Find the precision level for our trust relationship
    const precisionLevel = payload.precisionLevels.find(
      (p) => p.trustLevel === trustLevel
    );

    let location: ViewableLocation | null = null;

    if (precisionLevel) {
      const geohash = precisionLevel.geohash;
      const bounds = getGeohashBounds(geohash);
      const center = {
        latitude: (bounds.minLat + bounds.maxLat) / 2,
        longitude: (bounds.minLng + bounds.maxLng) / 2,
      };

      const ageSeconds = (Date.now() - payload.commitment.timestamp.getTime()) / 1000;

      location = {
        geohash,
        precision: precisionLevel.precision,
        center,
        bounds,
        uncertaintyRadius: getRadiusForPrecision(precisionLevel.precision),
        ageSeconds,
        isMoving: payload.isMoving,
        heading: payload.heading,
        speedCategory: payload.speedCategory,
      };
    }

    // Calculate proximity if we have our own location
    let proximity: ProximityInfo | undefined;
    if (location && this.state.self.location) {
      proximity = this.calculateProximity(location);
    }

    return {
      user: {
        pubKey: user.pubKey,
        displayName: user.displayName,
        color: user.color,
      },
      location,
      status: user.status,
      lastSeen: user.lastSeen,
      trustLevel,
      isVerified: true, // Has commitment
      proximity,
    };
  }

  /**
   * Calculate proximity to another user
   */
  private calculateProximity(otherLocation: ViewableLocation): ProximityInfo {
    if (!this.state.self.location) {
      return { category: 'far', verified: false, mutuallyVisible: false };
    }

    const myCoords = this.state.self.location.coordinates;
    const distance = this.haversineDistance(
      myCoords.latitude,
      myCoords.longitude,
      otherLocation.center.latitude,
      otherLocation.center.longitude
    );

    let category: ProximityInfo['category'];
    if (distance < 50) category = 'here';
    else if (distance < 500) category = 'nearby';
    else if (distance < 5000) category = 'same-area';
    else if (distance < 50000) category = 'same-city';
    else category = 'far';

    return {
      category,
      verified: false,
      approximateMeters: distance,
      mutuallyVisible: distance < otherLocation.uncertaintyRadius * 2,
    };
  }

  // ===========================================================================
  // Trust Circle Management
  // ===========================================================================

  /**
   * Set trust level for a contact
   */
  setTrustLevel(pubKey: string, level: TrustLevel): void {
    this.trustCircles.setTrustLevel(pubKey, level);

    // Update view if we have one
    const user = this.state.others.get(pubKey);
    if (user && user.location) {
      // Re-request their location at new precision
      // In a real implementation, this would request updated data
    }
  }

  /**
   * Get trust level for a contact
   */
  getTrustLevel(pubKey: string): TrustLevel {
    return this.trustCircles.getTrustLevel(pubKey) ?? 'public';
  }

  /**
   * Get trust circles manager
   */
  getTrustCircles(): TrustCircleManager {
    return this.trustCircles;
  }

  // ===========================================================================
  // Status Management
  // ===========================================================================

  /**
   * Set own status
   */
  setStatus(status: PresenceStatus, message?: string): void {
    this.state.self.status = status;
    this.state.self.statusMessage = message;
    this.broadcastStatus();
  }

  /**
   * Get own status
   */
  getStatus(): PresenceStatus {
    return this.state.self.status;
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  /**
   * Get all presence views
   */
  getViews(): PresenceView[] {
    return Array.from(this.state.views.values());
  }

  /**
   * Get view for a specific user
   */
  getView(pubKey: string): PresenceView | undefined {
    return this.state.views.get(pubKey);
  }

  /**
   * Get all online users
   */
  getOnlineUsers(): UserPresence[] {
    return Array.from(this.state.others.values()).filter(
      (u) => u.status === 'online' || u.status === 'away'
    );
  }

  /**
   * Get users within a distance category
   */
  getUsersNearby(
    maxCategory: ProximityInfo['category'] = 'same-area'
  ): PresenceView[] {
    const categories: ProximityInfo['category'][] = [
      'here',
      'nearby',
      'same-area',
      'same-city',
      'far',
    ];
    const maxIndex = categories.indexOf(maxCategory);

    return Array.from(this.state.views.values()).filter((v) => {
      if (!v.proximity) return false;
      const viewIndex = categories.indexOf(v.proximity.category);
      return viewIndex <= maxIndex;
    });
  }

  /**
   * Get current state
   */
  getState(): PresenceChannelState {
    return this.state;
  }

  /**
   * Get own presence
   */
  getSelf(): UserPresence {
    return this.state.self;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  /**
   * Subscribe to events
   */
  on(listener: PresenceEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: PresenceEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Error in presence event listener:', e);
      }
    }
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Detect device type
   */
  private detectDeviceType(): UserPresence['deviceType'] {
    if (typeof navigator === 'undefined') return 'unknown';

    const ua = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|ipod/.test(ua)) {
      if (/ipad|tablet/.test(ua)) return 'tablet';
      return 'mobile';
    }
    return 'desktop';
  }

  /**
   * Get speed category from speed in m/s
   */
  private getSpeedCategory(
    speed?: number
  ): LocationBroadcastPayload['speedCategory'] {
    if (speed === undefined || speed < 0.5) return 'stationary';
    if (speed < 2) return 'walking';
    if (speed < 8) return 'cycling';
    if (speed < 50) return 'driving';
    return 'flying';
  }

  /**
   * Generate color from public key
   */
  private generateUserColor(pubKey: string): string {
    let hash = 0;
    for (let i = 0; i < pubKey.length; i++) {
      hash = pubKey.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  /**
   * Haversine distance calculation
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a presence manager
 */
export function createPresenceManager(
  config: Partial<PresenceChannelConfig> &
    Pick<PresenceChannelConfig, 'channelId' | 'userPubKey' | 'userPrivKey' | 'displayName' | 'color'>
): PresenceManager {
  return new PresenceManager(config);
}
