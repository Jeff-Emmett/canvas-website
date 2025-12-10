import {
  TLUiDialogProps,
  TldrawUiButton,
  TldrawUiButtonLabel,
  TldrawUiDialogBody,
  TldrawUiDialogCloseButton,
  TldrawUiDialogFooter,
  TldrawUiDialogHeader,
  TldrawUiDialogTitle,
} from "tldraw"
import React, { useState, useEffect } from "react"
import { QRCodeSVG } from "qrcode.react"

interface InviteDialogProps extends TLUiDialogProps {
  boardUrl: string
  boardSlug: string
}

type PermissionType = 'view' | 'edit' | 'admin'

const PERMISSION_LABELS: Record<PermissionType, { label: string; description: string; color: string }> = {
  view: { label: 'View', description: 'Can view but not edit', color: '#6b7280' },
  edit: { label: 'Edit', description: 'Can view and edit', color: '#3b82f6' },
  admin: { label: 'Admin', description: 'Full control', color: '#10b981' },
}

export function InviteDialog({ onClose, boardUrl, boardSlug }: InviteDialogProps) {
  const [copied, setCopied] = useState(false)
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'writing' | 'success' | 'error' | 'unsupported'>('idle')
  const [nfcMessage, setNfcMessage] = useState('')
  const [permission, setPermission] = useState<PermissionType>('edit')

  // Check NFC support on mount and add ESC key handler
  useEffect(() => {
    if (!('NDEFReader' in window)) {
      setNfcStatus('unsupported')
    }

    // ESC key handler to close dialog
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose])

  // Generate URL with permission parameter
  const getShareUrl = () => {
    const url = new URL(boardUrl)
    url.searchParams.set('access', permission)
    return url.toString()
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }

  const handleNfcWrite = async () => {
    if (!('NDEFReader' in window)) {
      setNfcStatus('unsupported')
      setNfcMessage('NFC is not supported on this device')
      return
    }

    try {
      setNfcStatus('writing')
      setNfcMessage('Hold your NFC tag near the device...')

      const ndef = new (window as any).NDEFReader()
      await ndef.write({
        records: [
          { recordType: "url", data: getShareUrl() }
        ]
      })

      setNfcStatus('success')
      setNfcMessage('Board URL written to NFC tag!')
      setTimeout(() => {
        setNfcStatus('idle')
        setNfcMessage('')
      }, 3000)
    } catch (err: any) {
      console.error('NFC write error:', err)
      setNfcStatus('error')
      if (err.name === 'NotAllowedError') {
        setNfcMessage('NFC permission denied. Please allow NFC access.')
      } else if (err.name === 'NotSupportedError') {
        setNfcMessage('NFC is not supported on this device')
      } else {
        setNfcMessage(`Failed to write NFC tag: ${err.message || 'Unknown error'}`)
      }
    }
  }

  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>Invite to Board</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody style={{ maxWidth: 420 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Board name display */}
          <div style={{
            textAlign: 'center',
            padding: '8px 12px',
            backgroundColor: '#f8fafc',
            borderRadius: '6px',
            border: '1px solid #e2e8f0'
          }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Board: </span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{boardSlug}</span>
          </div>

          {/* Permission selector */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Access Level</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['view', 'edit', 'admin'] as PermissionType[]).map((perm) => {
                const isActive = permission === perm
                const { label, description, color } = PERMISSION_LABELS[perm]
                return (
                  <button
                    key={perm}
                    onClick={() => setPermission(perm)}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      border: isActive ? `2px solid ${color}` : '2px solid #e5e7eb',
                      background: isActive ? `${color}10` : 'white',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = color
                        e.currentTarget.style.background = `${color}08`
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = '#e5e7eb'
                        e.currentTarget.style.background = 'white'
                      }
                    }}
                  >
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: isActive ? color : '#374151'
                    }}>
                      {label}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      color: '#9ca3af',
                      lineHeight: 1.2,
                    }}>
                      {description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* QR Code and URL side by side */}
          <div style={{
            display: 'flex',
            gap: '16px',
            padding: '16px',
            backgroundColor: '#fafafa',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            {/* QR Code */}
            <div style={{
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              flexShrink: 0,
            }}>
              <QRCodeSVG
                value={getShareUrl()}
                size={120}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* URL and Copy Button */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
              <div style={{
                padding: '10px',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                wordBreak: 'break-all',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#374151',
                lineHeight: 1.4,
                maxHeight: '60px',
                overflowY: 'auto',
              }}>
                {getShareUrl()}
              </div>
              <button
                onClick={handleCopyUrl}
                style={{
                  padding: '8px 16px',
                  backgroundColor: copied ? '#10b981' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {copied ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Advanced sharing options (collapsed) */}
          <details style={{ marginTop: '4px' }}>
            <summary style={{
              fontSize: '12px',
              color: '#6b7280',
              cursor: 'pointer',
              userSelect: 'none',
              padding: '4px 0',
            }}>
              More sharing options (NFC, Audio)
            </summary>
            <div style={{
              marginTop: '12px',
              display: 'flex',
              gap: '8px',
            }}>
              {/* NFC Button */}
              <button
                onClick={handleNfcWrite}
                disabled={nfcStatus === 'unsupported' || nfcStatus === 'writing'}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: nfcStatus === 'unsupported' ? '#f3f4f6' :
                                  nfcStatus === 'success' ? '#d1fae5' :
                                  nfcStatus === 'error' ? '#fee2e2' :
                                  nfcStatus === 'writing' ? '#e0e7ff' : 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: nfcStatus === 'unsupported' || nfcStatus === 'writing' ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: nfcStatus === 'unsupported' ? 0.5 : 1,
                }}
              >
                <span style={{ fontSize: '20px' }}>
                  {nfcStatus === 'success' ? '✓' : nfcStatus === 'error' ? '!' : '📡'}
                </span>
                <span style={{ fontSize: '11px', color: '#374151', fontWeight: 500 }}>
                  {nfcStatus === 'writing' ? 'Writing...' :
                   nfcStatus === 'success' ? 'Written!' :
                   nfcStatus === 'unsupported' ? 'NFC Unavailable' :
                   'Write to NFC'}
                </span>
              </button>

              {/* Audio Button (coming soon) */}
              <button
                disabled
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'not-allowed',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: 0.5,
                }}
              >
                <span style={{ fontSize: '20px' }}>🔊</span>
                <span style={{ fontSize: '11px', color: '#374151', fontWeight: 500 }}>
                  Audio (Soon)
                </span>
              </button>
            </div>
            {nfcMessage && (
              <p style={{
                marginTop: '8px',
                fontSize: '11px',
                color: nfcStatus === 'error' ? '#ef4444' :
                       nfcStatus === 'success' ? '#10b981' : '#6b7280',
                textAlign: 'center',
              }}>
                {nfcMessage}
              </p>
            )}
          </details>
        </div>
      </TldrawUiDialogBody>
      <TldrawUiDialogFooter>
        <TldrawUiButton type="primary" onClick={onClose}>
          <TldrawUiButtonLabel>Done</TldrawUiButtonLabel>
        </TldrawUiButton>
      </TldrawUiDialogFooter>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  )
}
