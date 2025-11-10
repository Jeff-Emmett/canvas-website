"use client"

import React, { useState } from "react"
import type { ShareSettings, PrecisionLevel } from "@/lib/location/types"

interface ShareSettingsProps {
  onSettingsChange: (settings: ShareSettings) => void
  initialSettings?: Partial<ShareSettings>
}

export const ShareSettingsComponent: React.FC<ShareSettingsProps> = ({ onSettingsChange, initialSettings = {} }) => {
  const [duration, setDuration] = useState<string>(
    initialSettings.duration ? String(initialSettings.duration / 3600000) : "24",
  )
  const [maxViews, setMaxViews] = useState<string>(
    initialSettings.maxViews ? String(initialSettings.maxViews) : "unlimited",
  )
  const [precision, setPrecision] = useState<PrecisionLevel>(initialSettings.precision || "street")

  const handleChange = () => {
    const settings: ShareSettings = {
      duration: duration === "unlimited" ? null : Number(duration) * 3600000,
      maxViews: maxViews === "unlimited" ? null : Number(maxViews),
      precision,
    }
    onSettingsChange(settings)
  }

  React.useEffect(() => {
    handleChange()
  }, [duration, maxViews, precision])

  return (
    <div className="share-settings space-y-6">
      <div className="settings-header">
        <h3 className="text-lg font-semibold">Privacy Settings</h3>
        <p className="text-sm text-muted-foreground mt-1">Control how your location is shared</p>
      </div>

      {/* Precision Level */}
      <div className="setting-group">
        <label className="block text-sm font-medium mb-3">Location Precision</label>
        <div className="precision-options space-y-2">
          {[
            { value: "exact", label: "Exact Location", desc: "Share precise coordinates" },
            { value: "street", label: "Street Level", desc: "~100m radius" },
            { value: "neighborhood", label: "Neighborhood", desc: "~1km radius" },
            { value: "city", label: "City Level", desc: "~10km radius" },
          ].map((option) => (
            <label
              key={option.value}
              className={`precision-option flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                precision === option.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <input
                type="radio"
                name="precision"
                value={option.value}
                checked={precision === option.value}
                onChange={(e) => setPrecision(e.target.value as PrecisionLevel)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="setting-group">
        <label htmlFor="duration" className="block text-sm font-medium mb-2">
          Share Duration
        </label>
        <select
          id="duration"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="1">1 hour</option>
          <option value="6">6 hours</option>
          <option value="24">24 hours</option>
          <option value="168">1 week</option>
          <option value="unlimited">No expiration</option>
        </select>
      </div>

      {/* Max Views */}
      <div className="setting-group">
        <label htmlFor="maxViews" className="block text-sm font-medium mb-2">
          Maximum Views
        </label>
        <select
          id="maxViews"
          value={maxViews}
          onChange={(e) => setMaxViews(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="1">1 view</option>
          <option value="5">5 views</option>
          <option value="10">10 views</option>
          <option value="unlimited">Unlimited</option>
        </select>
      </div>

      {/* Privacy Notice */}
      <div className="privacy-notice bg-muted/50 rounded-lg p-4">
        <p className="text-xs text-muted-foreground">
          Your location data is stored securely in your private filesystem. Only people with the share link can view
          your location, and shares automatically expire based on your settings.
        </p>
      </div>
    </div>
  )
}



























