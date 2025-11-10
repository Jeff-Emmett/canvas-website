/**
 * Location sharing types
 */

export type PrecisionLevel = "exact" | "street" | "neighborhood" | "city";

export interface ShareSettings {
  duration: number | null; // Duration in milliseconds
  maxViews: number | null; // Maximum number of views allowed
  precision: PrecisionLevel; // Precision level for location obfuscation
}

export interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp: number;
}
























