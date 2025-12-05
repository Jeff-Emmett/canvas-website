// Connection status for UI display (maps from ConnectionState)
export type ConnectionStatus = 'online' | 'offline' | 'syncing'

interface OfflineIndicatorProps {
  connectionStatus: ConnectionStatus
  isOfflineReady: boolean
}

export function OfflineIndicator({ connectionStatus, isOfflineReady }: OfflineIndicatorProps) {
  // Don't show indicator when online and everything is working normally
  if (connectionStatus === 'online') {
    return null
  }

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'offline':
        return {
          icon: '📴',
          text: isOfflineReady ? 'Offline (changes saved locally)' : 'Offline',
          bgColor: '#fef3c7', // warm yellow
          textColor: '#92400e',
          borderColor: '#f59e0b'
        }
      case 'syncing':
        return {
          icon: '🔄',
          text: 'Syncing...',
          bgColor: '#dbeafe', // light blue
          textColor: '#1e40af',
          borderColor: '#3b82f6'
        }
      default:
        return null
    }
  }

  const config = getStatusConfig()
  if (!config) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: config.bgColor,
        color: config.textColor,
        padding: '8px 16px',
        borderRadius: '8px',
        border: `1px solid ${config.borderColor}`,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 9999,
        fontSize: '14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        pointerEvents: 'none'
      }}
    >
      <span style={{ fontSize: '16px' }}>{config.icon}</span>
      <span>{config.text}</span>
    </div>
  )
}
