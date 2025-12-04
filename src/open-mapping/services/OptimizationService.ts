/**
 * OptimizationService - Route and trip optimization
 *
 * Uses VROOM or similar for:
 * - Vehicle Routing Problems (VRP)
 * - Traveling Salesman Problem (TSP)
 * - Time window constraints
 * - Capacity constraints
 * - Multi-vehicle optimization
 * - Cost tracking and budgeting
 */

import type {
  Waypoint,
  Route,
  Coordinate,
  TripItinerary,
  TripBudget,
  OptimizationServiceConfig,
} from '../types';

export interface OptimizationJob {
  id: string;
  waypoints: Waypoint[];
  constraints: OptimizationConstraints;
  result?: OptimizationResult;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

export interface OptimizationConstraints {
  startLocation?: Coordinate;
  endLocation?: Coordinate;
  returnToStart?: boolean;
  maxDuration?: number; // seconds
  maxDistance?: number; // meters
  timeWindows?: TimeWindow[];
  vehicleCapacity?: number;
  priorities?: number[]; // waypoint priorities
}

export interface TimeWindow {
  waypointIndex: number;
  start: Date;
  end: Date;
}

export interface OptimizationResult {
  orderedWaypoints: Waypoint[];
  totalDistance: number;
  totalDuration: number;
  estimatedCost: OptimizationCost;
  unassigned?: number[]; // indices of waypoints that couldn't be visited
  violations?: string[];
}

export interface OptimizationCost {
  fuel: number;
  time: number; // value of time
  total: number;
  currency: string;
}

export interface CostParameters {
  fuelPricePerLiter: number;
  fuelConsumptionPer100km: number; // liters
  valueOfTimePerHour: number;
  currency: string;
}

const DEFAULT_COST_PARAMS: CostParameters = {
  fuelPricePerLiter: 1.5, // EUR
  fuelConsumptionPer100km: 8, // liters
  valueOfTimePerHour: 20, // EUR
  currency: 'EUR',
};

export class OptimizationService {
  private config: OptimizationServiceConfig;
  private costParams: CostParameters;

  constructor(
    config: OptimizationServiceConfig,
    costParams: CostParameters = DEFAULT_COST_PARAMS
  ) {
    this.config = config;
    this.costParams = costParams;
  }

  /**
   * Optimize waypoint order for minimum travel time/distance
   */
  async optimizeRoute(
    waypoints: Waypoint[],
    constraints?: OptimizationConstraints
  ): Promise<OptimizationResult> {
    if (waypoints.length <= 2) {
      return {
        orderedWaypoints: waypoints,
        totalDistance: 0,
        totalDuration: 0,
        estimatedCost: { fuel: 0, time: 0, total: 0, currency: this.costParams.currency },
      };
    }

    if (this.config.provider === 'vroom') {
      return this.optimizeWithVROOM(waypoints, constraints);
    }

    // Fallback: simple nearest-neighbor heuristic
    return this.nearestNeighborOptimization(waypoints, constraints);
  }

  /**
   * Optimize a full trip itinerary with time constraints
   */
  async optimizeItinerary(itinerary: TripItinerary): Promise<TripItinerary> {
    // Extract all waypoints from all routes
    const allWaypoints = itinerary.routes.flatMap((r) => r.waypoints);

    // Build time windows from events
    const timeWindows: TimeWindow[] = itinerary.events
      .filter((e) => e.waypointId)
      .map((e) => {
        const waypointIndex = allWaypoints.findIndex((w) => w.id === e.waypointId);
        return {
          waypointIndex,
          start: e.startTime,
          end: e.endTime,
        };
      })
      .filter((tw) => tw.waypointIndex >= 0);

    const result = await this.optimizeRoute(allWaypoints, { timeWindows });

    // Rebuild itinerary with optimized order
    return {
      ...itinerary,
      // Would need more sophisticated logic to rebuild routes
    };
  }

  /**
   * Estimate trip costs
   */
  estimateCosts(
    distance: number, // meters
    duration: number, // seconds
    additionalCosts?: Partial<TripBudget>
  ): OptimizationCost {
    const distanceKm = distance / 1000;
    const durationHours = duration / 3600;

    const fuelLiters = (distanceKm / 100) * this.costParams.fuelConsumptionPer100km;
    const fuelCost = fuelLiters * this.costParams.fuelPricePerLiter;
    const timeCost = durationHours * this.costParams.valueOfTimePerHour;

    return {
      fuel: Math.round(fuelCost * 100) / 100,
      time: Math.round(timeCost * 100) / 100,
      total: Math.round((fuelCost + timeCost) * 100) / 100,
      currency: this.costParams.currency,
    };
  }

