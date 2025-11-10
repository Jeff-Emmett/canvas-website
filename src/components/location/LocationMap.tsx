"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import type { LocationData } from "@/lib/location/locationStorage"
import { obfuscateLocation } from "@/lib/location/locationStorage"
import type { PrecisionLevel } from "@/lib/location/types"

// Leaflet types
interface LeafletMap {
  setView: (coords: [number, number], zoom: number) => void
  remove: () => void
}

interface LeafletMarker {
  addTo: (map: LeafletMap) => LeafletMarker
  bindPopup: (content: string) => LeafletMarker
}

interface LeafletCircle {
  addTo: (map: LeafletMap) => LeafletCircle
}

interface LeafletTileLayer {
  addTo: (map: LeafletMap) => LeafletTileLayer
}

interface Leaflet {
  map: (element: HTMLElement, options?: any) => LeafletMap
  marker: (coords: [number, number], options?: any) => LeafletMarker
  circle: (coords: [number, number], options?: any) => LeafletCircle
  tileLayer: (url: string, options?: any) => LeafletTileLayer
  icon: (options: any) => any
}

declare global {
  interface Window {
    L?: Leaflet
  }
}

interface LocationMapProps {
  location: LocationData
  precision?: PrecisionLevel
  showAccuracy?: boolean
  height?: string
}

export const LocationMap: React.FC<LocationMapProps> = ({
  location,
  precision = "exact",
  showAccuracy = true,
  height = "400px",
}) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<LeafletMap | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Load Leaflet CSS and JS
    const loadLeaflet = async () => {
      try {
        // Load CSS
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement("link")
          link.rel = "stylesheet"
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          link.crossOrigin = ""
          document.head.appendChild(link)
        }

        // Load JS
        if (!window.L) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script")
            script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
            script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
            script.crossOrigin = ""
            script.onload = () => resolve()
            script.onerror = () => reject(new Error("Failed to load Leaflet"))
            document.head.appendChild(script)
          })
        }

        setIsLoading(false)
      } catch (err) {
        setError("Failed to load map library")
        setIsLoading(false)
      }
    }

    loadLeaflet()
  }, [])

  useEffect(() => {
    if (!mapContainer.current || !window.L || isLoading) return

    // Clean up existing map
    if (mapInstance.current) {
      mapInstance.current.remove()
    }

    const L = window.L!

    // Get obfuscated location based on precision
    const { lat, lng, radius } = obfuscateLocation(location.latitude, location.longitude, precision)

    // Create map
    const map = L.map(mapContainer.current, {
      center: [lat, lng],
      zoom: precision === "exact" ? 15 : precision === "street" ? 14 : precision === "neighborhood" ? 12 : 10,
      zoomControl: true,
      attributionControl: true,
    })

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    // Add marker
    const marker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      }),
    }).addTo(map)

    // Add popup with location info
    const popupContent = `
      <div style="font-family: system-ui, sans-serif;">
        <strong>Shared Location</strong><br/>
        <small style="color: #666;">
          Precision: ${precision}<br/>
          ${new Date(location.timestamp).toLocaleString()}
        </small>
      </div>
    `
    marker.bindPopup(popupContent)

    // Add accuracy circle if showing accuracy
    if (showAccuracy && radius > 0) {
      L.circle([lat, lng], {
        radius: radius,
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map)
    }

    mapInstance.current = map

    // Cleanup
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [location, precision, showAccuracy, isLoading])

  if (error) {
    return (
      <div
        className="map-error flex items-center justify-center bg-muted/50 rounded-lg border border-border"
        style={{ height }}
      >
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        className="map-loading flex items-center justify-center bg-muted/50 rounded-lg border border-border"
        style={{ height }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="location-map-wrapper">
      <div
        ref={mapContainer}
        className="location-map rounded-lg border border-border overflow-hidden"
        style={{ height, width: "100%" }}
      />
      <div className="map-info mt-3 text-xs text-muted-foreground">
        <p>
          Showing {precision} location • Last updated {new Date(location.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
}






























