import { useState, useEffect } from 'react'
import { ConnectionState } from '../automerge/CloudflareAdapter'

interface ConnectionStatusIndicatorProps {
  connectionState: ConnectionState
  isNetworkOnline: boolean
}

export function ConnectionStatusIndicator({
  connectionState,
  isNetworkOnline
}: ConnectionStatusIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  // Determine if we're truly offline (no network OR disconnected for a while)
  const isOffline = !isNetworkOnline || connectionState === 'disconnected'
  const isReconnecting = connectionState === 'reconnecting' || connectionState === 'connecting'

  // Don't show anything when connected and online
  useEffect(() => {
    if (connectionState === 'connected' && isNetworkOnline) {
      // Fade out
      setIsVisible(false)
      setShowDetails(false)
    } else {
      // Fade in
      setIsVisible(true)
    }
  }, [connectionState, isNetworkOnline])

  if (!isVisible && connectionState === 'connected' && isNetworkOnline) {
    return null
  }

  const getStatusInfo = () => {
    if (!isNetworkOnline) {
      return {
        label: 'Working Offline',
        color: '#8b5cf6', // Purple - calm, not alarming
        icon: '🍄',
        pulse: false,
        description: 'Your data is safe and encrypted locally',
        detailedMessage: `Your canvas is stored securely in your browser using encrypted local storage. All changes are preserved with your personal encryption key. When you reconnect, your work will automatically sync with the shared canvas — no data will be lost.`,
      }
    }

    switch (connectionState) {
      case 'connecting':
        return {
          label: 'Connecting',
          color: '#f59e0b', // amber
          icon: '🌱',
          pulse: true,
          description: 'Establishing secure connection...',
          detailedMessage: 'Connecting to the collaborative canvas. Your local changes are safely stored.',
        }
      case 'reconnecting':
        return {
          label: 'Reconnecting',
          color: '#f59e0b', // amber
          icon: '🔄',
          pulse: true,
          description: 'Re-establishing connection...',
          detailedMessage: 'Connection interrupted. Attempting to reconnect. All your changes are saved locally and will sync automatically once the connection is restored.',
        }
      case 'disconnected':
        return {
          label: 'Disconnected',
          color: '#8b5cf6', // Purple
          icon: '🍄',
          pulse: false,
          description: 'Working in local mode',
          detailedMessage: `Your canvas is stored securely in your browser using encrypted local storage. All changes are preserved with your personal encryption key. When connectivity is restored, your work will automatically merge with the shared canvas.`,
        }
      default:
        return null
    }
  }

  const status = getStatusInfo()
  if (!status) return null

  return (
    <>
      <div
        onClick={() => setShowDetails(!showDetails)}
        style={{
          position: 'fixed',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: showDetails ? '12px 16px' : '10px 16px',
          backgroundColor: 'rgba(30, 30, 30, 0.95)',
          color: 'white',
          borderRadius: showDetails ? '16px' : '24px',
          fontSize: '14px',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          maxWidth: showDetails ? '380px' : '320px',
          opacity: isVisible ? 1 : 0,
          animation: status.pulse ? 'gentlePulse 3s infinite' : undefined,
        }}
      >
        {/* Status indicator dot */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '18px' }}>{status.icon}</span>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: status.color,
              boxShadow: `0 0 8px ${status.color}`,
              animation: status.pulse ? 'blink 1.5s infinite' : undefined,
            }}
          />
        </div>

        {/* Main content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          flex: 1,
          minWidth: 0,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{
              fontWeight: 600,
              color: status.color,
              letterSpacing: '-0.01em',
            }}>
              {status.label}
            </span>
            <span style={{
              opacity: 0.7,
              fontSize: '12px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {status.description}
            </span>
          </div>

          {/* Detailed message when expanded */}
          {showDetails && (
            <div style={{
              fontSize: '12px',
              lineHeight: '1.5',
              opacity: 0.85,
              marginTop: '6px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}>
              {status.detailedMessage}

              {/* Data sovereignty badges */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginTop: '10px',
                flexWrap: 'wrap',
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  backgroundColor: 'rgba(139, 92, 246, 0.2)',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: 500,
                  color: '#a78bfa',
                }}>
                  🔐 Encrypted Locally
                </span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: 500,
                  color: '#6ee7b7',
                }}>
                  💾 Auto-Saved
                </span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: 500,
                  color: '#93c5fd',
                }}>
                  🔄 Will Auto-Sync
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Expand indicator */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{
            opacity: 0.5,
            transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        >
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
        </svg>
      </div>

      <style>{`
        @keyframes gentlePulse {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.1);
          }
          50% {
            opacity: 0.9;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.15);
          }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  )
}
