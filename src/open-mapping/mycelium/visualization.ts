/**
 * Mycelium Network Visualization
 *
 * Helpers for visualizing the mycelial network on a canvas or map.
 * Provides colors, sizes, and styles based on node/signal state.
 */

import type {
  MyceliumNode,
  NodeType,
  Hypha,
  HyphaType,
  Signal,
  SignalType,
  Resonance,
  NodeVisualization,
  HyphaVisualization,
  SignalVisualization,
} from './types';

// =============================================================================
// Color Palettes
// =============================================================================

/**
 * Node type colors (nature-inspired)
 */
export const NODE_COLORS: Record<NodeType, string> = {
  poi: '#4ade80', // Green - points of interest
  event: '#f59e0b', // Amber - temporal events
  person: '#3b82f6', // Blue - people
  resource: '#8b5cf6', // Purple - resources
  discovery: '#ec4899', // Pink - discoveries
  waypoint: '#06b6d4', // Cyan - waypoints
  cluster: '#f97316', // Orange - clusters
  ghost: '#6b7280', // Gray - fading nodes
};

/**
 * Signal type colors (energy/urgency inspired)
 */
export const SIGNAL_COLORS: Record<SignalType, string> = {
  urgency: '#ef4444', // Red - urgent
  discovery: '#10b981', // Emerald - new finding
  attention: '#f59e0b', // Amber - focus
  trust: '#3b82f6', // Blue - trust
  novelty: '#ec4899', // Pink - novel
  activity: '#84cc16', // Lime - activity
  request: '#a855f7', // Purple - request
  presence: '#06b6d4', // Cyan - presence
  custom: '#6b7280', // Gray - custom
};

/**
 * Hypha type colors
 */
export const HYPHA_COLORS: Record<HyphaType, string> = {
  route: '#22c55e', // Green - routes
  attention: '#f59e0b', // Amber - attention
  reference: '#8b5cf6', // Purple - references
  temporal: '#06b6d4', // Cyan - temporal
  social: '#3b82f6', // Blue - social
  causal: '#f97316', // Orange - causal
  proximity: '#84cc16', // Lime - proximity
  semantic: '#ec4899', // Pink - semantic
};

// =============================================================================
// Node Visualization
// =============================================================================

/**
 * Get visualization properties for a node
 */
export function getNodeVisualization(node: MyceliumNode): NodeVisualization {
  const baseColor = NODE_COLORS[node.type] || NODE_COLORS.poi;

  // Size based on signal strength (8-32px)
  const totalSignal = node.signalStrength + node.receivedSignal;
  const size = 8 + Math.min(24, totalSignal * 24);

  // Opacity based on age (fade over time)
  const age = Date.now() - node.lastActiveAt;
  const ageFactor = Math.exp(-age / 3600000); // 1 hour half-life
  const opacity = 0.3 + 0.7 * ageFactor;

  // Pulse if recently active
  const pulse = age < 5000;

  // Glow if high signal
  const glow = totalSignal > 0.5;

  // Icon based on type
  const icons: Partial<Record<NodeType, string>> = {
    poi: '📍',
    event: '📅',
    person: '👤',
    resource: '📦',
    discovery: '💡',
    waypoint: '🔵',
    cluster: '🔷',
    ghost: '👻',
  };

  return {
    color: baseColor,
    size,
    opacity,
    pulse,
    glow,
    icon: icons[node.type],
  };
}

/**
 * Get CSS style object for a node
 */
export function getNodeStyle(node: MyceliumNode): React.CSSProperties {
  const viz = getNodeVisualization(node);

  return {
    width: viz.size,
    height: viz.size,
    backgroundColor: viz.color,
    opacity: viz.opacity,
    borderRadius: '50%',
    boxShadow: viz.glow
      ? `0 0 ${viz.size / 2}px ${viz.color}80`
      : undefined,
    animation: viz.pulse ? 'pulse 1s ease-in-out infinite' : undefined,
    position: 'absolute' as const,
    transform: 'translate(-50%, -50%)',
  };
}

// =============================================================================
// Hypha Visualization
// =============================================================================

/**
 * Get visualization properties for a hypha
 */
