"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { LocationStorageService, type LocationData } from "@/lib/location/locationStorage"
import type { GeolocationPosition } from "@/lib/location/types"

interface LocationCaptureProps {
  onLocationCaptured?: (location: LocationData) => void
  onError?: (error: string) => void
}

export const LocationCapture: React.FC<LocationCaptureProps> = ({ onLocationCaptured, onError }) => {
  const { session, fileSystem } = useAuth()
  const [isCapturing, setIsCapturing] = useState(false)
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied">("prompt")
  const [currentLocation, setCurrentLocation] = useState<GeolocationPosition | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Show loading state while auth is initializing
  if (session.loading) {
    return (
      <div className="location-capture-loading flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <div className="text-2xl mb-2 animate-spin">⏳</div>
          <p className="text-sm text-muted-foreground">Loading authentication...</p>
        </div>
      </div>
    )
  }

  // Check permission status on mount
  useEffect(() => {
    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        setPermissionState(result.state as "prompt" | "granted" | "denied")

        result.addEventListener("change", () => {
          setPermissionState(result.state as "prompt" | "granted" | "denied")
        })
      })
    }
  }, [])

  const captureLocation = async () => {
    // Don't proceed if still loading
    if (session.loading) {
      return
    }

    if (!session.authed) {
      const errorMsg = "You must be logged in to share your location. Please log in and try again."
      setError(errorMsg)
      onError?.(errorMsg)
      return
    }

    if (!fileSystem) {
      const errorMsg = "File system not available. Please refresh the page and try again."
      setError(errorMsg)
      onError?.(errorMsg)
      return
    }

    setIsCapturing(true)
    setError(null)

    try {
      // Request geolocation
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos as GeolocationPosition),
          (err) => reject(err),
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          },
        )
      })

      setCurrentLocation(position)

      // Create location data
      const locationData: LocationData = {
        id: crypto.randomUUID(),
        userId: session.username,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        expiresAt: null, // Will be set when creating a share
        precision: "exact",
      }

      // Save to filesystem
      const storageService = new LocationStorageService(fileSystem)
      await storageService.initialize()
      await storageService.saveLocation(locationData)

      onLocationCaptured?.(locationData)
    } catch (err: any) {
      let errorMsg = "Failed to capture location"

      if (err.code === 1) {
        errorMsg = "Location permission denied. Please enable location access in your browser settings."
        setPermissionState("denied")
      } else if (err.code === 2) {
        errorMsg = "Location unavailable. Please check your device settings."
      } else if (err.code === 3) {
        errorMsg = "Location request timed out. Please try again."
      }

      setError(errorMsg)
      onError?.(errorMsg)
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <div className="location-capture">
      <div className="capture-header">
        <h2 className="text-2xl font-semibold text-balance">Share Your Location</h2>
        <p className="text-sm text-muted-foreground mt-2">Securely share your current location with others</p>
      </div>

      {/* Permission status */}
      {permissionState === "denied" && (
        <div className="permission-denied bg-destructive/10 border border-destructive/20 rounded-lg p-4 mt-4">
          <p className="text-sm text-destructive">
            Location access is blocked. Please enable it in your browser settings to continue.
          </p>
        </div>
      )}

      {/* Current location display */}
      {currentLocation && (
        <div className="current-location bg-muted/50 rounded-lg p-4 mt-4">
          <h3 className="text-sm font-medium mb-2">Current Location</h3>
          <div className="location-details text-xs space-y-1">
            <p>
              <span className="text-muted-foreground">Latitude:</span> {currentLocation.coords.latitude.toFixed(6)}
            </p>
            <p>
              <span className="text-muted-foreground">Longitude:</span> {currentLocation.coords.longitude.toFixed(6)}
            </p>
            <p>
              <span className="text-muted-foreground">Accuracy:</span> ±{Math.round(currentLocation.coords.accuracy)}m
            </p>
            <p className="text-muted-foreground">Captured {new Date(currentLocation.timestamp).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="error-message bg-destructive/10 border border-destructive/20 rounded-lg p-4 mt-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Capture button */}
      <button
        onClick={captureLocation}
        disabled={isCapturing || permissionState === "denied" || !session.authed}
        className="capture-button w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-6 py-3 font-medium transition-colors"
      >
        {isCapturing ? (
          <span className="flex items-center justify-center gap-2">
            <span className="spinner" />
            Capturing Location...
          </span>
        ) : (
          "Capture My Location"
        )}
      </button>

      {!session.authed && (
        <p className="text-xs text-muted-foreground text-center mt-3">Please log in to share your location</p>
      )}
    </div>
  )
}


