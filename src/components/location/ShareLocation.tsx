"use client"

import React, { useState } from "react"
import { LocationCapture } from "./LocationCapture"
import { ShareSettingsComponent } from "./ShareSettings"
import { LocationMap } from "./LocationMap"
import type { LocationData, LocationShare } from "@/lib/location/locationStorage"
import { LocationStorageService, generateShareToken } from "@/lib/location/locationStorage"
import type { ShareSettings } from "@/lib/location/types"
import { useAuth } from "@/context/AuthContext"

export const ShareLocation: React.FC = () => {
  const { session, fileSystem } = useAuth()
  const [step, setStep] = useState<"capture" | "settings" | "share">("capture")
  const [capturedLocation, setCapturedLocation] = useState<LocationData | null>(null)
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    duration: 24 * 3600000, // 24 hours
    maxViews: null,
    precision: "street",
  })
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [isCreatingShare, setIsCreatingShare] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Show loading state while auth is initializing
  if (session.loading) {
    return (
      <div className="share-location-loading flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4 animate-spin">⏳</div>
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
          <p className="text-sm text-muted-foreground">Initializing authentication</p>
        </div>
      </div>
    )
  }

  const handleLocationCaptured = (location: LocationData) => {
    setCapturedLocation(location)
    setStep("settings")
  }

  const handleCreateShare = async () => {
    if (!capturedLocation || !fileSystem) {
      setError("Location or filesystem not available")
      return
    }

    setIsCreatingShare(true)
    setError(null)

    try {
      const storageService = new LocationStorageService(fileSystem)
      await storageService.initialize()

      // Generate share token
      const shareToken = generateShareToken()

      // Calculate expiration
      const expiresAt = shareSettings.duration ? Date.now() + shareSettings.duration : null

      // Update location with expiration
      const updatedLocation: LocationData = {
        ...capturedLocation,
        expiresAt,
        precision: shareSettings.precision,
      }

      await storageService.saveLocation(updatedLocation)

      // Create share
      const share: LocationShare = {
        id: crypto.randomUUID(),
        locationId: capturedLocation.id,
        shareToken,
        createdAt: Date.now(),
        expiresAt,
        maxViews: shareSettings.maxViews,
        viewCount: 0,
        precision: shareSettings.precision,
      }

      await storageService.createShare(share)

      // Generate share link
      const baseUrl = window.location.origin
      const link = `${baseUrl}/location/${shareToken}`

      setShareLink(link)
      setStep("share")
    } catch (err) {
      console.error("Error creating share:", err)
      setError("Failed to create share link")
    } finally {
      setIsCreatingShare(false)
    }
  }

  const handleCopyLink = async () => {
    if (!shareLink) return

    try {
      await navigator.clipboard.writeText(shareLink)
      // Could add a toast notification here
      alert("Link copied to clipboard!")
    } catch (err) {
      console.error("Failed to copy link:", err)
      alert("Failed to copy link. Please copy manually.")
    }
  }

  const handleReset = () => {
    setStep("capture")
    setCapturedLocation(null)
    setShareLink(null)
    setError(null)
  }

  if (!session.authed) {
    return (
      <div className="share-location-auth flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-sm text-muted-foreground">Please log in to share your location securely</p>
        </div>
      </div>
    )
  }

  return (
    <div className="share-location max-w-4xl mx-auto p-6">
      {/* Progress Steps */}
      <div className="progress-steps flex items-center justify-center gap-4 mb-8">
        {["capture", "settings", "share"].map((s, index) => (
          <React.Fragment key={s}>
            <div className="step-item flex items-center gap-2">
              <div
                className={`step-number w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : index < ["capture", "settings", "share"].indexOf(step)
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {index + 1}
              </div>
              <span
                className={`step-label text-sm font-medium capitalize ${
                  step === s ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s}
              </span>
            </div>
            {index < 2 && (
              <div
                className={`step-connector h-0.5 w-12 ${
                  index < ["capture", "settings", "share"].indexOf(step) ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Step Content */}
      <div className="step-content">
        {step === "capture" && <LocationCapture onLocationCaptured={handleLocationCaptured} onError={setError} />}

        {step === "settings" && capturedLocation && (
          <div className="settings-step space-y-6">
            <div className="location-preview">
              <h3 className="text-lg font-semibold mb-4">Preview Your Location</h3>
              <LocationMap
                location={capturedLocation}
                precision={shareSettings.precision}
                showAccuracy={true}
                height="300px"
              />
            </div>

            <ShareSettingsComponent onSettingsChange={setShareSettings} initialSettings={shareSettings} />

            <div className="settings-actions flex gap-3">
              <button
                onClick={() => setStep("capture")}
                className="flex-1 px-6 py-3 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreateShare}
                disabled={isCreatingShare}
                className="flex-1 px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isCreatingShare ? "Creating Share..." : "Create Share Link"}
              </button>
            </div>
          </div>
        )}

        {step === "share" && shareLink && capturedLocation && (
          <div className="share-step space-y-6">
            <div className="share-success text-center mb-6">
              <div className="text-5xl mb-4">✓</div>
              <h2 className="text-2xl font-bold mb-2">Share Link Created!</h2>
              <p className="text-sm text-muted-foreground">Your location is ready to share securely</p>
            </div>

            <div className="share-link-box bg-muted/50 rounded-lg p-4 border border-border">
              <label className="block text-sm font-medium mb-2">Share Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  onClick={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  Copy Link
                </button>
              </div>
            </div>

            <div className="share-preview">
              <h3 className="text-lg font-semibold mb-4">Location Preview</h3>
              <LocationMap
                location={capturedLocation}
                precision={shareSettings.precision}
                showAccuracy={true}
                height="300px"
              />
            </div>

            <div className="share-details bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium mb-3">Share Settings</h4>
              <div className="detail-row flex justify-between text-sm">
                <span className="text-muted-foreground">Precision:</span>
                <span className="font-medium capitalize">{shareSettings.precision}</span>
              </div>
              <div className="detail-row flex justify-between text-sm">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium">
                  {shareSettings.duration ? `${shareSettings.duration / 3600000} hours` : "No expiration"}
                </span>
              </div>
              <div className="detail-row flex justify-between text-sm">
                <span className="text-muted-foreground">Max Views:</span>
                <span className="font-medium">{shareSettings.maxViews || "Unlimited"}</span>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full px-6 py-3 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Share Another Location
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


