/**
 * Lens Manager
 *
 * Central coordinator for the lens system. Manages lens states,
 * transitions, and point transformations.
 */

import type {
  LensConfig,
  LensState,
  LensTransition,
  LensType,
  DataPoint,
  TransformedPoint,
  LensEvent,
  LensEventListener,
  TemporalPortal,
  EasingFunction,
} from './types';
import { DEFAULT_LENSES } from './types';
import {
  createTransition,
  updateTransition,
  isTransitionComplete,
  getTransitionConfigs,
  transformAndBlend,
  SMOOTH_TRANSITION,
} from './blending';

// =============================================================================
// Lens Manager
// =============================================================================

/**
 * Configuration for the lens manager
 */
export interface LensManagerConfig {
  /** Initial lenses */
  initialLenses: LensConfig[];

  /** Viewport dimensions */
  viewport: {
    width: number;
    height: number;
  };

  /** Default transition settings */
  defaultTransition: {
    duration: number;
    easing: EasingFunction;
  };

  /** Temporal lens playback settings */
  temporalPlayback: {
    /** Update interval during playback (ms) */
    updateInterval: number;
  };
}

/**
 * Default configuration
 */
export const DEFAULT_LENS_MANAGER_CONFIG: LensManagerConfig = {
  initialLenses: DEFAULT_LENSES,
  viewport: { width: 1000, height: 800 },
  defaultTransition: SMOOTH_TRANSITION,
  temporalPlayback: { updateInterval: 50 },
};

/**
 * The Lens Manager
 */
export class LensManager {
  private config: LensManagerConfig;
  private state: LensState;
  private listeners: Set<LensEventListener> = new Set();
  private dataPoints: Map<string, DataPoint> = new Map();
  private temporalPortals: Map<string, TemporalPortal> = new Map();
  private playbackTimer?: ReturnType<typeof setInterval>;
  private transitionFrame?: number;

  constructor(config: Partial<LensManagerConfig> = {}) {
    this.config = { ...DEFAULT_LENS_MANAGER_CONFIG, ...config };

    // Initialize state
    this.state = {
      activeLenses: this.config.initialLenses.filter((l) => l.active),
      viewport: {
        width: this.config.viewport.width,
        height: this.config.viewport.height,
        centerX: this.config.viewport.width / 2,
        centerY: this.config.viewport.height / 2,
        scale: 1,
      },
      transformedPoints: new Map(),
      lastUpdate: Date.now(),
    };
  }

  // ===========================================================================
  // Lens Management
  // ===========================================================================

  /**
   * Get all lenses
   */
  getAllLenses(): LensConfig[] {
    return [...this.config.initialLenses];
  }

  /**
   * Get active lenses
   */
  getActiveLenses(): LensConfig[] {
    return [...this.state.activeLenses];
  }

  /**
   * Get a lens by type
   */
  getLens(type: LensType): LensConfig | undefined {
    return this.config.initialLenses.find((l) => l.type === type);
  }

  /**
   * Activate a lens
   */
  activateLens(
    type: LensType,
    options: {
      exclusive?: boolean;
      transition?: Partial<LensTransition>;
    } = {}
  ): void {
    const lens = this.getLens(type);
    if (!lens) return;

    const { exclusive = false, transition } = options;

    // Determine target state
    let targetLenses: LensConfig[];

    if (exclusive) {
      // Only this lens active
      targetLenses = [{ ...lens, active: true, weight: 1 }];
    } else {
      // Add to existing
      const existing = this.state.activeLenses.filter((l) => l.type !== type);
      targetLenses = [...existing, { ...lens, active: true }];

      // Normalize weights
      const totalWeight = targetLenses.reduce((s, l) => s + l.weight, 0);
      if (totalWeight > 0) {
        targetLenses = targetLenses.map((l) => ({
          ...l,
          weight: l.weight / totalWeight,
        }));
      }
    }

    // Create transition
    this.startTransition(targetLenses, transition);

    this.emit({ type: 'lens:activated', lens: { ...lens, active: true } });
  }

  /**
   * Deactivate a lens
   */
  deactivateLens(type: LensType): void {
    const remaining = this.state.activeLenses.filter((l) => l.type !== type);

    if (remaining.length === 0) {
      // Keep at least one lens
      const firstLens = this.config.initialLenses[0];
      if (firstLens) {
        remaining.push({ ...firstLens, active: true, weight: 1 });
      }
    } else {
      // Normalize weights
      const totalWeight = remaining.reduce((s, l) => s + l.weight, 0);
      remaining.forEach((l) => {
        l.weight = l.weight / totalWeight;
      });
    }

    this.startTransition(remaining);

    this.emit({ type: 'lens:deactivated', lensType: type });
  }

