/**
 * RoutingService - Abstraction layer for routing providers
 *
 * Supports multiple backends:
 * - OSRM (Open Source Routing Machine)
 * - Valhalla
 * - GraphHopper
 * - OpenRouteService
 *
 * All providers expose a unified API for route calculation.
 */

import type {
  Waypoint,
  Route,
  RoutingOptions,
  RoutingServiceConfig,
  RouteSummary,
  RouteLeg,
  Coordinate,
  RoutingProfile,
} from '../types';

export class RoutingService {
  private config: RoutingServiceConfig;

  constructor(config: RoutingServiceConfig) {
    this.config = config;
  }

  /**
   * Calculate a route between waypoints
   */
  async calculateRoute(
    waypoints: Waypoint[],
    options?: Partial<RoutingOptions>
  ): Promise<Route> {
    const profile = options?.profile ?? 'car';
    const coordinates = waypoints.map((w) => w.coordinate);

    switch (this.config.provider) {
      case 'osrm':
        return this.calculateOSRMRoute(coordinates, profile, options);
      case 'valhalla':
        return this.calculateValhallaRoute(coordinates, profile, options);
      case 'graphhopper':
        return this.calculateGraphHopperRoute(coordinates, profile, options);
      case 'openrouteservice':
        return this.calculateORSRoute(coordinates, profile, options);
      default:
        throw new Error(`Unsupported routing provider: ${this.config.provider}`);
    }
  }

  /**
   * Calculate multiple alternative routes
   */
  async calculateAlternatives(
    waypoints: Waypoint[],
    count: number = 3
  ): Promise<Route[]> {
    // TODO: Implement alternatives calculation
    // OSRM supports alternatives=true parameter
    // Valhalla supports alternates parameter
    const mainRoute = await this.calculateRoute(waypoints, { alternatives: count });
    return mainRoute.alternatives
      ? [mainRoute, ...mainRoute.alternatives]
      : [mainRoute];
  }

  /**
   * Optimize waypoint ordering (traveling salesman)
   */
  async optimizeWaypointOrder(waypoints: Waypoint[]): Promise<Waypoint[]> {
    if (waypoints.length <= 2) return waypoints;

    // Use OSRM trip endpoint or VROOM for optimization
    const coordinates = waypoints.map((w) => `${w.coordinate.lng},${w.coordinate.lat}`).join(';');
    const url = `${this.config.baseUrl}/trip/v1/driving/${coordinates}?roundtrip=false&source=first&destination=last`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== 'Ok' || !data.trips?.[0]?.legs) {
        return waypoints;
      }