export function getHyphaVisualization(hypha: Hypha): HyphaVisualization {
  const baseColor = HYPHA_COLORS[hypha.type] || HYPHA_COLORS.proximity;

  // Stroke width based on strength (1-6px)
  const strokeWidth = 1 + hypha.strength * 5;

  // Opacity based on conductance
  const opacity = 0.2 + hypha.conductance * 0.8;

  // Animate if recently used
  const recentlyUsed = hypha.lastSignalAt
    ? Date.now() - hypha.lastSignalAt < 5000
    : false;

  // Dash pattern for different types
  const dashPatterns: Partial<Record<HyphaType, number[]>> = {
    temporal: [5, 5],
    reference: [2, 2],
    semantic: [10, 5],
  };

  return {
    color: baseColor,
    strokeWidth,
    opacity,
    flowAnimation: recentlyUsed,
    dashPattern: dashPatterns[hypha.type],
  };
}

/**
 * Get SVG path attributes for a hypha
 */
export function getHyphaPathAttrs(
  hypha: Hypha
): Record<string, string | number | undefined> {
  const viz = getHyphaVisualization(hypha);

  return {
    stroke: viz.color,
    strokeWidth: viz.strokeWidth,
    strokeOpacity: viz.opacity,
    strokeDasharray: viz.dashPattern?.join(' '),
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
}

// =============================================================================
// Signal Visualization
// =============================================================================

/**
 * Get visualization properties for a signal
 */
export function getSignalVisualization(signal: Signal): SignalVisualization {
  const baseColor = SIGNAL_COLORS[signal.type] || SIGNAL_COLORS.activity;

  // Particle size based on strength (4-16px)
  const particleSize = 4 + signal.currentStrength * 12;

  // Speed based on urgency
  const speedMultipliers: Partial<Record<SignalType, number>> = {
    urgency: 2,
    discovery: 1.5,
    attention: 1.2,
    activity: 1,
  };
  const speed = (speedMultipliers[signal.type] ?? 1) * 100; // px per second

  return {
    color: baseColor,
    particleSize,
    speed,
    trail: signal.currentStrength > 0.3,
  };
}

/**
 * Get CSS style for a signal particle
 */
export function getSignalParticleStyle(signal: Signal): React.CSSProperties {
  const viz = getSignalVisualization(signal);

  return {
    width: viz.particleSize,
    height: viz.particleSize,
    backgroundColor: viz.color,
    borderRadius: '50%',
    boxShadow: `0 0 ${viz.particleSize}px ${viz.color}`,
    position: 'absolute' as const,
  };
}

// =============================================================================
// Resonance Visualization
// =============================================================================

/**
 * Get visualization properties for a resonance
 */
export function getResonanceVisualization(resonance: Resonance): {
  color: string;
  radius: number;
  opacity: number;
  pulse: boolean;
  label: string;
} {
  // Color based on whether serendipitous
  const color = resonance.isSerendipitous
    ? '#ec4899' // Pink for serendipity
    : '#3b82f6'; // Blue for connected

  // Radius from resonance radius (in meters, convert for display)
  const radius = resonance.radius;

  // Opacity based on strength
  const opacity = 0.1 + resonance.strength * 0.3;

  // Age for pulsing
  const age = Date.now() - resonance.updatedAt;
  const pulse = age < 10000;

  // Label
  const label = resonance.isSerendipitous
    ? `${resonance.participants.length} converging`
    : `${resonance.participants.length} together`;

  return {
    color,
    radius,
    opacity,
    pulse,
    label,
  };
}

// =============================================================================
// Gradient and Heat Map Helpers
// =============================================================================

/**
 * Interpolate between two colors
 */
export function interpolateColor(
  color1: string,
  color2: string,
  factor: number
): string {
  // Parse hex colors
  const c1 = parseInt(color1.slice(1), 16);
  const c2 = parseInt(color2.slice(1), 16);

  const r1 = (c1 >> 16) & 255;
  const g1 = (c1 >> 8) & 255;
  const b1 = c1 & 255;

  const r2 = (c2 >> 16) & 255;
  const g2 = (c2 >> 8) & 255;
  const b2 = c2 & 255;

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Get heat map color for a value (0-1)
 */
export function getHeatMapColor(value: number): string {
  // Gradient: blue -> cyan -> green -> yellow -> red
  const colors = ['#3b82f6', '#06b6d4', '#22c55e', '#eab308', '#ef4444'];
  const segments = colors.length - 1;
  const segment = Math.min(segments - 1, Math.floor(value * segments));
  const localFactor = (value * segments) % 1;

  return interpolateColor(colors[segment], colors[segment + 1], localFactor);
}

/**
 * Get strength color (cold to hot)
 */
export function getStrengthColor(strength: number): string {
  // Blue (cold) to Red (hot)
  return interpolateColor('#3b82f6', '#ef4444', Math.min(1, strength));
}

// =============================================================================
// Canvas Rendering Helpers
// =============================================================================

/**
 * Draw a node on a canvas context
 */
export function drawNode(
  ctx: CanvasRenderingContext2D,
  node: MyceliumNode,
  x: number,
  y: number
): void {
  const viz = getNodeVisualization(node);

  ctx.save();
  ctx.globalAlpha = viz.opacity;

  // Glow effect
  if (viz.glow) {
    ctx.shadowColor = viz.color;
    ctx.shadowBlur = viz.size / 2;
  }

  // Draw circle
  ctx.fillStyle = viz.color;
  ctx.beginPath();
  ctx.arc(x, y, viz.size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a hypha on a canvas context
 */
export function drawHypha(
  ctx: CanvasRenderingContext2D,
  hypha: Hypha,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  const viz = getHyphaVisualization(hypha);

  ctx.save();
  ctx.globalAlpha = viz.opacity;
  ctx.strokeStyle = viz.color;
  ctx.lineWidth = viz.strokeWidth;
  ctx.lineCap = 'round';

  if (viz.dashPattern) {
    ctx.setLineDash(viz.dashPattern);
  }

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Draw arrow for directed hyphae
  if (hypha.directed) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowSize = viz.strokeWidth * 3;

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - arrowSize * Math.cos(angle - Math.PI / 6),
      y2 - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - arrowSize * Math.cos(angle + Math.PI / 6),
      y2 - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw a resonance circle on a canvas context
 */
export function drawResonance(
  ctx: CanvasRenderingContext2D,
  resonance: Resonance,
  centerX: number,
  centerY: number,
  radiusPx: number
): void {
  const viz = getResonanceVisualization(resonance);

  ctx.save();
  ctx.globalAlpha = viz.opacity;

  // Fill
  ctx.fillStyle = viz.color;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radiusPx, 0, Math.PI * 2);
  ctx.fill();

  // Border
  ctx.globalAlpha = viz.opacity * 2;
  ctx.strokeStyle = viz.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

// =============================================================================
// Animation Helpers
// =============================================================================

/**
 * Calculate position along a path for animated signals
 */
export function getSignalPosition(
  signal: Signal,
  pathPoints: Array<{ x: number; y: number }>,
  animationTime: number
): { x: number; y: number } | null {
  if (pathPoints.length < 2) return null;

  const viz = getSignalVisualization(signal);
  const elapsed = animationTime - signal.emittedAt;
  const totalLength = calculatePathLength(pathPoints);
  const distance = (elapsed / 1000) * viz.speed;

  if (distance >= totalLength) return null;

  // Find segment
  let accumulated = 0;
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const segmentLength = calculateDistance(pathPoints[i], pathPoints[i + 1]);
    if (accumulated + segmentLength >= distance) {
      const segmentProgress = (distance - accumulated) / segmentLength;
      return {
        x: pathPoints[i].x + (pathPoints[i + 1].x - pathPoints[i].x) * segmentProgress,
        y: pathPoints[i].y + (pathPoints[i + 1].y - pathPoints[i].y) * segmentProgress,
      };
    }
    accumulated += segmentLength;
  }

  return pathPoints[pathPoints.length - 1];
}

function calculatePathLength(points: Array<{ x: number; y: number }>): number {
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    length += calculateDistance(points[i], points[i + 1]);
  }
  return length;
}

function calculateDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// =============================================================================
// CSS Keyframes (for React/CSS animations)
// =============================================================================

/**
 * CSS keyframes for pulse animation
 */
export const PULSE_KEYFRAMES = `
@keyframes pulse {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.7; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}
`;

/**
 * CSS keyframes for flow animation on hyphae
 */
export const FLOW_KEYFRAMES = `
@keyframes flow {
  0% { stroke-dashoffset: 20; }
  100% { stroke-dashoffset: 0; }
}
`;

/**
 * CSS keyframes for resonance ripple
 */
export const RIPPLE_KEYFRAMES = `
@keyframes ripple {
  0% { transform: scale(0.8); opacity: 0.8; }
  100% { transform: scale(1.2); opacity: 0; }
}
`;
