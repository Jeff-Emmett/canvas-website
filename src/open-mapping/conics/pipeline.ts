/**
 * Constraint Pipeline
 *
 * Manages the propagation of constraints through a pipeline,
 * progressively narrowing possibility cones and computing
 * the valid solution space.
 */

import type {
  PossibilityCone,
  ConeConstraint,
  ConeIntersection,
  ConstraintPipeline,
  PipelineStage,
  SpacePoint,
  SpaceVector,
  ConicEvent,
  ConicEventListener,
} from './types';
import {
  createCone,
  narrowCone,
  isPointInCone,
  signedDistanceToSurface,
  estimateIntersectionVolume,
  findIntersectionWaist,
} from './geometry';

// =============================================================================
// Pipeline Manager
// =============================================================================

/**
 * Configuration for the constraint pipeline
 */
export interface PipelineConfig {
  /** Number of dimensions in possibility space */
  dimensions: number;

  /** Dimension labels */
  dimensionLabels: string[];

  /** Initial cone aperture (default = PI/4 = 45 degrees) */
  initialAperture: number;

  /** Initial cone axis (default = time dimension) */
  initialAxis: number;

  /** Bounds for volume estimation */
  bounds: {
    min: number[];
    max: number[];
  };

  /** Sampling resolution for volume estimation */
  volumeSamples: number;
}

/**
 * Default pipeline configuration
 */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  dimensions: 4,
  dimensionLabels: ['Time', 'Value', 'Risk', 'Resources'],
  initialAperture: Math.PI / 4,
  initialAxis: 0, // Time
  bounds: {
    min: [0, 0, 0, 0],
    max: [100, 100, 100, 100],
  },
  volumeSamples: 5000,
};

/**
 * Manages constraint pipeline execution
 */
