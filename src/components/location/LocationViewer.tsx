"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { LocationMap } from "./LocationMap"
import type { LocationData, LocationShare } from "@/lib/location/locationStorage"
import { LocationStorageService } from "@/lib/location/locationStorage"
import { useAuth } from "@/context/AuthContext"

interface LocationViewerProps {
  shareToken: string
}

export const LocationViewer: React.FC<LocationViewerProps> = ({ shareToken }) => {
  const { fileSystem } = useAuth()
  const [location, setLocation] = useState<LocationData | null>(null)
  const [share, setShare] = useState<LocationShare | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSharedLocation = async () => {
      if (!fileSystem) {
        setError("File system not available")
        setLoading(false)
        return
      }

      try {
        const storageService = new LocationStorageService(fileSystem)
        await storageService.initialize()

        // Get share by token
        const shareData = await storageService.getShareByToken(shareToken)
        if (!shareData) {
          setError("Share not found or expired")
          setLoading(false)
          return
        }

        // Check if share is expired
        if (shareData.expiresAt && shareData.expiresAt < Date.now()) {
          setError("This share has expired")
          setLoading(false)
          return
        }

        // Check if max views reached
        if (shareData.maxViews && shareData.viewCount >= shareData.maxViews) {
          setError("This share has reached its maximum view limit")
          setLoading(false)
          return
        }

        // Get location data
        const locationData = await storageService.getLocation(shareData.locationId)
        if (!locationData) {
          setError("Location data not found")
          setLoading(false)
          return
        }

        setShare(shareData)
        setLocation(locationData)

        // Increment view count
        await storageService.incrementShareViews(shareData.id)

        setLoading(false)
      } catch (err) {
        console.error("Error loading shared location:", err)
        setError("Failed to load shared location")
        setLoading(false)
      }
    }

    loadSharedLocation()
  }, [shareToken, fileSystem])

  if (loading) {
    return (
      <div className="location-viewer flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" />
          <p className="text-sm text-muted-foreground">Loading shared location...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="location-viewer flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">📍</div>
          <h2 className="text-xl font-semibold mb-2">Unable to Load Location</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!location || !share) {
    return null
  }

  return (
    <div className="location-viewer max-w-4xl mx-auto p-6">
      <div className="viewer-header mb-6">
        <h1 className="text-3xl font-bold text-balance">Shared Location</h1>
        <p className="text-sm text-muted-foreground mt-2">Someone has shared their location with you</p>
      </div>

      <div className="viewer-content space-y-6">
        {/* Map Display */}
        <LocationMap location={location} precision={share.precision} showAccuracy={true} height="500px" />

        {/* Share Info */}
        <div className="share-info bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="info-row flex justify-between text-sm">
            <span className="text-muted-foreground">Precision Level:</span>
            <span className="font-medium capitalize">{share.precision}</span>
          </div>
          <div className="info-row flex justify-between text-sm">
            <span className="text-muted-foreground">Views:</span>
            <span className="font-medium">
              {share.viewCount} {share.maxViews ? `/ ${share.maxViews}` : ""}
            </span>
          </div>
          {share.expiresAt && (
            <div className="info-row flex justify-between text-sm">
              <span className="text-muted-foreground">Expires:</span>
              <span className="font-medium">{new Date(share.expiresAt).toLocaleString()}</span>
            </div>
          )}
          <div className="info-row flex justify-between text-sm">
            <span className="text-muted-foreground">Shared:</span>
            <span className="font-medium">{new Date(share.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="privacy-notice bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">
            This location is shared securely and will expire based on the sender's privacy settings. The location data
            is stored in a decentralized filesystem and is only accessible via this unique link.
          </p>
        </div>
      </div>
    </div>
  )
}


