      // Reorder waypoints based on optimization result
      const optimizedIndices = data.waypoints.map((wp: { waypoint_index: number }) => wp.waypoint_index);
      return optimizedIndices.map((index: number) => waypoints[index]);
    } catch (error) {
      console.error('Waypoint optimization failed:', error);
      return waypoints;
    }
  }

  /**
   * Calculate isochrone (reachable area in given time)
   */
  async calculateIsochrone(
    center: Coordinate,
    minutes: number[]
  ): Promise<GeoJSON.FeatureCollection> {
    // Valhalla and ORS support isochrones natively
    if (this.config.provider === 'valhalla') {
      return this.calculateValhallaIsochrone(center, minutes);
    }
    if (this.config.provider === 'openrouteservice') {
      return this.calculateORSIsochrone(center, minutes);
    }

    // For OSRM/GraphHopper, would need to approximate with sampling
    console.warn('Isochrone not supported for provider:', this.config.provider);
    return { type: 'FeatureCollection', features: [] };
  }

  // =========================================================================
  // Private Provider-Specific Methods
  // =========================================================================

  private async calculateOSRMRoute(
    coordinates: Coordinate[],
    profile: RoutingProfile,
    options?: Partial<RoutingOptions>
  ): Promise<Route> {
    const coordString = coordinates
      .map((c) => `${c.lng},${c.lat}`)
      .join(';');

    const osrmProfile = this.mapProfileToOSRM(profile);
    const url = new URL(`${this.config.baseUrl}/route/v1/${osrmProfile}/${coordString}`);
    url.searchParams.set('overview', 'full');
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('steps', 'true');
    if (options?.alternatives) {
      url.searchParams.set('alternatives', 'true');
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.code !== 'Ok') {
      throw new Error(`OSRM error: ${data.message || data.code}`);
    }

    return this.parseOSRMResponse(data, profile);
  }

  private async calculateValhallaRoute(
    coordinates: Coordinate[],
    profile: RoutingProfile,
    options?: Partial<RoutingOptions>
  ): Promise<Route> {
    const locations = coordinates.map((c) => ({
      lat: c.lat,
      lon: c.lng,
    }));

    const costing = this.mapProfileToValhalla(profile);
    const body = {
      locations,
      costing,
      directions_options: {
        units: 'kilometers',
      },
      alternates: options?.alternatives ?? 0,
    };

    const response = await fetch(`${this.config.baseUrl}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Valhalla error: ${data.error}`);
    }

    return this.parseValhallaResponse(data, profile);
  }

  private async calculateGraphHopperRoute(
    coordinates: Coordinate[],
    profile: RoutingProfile,
    options?: Partial<RoutingOptions>
  ): Promise<Route> {
    const url = new URL(`${this.config.baseUrl}/route`);
    coordinates.forEach((c) => {
      url.searchParams.append('point', `${c.lat},${c.lng}`);
    });
    url.searchParams.set('profile', this.mapProfileToGraphHopper(profile));
    url.searchParams.set('points_encoded', 'false');
    url.searchParams.set('instructions', 'true');
    if (options?.alternatives) {
      url.searchParams.set('algorithm', 'alternative_route');
      url.searchParams.set('alternative_route.max_paths', String(options.alternatives));
    }
    if (this.config.apiKey) {
      url.searchParams.set('key', this.config.apiKey);
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.message) {
      throw new Error(`GraphHopper error: ${data.message}`);
    }

    return this.parseGraphHopperResponse(data, profile);
  }

  private async calculateORSRoute(
    coordinates: Coordinate[],
    profile: RoutingProfile,
    options?: Partial<RoutingOptions>
  ): Promise<Route> {
    const orsProfile = this.mapProfileToORS(profile);
    const body = {
      coordinates: coordinates.map((c) => [c.lng, c.lat]),
      alternative_routes: options?.alternatives
        ? { target_count: options.alternatives }
        : undefined,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = this.config.apiKey;
    }

    const response = await fetch(
      `${this.config.baseUrl}/v2/directions/${orsProfile}/geojson`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(`ORS error: ${data.error.message}`);
    }

    return this.parseORSResponse(data, profile);
  }

  private async calculateValhallaIsochrone(
    center: Coordinate,
    minutes: number[]
  ): Promise<GeoJSON.FeatureCollection> {
    const body = {
      locations: [{ lat: center.lat, lon: center.lng }],
      costing: 'auto',
      contours: minutes.map((m) => ({ time: m })),
      polygons: true,
    };

    const response = await fetch(`${this.config.baseUrl}/isochrone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return response.json();
  }

  private async calculateORSIsochrone(
    center: Coordinate,
    minutes: number[]
  ): Promise<GeoJSON.FeatureCollection> {
    const body = {
      locations: [[center.lng, center.lat]],
      range: minutes.map((m) => m * 60), // ORS uses seconds
      range_type: 'time',
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = this.config.apiKey;
    }

    const response = await fetch(`${this.config.baseUrl}/v2/isochrones/driving-car`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    return response.json();
  }

  // =========================================================================
  // Profile Mapping
  // =========================================================================

  private mapProfileToOSRM(profile: RoutingProfile): string {
    const mapping: Partial<Record<RoutingProfile, string>> = {
      car: 'driving',
      bicycle: 'cycling',
      foot: 'walking',
      hiking: 'walking',
    };
    return mapping[profile] ?? 'driving';
  }

  private mapProfileToValhalla(profile: RoutingProfile): string {
    const mapping: Partial<Record<RoutingProfile, string>> = {
      car: 'auto',
      truck: 'truck',
      motorcycle: 'motorcycle',
      bicycle: 'bicycle',
      mountain_bike: 'bicycle',
      road_bike: 'bicycle',
      foot: 'pedestrian',
      hiking: 'pedestrian',
      transit: 'multimodal',
    };
    return mapping[profile] ?? 'auto';
  }

  private mapProfileToGraphHopper(profile: RoutingProfile): string {
    const mapping: Partial<Record<RoutingProfile, string>> = {
      car: 'car',
      truck: 'truck',
      motorcycle: 'motorcycle',
      bicycle: 'bike',
      mountain_bike: 'mtb',
      road_bike: 'racingbike',
      foot: 'foot',
      hiking: 'hike',
    };
    return mapping[profile] ?? 'car';
  }

  private mapProfileToORS(profile: RoutingProfile): string {
    const mapping: Partial<Record<RoutingProfile, string>> = {
      car: 'driving-car',
      truck: 'driving-hgv',
      bicycle: 'cycling-regular',
      mountain_bike: 'cycling-mountain',
      road_bike: 'cycling-road',
      foot: 'foot-walking',
      hiking: 'foot-hiking',
      wheelchair: 'wheelchair',
    };
    return mapping[profile] ?? 'driving-car';
  }

  // =========================================================================
  // Response Parsing
  // =========================================================================

  private parseOSRMResponse(data: any, profile: RoutingProfile): Route {
    const route = data.routes[0];
    const id = `route-${Date.now()}`;

    return {
      id,
      waypoints: [], // Populated by caller
      geometry: route.geometry,
      profile,
      summary: {
        distance: route.distance,
        duration: route.duration,
      },
      legs: route.legs.map((leg: any, index: number) => ({
        startWaypoint: `waypoint-${index}`,
        endWaypoint: `waypoint-${index + 1}`,
        distance: leg.distance,
        duration: leg.duration,
        geometry: { type: 'LineString', coordinates: [] }, // Would need to extract from steps
        steps: leg.steps?.map((step: any) => ({
          instruction: step.maneuver?.instruction ?? '',
          distance: step.distance,
          duration: step.duration,
          geometry: step.geometry,
          maneuver: {
            type: step.maneuver?.type ?? 'continue',
            modifier: step.maneuver?.modifier,
            bearingBefore: step.maneuver?.bearing_before ?? 0,
            bearingAfter: step.maneuver?.bearing_after ?? 0,
            location: {
              lat: step.maneuver?.location?.[1] ?? 0,
              lng: step.maneuver?.location?.[0] ?? 0,
            },
          },
        })),
      })),
      alternatives: data.routes.slice(1).map((alt: any) =>
        this.parseOSRMResponse({ routes: [alt] }, profile)
      ),
    };
  }

  private parseValhallaResponse(data: any, profile: RoutingProfile): Route {
    const trip = data.trip;
    const id = `route-${Date.now()}`;

    return {
      id,
      waypoints: [],
      geometry: {
        type: 'LineString',
        coordinates: this.decodeValhallaPolyline(trip.legs[0]?.shape ?? ''),
      },
      profile,
      summary: {
        distance: trip.summary.length * 1000, // km to m
        duration: trip.summary.time,
      },
      legs: trip.legs.map((leg: any, index: number) => ({
        startWaypoint: `waypoint-${index}`,
        endWaypoint: `waypoint-${index + 1}`,
        distance: leg.summary.length * 1000,
        duration: leg.summary.time,
        geometry: {
          type: 'LineString',
          coordinates: this.decodeValhallaPolyline(leg.shape ?? ''),
        },
      })),
    };
  }

  private parseGraphHopperResponse(data: any, profile: RoutingProfile): Route {
    const path = data.paths[0];
    const id = `route-${Date.now()}`;

    return {
      id,
      waypoints: [],
      geometry: path.points,
      profile,
      summary: {
        distance: path.distance,
        duration: path.time / 1000, // ms to s
        ascent: path.ascend,
        descent: path.descend,
      },
      legs: [], // GraphHopper doesn't split by waypoint in the same way
      alternatives: data.paths.slice(1).map((alt: any) =>
        this.parseGraphHopperResponse({ paths: [alt] }, profile)
      ),
    };
  }

  private parseORSResponse(data: any, profile: RoutingProfile): Route {
    const feature = data.features[0];
    const id = `route-${Date.now()}`;

    return {
      id,
      waypoints: [],
      geometry: feature.geometry,
      profile,
      summary: {
        distance: feature.properties.summary.distance,
        duration: feature.properties.summary.duration,
      },
      legs: feature.properties.segments.map((seg: any, index: number) => ({
        startWaypoint: `waypoint-${index}`,
        endWaypoint: `waypoint-${index + 1}`,
        distance: seg.distance,
        duration: seg.duration,
        geometry: { type: 'LineString', coordinates: [] },
        steps: seg.steps,
      })),
    };
  }

  private decodeValhallaPolyline(encoded: string): [number, number][] {
    // Valhalla uses Google's polyline encoding
    const coordinates: [number, number][] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte: number;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      coordinates.push([lng / 1e6, lat / 1e6]);
    }

    return coordinates;
  }
}

export default RoutingService;
