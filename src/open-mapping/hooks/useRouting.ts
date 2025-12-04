/**
 * useRouting - Hook for route calculation and management
 *
 * Provides:
 * - Route calculation between waypoints
 * - Multi-route comparison
 * - Route optimization (reorder waypoints)
 * - Isochrone calculation
 */

import { useState, useCallback } from 'react';
import type {
  Waypoint,
  Route,
  RoutingOptions,
  RoutingServiceConfig,
  Coordinate,
} from '../types';
import { RoutingService } from '../services/RoutingService';

interface UseRoutingOptions {
  config: RoutingServiceConfig;
  onRouteCalculated?: (route: Route) => void;
  onError?: (error: Error) => void;
}

interface UseRoutingReturn {
  routes: Route[];
  isCalculating: boolean;
  error: Error | null;
  calculateRoute: (waypoints: Waypoint[], options?: Partial<RoutingOptions>) => Promise<Route | null>;
  calculateAlternatives: (waypoints: Waypoint[], count?: number) => Promise<Route[]>;
  optimizeOrder: (waypoints: Waypoint[]) => Promise<Waypoint[]>;
  calculateIsochrone: (center: Coordinate, minutes: number[]) => Promise<GeoJSON.FeatureCollection>;
  clearRoutes: () => void;
}

export function useRouting({
  config,
  onRouteCalculated,
  onError,
}: UseRoutingOptions): UseRoutingReturn {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = new RoutingService(config);

  const calculateRoute = useCallback(async (
    waypoints: Waypoint[],
    options?: Partial<RoutingOptions>
  ): Promise<Route | null> => {
    if (waypoints.length < 2) {
      setError(new Error('At least 2 waypoints required'));
      return null;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const route = await service.calculateRoute(waypoints, options);
      setRoutes((prev) => [...prev, route]);
      onRouteCalculated?.(route);
      return route;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Route calculation failed');
      setError(error);
      onError?.(error);
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [service, onRouteCalculated, onError]);

  const calculateAlternatives = useCallback(async (
    waypoints: Waypoint[],
    count = 3
  ): Promise<Route[]> => {
    setIsCalculating(true);
    setError(null);

    try {
      const alternatives = await service.calculateAlternatives(waypoints, count);
      setRoutes(alternatives);
      return alternatives;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Alternative routes calculation failed');
      setError(error);
      onError?.(error);
      return [];
    } finally {
      setIsCalculating(false);
    }
  }, [service, onError]);

  const optimizeOrder = useCallback(async (waypoints: Waypoint[]): Promise<Waypoint[]> => {
    setIsCalculating(true);
    setError(null);

    try {
      return await service.optimizeWaypointOrder(waypoints);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Waypoint optimization failed');
      setError(error);
      onError?.(error);
      return waypoints;
    } finally {
      setIsCalculating(false);
    }
  }, [service, onError]);

  const calculateIsochrone = useCallback(async (
    center: Coordinate,
    minutes: number[]
  ): Promise<GeoJSON.FeatureCollection> => {
    setIsCalculating(true);
    setError(null);

    try {
      return await service.calculateIsochrone(center, minutes);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Isochrone calculation failed');
      setError(error);
      onError?.(error);
      return { type: 'FeatureCollection', features: [] };
    } finally {
      setIsCalculating(false);
    }
  }, [service, onError]);

  const clearRoutes = useCallback(() => {
    setRoutes([]);
    setError(null);
  }, []);

  return {
    routes,
    isCalculating,
    error,
    calculateRoute,
    calculateAlternatives,
    optimizeOrder,
    calculateIsochrone,
    clearRoutes,
  };
}

export default useRouting;
