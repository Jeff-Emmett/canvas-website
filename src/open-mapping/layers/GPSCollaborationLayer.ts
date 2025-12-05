/**
 * GPS Collaboration Layer
 *
 * A reusable module for adding real-time GPS/location sharing to any MapLibre map.
 * Uses GeoJSON format for data interchange and can sync via any CRDT system.
 *
 * Usage:
 *   const gpsLayer = new GPSCollaborationLayer(map);
 *   gpsLayer.startSharing({ userId: 'user1', userName: 'Alice', color: '#3b82f6' });
 *   gpsLayer.updatePeer({ userId: 'user2', ... }); // From CRDT sync
 */

import maplibregl from 'maplibre-gl';

// =============================================================================
// Types
// =============================================================================

export interface GPSUser {
  userId: string;
  userName: string;
  color: string;
  coordinate: { lat: number; lng: number };
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface GPSLayerOptions {
  /** Stale timeout in ms (default: 5 minutes) */
  staleTimeout?: number;
  /** Update interval for broadcasting location (default: 5000ms) */
  updateInterval?: number;
  /** Privacy mode - reduces coordinate precision */
  privacyMode?: 'precise' | 'neighborhood' | 'city';
  /** Callback when user location updates */
  onLocationUpdate?: (user: GPSUser) => void;
  /** Custom marker style */
  markerStyle?: Partial<MarkerStyle>;
}

interface MarkerStyle {
  size: number;
  borderWidth: number;
  showAccuracy: boolean;
  showHeading: boolean;
  pulseAnimation: boolean;
}

const DEFAULT_OPTIONS: Required<GPSLayerOptions> = {
  staleTimeout: 5 * 60 * 1000,
  updateInterval: 5000,
  privacyMode: 'precise',
  onLocationUpdate: () => {},
  markerStyle: {
    size: 36,
    borderWidth: 3,
    showAccuracy: true,
    showHeading: true,
    pulseAnimation: true,
  },
};

// Person emojis for variety
const PERSON_EMOJIS = ['🧑', '👤', '🚶', '🧍', '👨', '👩', '🧔', '👱'];

// =============================================================================
// GPS Collaboration Layer
// =============================================================================

export class GPSCollaborationLayer {
  private map: maplibregl.Map;
  private options: Required<GPSLayerOptions>;
  private markers: Map<string, maplibregl.Marker> = new Map();
  private accuracyCircles: Map<string, string> = new Map(); // layerId
  private watchId: number | null = null;
  private currentUser: GPSUser | null = null;
  private peers: Map<string, GPSUser> = new Map();
  private updateTimer: number | null = null;
  private isSharing = false;