  /**
   * Set lens weight for blending
   */
  setLensWeight(type: LensType, weight: number): void {
    const lens = this.state.activeLenses.find((l) => l.type === type);
    if (!lens) return;

    lens.weight = Math.max(0, Math.min(1, weight));

    // Normalize weights
    const totalWeight = this.state.activeLenses.reduce((s, l) => s + l.weight, 0);
    if (totalWeight > 0) {
      this.state.activeLenses.forEach((l) => {
        l.weight = l.weight / totalWeight;
      });
    }

    this.updateTransformedPoints();
    this.emit({ type: 'lens:updated', lens });
  }

  /**
   * Update lens configuration
   */
  updateLens(type: LensType, updates: Partial<LensConfig>): void {
    const lens = this.state.activeLenses.find((l) => l.type === type);
    if (!lens) return;

    Object.assign(lens, updates);
    this.updateTransformedPoints();
    this.emit({ type: 'lens:updated', lens });
  }

  // ===========================================================================
  // Transitions
  // ===========================================================================

  /**
   * Start a transition to new lens configuration
   */
  private startTransition(
    targetLenses: LensConfig[],
    options?: Partial<LensTransition>
  ): void {
    // Cancel any existing transition
    if (this.transitionFrame) {
      cancelAnimationFrame(this.transitionFrame);
    }

    const transition = createTransition(
      this.state.activeLenses,
      targetLenses,
      options?.duration ?? this.config.defaultTransition.duration,
      options?.easing ?? this.config.defaultTransition.easing
    );

    this.state.transition = transition;
    this.emit({ type: 'transition:started', transition });

    // Run transition loop
    this.runTransition();
  }

  /**
   * Run transition animation frame
   */
  private runTransition(): void {
    if (!this.state.transition) return;

    const transition = updateTransition(this.state.transition);
    this.state.transition = transition;

    // Get interpolated lens configs
    this.state.activeLenses = getTransitionConfigs(transition);

    // Update points
    this.updateTransformedPoints();

    this.emit({ type: 'transition:progress', transition });

    if (isTransitionComplete(transition)) {
      // Transition complete
      this.state.activeLenses = transition.to.map((l) => ({ ...l }));
      this.state.transition = undefined;
      this.emit({ type: 'transition:completed', transition });
      this.updateTransformedPoints();
    } else {
      // Continue
      this.transitionFrame = requestAnimationFrame(() => this.runTransition());
    }
  }

  // ===========================================================================
  // Data Points
  // ===========================================================================

  /**
   * Add or update a data point
   */
  setDataPoint(point: DataPoint): void {
    this.dataPoints.set(point.id, point);
    this.updateTransformedPoint(point);
  }

  /**
   * Add multiple data points
   */
  setDataPoints(points: DataPoint[]): void {
    for (const point of points) {
      this.dataPoints.set(point.id, point);
    }
    this.updateTransformedPoints();
  }

  /**
   * Remove a data point
   */
  removeDataPoint(id: string): void {
    this.dataPoints.delete(id);
    this.state.transformedPoints.delete(id);
  }

  /**
   * Get a transformed point
   */
  getTransformedPoint(id: string): TransformedPoint | undefined {
    return this.state.transformedPoints.get(id);
  }

  /**
   * Get all transformed points
   */
  getAllTransformedPoints(): TransformedPoint[] {
    return Array.from(this.state.transformedPoints.values());
  }

  /**
   * Get visible transformed points
   */
  getVisiblePoints(): TransformedPoint[] {
    return Array.from(this.state.transformedPoints.values()).filter(
      (p) => p.visible
    );
  }

  /**
   * Update transformed point for a single data point
   */
  private updateTransformedPoint(point: DataPoint): void {
    const transformed = transformAndBlend(
      point,
      this.state.activeLenses,
      this.state.viewport
    );
    this.state.transformedPoints.set(point.id, transformed);
  }

  /**
   * Update all transformed points
   */
  private updateTransformedPoints(): void {
    for (const point of this.dataPoints.values()) {
      this.updateTransformedPoint(point);
    }
    this.state.lastUpdate = Date.now();
    this.emit({ type: 'points:transformed', count: this.dataPoints.size });
  }

  // ===========================================================================
  // Viewport
  // ===========================================================================

  /**
   * Update viewport dimensions
   */
  setViewport(
    viewport: Partial<LensState['viewport']>
  ): void {
    Object.assign(this.state.viewport, viewport);

    // Update center if dimensions changed
    if (viewport.width !== undefined || viewport.height !== undefined) {
      this.state.viewport.centerX =
        viewport.centerX ?? this.state.viewport.width / 2;
      this.state.viewport.centerY =
        viewport.centerY ?? this.state.viewport.height / 2;
    }

    this.updateTransformedPoints();
  }

  /**
   * Pan viewport
   */
  pan(dx: number, dy: number): void {
    this.state.viewport.centerX -= dx;
    this.state.viewport.centerY -= dy;
    this.updateTransformedPoints();
  }

