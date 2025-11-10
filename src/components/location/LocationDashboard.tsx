"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { LocationStorageService, type LocationData, type LocationShare } from "@/lib/location/locationStorage"
import { LocationMap } from "./LocationMap"

interface ShareWithLocation {
  share: LocationShare
  location: LocationData
}

export const LocationDashboard: React.FC = () => {
  const { session, fileSystem } = useAuth()
  const [shares, setShares] = useState<ShareWithLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShare, setSelectedShare] = useState<ShareWithLocation | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadShares = async () => {
    if (!fileSystem) {
      setError("File system not available")
      setLoading(false)
      return
    }

    try {
      const storageService = new LocationStorageService(fileSystem)
      await storageService.initialize()

      // Get all shares
      const allShares = await storageService.getAllShares()

      // Get locations for each share
      const sharesWithLocations: ShareWithLocation[] = []

      for (const share of allShares) {
        const location = await storageService.getLocation(share.locationId)
        if (location) {
          sharesWithLocations.push({ share, location })
        }
      }

      // Sort by creation date (newest first)
      sharesWithLocations.sort((a, b) => b.share.createdAt - a.share.createdAt)

      setShares(sharesWithLocations)
      setLoading(false)
    } catch (err) {
      console.error("Error loading shares:", err)
      setError("Failed to load location shares")
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session.authed && fileSystem) {
      loadShares()
    }
  }, [session.authed, fileSystem])

  const handleCopyLink = async (shareToken: string) => {
    const baseUrl = window.location.origin
    const link = `${baseUrl}/location/${shareToken}`

    try {
      await navigator.clipboard.writeText(link)
      alert("Link copied to clipboard!")
    } catch (err) {
      console.error("Failed to copy link:", err)
      alert("Failed to copy link")
    }
  }

  const isExpired = (share: LocationShare): boolean => {
    return share.expiresAt ? share.expiresAt < Date.now() : false
  }

  const isMaxViewsReached = (share: LocationShare): boolean => {
    return share.maxViews ? share.viewCount >= share.maxViews : false
  }

  const getShareStatus = (share: LocationShare): { label: string; color: string } => {
    if (isExpired(share)) {
      return { label: "Expired", color: "text-destructive" }
    }
    if (isMaxViewsReached(share)) {
      return { label: "Max Views Reached", color: "text-destructive" }
    }
    return { label: "Active", color: "text-green-600" }
  }

  if (!session.authed) {
    return (
      <div className="location-dashboard-auth flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-sm text-muted-foreground">Please log in to view your location shares</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="location-dashboard flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" />
          <p className="text-sm text-muted-foreground">Loading your shares...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="location-dashboard flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Error Loading Dashboard</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={loadShares}
            className="mt-4 px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="location-dashboard max-w-6xl mx-auto p-6">
      <div className="dashboard-header mb-8">
        <h1 className="text-3xl font-bold text-balance">Location Shares</h1>
        <p className="text-sm text-muted-foreground mt-2">Manage your shared locations and privacy settings</p>
      </div>

      {shares.length === 0 ? (
        <div className="empty-state flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="text-6xl mb-4">📍</div>
          <h2 className="text-xl font-semibold mb-2">No Location Shares Yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            You haven't shared any locations yet. Create your first share to get started.
          </p>
          <a
            href="/share-location"
            className="px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            Share Your Location
          </a>
        </div>
      ) : (
        <div className="dashboard-content">
          {/* Stats Overview */}
          <div className="stats-grid grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="stat-card bg-muted/50 rounded-lg p-4 border border-border">
              <div className="stat-label text-sm text-muted-foreground mb-1">Total Shares</div>
              <div className="stat-value text-3xl font-bold">{shares.length}</div>
            </div>
            <div className="stat-card bg-muted/50 rounded-lg p-4 border border-border">
              <div className="stat-label text-sm text-muted-foreground mb-1">Active Shares</div>
              <div className="stat-value text-3xl font-bold text-green-600">
                {shares.filter((s) => !isExpired(s.share) && !isMaxViewsReached(s.share)).length}
              </div>
            </div>
            <div className="stat-card bg-muted/50 rounded-lg p-4 border border-border">
              <div className="stat-label text-sm text-muted-foreground mb-1">Total Views</div>
              <div className="stat-value text-3xl font-bold">
                {shares.reduce((sum, s) => sum + s.share.viewCount, 0)}
              </div>
            </div>
          </div>

          {/* Shares List */}
          <div className="shares-list space-y-4">
            {shares.map(({ share, location }) => {
              const status = getShareStatus(share)
              const isSelected = selectedShare?.share.id === share.id

              return (
                <div
                  key={share.id}
                  className={`share-card bg-background rounded-lg border-2 transition-colors ${
                    isSelected ? "border-primary" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="share-card-header p-4 flex items-start justify-between gap-4">
                    <div className="share-info flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">Location Share</h3>
                        <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                      </div>
                      <div className="share-meta text-xs text-muted-foreground space-y-1">
                        <p>Created: {new Date(share.createdAt).toLocaleString()}</p>
                        {share.expiresAt && <p>Expires: {new Date(share.expiresAt).toLocaleString()}</p>}
                        <p>
                          Views: {share.viewCount}
                          {share.maxViews && ` / ${share.maxViews}`}
                        </p>
                        <p>
                          Precision: <span className="capitalize">{share.precision}</span>
                        </p>
                      </div>
                    </div>
                    <div className="share-actions flex gap-2">
                      <button
                        onClick={() => handleCopyLink(share.shareToken)}
                        disabled={isExpired(share) || isMaxViewsReached(share)}
                        className="px-4 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                      >
                        Copy Link
                      </button>
                      <button
                        onClick={() => setSelectedShare(isSelected ? null : { share, location })}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm"
                      >
                        {isSelected ? "Hide" : "View"} Map
                      </button>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="share-card-body p-4 pt-0 border-t border-border mt-4">
                      <LocationMap location={location} precision={share.precision} showAccuracy={true} height="300px" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}






