  constructor(map: maplibregl.Map, options: GPSLayerOptions = {}) {
    this.map = map;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.injectStyles();
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Start sharing your location
   */
  startSharing(user: Pick<GPSUser, 'userId' | 'userName' | 'color'>): Promise<GPSUser> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      this.isSharing = true;

      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const coordinate = this.applyPrivacy({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });

          this.currentUser = {
            ...user,
            coordinate,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading ?? undefined,
            speed: position.coords.speed ?? undefined,
            timestamp: Date.now(),
          };

          this.renderUserMarker(this.currentUser, true);
          this.options.onLocationUpdate(this.currentUser);
          resolve(this.currentUser);
        },
        (error) => {
          this.isSharing = false;
          reject(new Error(this.getGeolocationErrorMessage(error)));
        },
        {
          enableHighAccuracy: this.options.privacyMode === 'precise',
          timeout: 10000,
          maximumAge: this.options.privacyMode === 'precise' ? 0 : 30000,
        }
      );
    });
  }

  /**
   * Stop sharing your location
   */
  stopSharing(): void {
    this.isSharing = false;

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.currentUser) {
      this.removeMarker(this.currentUser.userId);
      this.currentUser = null;
    }
  }

  /**
   * Update a peer's location (call this from your sync system)
   */
  updatePeer(user: GPSUser): void {
    // Ignore stale updates
    if (Date.now() - user.timestamp > this.options.staleTimeout) {
      this.removePeer(user.userId);
      return;
    }

    this.peers.set(user.userId, user);
    this.renderUserMarker(user, false);
  }

  /**
   * Remove a peer (when they disconnect or stop sharing)
   */
  removePeer(userId: string): void {
    this.peers.delete(userId);
    this.removeMarker(userId);
  }

  /**
   * Get all active users as GeoJSON FeatureCollection
   */
  toGeoJSON(): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];

    // Add current user
    if (this.currentUser) {
      features.push(this.userToFeature(this.currentUser, true));
    }

    // Add peers
    this.peers.forEach((user) => {
      if (Date.now() - user.timestamp < this.options.staleTimeout) {
        features.push(this.userToFeature(user, false));
      }
    });

    return { type: 'FeatureCollection', features };
  }

  /**
   * Load users from GeoJSON (e.g., from CRDT sync)
   */
  fromGeoJSON(geojson: GeoJSON.FeatureCollection): void {
    geojson.features.forEach((feature) => {
      if (feature.geometry.type !== 'Point') return;

      const props = feature.properties as any;
      if (props.userId === this.currentUser?.userId) return; // Skip self

      const user: GPSUser = {
        userId: props.userId,
        userName: props.userName,
        color: props.color,
        coordinate: {
          lng: (feature.geometry as GeoJSON.Point).coordinates[0],
          lat: (feature.geometry as GeoJSON.Point).coordinates[1],
        },
        accuracy: props.accuracy,
        heading: props.heading,
        speed: props.speed,
        timestamp: props.timestamp,
      };

      this.updatePeer(user);
    });
  }

  /**
   * Get current sharing state
   */
  getState(): { isSharing: boolean; currentUser: GPSUser | null; peerCount: number } {
    return {
      isSharing: this.isSharing,
      currentUser: this.currentUser,
      peerCount: this.peers.size,
    };
  }

  /**
   * Fly to a specific user
   */
  flyToUser(userId: string): void {
    const user = userId === this.currentUser?.userId ? this.currentUser : this.peers.get(userId);
    if (user) {
      this.map.flyTo({
        center: [user.coordinate.lng, user.coordinate.lat],
        zoom: 15,
        duration: 1000,
      });
    }
  }

  /**
   * Fit map to show all users
   */
  fitToAllUsers(): void {
    const bounds = new maplibregl.LngLatBounds();
    let hasPoints = false;

    if (this.currentUser) {
      bounds.extend([this.currentUser.coordinate.lng, this.currentUser.coordinate.lat]);
      hasPoints = true;
    }

    this.peers.forEach((user) => {
      bounds.extend([user.coordinate.lng, user.coordinate.lat]);
      hasPoints = true;
    });

    if (hasPoints) {
      this.map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }
  }

  /**
   * Cleanup - call when done with the layer
   */
  destroy(): void {
    this.stopSharing();
    this.markers.forEach((marker) => marker.remove());
    this.markers.clear();
    this.accuracyCircles.forEach((layerId) => {
      if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
      if (this.map.getSource(layerId)) this.map.removeSource(layerId);
    });
    this.accuracyCircles.clear();
    this.peers.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private renderUserMarker(user: GPSUser, isCurrentUser: boolean): void {
    const markerId = user.userId;
    let marker = this.markers.get(markerId);

    if (!marker) {
      const el = this.createMarkerElement(user, isCurrentUser);
      marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([user.coordinate.lng, user.coordinate.lat])
        .addTo(this.map);
      this.markers.set(markerId, marker);
    } else {
      marker.setLngLat([user.coordinate.lng, user.coordinate.lat]);
      this.updateMarkerElement(marker.getElement(), user, isCurrentUser);
    }

    // Update accuracy circle if enabled
    if (this.options.markerStyle.showAccuracy && user.accuracy) {
      this.updateAccuracyCircle(user);
    }
  }

  private createMarkerElement(user: GPSUser, isCurrentUser: boolean): HTMLDivElement {
    const el = document.createElement('div');
    el.className = `gps-marker ${isCurrentUser ? 'gps-marker-self' : 'gps-marker-peer'}`;

    const { size, borderWidth } = this.options.markerStyle;
    const emoji = this.getPersonEmoji(user.userId);

    el.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background: ${isCurrentUser ? `linear-gradient(135deg, ${user.color}, ${this.darkenColor(user.color)})` : user.color};
      border: ${borderWidth}px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${size * 0.5}px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      cursor: pointer;
      position: relative;
      ${this.options.markerStyle.pulseAnimation ? 'animation: gps-pulse 2s ease-in-out infinite;' : ''}
    `;

    el.textContent = isCurrentUser ? '📍' : emoji;
    el.title = `${user.userName}${isCurrentUser ? ' (you)' : ''}`;

    return el;
  }

  private updateMarkerElement(el: HTMLElement, user: GPSUser, isCurrentUser: boolean): void {
    el.title = `${user.userName}${isCurrentUser ? ' (you)' : ''}`;
  }

  private updateAccuracyCircle(user: GPSUser): void {
    if (!user.accuracy || user.accuracy > 500) return; // Don't show if too inaccurate

    const sourceId = `accuracy-${user.userId}`;
    const layerId = `accuracy-layer-${user.userId}`;

    const center = [user.coordinate.lng, user.coordinate.lat];
    const radiusInKm = user.accuracy / 1000;
    const circleGeoJSON = this.createCircleGeoJSON(center as [number, number], radiusInKm);

    if (this.map.getSource(sourceId)) {
      (this.map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(circleGeoJSON);
    } else {
      this.map.addSource(sourceId, { type: 'geojson', data: circleGeoJSON });
      this.map.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': user.color,
          'fill-opacity': 0.15,
        },
      });
      this.accuracyCircles.set(user.userId, layerId);
    }
  }

  private createCircleGeoJSON(center: [number, number], radiusKm: number): GeoJSON.Feature {
    const points = 64;
    const coords: [number, number][] = [];

    for (let i = 0; i < points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const dx = radiusKm * Math.cos(angle);
      const dy = radiusKm * Math.sin(angle);
      const lat = center[1] + (dy / 111.32);
      const lng = center[0] + (dx / (111.32 * Math.cos(center[1] * Math.PI / 180)));
      coords.push([lng, lat]);
    }
    coords.push(coords[0]); // Close the polygon

    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [coords] },
    };
  }

  private removeMarker(userId: string): void {
    const marker = this.markers.get(userId);
    if (marker) {
      marker.remove();
      this.markers.delete(userId);
    }

    const layerId = this.accuracyCircles.get(userId);
    if (layerId) {
      if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
      const sourceId = `accuracy-${userId}`;
      if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
      this.accuracyCircles.delete(userId);
    }
  }

  private userToFeature(user: GPSUser, isCurrentUser: boolean): GeoJSON.Feature {
    return {
      type: 'Feature',
      properties: {
        userId: user.userId,
        userName: user.userName,
        color: user.color,
        accuracy: user.accuracy,
        heading: user.heading,
        speed: user.speed,
        timestamp: user.timestamp,
        isCurrentUser,
      },
      geometry: {
        type: 'Point',
        coordinates: [user.coordinate.lng, user.coordinate.lat],
      },
    };
  }

  private applyPrivacy(coord: { lat: number; lng: number }): { lat: number; lng: number } {
    switch (this.options.privacyMode) {
      case 'city':
        return {
          lat: Math.round(coord.lat * 10) / 10,
          lng: Math.round(coord.lng * 10) / 10,
        };
      case 'neighborhood':
        return {
          lat: Math.round(coord.lat * 100) / 100,
          lng: Math.round(coord.lng * 100) / 100,
        };
      default:
        return coord;
    }
  }

  private getPersonEmoji(userId: string): string {
    const hash = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return PERSON_EMOJIS[Math.abs(hash) % PERSON_EMOJIS.length];
  }

  private darkenColor(hex: string): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - 40);
    const g = Math.max(0, ((num >> 8) & 0x00FF) - 40);
    const b = Math.max(0, (num & 0x0000FF) - 40);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }

  private getGeolocationErrorMessage(error: GeolocationPositionError): string {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location permission denied';
      case error.POSITION_UNAVAILABLE:
        return 'Location unavailable';
      case error.TIMEOUT:
        return 'Location request timeout';
      default:
        return 'Unknown location error';
    }
  }

  private injectStyles(): void {
    if (document.getElementById('gps-collaboration-styles')) return;

    const style = document.createElement('style');
    style.id = 'gps-collaboration-styles';
    style.textContent = `
      @keyframes gps-pulse {
        0%, 100% { transform: scale(1); box-shadow: 0 2px 10px rgba(0,0,0,0.4); }
        50% { transform: scale(1.05); box-shadow: 0 3px 15px rgba(0,0,0,0.5); }
      }
      .gps-marker:hover {
        transform: scale(1.1) !important;
        z-index: 1000;
      }
    `;
    document.head.appendChild(style);
  }
}

export default GPSCollaborationLayer;
