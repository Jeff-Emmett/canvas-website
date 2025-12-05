/**
 * Presence Layer Component
 *
 * Renders location presence indicators on the canvas/map.
 * Shows other users with uncertainty circles based on trust-level precision.
 */

import React, { useMemo } from 'react';
import type { PresenceView } from './types';
import type { PresenceIndicatorData } from './useLocationPresence';
import { viewsToIndicators } from './useLocationPresence';
import { getRadiusForPrecision, TRUST_LEVEL_PRECISION } from './types';

// =============================================================================
// Types
// =============================================================================

export interface PresenceLayerProps {
  /** Presence views to render */
  views: PresenceView[];

  /** Map projection function (lat/lng to screen coordinates) */
  project: (lat: number, lng: number) => { x: number; y: number };

  /** Current zoom level (for scaling indicators) */
  zoom: number;

  /** Whether to show uncertainty circles */
  showUncertainty?: boolean;

  /** Whether to show direction arrows */
  showDirection?: boolean;

  /** Whether to show names */
  showNames?: boolean;

  /** Click handler for presence indicators */
  onIndicatorClick?: (indicator: PresenceIndicatorData) => void;

  /** Hover handler */
  onIndicatorHover?: (indicator: PresenceIndicatorData | null) => void;

  /** Custom render function for indicators */
  renderIndicator?: (indicator: PresenceIndicatorData, screenPos: { x: number; y: number }) => React.ReactNode;
}

// =============================================================================
// Component
// =============================================================================

export function PresenceLayer({
  views,
  project,
  zoom,
  showUncertainty = true,
  showDirection = true,
  showNames = true,
  onIndicatorClick,
  onIndicatorHover,
  renderIndicator,
}: PresenceLayerProps) {
  // Convert views to indicator data
  const indicators = useMemo(() => viewsToIndicators(views), [views]);

  // Calculate screen positions
  const positioned = useMemo(() => {
    return indicators.map((indicator) => ({
      indicator,
      screenPos: project(indicator.position.lat, indicator.position.lng),
    }));
  }, [indicators, project]);

  if (positioned.length === 0) {
    return null;
  }

  return (
    <div className="presence-layer" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {positioned.map(({ indicator, screenPos }) => {
        if (renderIndicator) {
          return (
            <div key={indicator.id} style={{ position: 'absolute', left: screenPos.x, top: screenPos.y, transform: 'translate(-50%, -50%)' }}>
              {renderIndicator(indicator, screenPos)}
            </div>
          );
        }

        return (
          <PresenceIndicator
            key={indicator.id}
            indicator={indicator}
            screenPos={screenPos}
            zoom={zoom}
            showUncertainty={showUncertainty}
            showDirection={showDirection}
            showName={showNames}
            onClick={onIndicatorClick}
            onHover={onIndicatorHover}
          />
        );
      })}
    </div>
  );
}

// =============================================================================
// Presence Indicator Component
// =============================================================================

interface PresenceIndicatorProps {
  indicator: PresenceIndicatorData;
  screenPos: { x: number; y: number };
  zoom: number;
  showUncertainty: boolean;
  showDirection: boolean;
  showName: boolean;
  onClick?: (indicator: PresenceIndicatorData) => void;
  onHover?: (indicator: PresenceIndicatorData | null) => void;
}