export class ConstraintPipelineManager {
  private config: PipelineConfig;
  private pipelines: Map<string, ConstraintPipeline> = new Map();
  private listeners: Set<ConicEventListener> = new Set();

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
  }

  // ===========================================================================
  // Pipeline Management
  // ===========================================================================

  /**
   * Create a new pipeline
   */
  createPipeline(
    name: string,
    origin: SpacePoint,
    axis?: SpaceVector
  ): ConstraintPipeline {
    const id = `pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Default axis along first dimension
    const defaultAxis: SpaceVector = {
      components: new Array(this.config.dimensions)
        .fill(0)
        .map((_, i) => (i === this.config.initialAxis ? 1 : 0)),
    };

    const initialCone = createCone({
      apex: origin,
      axis: axis ?? defaultAxis,
      aperture: this.config.initialAperture,
      direction: 'forward',
    });

    const pipeline: ConstraintPipeline = {
      id,
      name,
      stages: [],
      initialCone,
      metadata: {},
    };

    this.pipelines.set(id, pipeline);
    return pipeline;
  }

  /**
   * Add a constraint stage to pipeline
   */
  addStage(
    pipelineId: string,
    stageName: string,
    constraints: ConeConstraint[]
  ): PipelineStage | null {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return null;

    const position = pipeline.stages.length;

    const stage: PipelineStage = {
      id: `stage-${position}-${Date.now()}`,
      name: stageName,
      position,
      constraints,
    };

    pipeline.stages.push(stage);

    // Process stage
    this.processStage(pipeline, stage);

    return stage;
  }

  /**
   * Process a pipeline stage
   */
  private processStage(pipeline: ConstraintPipeline, stage: PipelineStage): void {
    // Get the cone from previous stage
    const previousCone =
      stage.position === 0
        ? pipeline.initialCone
        : pipeline.stages[stage.position - 1].resultingCone ?? pipeline.initialCone;

    // Apply constraints to narrow the cone
    let resultingCone = previousCone;

    for (const constraint of stage.constraints) {
      // Calculate how much this constraint narrows the cone
      const narrowingFactor = 1 - constraint.restrictiveness;
      resultingCone = narrowCone(resultingCone, narrowingFactor, constraint.id);
    }

    stage.resultingCone = resultingCone;

    // Estimate remaining volume fraction
    const initialVolume = this.estimateVolume([pipeline.initialCone]);
    const currentVolume = this.estimateVolume([resultingCone]);
    stage.remainingVolumeFraction =
      initialVolume > 0 ? currentVolume / initialVolume : 0;

    this.emit({ type: 'pipeline:stage-completed', stage });
  }

  /**
   * Run full pipeline and compute final intersection
   */
  runPipeline(pipelineId: string): ConeIntersection | null {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline || pipeline.stages.length === 0) return null;

    // Collect all resulting cones
    const cones: PossibilityCone[] = [];
    let lastCone = pipeline.initialCone;

    for (const stage of pipeline.stages) {
      if (stage.resultingCone) {
        cones.push(stage.resultingCone);
        lastCone = stage.resultingCone;
      }
    }

    // Compute intersection
    const intersection = this.computeIntersection(cones, pipeline);
    pipeline.finalIntersection = intersection;

    this.emit({ type: 'intersection:computed', intersection });

    return intersection;
  }

  /**
   * Compute cone intersection
   */
  private computeIntersection(
    cones: PossibilityCone[],
    pipeline: ConstraintPipeline
  ): ConeIntersection {
    const bounds = this.getBounds();

    // Estimate volume
    const volume = this.estimateVolume(cones);

    // Find waist
    const waist = findIntersectionWaist(
      cones,
      this.config.initialAxis,
      bounds,
      50
    );

    const intersection: ConeIntersection = {
      id: `intersection-${Date.now()}`,
      coneIds: cones.map((c) => c.id),
      constraintIds: pipeline.stages.flatMap((s) => s.constraints.map((c) => c.id)),
      volume,
      waist: waist ?? undefined,
      boundary: {
        type: 'implicit',
        bounds,
      },
    };

    if (waist) {
      this.emit({ type: 'waist:detected', waist });
    }

    return intersection;
  }

  /**
   * Estimate volume of cone intersection
   */
  private estimateVolume(cones: PossibilityCone[]): number {
    return estimateIntersectionVolume(
      cones,
      this.getBounds(),
      this.config.volumeSamples
    );
  }

  /**
   * Get bounds as SpacePoints
   */
  private getBounds(): { min: SpacePoint; max: SpacePoint } {
    return {
      min: { coordinates: this.config.bounds.min },
      max: { coordinates: this.config.bounds.max },
    };
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Get a pipeline by ID
   */
  getPipeline(id: string): ConstraintPipeline | undefined {
    return this.pipelines.get(id);
  }

  /**
   * Get all pipelines
   */
  getAllPipelines(): ConstraintPipeline[] {
    return Array.from(this.pipelines.values());
  }

  /**
   * Check if a point is valid (in all pipeline intersections)
   */
  isPointValid(pipelineId: string, point: SpacePoint): boolean {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return false;

    // Check against all stage cones
    for (const stage of pipeline.stages) {
      if (stage.resultingCone && !isPointInCone(point, stage.resultingCone)) {
        return false;
      }
    }

    // Check against all constraints
    for (const stage of pipeline.stages) {
      for (const constraint of stage.constraints) {
        if (
          constraint.hardness === 'hard' &&
          signedDistanceToSurface(point, constraint.surface) > 0
        ) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get constraint violation score for a point
   */
  getViolationScore(pipelineId: string, point: SpacePoint): number {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return Infinity;

    let totalViolation = 0;

    for (const stage of pipeline.stages) {
      for (const constraint of stage.constraints) {
        const dist = signedDistanceToSurface(point, constraint.surface);
        if (dist > 0) {
          // Violation
          const weight = constraint.hardness === 'hard' ? 1000 : constraint.weight ?? 1;
          totalViolation += dist * weight;
        }
      }
    }

    return totalViolation;
  }

  /**
   * Get the narrowest point (bottleneck) in the pipeline
   */
  getBottleneck(pipelineId: string): PipelineStage | null {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return null;

    let narrowestStage: PipelineStage | null = null;
    let minVolumeFraction = Infinity;

    for (const stage of pipeline.stages) {
      if (
        stage.remainingVolumeFraction !== undefined &&
        stage.remainingVolumeFraction < minVolumeFraction
      ) {
        minVolumeFraction = stage.remainingVolumeFraction;
        narrowestStage = stage;
      }
    }

    return narrowestStage;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  /**
   * Subscribe to events
   */
  on(listener: ConicEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ConicEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Error in conic event listener:', e);
      }
    }
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  /**
   * Export pipeline to JSON
   */
  exportPipeline(pipelineId: string): string | null {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return null;
    return JSON.stringify(pipeline, null, 2);
  }

  /**
   * Import pipeline from JSON
   */
  importPipeline(json: string): ConstraintPipeline | null {
    try {
      const pipeline = JSON.parse(json) as ConstraintPipeline;
      this.pipelines.set(pipeline.id, pipeline);
      return pipeline;
    } catch {
      return null;
    }
  }
}

// =============================================================================
// Dependency Analysis
// =============================================================================

/**
 * Analyze constraint dependencies
 */
export function analyzeConstraintDependencies(
  constraints: ConeConstraint[]
): {
  order: ConeConstraint[];
  cycles: string[][];
  parallelGroups: ConeConstraint[][];
} {
  // Build dependency graph
  const graph = new Map<string, Set<string>>();
  const constraintMap = new Map<string, ConeConstraint>();

  for (const c of constraints) {
    constraintMap.set(c.id, c);
    graph.set(c.id, new Set(c.dependencies));
  }

  // Topological sort with cycle detection
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const order: ConeConstraint[] = [];
  const cycles: string[][] = [];

  function dfs(id: string, path: string[]): boolean {
    if (recursionStack.has(id)) {
      // Cycle detected
      const cycleStart = path.indexOf(id);
      cycles.push(path.slice(cycleStart));
      return false;
    }

    if (visited.has(id)) return true;

    visited.add(id);
    recursionStack.add(id);

    const deps = graph.get(id) ?? new Set();
    for (const dep of deps) {
      if (!dfs(dep, [...path, id])) {
        return false;
      }
    }

    recursionStack.delete(id);
    const constraint = constraintMap.get(id);
    if (constraint) {
      order.push(constraint);
    }

    return true;
  }

  for (const id of constraintMap.keys()) {
    if (!visited.has(id)) {
      dfs(id, []);
    }
  }

  // Find parallel groups (constraints with same dependencies)
  const depSignature = (c: ConeConstraint) =>
    [...c.dependencies].sort().join(',');

  const signatureGroups = new Map<string, ConeConstraint[]>();
  for (const c of constraints) {
    const sig = depSignature(c);
    const group = signatureGroups.get(sig) ?? [];
    group.push(c);
    signatureGroups.set(sig, group);
  }

  const parallelGroups = Array.from(signatureGroups.values()).filter(
    (g) => g.length > 1
  );

  return {
    order: order.reverse(),
    cycles,
    parallelGroups,
  };
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a constraint pipeline manager
 */
export function createPipelineManager(
  config?: Partial<PipelineConfig>
): ConstraintPipelineManager {
  return new ConstraintPipelineManager(config);
}

/**
 * Create a simple constraint
 */
export function createConstraint(params: {
  label: string;
  type: ConeConstraint['type'];
  restrictiveness: number;
  hardness?: 'hard' | 'soft';
  dependencies?: string[];
  surface?: ConeConstraint['surface'];
}): ConeConstraint {
  return {
    id: `constraint-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: params.label,
    type: params.type,
    pipelinePosition: 0,
    surface: params.surface ?? {
      type: 'hyperplane',
      normal: { components: [1, 0, 0, 0] },
      offset: 0,
      validSide: 'positive',
    },
    restrictiveness: params.restrictiveness,
    dependencies: params.dependencies ?? [],
    hardness: params.hardness ?? 'hard',
  };
}
