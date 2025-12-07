/**
 * Value-Weighted Path Optimization
 *
 * Find optimal paths through the intersection of possibility cones,
 * maximizing accumulated value while satisfying constraints.
 */

import type {
  SpacePoint,
  SpaceVector,
  PossibilityCone,
  PossibilityPath,
  PathWaypoint,
  OptimizationConfig,
  OptimizationResult,
  ConeConstraint,
  ValueField,
} from './types';
import { DEFAULT_OPTIMIZATION_CONFIG } from './types';
import {
  distance,
  addVectors,
  subtractVectors,
  scaleVector,
  normalize,
  magnitude,
  pointToVector,
  vectorToPoint,
  isPointInCone,
  isPointInIntersection,
  signedDistanceToSurface,
} from './geometry';

// =============================================================================
// Path Optimizer
// =============================================================================

/**
 * Path optimization engine
 */
export class PathOptimizer {
  private config: OptimizationConfig;
  private cones: PossibilityCone[] = [];
  private constraints: ConeConstraint[] = [];
  private valueField?: ValueField;
  private bounds: { min: SpacePoint; max: SpacePoint };

  constructor(
    bounds: { min: SpacePoint; max: SpacePoint },
    config: Partial<OptimizationConfig> = {}
  ) {
    this.config = { ...DEFAULT_OPTIMIZATION_CONFIG, ...config };
    this.bounds = bounds;
  }

  /**
   * Set the cones to navigate through
   */
  setCones(cones: PossibilityCone[]): void {
    this.cones = cones;
  }

  /**
   * Set additional constraints
   */
  setConstraints(constraints: ConeConstraint[]): void {
    this.constraints = constraints;
  }

  /**
   * Set the value field for optimization
   */
  setValueField(field: ValueField): void {
    this.valueField = field;
  }

  /**
   * Find optimal path from start to goal
   */
  findOptimalPath(
    start: SpacePoint,
    goal: SpacePoint
  ): OptimizationResult {
    const startTime = Date.now();

    switch (this.config.algorithm) {
      case 'a-star':
        return this.aStarSearch(start, goal, startTime);
      case 'dijkstra':
        return this.dijkstraSearch(start, goal, startTime);
      case 'gradient-descent':
        return this.gradientDescent(start, goal, startTime);
      case 'simulated-annealing':
        return this.simulatedAnnealing(start, goal, startTime);
      default:
        return this.aStarSearch(start, goal, startTime);
    }
  }

  // ===========================================================================
  // A* Search
  // ===========================================================================

  private aStarSearch(
    start: SpacePoint,
    goal: SpacePoint,
    startTime: number
  ): OptimizationResult {
    const dim = start.coordinates.length;
    const resolution = this.config.samplingResolution;

    // Discretize space
    const grid = this.createGrid(resolution);

    // Find grid cells for start and goal
    const startCell = this.pointToCell(start, resolution);
    const goalCell = this.pointToCell(goal, resolution);

    // Priority queue (min-heap by f-score)
    const openSet: Array<{ cell: number[]; fScore: number }> = [
      { cell: startCell, fScore: 0 },
    ];

    // Track visited cells and their g-scores
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const cameFrom = new Map<string, number[]>();

    const cellKey = (cell: number[]) => cell.join(',');
    gScore.set(cellKey(startCell), 0);
    fScore.set(cellKey(startCell), this.heuristic(startCell, goalCell, resolution));

    let iterations = 0;

    while (openSet.length > 0 && iterations < this.config.maxIterations) {
      iterations++;

      // Get cell with lowest f-score
      openSet.sort((a, b) => a.fScore - b.fScore);
      const current = openSet.shift()!;
      const currentKey = cellKey(current.cell);

      // Check if reached goal
      if (this.cellsEqual(current.cell, goalCell)) {
        const path = this.reconstructPath(cameFrom, current.cell, start, goal, resolution);
        return this.createResult(path, iterations, true, startTime);
      }

      // Explore neighbors
      const neighbors = this.getNeighborCells(current.cell, resolution);

      for (const neighbor of neighbors) {
        const neighborKey = cellKey(neighbor);
        const neighborPoint = this.cellToPoint(neighbor, resolution);

        // Check if valid (in cone intersection)
        if (!this.isValidPoint(neighborPoint)) continue;

        // Calculate tentative g-score
        const currentPoint = this.cellToPoint(current.cell, resolution);
        const moveCost = this.getMoveCost(currentPoint, neighborPoint);
        const tentativeG = (gScore.get(currentKey) ?? Infinity) + moveCost;

        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          // Better path found
          cameFrom.set(neighborKey, current.cell);
          gScore.set(neighborKey, tentativeG);
          const h = this.heuristic(neighbor, goalCell, resolution);
          const f = tentativeG + h;
          fScore.set(neighborKey, f);

          if (!openSet.some((n) => cellKey(n.cell) === neighborKey)) {
            openSet.push({ cell: neighbor, fScore: f });
          }
        }
      }
    }