function PresenceIndicator({
  indicator,
  screenPos,
  zoom,
  showUncertainty,
  showDirection,
  showName,
  onClick,
  onHover,
}: PresenceIndicatorProps) {
  // Calculate uncertainty circle radius in pixels
  // This is approximate - would need proper map projection for accuracy
  const metersPerPixel = 156543.03392 * Math.cos((indicator.position.lat * Math.PI) / 180) / Math.pow(2, zoom);
  const uncertaintyPixels = indicator.uncertaintyRadius / metersPerPixel;

  // Clamp uncertainty circle size
  const clampedUncertainty = Math.min(Math.max(uncertaintyPixels, 20), 200);

  // Status-based opacity
  const opacity = indicator.status === 'online' ? 1 : indicator.status === 'away' ? 0.7 : 0.4;

  // Moving animation
  const isAnimated = indicator.isMoving;

  return (
    <div
      className="presence-indicator"
      style={{
        position: 'absolute',
        left: screenPos.x,
        top: screenPos.y,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'auto',
        cursor: onClick ? 'pointer' : 'default',
        opacity,
      }}
      onClick={() => onClick?.(indicator)}
      onMouseEnter={() => onHover?.(indicator)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Uncertainty circle */}
      {showUncertainty && (
        <div
          className="uncertainty-circle"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: clampedUncertainty * 2,
            height: clampedUncertainty * 2,
            borderRadius: '50%',
            backgroundColor: `${indicator.color}20`,
            border: `2px solid ${indicator.color}40`,
            animation: isAnimated ? 'pulse 2s ease-in-out infinite' : undefined,
          }}
        />
      )}

      {/* Direction arrow */}
      {showDirection && indicator.heading !== undefined && indicator.isMoving && (
        <div
          className="direction-arrow"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) rotate(${indicator.heading}deg)`,
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: `20px solid ${indicator.color}`,
            marginTop: -15,
          }}
        />
      )}

      {/* Center dot */}
      <div
        className="center-dot"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: indicator.color,
          border: '3px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}
      >
        {/* Verified badge */}
        {indicator.isVerified && (
          <div
            style={{
              position: 'absolute',
              right: -4,
              bottom: -4,
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              border: '1px solid white',
            }}
          />
        )}
      </div>

      {/* Name label */}
      {showName && (
        <div
          className="name-label"
          style={{
            position: 'absolute',
            left: '50%',
            top: '100%',
            transform: 'translateX(-50%)',
            marginTop: 8,
            padding: '2px 8px',
            backgroundColor: 'rgba(0,0,0,0.75)',
            color: 'white',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            maxWidth: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {indicator.displayName}
          <TrustBadge level={indicator.trustLevel} />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Trust Badge Component
// =============================================================================

interface TrustBadgeProps {
  level: PresenceIndicatorData['trustLevel'];
}

function TrustBadge({ level }: TrustBadgeProps) {
  const badges: Record<string, { icon: string; color: string }> = {
    intimate: { icon: '♥', color: '#ec4899' },
    close: { icon: '★', color: '#f59e0b' },
    friends: { icon: '●', color: '#22c55e' },
    network: { icon: '◐', color: '#3b82f6' },
    public: { icon: '○', color: '#6b7280' },
  };

  const badge = badges[level] ?? badges.public;

  return (
    <span
      style={{
        marginLeft: 4,
        color: badge.color,
        fontSize: 10,
      }}
    >
      {badge.icon}
    </span>
  );
}

// =============================================================================
// Presence List Component
// =============================================================================

export interface PresenceListProps {
  views: PresenceView[];
  onUserClick?: (view: PresenceView) => void;
  onTrustLevelChange?: (pubKey: string, level: PresenceView['trustLevel']) => void;
}

export function PresenceList({ views, onUserClick, onTrustLevelChange }: PresenceListProps) {
  const sortedViews = useMemo(() => {
    return [...views].sort((a, b) => {
      // Online first, then by proximity
      if (a.status !== b.status) {
        const statusOrder = { online: 0, away: 1, busy: 2, invisible: 3, offline: 4 };
        return statusOrder[a.status] - statusOrder[b.status];
      }
      if (a.proximity && b.proximity) {
        const distOrder = { here: 0, nearby: 1, 'same-area': 2, 'same-city': 3, far: 4 };
        return distOrder[a.proximity.category] - distOrder[b.proximity.category];
      }
      return 0;
    });
  }, [views]);

  if (sortedViews.length === 0) {
    return (
      <div style={{ padding: 16, color: '#6b7280', textAlign: 'center' }}>
        No other users nearby
      </div>
    );
  }

  return (
    <div className="presence-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sortedViews.map((view) => (
        <PresenceListItem
          key={view.user.pubKey}
          view={view}
          onClick={() => onUserClick?.(view)}
          onTrustLevelChange={onTrustLevelChange}
        />
      ))}
    </div>
  );
}

interface PresenceListItemProps {
  view: PresenceView;
  onClick?: () => void;
  onTrustLevelChange?: (pubKey: string, level: PresenceView['trustLevel']) => void;
}

function PresenceListItem({ view, onClick, onTrustLevelChange }: PresenceListItemProps) {
  const proximityLabels = {
    here: 'Right here',
    nearby: 'Nearby',
    'same-area': 'Same area',
    'same-city': 'Same city',
    far: 'Far away',
  };

  const statusColors = {
    online: '#22c55e',
    away: '#f59e0b',
    busy: '#ef4444',
    invisible: '#6b7280',
    offline: '#374151',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      {/* Avatar */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          backgroundColor: view.user.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 600,
          fontSize: 14,
          position: 'relative',
        }}
      >
        {view.user.displayName.charAt(0).toUpperCase()}
        {/* Status dot */}
        <div
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: statusColors[view.status],
            border: '2px solid #1f2937',
          }}
        />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {view.user.displayName}
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          {view.proximity ? proximityLabels[view.proximity.category] : 'Location unknown'}
          {view.location?.isMoving && ' • Moving'}
        </div>
      </div>

      {/* Trust level selector */}
      {onTrustLevelChange && (
        <select
          value={view.trustLevel}
          onChange={(e) => onTrustLevelChange(view.user.pubKey, e.target.value as PresenceView['trustLevel'])}
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid #374151',
            backgroundColor: '#1f2937',
            color: 'white',
            fontSize: 12,
          }}
        >
          <option value="public">Public</option>
          <option value="network">Network</option>
          <option value="friends">Friends</option>
          <option value="close">Close</option>
          <option value="intimate">Intimate</option>
        </select>
      )}
    </div>
  );
}

// =============================================================================
// CSS Keyframes (inject once)
// =============================================================================

const styleId = 'presence-layer-styles';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes pulse {
      0%, 100% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0.6;
      }
      50% {
        transform: translate(-50%, -50%) scale(1.1);
        opacity: 0.4;
      }
    }
  `;
  document.head.appendChild(style);
}