  /**
   * Update cost calculation parameters
   */
  setCostParameters(params: Partial<CostParameters>): void {
    this.costParams = { ...this.costParams, ...params };
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  private async optimizeWithVROOM(
    waypoints: Waypoint[],
    constraints?: OptimizationConstraints
  ): Promise<OptimizationResult> {
    // Build VROOM request
    const jobs = waypoints.map((wp, index) => ({
      id: index,
      location: [wp.coordinate.lng, wp.coordinate.lat],
      service: wp.stayDuration ? wp.stayDuration * 60 : 0, // seconds
      priority: constraints?.priorities?.[index] ?? 0,
      time_windows: this.getTimeWindowForWaypoint(index, constraints?.timeWindows),
    }));

    const vehicles = [{
      id: 0,
      start: constraints?.startLocation
        ? [constraints.startLocation.lng, constraints.startLocation.lat]
        : [waypoints[0].coordinate.lng, waypoints[0].coordinate.lat],
      end: constraints?.endLocation
        ? [constraints.endLocation.lng, constraints.endLocation.lat]
        : constraints?.returnToStart
          ? [waypoints[0].coordinate.lng, waypoints[0].coordinate.lat]
          : undefined,
      capacity: constraints?.vehicleCapacity ? [constraints.vehicleCapacity] : undefined,
    }];

    const body = { jobs, vehicles };

    try {
      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.code !== 0) {
        throw new Error(`VROOM error: ${data.error}`);
      }

      return this.parseVROOMResponse(data, waypoints);
    } catch (error) {
      console.error('VROOM optimization failed:', error);
      return this.nearestNeighborOptimization(waypoints, constraints);
    }
  }

  private parseVROOMResponse(
    data: any,
    originalWaypoints: Waypoint[]
  ): OptimizationResult {
    const route = data.routes[0];
    const orderedIndices = route.steps
      .filter((s: any) => s.type === 'job')
      .map((s: any) => s.job);

    const orderedWaypoints = orderedIndices.map((i: number) => originalWaypoints[i]);

    return {
      orderedWaypoints,
      totalDistance: data.summary.distance,
      totalDuration: data.summary.duration,
      estimatedCost: this.estimateCosts(data.summary.distance, data.summary.duration),
      unassigned: data.unassigned?.map((u: any) => u.id),
    };
  }

  private nearestNeighborOptimization(
    waypoints: Waypoint[],
    constraints?: OptimizationConstraints
  ): OptimizationResult {
    const remaining = [...waypoints];
    const ordered: Waypoint[] = [];

    // Start from first waypoint or specified start
    let current = remaining.shift()!;
    ordered.push(current);

    while (remaining.length > 0) {
      // Find nearest unvisited waypoint
      let nearestIndex = 0;
      let nearestDist = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const dist = this.haversineDistance(
          current.coordinate,
          remaining[i].coordinate
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIndex = i;
        }
      }

      current = remaining.splice(nearestIndex, 1)[0];
      ordered.push(current);
    }

    // Estimate total distance/duration
    let totalDistance = 0;
    for (let i = 0; i < ordered.length - 1; i++) {
      totalDistance += this.haversineDistance(
        ordered[i].coordinate,
        ordered[i + 1].coordinate
      );
    }

    // Rough duration estimate: 50 km/h average
    const totalDuration = (totalDistance / 50000) * 3600;

    return {
      orderedWaypoints: ordered,
      totalDistance,
      totalDuration,
      estimatedCost: this.estimateCosts(totalDistance, totalDuration),
    };
  }

  private getTimeWindowForWaypoint(
    index: number,
    timeWindows?: TimeWindow[]
  ): number[][] | undefined {
    const tw = timeWindows?.find((t) => t.waypointIndex === index);
    if (!tw) return undefined;

    return [[
      Math.floor(tw.start.getTime() / 1000),
      Math.floor(tw.end.getTime() / 1000),
    ]];
  }

  private haversineDistance(coord1: Coordinate, coord2: Coordinate): number {
    const R = 6371000; // Earth's radius in meters
    const lat1 = (coord1.lat * Math.PI) / 180;
    const lat2 = (coord2.lat * Math.PI) / 180;
    const deltaLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const deltaLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export default OptimizationService;