  /**
   * Zoom viewport
   */
  zoom(factor: number, centerX?: number, centerY?: number): void {
    const cx = centerX ?? this.state.viewport.centerX;
    const cy = centerY ?? this.state.viewport.centerY;

    // Zoom toward point
    this.state.viewport.centerX += (cx - this.state.viewport.centerX) * (1 - factor);
    this.state.viewport.centerY += (cy - this.state.viewport.centerY) * (1 - factor);
    this.state.viewport.scale *= factor;

    this.updateTransformedPoints();
  }

  // ===========================================================================
  // Temporal Lens Controls
  // ===========================================================================

  /**
   * Scrub to a specific time
   */
  scrubToTime(time: number): void {
    const temporal = this.state.activeLenses.find(
      (l) => l.type === 'temporal'
    ) as import('./types').TemporalLensConfig | undefined;

    if (!temporal) return;

    temporal.currentTime = time;
    this.updateTransformedPoints();
    this.emit({ type: 'temporal:scrub', time });
  }

  /**
   * Start temporal playback
   */
  play(): void {
    const temporal = this.state.activeLenses.find(
      (l) => l.type === 'temporal'
    ) as import('./types').TemporalLensConfig | undefined;

    if (!temporal) return;

    temporal.playing = true;

    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
    }

    this.playbackTimer = setInterval(() => {
      if (!temporal.playing) {
        clearInterval(this.playbackTimer);
        return;
      }

      const step =
        this.config.temporalPlayback.updateInterval * temporal.playbackSpeed;
      temporal.currentTime = Math.min(
        temporal.timeRange.end,
        temporal.currentTime + step
      );

      if (temporal.currentTime >= temporal.timeRange.end) {
        this.pause();
      }

      this.updateTransformedPoints();
      this.emit({ type: 'temporal:scrub', time: temporal.currentTime });
    }, this.config.temporalPlayback.updateInterval);

    this.emit({ type: 'temporal:play' });
  }

  /**
   * Pause temporal playback
   */
  pause(): void {
    const temporal = this.state.activeLenses.find(
      (l) => l.type === 'temporal'
    ) as import('./types').TemporalLensConfig | undefined;

    if (!temporal) return;

    temporal.playing = false;

    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = undefined;
    }

    this.emit({ type: 'temporal:pause' });
  }

  /**
   * Set playback speed
   */
  setPlaybackSpeed(speed: number): void {
    const temporal = this.state.activeLenses.find(
      (l) => l.type === 'temporal'
    ) as import('./types').TemporalLensConfig | undefined;

    if (!temporal) return;

    temporal.playbackSpeed = speed;
  }

  // ===========================================================================
  // Temporal Portals
  // ===========================================================================

  /**
   * Create a temporal portal
   */
  createPortal(
    location: { lat: number; lng: number },
    targetTime: number,
    position?: { x: number; y: number }
  ): TemporalPortal {
    const portal: TemporalPortal = {
      id: `portal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      location,
      position: position ?? {
        x: this.state.viewport.centerX,
        y: this.state.viewport.centerY,
      },
      targetTime,
      radius: 100,
      active: true,
    };

    this.temporalPortals.set(portal.id, portal);
    return portal;
  }

  /**
   * Remove a temporal portal
   */
  removePortal(id: string): void {
    this.temporalPortals.delete(id);
  }

  /**
   * Get all temporal portals
   */
  getPortals(): TemporalPortal[] {
    return Array.from(this.temporalPortals.values());
  }

  /**
   * Check if a point is within a portal
   */
  isInPortal(x: number, y: number): TemporalPortal | null {
    for (const portal of this.temporalPortals.values()) {
      if (!portal.active) continue;

      const dx = x - portal.position.x;
      const dy = y - portal.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= portal.radius) {
        return portal;
      }
    }
    return null;
  }

  // ===========================================================================
  // State Access
  // ===========================================================================

  /**
   * Get current state
   */
  getState(): LensState {
    return {
      ...this.state,
      activeLenses: [...this.state.activeLenses],
      transformedPoints: new Map(this.state.transformedPoints),
    };
  }

  /**
   * Check if transition is in progress
   */
  isTransitioning(): boolean {
    return this.state.transition !== undefined;
  }

  // ===========================================================================
  // Event System
  // ===========================================================================

  /**
   * Subscribe to events
   */
  on(listener: LensEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit an event
   */
  private emit(event: LensEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Error in lens event listener:', e);
      }
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
    }
    if (this.transitionFrame) {
      cancelAnimationFrame(this.transitionFrame);
    }
    this.listeners.clear();
    this.dataPoints.clear();
    this.temporalPortals.clear();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new lens manager
 */
export function createLensManager(
  config?: Partial<LensManagerConfig>
): LensManager {
  return new LensManager(config);
}
