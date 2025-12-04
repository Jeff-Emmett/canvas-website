/**
 * useRouting - Hook for route calculation and management
 */

import { useState, useCallback } from 'react';
import type { Waypoint, Route, RoutingOptions, RoutingServiceConfig, Coordinate } from '../types';
import { RoutingService } from '../services/RoutingService';

interface UseRoutingOptions {
  config: RoutingServiceConfig;
  onRouteCalculated?: (route: Route) => void;
  onError?: (error: Error) => void;
}

export function useRouting({ config, onRouteCalculated, onError }: UseRoutingOptions) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const service = new RoutingService(config);

  const calculateRoute = useCallback(async (waypoints: Waypoint[], options?: Partial<RoutingOptions>) => {
    if (waypoints.length < 2) { setError(new Error('At least 2 waypoints required')); return null; }
    setIsCalculating(true); setError(null);
    try {
      const route = await service.calculateRoute(waypoints, options);
      setRoutes((prev) => [...prev, route]);
      onRouteCalculated?.(route);
      return route;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Route calculation failed');
      setError(error); onError?.(error); return null;
    } finally { setIsCalculating(false); }
  }, [service, onRouteCalculated, onError]);

  const calculateAlternatives = useCallback(async (waypoints: Waypoint[], count = 3) => {
    setIsCalculating(true); setError(null);
    try {
      const alternatives = await service.calculateAlternatives(waypoints, count);
      setRoutes(alternatives);
      return alternatives;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed');
      setError(error); onError?.(error); return [];
    } finally { setIsCalculating(false); }
  }, [service, onError]);

  const optimizeOrder = useCallback(async (waypoints: Waypoint[]) => {
    setIsCalculating(true); setError(null);
    try { return await service.optimizeWaypointOrder(waypoints); }
    catch (err) { const error = err instanceof Error ? err : new Error('Failed'); setError(error); return waypoints; }
    finally { setIsCalculating(false); }
  }, [service]);

  const calculateIsochrone = useCallback(async (center: Coordinate, minutes: number[]) => {
    setIsCalculating(true);
    try { return await service.calculateIsochrone(center, minutes); }
    catch { return { type: 'FeatureCollection' as const, features: [] }; }
    finally { setIsCalculating(false); }
  }, [service]);

  return { routes, isCalculating, error, calculateRoute, calculateAlternatives, optimizeOrder, calculateIsochrone, clearRoutes: () => setRoutes([]) };
}

export default useRouting;
