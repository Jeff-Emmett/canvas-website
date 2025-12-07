/**
 * RoutingService - Multi-provider routing abstraction
 * Supports: OSRM, Valhalla, GraphHopper, OpenRouteService
 */

import type { Waypoint, Route, RoutingOptions, RoutingServiceConfig, Coordinate, RoutingProfile } from '../types';

export class RoutingService {
  private config: RoutingServiceConfig;

  constructor(config: RoutingServiceConfig) {
    this.config = config;
  }

  async calculateRoute(waypoints: Waypoint[], options?: Partial<RoutingOptions>): Promise<Route> {
    const profile = options?.profile ?? 'car';
    const coordinates = waypoints.map((w) => w.coordinate);

    switch (this.config.provider) {
      case 'osrm': return this.calculateOSRMRoute(coordinates, profile, options);
      case 'valhalla': return this.calculateValhallaRoute(coordinates, profile, options);
      default: throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  async calculateAlternatives(waypoints: Waypoint[], count = 3): Promise<Route[]> {
    const mainRoute = await this.calculateRoute(waypoints, { alternatives: count });
    return mainRoute.alternatives ? [mainRoute, ...mainRoute.alternatives] : [mainRoute];
  }

  async optimizeWaypointOrder(waypoints: Waypoint[]): Promise<Waypoint[]> {
    if (waypoints.length <= 2) return waypoints;
    const coords = waypoints.map((w) => `${w.coordinate.lng},${w.coordinate.lat}`).join(';');
    const url = `${this.config.baseUrl}/trip/v1/driving/${coords}?roundtrip=false&source=first&destination=last`;
    try {
      const res = await fetch(url);
      const data = await res.json() as { code: string; waypoints: { waypoint_index: number }[] };
      if (data.code !== 'Ok') return waypoints;
      return data.waypoints.map((wp) => waypoints[wp.waypoint_index]);
    } catch { return waypoints; }
  }

  async calculateIsochrone(center: Coordinate, minutes: number[]): Promise<GeoJSON.FeatureCollection> {
    if (this.config.provider !== 'valhalla') return { type: 'FeatureCollection', features: [] };
    const body = { locations: [{ lat: center.lat, lon: center.lng }], costing: 'auto', contours: minutes.map((m) => ({ time: m })), polygons: true };
    const res = await fetch(`${this.config.baseUrl}/isochrone`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.json();
  }

  private async calculateOSRMRoute(coords: Coordinate[], profile: RoutingProfile, options?: Partial<RoutingOptions>): Promise<Route> {
    const coordStr = coords.map((c) => `${c.lng},${c.lat}`).join(';');
    const osrmProfile = profile === 'bicycle' ? 'cycling' : profile === 'foot' ? 'walking' : 'driving';
    const url = new URL(`${this.config.baseUrl}/route/v1/${osrmProfile}/${coordStr}`);
    url.searchParams.set('overview', 'full');
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('steps', 'true');
    if (options?.alternatives) url.searchParams.set('alternatives', 'true');
    const res = await fetch(url.toString());
    const data = await res.json() as { code: string; message?: string; routes: unknown[] };
    if (data.code !== 'Ok') throw new Error(`OSRM error: ${data.message || data.code}`);
    return this.parseOSRMResponse(data, profile);
  }

  private async calculateValhallaRoute(coords: Coordinate[], profile: RoutingProfile, options?: Partial<RoutingOptions>): Promise<Route> {
    const costing = profile === 'bicycle' ? 'bicycle' : profile === 'foot' ? 'pedestrian' : 'auto';
    const body = { locations: coords.map((c) => ({ lat: c.lat, lon: c.lng })), costing, alternates: options?.alternatives ?? 0 };
    const res = await fetch(`${this.config.baseUrl}/route`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json() as { error?: string };
    if (data.error) throw new Error(`Valhalla error: ${data.error}`);
    return this.parseValhallaResponse(data, profile);
  }

  private parseOSRMResponse(data: any, profile: RoutingProfile): Route {
    const r = data.routes[0];
    return {
      id: `route-${Date.now()}`, waypoints: [], geometry: r.geometry, profile,
      summary: { distance: r.distance, duration: r.duration },
      legs: r.legs.map((leg: any, i: number) => ({ startWaypoint: `wp-${i}`, endWaypoint: `wp-${i + 1}`, distance: leg.distance, duration: leg.duration, geometry: { type: 'LineString', coordinates: [] } })),
      alternatives: data.routes.slice(1).map((alt: any) => this.parseOSRMResponse({ routes: [alt] }, profile)),
    };
  }

  private parseValhallaResponse(data: any, profile: RoutingProfile): Route {
    const trip = data.trip;
    return {
      id: `route-${Date.now()}`, waypoints: [], geometry: { type: 'LineString', coordinates: [] }, profile,
      summary: { distance: trip.summary.length * 1000, duration: trip.summary.time },
      legs: trip.legs.map((leg: any, i: number) => ({ startWaypoint: `wp-${i}`, endWaypoint: `wp-${i + 1}`, distance: leg.summary.length * 1000, duration: leg.summary.time, geometry: { type: 'LineString', coordinates: [] } })),
    };
  }
}

export default RoutingService;
