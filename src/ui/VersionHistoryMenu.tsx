import { useCallback, useEffect, useState } from 'react'
import { useEditor } from 'tldraw'
import { WORKER_URL } from '../routes/Board'
import { useParams } from 'react-router-dom'

interface Version {
  timestamp: number
  version: number
  dateKey: string
}

export function VersionHistoryMenu() {
  const editor = useEditor()
  const { slug } = useParams<{ slug: string }>()
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(false)

  const fetchVersions = useCallback(async () => {
    try {
      const response = await fetch(`/backups/${slug}`)
      const data = await response.json()
      setVersions(data as Version[])
    } catch (error) {
      console.error('Failed to fetch versions:', error)
    }
  }, [slug])

  const restoreVersion = async (dateKey: string) => {
    if (!confirm('Are you sure you want to restore this version? Current changes will be lost.')) {
      return
    }

    setLoading(true)
    try {
      await fetch(`${WORKER_URL}/rooms/${slug}/restore/${dateKey}`, {
        method: 'POST'
      })
      // Reload the page to get the restored version
      window.location.reload()
    } catch (error) {
      console.error('Failed to restore version:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVersions()
    // Refresh versions list every 5 minutes
    const interval = setInterval(fetchVersions, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchVersions])

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date)
  }

  return (
    <div className="version-history-menu">
      <h3>Daily Backups</h3>
      <div className="version-list">
        {versions.length === 0 ? (
          <div className="no-versions">No backups available yet</div>
        ) : (
          versions.map((version) => (
            <div key={version.dateKey} className="version-item">
              <span className="version-date">
                {formatDate(version.timestamp)}
              </span>
              <button 
                onClick={() => restoreVersion(version.dateKey)}
                disabled={loading}
                className="restore-button"
              >
                {loading ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
} 