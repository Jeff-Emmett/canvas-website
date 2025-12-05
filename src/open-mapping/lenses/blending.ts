/**
 * Lens Blending and Transitions
 *
 * Handles smooth transitions between lenses and blending multiple
 * lenses together for hybrid visualizations.
 */

import type {
  TransformedPoint,
  LensConfig,
  LensState,
  LensTransition,
  EasingFunction,
  DataPoint,
} from './types';
import { transformPoint } from './transforms';

// =============================================================================
// Easing Functions
// =============================================================================

/**
 * Easing function implementations
 */
export const EASING_FUNCTIONS: Record<EasingFunction, (t: number) => number> = {
  linear: (t) => t,

  'ease-in': (t) => t * t,

  'ease-out': (t) => t * (2 - t),

  'ease-in-out': (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  spring: (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },

  bounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;

    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
};

/**
 * Apply easing to a value
 */
export function applyEasing(t: number, easing: EasingFunction): number {
  const fn = EASING_FUNCTIONS[easing] ?? EASING_FUNCTIONS.linear;
  return fn(Math.max(0, Math.min(1, t)));
}

// =============================================================================
// Transition Management
// =============================================================================

/**
 * Create a new lens transition
 */
export function createTransition(
  from: LensConfig[],
  to: LensConfig[],
  duration: number = 500,
  easing: EasingFunction = 'ease-in-out'
): LensTransition {
  return {
    id: `transition-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    from: from.map((c) => ({ ...c })),
    to: to.map((c) => ({ ...c })),
    duration,
    startTime: Date.now(),
    easing,
    progress: 0,
  };
}

/**
 * Update transition progress
 */
export function updateTransition(transition: LensTransition): LensTransition {
  const elapsed = Date.now() - transition.startTime;
  const rawProgress = Math.min(1, elapsed / transition.duration);
  const progress = applyEasing(rawProgress, transition.easing);

  return {
    ...transition,
    progress,
  };
}

/**
 * Check if a transition is complete
 */
export function isTransitionComplete(transition: LensTransition): boolean {
  return Date.now() - transition.startTime >= transition.duration;
}

/**
 * Get interpolated lens configs during transition
 */
export function getTransitionConfigs(transition: LensTransition): LensConfig[] {
  const { from, to, progress } = transition;

  // Find matching lens types and interpolate
  const result: LensConfig[] = [];

  // Handle lenses in both from and to
  const fromTypes = new Set(from.map((c) => c.type));
  const toTypes = new Set(to.map((c) => c.type));

  // Lenses in both: interpolate weight
  for (const type of fromTypes) {
    if (toTypes.has(type)) {
      const fromLens = from.find((c) => c.type === type)!;
      const toLens = to.find((c) => c.type === type)!;

      result.push(interpolateLensConfig(fromLens, toLens, progress));
    } else {
      // Fading out
      const fromLens = from.find((c) => c.type === type)!;
      result.push({
        ...fromLens,
        weight: fromLens.weight * (1 - progress),
        active: progress < 0.5,
      });
    }
  }

  // Lenses only in to: fading in
  for (const type of toTypes) {
    if (!fromTypes.has(type)) {
      const toLens = to.find((c) => c.type === type)!;
      result.push({
        ...toLens,
        weight: toLens.weight * progress,
        active: progress > 0.5,
      });
    }
  }

  return result;
}

/**
 * Interpolate between two lens configs of the same type
 */
function interpolateLensConfig(
  from: LensConfig,
  to: LensConfig,
  t: number
): LensConfig {
  // Base interpolation
  const base = {
    ...from,
    weight: lerp(from.weight, to.weight, t),
    active: t > 0.5 ? to.active : from.active,
  };

  // Type-specific interpolation
  switch (from.type) {
    case 'geographic':
      if (to.type === 'geographic') {
        return {
          ...base,
          type: 'geographic',
          center: {
            lat: lerp(from.center.lat, to.center.lat, t),
            lng: lerp(from.center.lng, to.center.lng, t),
          },
          zoom: lerp(from.zoom, to.zoom, t),
          bearing: lerpAngle(from.bearing, to.bearing, t),
          pitch: lerp(from.pitch, to.pitch, t),
        };
      }
      break;

    case 'temporal':
      if (to.type === 'temporal') {
        return {
          ...base,
          type: 'temporal',
          timeRange: {
            start: lerp(from.timeRange.start, to.timeRange.start, t),
            end: lerp(from.timeRange.end, to.timeRange.end, t),
          },
          currentTime: lerp(from.currentTime, to.currentTime, t),
          timeScale: lerp(from.timeScale, to.timeScale, t),
          playing: t > 0.5 ? to.playing : from.playing,
          playbackSpeed: lerp(from.playbackSpeed, to.playbackSpeed, t),
          groupBy: t > 0.5 ? to.groupBy : from.groupBy,
        };
      }
      break;

    case 'attention':
      if (to.type === 'attention') {
        return {
          ...base,
          type: 'attention',
          decayRate: lerp(from.decayRate, to.decayRate, t),
          minAttention: lerp(from.minAttention, to.minAttention, t),
          colorGradient: {
            low: interpolateColor(from.colorGradient.low, to.colorGradient.low, t),
            medium: interpolateColor(from.colorGradient.medium, to.colorGradient.medium, t),
            high: interpolateColor(from.colorGradient.high, to.colorGradient.high, t),
          },
          showHeatmap: t > 0.5 ? to.showHeatmap : from.showHeatmap,
          heatmapRadius: lerp(from.heatmapRadius, to.heatmapRadius, t),
        };
      }
      break;
  }

  return base as LensConfig;
}

// =============================================================================
// Point Blending
// =============================================================================

/**
 * Blend multiple transformed points into one
 */
export function blendPoints(
  points: TransformedPoint[],
  weights: number[]
): TransformedPoint {
  if (points.length === 0) {
    return {
      id: '',
      x: 0,
      y: 0,
      size: 0,
      opacity: 0,
      visible: false,
    };
  }

  if (points.length === 1) {
    return points[0];
  }

  // Normalize weights
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const normalizedWeights = weights.map((w) => w / totalWeight);

  // Weighted average of all properties
  let x = 0,
    y = 0,
    z = 0,
    size = 0,
    opacity = 0;
  let visible = false;
  let color: string | undefined;
  let colorR = 0,
    colorG = 0,
    colorB = 0,
    colorWeight = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const w = normalizedWeights[i];

    x += p.x * w;
    y += p.y * w;
    z += (p.z ?? 0) * w;
    size += p.size * w;
    opacity += p.opacity * w;
    visible = visible || p.visible;

    if (p.color) {
      const c = parseInt(p.color.slice(1), 16);
      colorR += ((c >> 16) & 255) * w;
      colorG += ((c >> 8) & 255) * w;
      colorB += (c & 255) * w;
      colorWeight += w;
    }
  }

  if (colorWeight > 0) {
    const r = Math.round(colorR / colorWeight);
    const g = Math.round(colorG / colorWeight);
    const b = Math.round(colorB / colorWeight);
    color = `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  return {
    id: points[0].id,
    x,
    y,
    z: z !== 0 ? z : undefined,
    size,
    opacity,
    color,
    visible,
  };
}

/**
 * Transform a point through multiple lenses and blend
 */
export function transformAndBlend(
  point: DataPoint,
  lenses: LensConfig[],
  viewport: LensState['viewport']
): TransformedPoint {
  // Get active lenses with non-zero weights
  const activeLenses = lenses.filter((l) => l.active && l.weight > 0);

  if (activeLenses.length === 0) {
    return {
      id: point.id,
      x: 0,
      y: 0,
      size: 0,
      opacity: 0,
      visible: false,
    };
  }

  if (activeLenses.length === 1) {
    const transformed = transformPoint(point, activeLenses[0], viewport);
    return {
      ...transformed,
      opacity: transformed.opacity * activeLenses[0].weight,
    };
  }

  // Transform through each lens
  const transformedPoints: TransformedPoint[] = [];
  const weights: number[] = [];

  for (const lens of activeLenses) {
    const transformed = transformPoint(point, lens, viewport);
    transformedPoints.push(transformed);
    weights.push(lens.weight);
  }

  // Blend results
  return blendPoints(transformedPoints, weights);
}

// =============================================================================
// Interpolation Utilities
// =============================================================================

/**
 * Linear interpolation
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Angle interpolation (handles wraparound)
 */
function lerpAngle(a: number, b: number, t: number): number {
  // Normalize to -180 to 180
  let diff = ((b - a + 180) % 360) - 180;
  if (diff < -180) diff += 360;
  return a + diff * t;
}

/**
 * Color interpolation
 */
function interpolateColor(color1: string, color2: string, t: number): string {
  const c1 = parseInt(color1.slice(1), 16);
  const c2 = parseInt(color2.slice(1), 16);

  const r = Math.round(lerp((c1 >> 16) & 255, (c2 >> 16) & 255, t));
  const g = Math.round(lerp((c1 >> 8) & 255, (c2 >> 8) & 255, t));
  const b = Math.round(lerp(c1 & 255, c2 & 255, t));

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// =============================================================================
// Transition Presets
// =============================================================================

/**
 * Quick transition (for responsive feel)
 */
export const QUICK_TRANSITION: Pick<LensTransition, 'duration' | 'easing'> = {
  duration: 200,
  easing: 'ease-out',
};

/**
 * Smooth transition (for cinematic feel)
 */
export const SMOOTH_TRANSITION: Pick<LensTransition, 'duration' | 'easing'> = {
  duration: 500,
  easing: 'ease-in-out',
};

/**
 * Slow transition (for dramatic reveal)
 */
export const SLOW_TRANSITION: Pick<LensTransition, 'duration' | 'easing'> = {
  duration: 1000,
  easing: 'ease-in-out',
};

/**
 * Bouncy transition (for playful interactions)
 */
export const BOUNCY_TRANSITION: Pick<LensTransition, 'duration' | 'easing'> = {
  duration: 600,
  easing: 'bounce',
};

/**
 * Spring transition (for organic feel)
 */
export const SPRING_TRANSITION: Pick<LensTransition, 'duration' | 'easing'> = {
  duration: 800,
  easing: 'spring',
};
