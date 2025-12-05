/**
 * Map Layers - Reusable overlay modules for MapLibre GL JS
 *
 * These layers can be added to any MapLibre map instance and are designed
 * to work with GeoJSON data synced via CRDT (Automerge).
 */

export { GPSCollaborationLayer } from './GPSCollaborationLayer';
export type { GPSUser, GPSLayerOptions } from './GPSCollaborationLayer';
