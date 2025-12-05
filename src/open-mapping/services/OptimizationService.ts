/**
 * OptimizationService - Route optimization using VROOM
 */

import type { Waypoint, Coordinate, OptimizationServiceConfig } from '../types';

export interface OptimizationResult {
  orderedWaypoints: Waypoint[];
  totalDistance: number;
  totalDuration: number;
  estimatedCost: { fuel: number; time: number; total: number; currency: string };
}

export interface CostParameters {
  fuelPricePerLiter: number;
  fuelConsumptionPer100km: number;
  valueOfTimePerHour: number;
  currency: string;
}

const DEFAULT_COST_PARAMS: CostParameters = { fuelPricePerLiter: 1.5, fuelConsumptionPer100km: 8, valueOfTimePerHour: 20, currency: 'EUR' };

export class OptimizationService {
  private config: OptimizationServiceConfig;
  private costParams: CostParameters;

  constructor(config: OptimizationServiceConfig, costParams = DEFAULT_COST_PARAMS) {
    this.config = config;
    this.costParams = costParams;
  }

  async optimizeRoute(waypoints: Waypoint[]): Promise<OptimizationResult> {
    if (waypoints.length <= 2) return { orderedWaypoints: waypoints, totalDistance: 0, totalDuration: 0, estimatedCost: { fuel: 0, time: 0, total: 0, currency: this.costParams.currency } };

    if (this.config.provider === 'vroom') {
      return this.optimizeWithVROOM(waypoints);
    }
    return this.nearestNeighbor(waypoints);
  }

  estimateCosts(distance: number, duration: number) {
    const km = distance / 1000, hours = duration / 3600;
    const fuel = (km / 100) * this.costParams.fuelConsumptionPer100km * this.costParams.fuelPricePerLiter;
    const time = hours * this.costParams.valueOfTimePerHour;
    return { fuel: Math.round(fuel * 100) / 100, time: Math.round(time * 100) / 100, total: Math.round((fuel + time) * 100) / 100, currency: this.costParams.currency };
  }

  private async optimizeWithVROOM(waypoints: Waypoint[]): Promise<OptimizationResult> {
    const jobs = waypoints.map((wp, i) => ({ id: i, location: [wp.coordinate.lng, wp.coordinate.lat] }));
    const vehicles = [{ id: 0, start: [waypoints[0].coordinate.lng, waypoints[0].coordinate.lat] }];
    try {
      const res = await fetch(this.config.baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobs, vehicles }) });
      const data = await res.json();
      if (data.code !== 0) throw new Error(data.error);
      const indices = data.routes[0].steps.filter((s: any) => s.type === 'job').map((s: any) => s.job);
      return { orderedWaypoints: indices.map((i: number) => waypoints[i]), totalDistance: data.summary.distance, totalDuration: data.summary.duration, estimatedCost: this.estimateCosts(data.summary.distance, data.summary.duration) };
    } catch { return this.nearestNeighbor(waypoints); }
  }

  private nearestNeighbor(waypoints: Waypoint[]): OptimizationResult {
    const remaining = [...waypoints], ordered: Waypoint[] = [];
    let current = remaining.shift()!;
    ordered.push(current);
    while (remaining.length) {
      let nearest = 0, minDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = this.haversine(current.coordinate, remaining[i].coordinate);
        if (d < minDist) { minDist = d; nearest = i; }
      }
      current = remaining.splice(nearest, 1)[0];
      ordered.push(current);
    }
    let dist = 0;
    for (let i = 0; i < ordered.length - 1; i++) dist += this.haversine(ordered[i].coordinate, ordered[i + 1].coordinate);
    const dur = (dist / 50000) * 3600;
    return { orderedWaypoints: ordered, totalDistance: dist, totalDuration: dur, estimatedCost: this.estimateCosts(dist, dur) };
  }

  private haversine(a: Coordinate, b: Coordinate): number {
    const R = 6371000, lat1 = (a.lat * Math.PI) / 180, lat2 = (b.lat * Math.PI) / 180;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
}

export default OptimizationService;
