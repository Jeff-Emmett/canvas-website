/**
 * CollaborativeMap - Complete example of map with location presence
 *
 * This component demonstrates how to integrate the MapCanvas with
 * real-time location presence. Location sharing is OPT-IN - users
 * must explicitly click to share their location.
 *
 * Usage in your app:
 * ```tsx
 * import { CollaborativeMap } from '@/open-mapping/components/CollaborativeMap';
 *
 * function MyPage() {
 *   return (
 *     <CollaborativeMap
 *       roomId="my-room-123"
 *       user={{
 *         pubKey: userPublicKey,
 *         privKey: userPrivateKey,
 *         displayName: 'Alice',
 *         color: '#3b82f6',
 *       }}
 *       broadcastFn={(data) => myAutomergeAdapter.broadcast(data)}
 *       onBroadcastReceived={(handler) => {
 *         return myAutomergeAdapter.onMessage((msg) => {
 *           if (msg.type === 'location-presence') handler(msg.payload);
 *         });
 *       }}
 *     />
 *   );
 * }
 * ```
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MapCanvas } from './MapCanvas';
import { PresenceList } from '../presence/PresenceLayer';
import { useLocationPresence } from '../presence/useLocationPresence';
import type { PresenceView, PresenceBroadcast } from '../presence/types';
import type { MapViewport, Coordinate } from '../types';

// =============================================================================
// Types
// =============================================================================

export interface CollaborativeMapProps {
  /** Room/channel ID for presence */
  roomId: string;

  /** User identity */
  user: {
    pubKey: string;
    privKey: string;
    displayName: string;
    color: string;
  };

  /** Function to broadcast data to other clients */
  broadcastFn: (data: any) => void;

  /** Subscribe to incoming broadcasts - returns unsubscribe function */
  onBroadcastReceived: (handler: (broadcast: PresenceBroadcast) => void) => () => void;

  /** Initial map viewport */
  initialViewport?: MapViewport;

  /** Show the presence sidebar */
  showPresenceList?: boolean;

  /** Custom map style */
  mapStyle?: string;

  /** Callback when map is clicked */
  onMapClick?: (coordinate: Coordinate) => void;

  /** Callback when a user's presence is clicked */
  onUserClick?: (view: PresenceView) => void;

  /** Custom class name */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function CollaborativeMap({
  roomId,
  user,
  broadcastFn,
  onBroadcastReceived,
  initialViewport = { center: [-122.4194, 37.7749], zoom: 12 }, // SF default
  showPresenceList = true,
  mapStyle,
  onMapClick,
  onUserClick,
  className,
}: CollaborativeMapProps) {
  const [viewport, setViewport] = useState<MapViewport>(initialViewport);

  // Initialize presence system (location is OFF by default)
  const presence = useLocationPresence({
    channelId: roomId,
    user,
    broadcastFn,
    // autoStartLocation: false (default - OPT-IN required)
  });

  // Handle incoming broadcasts
  useEffect(() => {
    const unsubscribe = onBroadcastReceived((broadcast) => {
      presence.handleBroadcast(broadcast);
    });
    return unsubscribe;
  }, [onBroadcastReceived, presence.handleBroadcast]);

  // Handle presence click - fly to their location
  const handlePresenceClick = useCallback((view: PresenceView) => {
    if (view.location) {
      setViewport({
        ...viewport,
        center: [view.location.center.longitude, view.location.center.latitude],
        zoom: Math.max(viewport.zoom, 14),
      });
    }
    onUserClick?.(view);
  }, [viewport, onUserClick]);

  return (
    <div
      className={`collaborative-map ${className ?? ''}`}
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {/* Main Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapCanvas
          viewport={viewport}
          onViewportChange={setViewport}
          onMapClick={onMapClick}
          style={mapStyle}
          presenceViews={presence.views}
          showPresenceUncertainty={true}
          onPresenceClick={handlePresenceClick}
        />

        {/* Location sharing controls - bottom left */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 10,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <LocationSharingToggle
            isSharing={presence.isSharing}
            onStart={presence.startSharing}
            onStop={presence.stopSharing}
          />
        </div>

        {/* Online count badge - top left */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 1000,
            padding: '4px 12px',
            backgroundColor: 'rgba(0,0,0,0.75)',
            borderRadius: 16,
            color: 'white',
            fontSize: 14,
          }}
        >
          {presence.onlineCount + 1} online
        </div>
      </div>

      {/* Presence sidebar */}
      {showPresenceList && (
        <div
          style={{
            width: 280,
            backgroundColor: '#1f2937',
            borderLeft: '1px solid #374151',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: 16,
              borderBottom: '1px solid #374151',
              fontWeight: 600,
              color: 'white',
            }}
          >
            People ({presence.views.length})
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {/* Self */}
            <div
              style={{
                padding: '8px 12px',
                marginBottom: 8,
                borderRadius: 8,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: user.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 600,
                  }}
                >
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ color: 'white', fontWeight: 500 }}>{user.displayName} (you)</div>
                  <div style={{ color: '#9ca3af', fontSize: 12 }}>
                    {presence.isSharing ? 'Sharing location' : 'Location hidden'}
                  </div>
                </div>
              </div>
            </div>

            {/* Others */}
            <PresenceList
              views={presence.views}
              onUserClick={handlePresenceClick}
              onTrustLevelChange={presence.setTrustLevel}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Location Sharing Toggle Button
// =============================================================================

interface LocationSharingToggleProps {
  isSharing: boolean;
  onStart: () => void;
  onStop: () => void;
}

function LocationSharingToggle({ isSharing, onStart, onStop }: LocationSharingToggleProps) {
  return (
    <button
      onClick={isSharing ? onStop : onStart}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        borderRadius: 8,
        border: 'none',
        backgroundColor: isSharing ? '#ef4444' : '#22c55e',
        color: 'white',
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'all 0.2s',
      }}
    >
      <LocationIcon />
      {isSharing ? 'Stop Sharing' : 'Share Location'}
    </button>
  );
}

function LocationIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
    </svg>
  );
}

export default CollaborativeMap;