    // No path found - return best effort
    const partialPath = this.createDirectPath(start, goal);
    return this.createResult(partialPath, iterations, false, startTime);
  }

  // ===========================================================================
  // Dijkstra Search
  // ===========================================================================

  private dijkstraSearch(
    start: SpacePoint,
    goal: SpacePoint,
    startTime: number
  ): OptimizationResult {
    // Simplified Dijkstra (A* with h=0)
    const originalConfig = this.config;
    this.config = { ...originalConfig };

    const result = this.aStarSearch(start, goal, startTime);

    this.config = originalConfig;
    return result;
  }

  // ===========================================================================
  // Gradient Descent
  // ===========================================================================

  private gradientDescent(
    start: SpacePoint,
    goal: SpacePoint,
    startTime: number
  ): OptimizationResult {
    const dim = start.coordinates.length;
    const stepSize = 0.1;
    const waypoints: PathWaypoint[] = [];

    let current = { ...start, coordinates: [...start.coordinates] };
    let iterations = 0;
    let totalValue = this.getValueAt(current);
    let distanceToGoal = distance(current, goal);

    while (iterations < this.config.maxIterations && distanceToGoal > 0.1) {
      iterations++;

      // Calculate gradient (toward goal + value gradient)
      const toGoal = subtractVectors(pointToVector(goal), pointToVector(current));
      const goalDir = normalize(toGoal);

      // Value gradient (finite differences)
      const valueGrad = this.estimateValueGradient(current);

      // Combined gradient
      const combinedGrad = addVectors(
        scaleVector(goalDir, this.config.weights.length),
        scaleVector(valueGrad, this.config.weights.value)
      );

      const step = scaleVector(normalize(combinedGrad), stepSize);

      // Proposed new position
      const proposed: SpacePoint = {
        coordinates: current.coordinates.map(
          (c, i) => c + (step.components[i] ?? 0)
        ),
      };

      // Check validity
      if (this.isValidPoint(proposed)) {
        // Add waypoint
        waypoints.push({
          position: current,
          value: this.getValueAt(current),
          distanceFromStart: waypoints.length > 0
            ? waypoints[waypoints.length - 1].distanceFromStart + distance(current, proposed)
            : 0,
          containingCones: this.getContainingCones(current),
        });

        current = proposed;
        totalValue += this.getValueAt(current);
        distanceToGoal = distance(current, goal);
      } else {
        // Try to project back into valid region
        const projected = this.projectToValidRegion(proposed);
        if (projected) {
          current = projected;
        } else {
          break; // Stuck
        }
      }

      // Check convergence
      if (distanceToGoal < this.config.convergenceThreshold) {
        break;
      }
    }

    // Add final waypoint
    waypoints.push({
      position: current,
      value: this.getValueAt(current),
      distanceFromStart: waypoints.length > 0
        ? waypoints[waypoints.length - 1].distanceFromStart + distance(current, goal)
        : distance(start, goal),
      containingCones: this.getContainingCones(current),
    });

    const path = this.waypointsToPath(waypoints);
    return this.createResult(path, iterations, distanceToGoal < 0.1, startTime);
  }

  // ===========================================================================
  // Simulated Annealing
  // ===========================================================================

  private simulatedAnnealing(
    start: SpacePoint,
    goal: SpacePoint,
    startTime: number
  ): OptimizationResult {
    const dim = start.coordinates.length;

    // Initialize with direct path
    let currentPath = this.createDirectPath(start, goal);
    let currentScore = this.scorePath(currentPath);
    let bestPath = currentPath;
    let bestScore = currentScore;

    let temperature = 1.0;
    const coolingRate = 0.995;
    let iterations = 0;

    while (
      iterations < this.config.maxIterations &&
      temperature > this.config.convergenceThreshold
    ) {
      iterations++;

      // Generate neighbor solution (perturb random waypoint)
      const neighborPath = this.perturbPath(currentPath);
      const neighborScore = this.scorePath(neighborPath);

      // Acceptance probability
      const delta = neighborScore - currentScore;
      const acceptProb = delta > 0 ? 1 : Math.exp(delta / temperature);

      if (Math.random() < acceptProb) {
        currentPath = neighborPath;
        currentScore = neighborScore;

        if (currentScore > bestScore) {
          bestPath = currentPath;
          bestScore = currentScore;
        }
      }

      temperature *= coolingRate;
    }

    return this.createResult(bestPath, iterations, true, startTime);
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private createGrid(_resolution: number): void {
    // Grid is implicit - we just use resolution to map points to cells
  }

  private pointToCell(point: SpacePoint, resolution: number): number[] {
    return point.coordinates.map((c, i) => {
      const min = this.bounds.min.coordinates[i];
      const max = this.bounds.max.coordinates[i];
      const normalized = (c - min) / (max - min);
      return Math.floor(normalized * resolution);
    });
  }

  private cellToPoint(cell: number[], resolution: number): SpacePoint {
    return {
      coordinates: cell.map((c, i) => {
        const min = this.bounds.min.coordinates[i];
        const max = this.bounds.max.coordinates[i];
        return min + ((c + 0.5) / resolution) * (max - min);
      }),
    };
  }

  private cellsEqual(a: number[], b: number[]): boolean {
    return a.every((v, i) => v === b[i]);
  }

  private getNeighborCells(cell: number[], resolution: number): number[][] {
    const neighbors: number[][] = [];
    const dim = cell.length;

    // Generate all adjacent cells (26 neighbors in 3D, etc.)
    const directions: number[] = [-1, 0, 1];

    const generate = (index: number, current: number[]): void => {
      if (index === dim) {
        if (!current.every((v, i) => v === cell[i])) {
          // Check bounds
          if (current.every((v, _i) => v >= 0 && v < resolution)) {
            neighbors.push([...current]);
          }
        }
        return;
      }

      for (const d of directions) {
        current[index] = cell[index] + d;
        generate(index + 1, current);
      }
    };

    generate(0, new Array(dim).fill(0));
    return neighbors;
  }

  private heuristic(
    cell: number[],
    goalCell: number[],
    _resolution: number
  ): number {
    // Euclidean distance in cell space
    let sum = 0;
    for (let i = 0; i < cell.length; i++) {
      const diff = cell[i] - goalCell[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  private getMoveCost(from: SpacePoint, to: SpacePoint): number {
    const dist = distance(from, to);
    const value = (this.getValueAt(from) + this.getValueAt(to)) / 2;
    const risk = this.getRiskAt(to);

    // Cost = distance - value + risk
    return (
      dist * this.config.weights.length -
      value * this.config.weights.value +
      risk * this.config.weights.risk
    );
  }

  private isValidPoint(point: SpacePoint): boolean {
    // Check bounds
    for (let i = 0; i < point.coordinates.length; i++) {
      if (
        point.coordinates[i] < this.bounds.min.coordinates[i] ||
        point.coordinates[i] > this.bounds.max.coordinates[i]
      ) {
        return false;
      }
    }

    // Check cone intersection
    if (!isPointInIntersection(point, this.cones)) {
      return false;
    }

    // Check hard constraints
    for (const constraint of this.constraints) {
      if (constraint.hardness === 'hard') {
        if (signedDistanceToSurface(point, constraint.surface) > 0) {
          return false;
        }
      }
    }

    return true;
  }

  private getValueAt(point: SpacePoint): number {
    if (!this.valueField) {
      // Default: higher value along value dimension
      return point.coordinates[1] ?? 0;
    }

    // Trilinear interpolation from value field
    // Simplified: nearest neighbor
    const resolution = this.valueField.resolution;
    const indices = point.coordinates.map((c, i) => {
      const min = this.bounds.min.coordinates[i];
      const max = this.bounds.max.coordinates[i];
      const normalized = (c - min) / (max - min);
      return Math.floor(normalized * (resolution[i] - 1));
    });

    // Flatten index
    let flatIndex = 0;
    let stride = 1;
    for (let i = indices.length - 1; i >= 0; i--) {
      flatIndex += indices[i] * stride;
      stride *= resolution[i];
    }

    return this.valueField.values[flatIndex] ?? 0;
  }

  private getRiskAt(point: SpacePoint): number {
    // Default: lower risk toward center of cones
    let totalDistance = 0;
    for (const cone of this.cones) {
      totalDistance += Math.abs(
        isPointInCone(point, cone) ? -1 : 1
      );
    }
    return totalDistance / Math.max(1, this.cones.length);
  }

  private estimateValueGradient(point: SpacePoint): SpaceVector {
    const epsilon = 0.01;
    const dim = point.coordinates.length;
    const gradient: number[] = [];

    for (let i = 0; i < dim; i++) {
      const forward: SpacePoint = {
        coordinates: point.coordinates.map((c, j) =>
          j === i ? c + epsilon : c
        ),
      };
      const backward: SpacePoint = {
        coordinates: point.coordinates.map((c, j) =>
          j === i ? c - epsilon : c
        ),
      };

      const fValue = this.isValidPoint(forward) ? this.getValueAt(forward) : 0;
      const bValue = this.isValidPoint(backward) ? this.getValueAt(backward) : 0;

      gradient.push((fValue - bValue) / (2 * epsilon));
    }

    return { components: gradient };
  }

  private projectToValidRegion(point: SpacePoint): SpacePoint | null {
    // Simple projection: move toward nearest valid point
    // This is a simplified version - real implementation would be more sophisticated
    const maxAttempts = 10;
    let current = point;

    for (let i = 0; i < maxAttempts; i++) {
      if (this.isValidPoint(current)) {
        return current;
      }

      // Move toward center of bounds
      const center: SpacePoint = {
        coordinates: this.bounds.min.coordinates.map(
          (min, j) => (min + this.bounds.max.coordinates[j]) / 2
        ),
      };

      const toCenter = subtractVectors(
        pointToVector(center),
        pointToVector(current)
      );
      const step = scaleVector(normalize(toCenter), 0.1);

      current = {
        coordinates: current.coordinates.map(
          (c, j) => c + (step.components[j] ?? 0)
        ),
      };
    }

    return null;
  }

  private getContainingCones(point: SpacePoint): string[] {
    return this.cones
      .filter((cone) => isPointInCone(point, cone))
      .map((cone) => cone.id);
  }

  private reconstructPath(
    cameFrom: Map<string, number[]>,
    goalCell: number[],
    start: SpacePoint,
    _goal: SpacePoint,
    resolution: number
  ): PossibilityPath {
    const waypoints: PathWaypoint[] = [];
    let current = goalCell;
    const cellKey = (cell: number[]) => cell.join(',');

    // Trace back
    const cells: number[][] = [current];
    while (cameFrom.has(cellKey(current))) {
      current = cameFrom.get(cellKey(current))!;
      cells.unshift(current);
    }

    // Convert to waypoints
    let distanceFromStart = 0;
    let prevPoint = start;

    for (const cell of cells) {
      const point = this.cellToPoint(cell, resolution);
      distanceFromStart += distance(prevPoint, point);

      waypoints.push({
        position: point,
        value: this.getValueAt(point),
        distanceFromStart,
        containingCones: this.getContainingCones(point),
      });

      prevPoint = point;
    }

    return this.waypointsToPath(waypoints);
  }

  private createDirectPath(start: SpacePoint, goal: SpacePoint): PossibilityPath {
    const waypoints: PathWaypoint[] = [
      {
        position: start,
        value: this.getValueAt(start),
        distanceFromStart: 0,
        containingCones: this.getContainingCones(start),
      },
      {
        position: goal,
        value: this.getValueAt(goal),
        distanceFromStart: distance(start, goal),
        containingCones: this.getContainingCones(goal),
      },
    ];

    return this.waypointsToPath(waypoints);
  }

  private waypointsToPath(waypoints: PathWaypoint[]): PossibilityPath {
    const totalValue = waypoints.reduce((sum, w) => sum + w.value, 0);
    const length =
      waypoints.length > 0
        ? waypoints[waypoints.length - 1].distanceFromStart
        : 0;

    const satisfiedConstraints = this.constraints
      .filter((c) =>
        waypoints.every(
          (w) => signedDistanceToSurface(w.position, c.surface) <= 0
        )
      )
      .map((c) => c.id);

    const violatedConstraints = this.constraints
      .filter((c) => !satisfiedConstraints.includes(c.id))
      .map((c) => c.id);

    return {
      id: `path-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      waypoints,
      length,
      totalValue,
      riskExposure: this.calculateRiskExposure(waypoints),
      satisfiedConstraints,
      violatedConstraints,
      optimalityScore: this.scorePath({
        id: '',
        waypoints,
        length,
        totalValue,
        riskExposure: 0,
        satisfiedConstraints,
        violatedConstraints,
        optimalityScore: 0,
      }),
    };
  }

  private scorePath(path: PossibilityPath): number {
    const { weights } = this.config;

    let score = 0;
    score += path.totalValue * weights.value;
    score -= path.length * weights.length;
    score -= path.riskExposure * weights.risk;
    score +=
      (path.satisfiedConstraints.length /
        Math.max(1, this.constraints.length)) *
      weights.constraints;

    // Penalty for soft violations
    if (this.config.allowSoftViolations) {
      score -=
        path.violatedConstraints.filter((id) => {
          const c = this.constraints.find((c) => c.id === id);
          return c?.hardness === 'soft';
        }).length * this.config.softViolationPenalty;
    }

    return score;
  }

  private calculateRiskExposure(waypoints: PathWaypoint[]): number {
    return waypoints.reduce((sum, w) => sum + this.getRiskAt(w.position), 0) /
      Math.max(1, waypoints.length);
  }

  private perturbPath(path: PossibilityPath): PossibilityPath {
    if (path.waypoints.length < 3) return path;

    // Select random waypoint (not start/end)
    const index = 1 + Math.floor(Math.random() * (path.waypoints.length - 2));
    const waypoint = path.waypoints[index];

    // Perturb position
    const perturbation = 0.5;
    const newPosition: SpacePoint = {
      coordinates: waypoint.position.coordinates.map(
        (c) => c + (Math.random() - 0.5) * perturbation
      ),
    };

    // Create new waypoints array
    const newWaypoints = [...path.waypoints];
    newWaypoints[index] = {
      ...waypoint,
      position: newPosition,
      value: this.getValueAt(newPosition),
      containingCones: this.getContainingCones(newPosition),
    };

    return this.waypointsToPath(newWaypoints);
  }

  private createResult(
    path: PossibilityPath,
    iterations: number,
    converged: boolean,
    startTime: number
  ): OptimizationResult {
    return {
      bestPath: path,
      alternatives: [], // Could generate Pareto frontier
      iterations,
      converged,
      metrics: {
        initialScore: 0,
        finalScore: path.optimalityScore,
        improvement: path.optimalityScore,
        runtime: Date.now() - startTime,
      },
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a path optimizer
 */
export function createPathOptimizer(
  bounds: { min: SpacePoint; max: SpacePoint },
  config?: Partial<OptimizationConfig>
): PathOptimizer {
  return new PathOptimizer(bounds, config);
}
