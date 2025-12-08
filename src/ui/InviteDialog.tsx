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

type TabType = 'qr' | 'url' | 'nfc' | 'audio'

export function InviteDialog({ onClose, boardUrl, boardSlug }: InviteDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('qr')
  const [copied, setCopied] = useState(false)
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'writing' | 'success' | 'error' | 'unsupported'>('idle')
  const [nfcMessage, setNfcMessage] = useState('')

  // Check NFC support on mount
  useEffect(() => {
    if (!('NDEFReader' in window)) {
      setNfcStatus('unsupported')
    }
  }, [])

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(boardUrl)
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
          { recordType: "url", data: boardUrl }
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

  const tabStyle = (tab: TabType) => ({
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    background: activeTab === tab ? '#3b82f6' : '#f3f4f6',
    color: activeTab === tab ? 'white' : '#374151',
    cursor: 'pointer',
    fontWeight: activeTab === tab ? 600 : 400,
    fontSize: '13px',
    transition: 'all 0.2s ease',
    borderRadius: tab === 'qr' ? '6px 0 0 6px' : tab === 'audio' ? '0 6px 6px 0' : '0',
  })

  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>Invite to Board</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody style={{ maxWidth: 420, minHeight: 380 }}>
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

          {/* Tab navigation */}
          <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden' }}>
            <button style={tabStyle('qr')} onClick={() => setActiveTab('qr')}>
              QR Code
            </button>
            <button style={tabStyle('url')} onClick={() => setActiveTab('url')}>
              URL
            </button>
            <button style={tabStyle('nfc')} onClick={() => setActiveTab('nfc')}>
              NFC
            </button>
            <button style={tabStyle('audio')} onClick={() => setActiveTab('audio')}>
              Audio
            </button>
          </div>

          {/* Tab content */}
          <div style={{
            minHeight: 220,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: '#fafafa',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            {activeTab === 'qr' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  padding: '16px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  display: 'inline-block'
                }}>
                  <QRCodeSVG
                    value={boardUrl}
                    size={180}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p style={{
                  marginTop: '16px',
                  fontSize: '13px',
                  color: '#6b7280',
                  lineHeight: 1.5
                }}>
                  Scan this QR code with a mobile device to join the board
                </p>
              </div>
            )}

            {activeTab === 'url' && (
              <div style={{ width: '100%', textAlign: 'center' }}>
                <div style={{
                  padding: '12px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  marginBottom: '16px',
                  wordBreak: 'break-all',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  color: '#374151'
                }}>
                  {boardUrl}
                </div>
                <button
                  onClick={handleCopyUrl}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: copied ? '#10b981' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: '0 auto'
                  }}
                >
                  {copied ? (
                    <>
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
                <p style={{
                  marginTop: '16px',
                  fontSize: '13px',
                  color: '#6b7280'
                }}>
                  Share this link with anyone to invite them to your board
                </p>
              </div>
            )}

            {activeTab === 'nfc' && (
              <div style={{ width: '100%', textAlign: 'center' }}>
                {nfcStatus === 'unsupported' ? (
                  <>
                    <div style={{
                      fontSize: '48px',
                      marginBottom: '16px',
                      opacity: 0.5
                    }}>
                      NFC
                    </div>
                    <p style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      marginBottom: '8px'
                    }}>
                      NFC is not supported on this device
                    </p>
                    <p style={{
                      fontSize: '12px',
                      color: '#9ca3af'
                    }}>
                      Try using a mobile device with NFC capability
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{
                      fontSize: '48px',
                      marginBottom: '16px',
                      animation: nfcStatus === 'writing' ? 'pulse 1.5s infinite' : 'none'
                    }}>
                      {nfcStatus === 'success' ? '(done)' : nfcStatus === 'error' ? '(!)' : 'NFC'}
                    </div>
                    <button
                      onClick={handleNfcWrite}
                      disabled={nfcStatus === 'writing'}
                      style={{
                        padding: '10px 24px',
                        backgroundColor: nfcStatus === 'success' ? '#10b981' :
                                        nfcStatus === 'error' ? '#ef4444' :
                                        nfcStatus === 'writing' ? '#9ca3af' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: nfcStatus === 'writing' ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        marginBottom: '12px'
                      }}
                    >
                      {nfcStatus === 'writing' ? 'Writing...' :
                       nfcStatus === 'success' ? 'Written!' :
                       'Write to NFC Tag'}
                    </button>
                    {nfcMessage && (
                      <p style={{
                        fontSize: '13px',
                        color: nfcStatus === 'error' ? '#ef4444' :
                               nfcStatus === 'success' ? '#10b981' : '#6b7280'
                      }}>
                        {nfcMessage}
                      </p>
                    )}
                    {!nfcMessage && (
                      <p style={{
                        fontSize: '13px',
                        color: '#6b7280'
                      }}>
                        Write the board URL to an NFC tag for instant access
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'audio' && (
              <div style={{ width: '100%', textAlign: 'center' }}>
                <div style={{
                  fontSize: '48px',
                  marginBottom: '16px',
                  opacity: 0.6
                }}>
                  ((( )))
                </div>
                <p style={{
                  fontSize: '14px',
                  color: '#374151',
                  fontWeight: 500,
                  marginBottom: '8px'
                }}>
                  Audio Connect
                </p>
                <p style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  marginBottom: '16px'
                }}>
                  Share the board link via ultrasonic audio
                </p>
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '8px',
                  border: '1px solid #fcd34d',
                  fontSize: '12px',
                  color: '#92400e'
                }}>
                  Coming soon! Audio-based sharing will allow nearby devices to join by listening for an ultrasonic signal.
                </div>
              </div>
            )}
          </div>
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
