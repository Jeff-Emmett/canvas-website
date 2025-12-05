import { useState, useEffect, useRef } from "react"
import { useAuth } from "../context/AuthContext"
import { useDialogs } from "tldraw"
import { SettingsDialog } from "./SettingsDialog"
import { getFathomApiKey, saveFathomApiKey, removeFathomApiKey, isFathomApiKeyConfigured } from "../lib/fathomApiKey"
import { linkEmailToAccount, checkEmailStatus, type LookupResult } from "../lib/auth/cryptidEmailService"
import { GoogleDataService, type GoogleService, type ShareableItem } from "../lib/google"
import { GoogleExportBrowser } from "../components/GoogleExportBrowser"

// AI tool model configurations
const AI_TOOLS = [
  {
    id: 'chat',
    name: 'Chat Assistant',
    icon: '💬',
    description: 'Conversational AI for questions and discussions',
    models: {
      primary: { name: 'Ollama (Local)', model: 'llama3.1:8b', type: 'local' },
      fallback: { name: 'OpenAI', model: 'gpt-4o', type: 'cloud' },
    }
  },
  {
    id: 'make-real',
    name: 'Make Real',
    icon: '🔧',
    description: 'Convert wireframes to working prototypes',
    models: {
      primary: { name: 'Anthropic', model: 'claude-sonnet-4-5', type: 'cloud' },
      fallback: { name: 'OpenAI', model: 'gpt-4o', type: 'cloud' },
    }
  },
  {
    id: 'image-gen',
    name: 'Image Generation',
    icon: '🎨',
    description: 'Generate images from text prompts',
    models: {
      primary: { name: 'RunPod', model: 'Stable Diffusion XL', type: 'gpu' },
    }
  },
  {
    id: 'video-gen',
    name: 'Video Generation',
    icon: '🎬',
    description: 'Generate videos from images',
    models: {
      primary: { name: 'RunPod', model: 'Wan2.1 I2V', type: 'gpu' },
    }
  },
  {
    id: 'transcription',
    name: 'Transcription',
    icon: '🎤',
    description: 'Transcribe audio to text',
    models: {
      primary: { name: 'Browser', model: 'Web Speech API', type: 'local' },
      fallback: { name: 'Whisper', model: 'whisper-large-v3', type: 'local' },
    }
  },
  {
    id: 'mycelial',
    name: 'Mycelial Intelligence',
    icon: '🍄',
    description: 'Analyze connections between concepts',
    models: {
      primary: { name: 'Ollama (Local)', model: 'llama3.1:70b', type: 'local' },
      fallback: { name: 'Anthropic', model: 'claude-sonnet-4-5', type: 'cloud' },
    }
  },
]

interface UserSettingsModalProps {
  onClose: () => void
  isDarkMode: boolean
  onToggleDarkMode: () => void
}

export function UserSettingsModal({ onClose, isDarkMode, onToggleDarkMode }: UserSettingsModalProps) {
  const { session, setSession } = useAuth()
  const { addDialog, removeDialog } = useDialogs()
  const modalRef = useRef<HTMLDivElement>(null)

  const [hasApiKey, setHasApiKey] = useState(false)
  const [hasFathomApiKey, setHasFathomApiKey] = useState(false)
  const [showFathomApiKeyInput, setShowFathomApiKeyInput] = useState(false)
  const [fathomApiKeyInput, setFathomApiKeyInput] = useState('')
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'integrations'>('general')

  // Dark mode aware colors
  const colors = isDarkMode ? {
    cardBg: '#252525',
    cardBorder: '#404040',
    text: '#e4e4e4',
    textMuted: '#a1a1aa',
    textHeading: '#f4f4f5',
    warningBg: '#3d3620',
    warningBorder: '#665930',
    warningText: '#fbbf24',
    successBg: '#1a3d2e',
    successText: '#34d399',
    errorBg: '#3d2020',
    errorText: '#f87171',
    localBg: '#1a3d2e',
    localText: '#34d399',
    gpuBg: '#1e2756',
    gpuText: '#818cf8',
    cloudBg: '#3d3620',
    cloudText: '#fbbf24',
    fallbackBg: '#2d2d2d',
    fallbackText: '#a1a1aa',
    legendBg: '#252525',
    legendBorder: '#404040',
    linkColor: '#60a5fa',
    dividerColor: '#404040',
  } : {
    cardBg: '#f9fafb',
    cardBorder: '#e5e7eb',
    text: '#374151',
    textMuted: '#6b7280',
    textHeading: '#1f2937',
    warningBg: '#fef3c7',
    warningBorder: '#fcd34d',
    warningText: '#92400e',
    successBg: '#d1fae5',
    successText: '#065f46',
    errorBg: '#fee2e2',
    errorText: '#991b1b',
    localBg: '#d1fae5',
    localText: '#065f46',
    gpuBg: '#e0e7ff',
    gpuText: '#3730a3',
    cloudBg: '#fef3c7',
    cloudText: '#92400e',
    fallbackBg: '#f3f4f6',
    fallbackText: '#6b7280',
    legendBg: '#f8fafc',
    legendBorder: '#e2e8f0',
    linkColor: '#3b82f6',
    dividerColor: '#e5e7eb',
  }

  // Email linking state
  const [emailStatus, setEmailStatus] = useState<LookupResult | null>(null)
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [emailLinkLoading, setEmailLinkLoading] = useState(false)
  const [emailLinkMessage, setEmailLinkMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Google Data state
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleCounts, setGoogleCounts] = useState<Record<GoogleService, number>>({
    gmail: 0,
    drive: 0,
    photos: 0,
    calendar: 0,
  })
  const [showGoogleExportBrowser, setShowGoogleExportBrowser] = useState(false)

  // Check API key status
  const checkApiKeys = () => {
    const settings = localStorage.getItem("openai_api_key")
    try {
      if (settings) {
        try {
          const parsed = JSON.parse(settings)
          if (parsed.keys) {
            const hasValidKey = Object.values(parsed.keys).some(key =>
              typeof key === 'string' && key.trim() !== ''
            )
            setHasApiKey(hasValidKey)
          } else {
            setHasApiKey(typeof settings === 'string' && settings.trim() !== '')
          }
        } catch (e) {
          setHasApiKey(typeof settings === 'string' && settings.trim() !== '')
        }
      } else {
        setHasApiKey(false)
      }
    } catch (e) {
      setHasApiKey(false)
    }
  }

  useEffect(() => {
    checkApiKeys()
  }, [])

  useEffect(() => {
    if (session.authed && session.username) {
      setHasFathomApiKey(isFathomApiKeyConfigured(session.username))
    }
  }, [session.authed, session.username])

  // Check email status when modal opens
  useEffect(() => {
    const fetchEmailStatus = async () => {
      if (session.authed && session.username) {
        const status = await checkEmailStatus(session.username)
        setEmailStatus(status)
      }
    }
    fetchEmailStatus()
  }, [session.authed, session.username])

  // Check Google connection status when modal opens
  useEffect(() => {
    const checkGoogleStatus = async () => {
      try {
        const service = GoogleDataService.getInstance()
        const isAuthed = await service.isAuthenticated()
        setGoogleConnected(isAuthed)

        if (isAuthed) {
          // Get stored item counts
          const counts = await service.getStoredCounts()
          setGoogleCounts(counts)
        }
      } catch (error) {
        console.warn('Failed to check Google status:', error)
        setGoogleConnected(false)
      }
    }
    checkGoogleStatus()
  }, [])

  // Handle email linking
  const handleLinkEmail = async () => {
    if (!emailInput.trim() || !session.username) return

    setEmailLinkLoading(true)
    setEmailLinkMessage(null)

    try {
      const result = await linkEmailToAccount(emailInput.trim(), session.username)
      if (result.success) {
        if (result.emailSent) {
          setEmailLinkMessage({
            type: 'success',
            text: 'Verification email sent! Check your inbox to confirm.'
          })
        } else if (result.emailVerified) {
          setEmailLinkMessage({
            type: 'success',
            text: 'Email already verified and linked!'
          })
        } else {
          setEmailLinkMessage({
            type: 'success',
            text: 'Email linked successfully!'
          })
        }
        setShowEmailInput(false)
        setEmailInput('')
        // Refresh status
        const status = await checkEmailStatus(session.username)
        setEmailStatus(status)
      } else {
        setEmailLinkMessage({
          type: 'error',
          text: result.error || 'Failed to link email'
        })
      }
    } catch (error) {
      setEmailLinkMessage({
        type: 'error',
        text: 'An error occurred while linking email'
      })
    } finally {
      setEmailLinkLoading(false)
    }
  }

  // Handle Google connect
  const handleGoogleConnect = async () => {
    setGoogleLoading(true)
    try {
      const service = GoogleDataService.getInstance()
      // Request all services by default
      await service.authenticate(['gmail', 'drive', 'photos', 'calendar'])
      setGoogleConnected(true)
      // Refresh counts after connection
      const counts = await service.getStoredCounts()
      setGoogleCounts(counts)
    } catch (error) {
      console.error('Google connect failed:', error)
    } finally {
      setGoogleLoading(false)
    }
  }

  // Handle Google disconnect
  const handleGoogleDisconnect = async () => {
    try {
      const service = GoogleDataService.getInstance()
      await service.signOut()
      setGoogleConnected(false)
      setGoogleCounts({ gmail: 0, drive: 0, photos: 0, calendar: 0 })
    } catch (error) {
      console.error('Google disconnect failed:', error)
    }
  }

  // Calculate total imported items
  const totalGoogleItems = Object.values(googleCounts).reduce((a, b) => a + b, 0)

  // Handle adding items to canvas from Google Data Browser
  const handleAddToCanvas = async (items: ShareableItem[], position: { x: number; y: number }) => {
    // For now, emit a custom event that Board.tsx can listen to
    // In Phase 3, this will add items to the Private Workspace zone
    window.dispatchEvent(new CustomEvent('add-google-items-to-canvas', {
      detail: { items, position }
    }));
    setShowGoogleExportBrowser(false);
    onClose();
  }

  // Handle escape key and click outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  const openApiKeysDialog = () => {
    addDialog({
      id: "api-keys",
      component: ({ onClose: dialogClose }: { onClose: () => void }) => (
        <SettingsDialog
          onClose={() => {
            dialogClose()
            removeDialog("api-keys")
            checkApiKeys()
          }}
        />
      ),
    })
  }

  const handleSetVault = () => {
    window.dispatchEvent(new CustomEvent('open-obsidian-browser'))
    onClose()
  }

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal" ref={modalRef}>
        <div className="settings-modal-header">
          <h2>Settings</h2>
          <button className="settings-close-btn" onClick={onClose} title="Close (Esc)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`settings-tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            AI Models
          </button>
          <button
            className={`settings-tab ${activeTab === 'integrations' ? 'active' : ''}`}
            onClick={() => setActiveTab('integrations')}
          >
            Integrations
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'general' && (
            <div className="settings-section">
              <div className="settings-item">
                <div className="settings-item-info">
                  <span className="settings-item-label">Appearance</span>
                  <span className="settings-item-description">Toggle between light and dark mode</span>
                </div>
                <button
                  className="settings-toggle-btn"
                  onClick={onToggleDarkMode}
                >
                  <span className="toggle-icon">{isDarkMode ? '🌙' : '☀️'}</span>
                  <span>{isDarkMode ? 'Dark' : 'Light'}</span>
                </button>
              </div>

              <div className="settings-divider" />

              {/* CryptID Account Section */}
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: colors.text }}>
                CryptID Account
              </h3>

              {session.authed && session.username ? (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: colors.cardBg,
                    borderRadius: '8px',
                    border: `1px solid ${colors.cardBorder}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px' }}>🔐</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: colors.textHeading }}>
                        {session.username}
                      </span>
                      <p style={{ fontSize: '11px', color: colors.textMuted, marginTop: '2px' }}>
                        Your CryptID username - cryptographically secured
                      </p>
                    </div>
                  </div>

                  {/* Email Section */}
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${colors.dividerColor}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '16px' }}>✉️</span>
                      <span style={{ fontSize: '12px', fontWeight: '500', color: colors.text }}>Email Recovery</span>
                      <span
                        className={`status-badge ${emailStatus?.emailVerified ? 'success' : 'warning'}`}
                        style={{ fontSize: '10px', marginLeft: 'auto' }}
                      >
                        {emailStatus?.emailVerified ? 'Verified' : emailStatus?.email ? 'Pending' : 'Not Set'}
                      </span>
                    </div>

                    {emailStatus?.email && (
                      <p style={{ fontSize: '11px', color: emailStatus.emailVerified ? colors.successText : colors.warningText, marginBottom: '8px' }}>
                        {emailStatus.email}
                        {!emailStatus.emailVerified && ' (verification pending)'}
                      </p>
                    )}

                    <p style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '8px', lineHeight: '1.4' }}>
                      Link an email to recover your account on new devices. You'll receive a verification link.
                    </p>

                    {emailLinkMessage && (
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          marginBottom: '8px',
                          backgroundColor: emailLinkMessage.type === 'success' ? colors.successBg : colors.errorBg,
                          color: emailLinkMessage.type === 'success' ? colors.successText : colors.errorText,
                          fontSize: '11px',
                        }}
                      >
                        {emailLinkMessage.text}
                      </div>
                    )}

                    {showEmailInput ? (
                      <div>
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="Enter your email address..."
                          className="settings-input"
                          style={{ width: '100%', marginBottom: '8px' }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && emailInput.trim()) {
                              handleLinkEmail()
                            } else if (e.key === 'Escape') {
                              setShowEmailInput(false)
                              setEmailInput('')
                            }
                          }}
                          autoFocus
                          disabled={emailLinkLoading}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="settings-btn-sm primary"
                            style={{ flex: 1 }}
                            onClick={handleLinkEmail}
                            disabled={emailLinkLoading || !emailInput.trim()}
                          >
                            {emailLinkLoading ? 'Sending...' : 'Send Verification'}
                          </button>
                          <button
                            className="settings-btn-sm"
                            style={{ flex: 1 }}
                            onClick={() => {
                              setShowEmailInput(false)
                              setEmailInput('')
                              setEmailLinkMessage(null)
                            }}
                            disabled={emailLinkLoading}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="settings-action-btn"
                        style={{ width: '100%' }}
                        onClick={() => setShowEmailInput(true)}
                      >
                        {emailStatus?.email ? 'Update Email' : 'Link Email'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: colors.warningBg,
                    borderRadius: '8px',
                    border: `1px solid ${colors.warningBorder}`,
                  }}
                >
                  <p style={{ fontSize: '12px', color: colors.warningText }}>
                    Sign in to manage your CryptID account settings
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="settings-section">
              {/* AI Tools Overview */}
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: colors.text }}>
                  AI Tools & Models
                </h3>
                <p style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '16px', lineHeight: '1.4' }}>
                  Each tool uses optimized AI models. Local models run on your private server for free, cloud models require API keys.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {AI_TOOLS.map((tool) => (
                    <div
                      key={tool.id}
                      style={{
                        padding: '12px',
                        backgroundColor: colors.cardBg,
                        borderRadius: '8px',
                        border: `1px solid ${colors.cardBorder}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '16px' }}>{tool.icon}</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: colors.textHeading }}>{tool.name}</span>
                      </div>
                      <p style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '8px' }}>{tool.description}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            backgroundColor: tool.models.primary.type === 'local' ? colors.localBg : tool.models.primary.type === 'gpu' ? colors.gpuBg : colors.cloudBg,
                            color: tool.models.primary.type === 'local' ? colors.localText : tool.models.primary.type === 'gpu' ? colors.gpuText : colors.cloudText,
                            fontWeight: '500',
                          }}
                        >
                          {tool.models.primary.name}: {tool.models.primary.model}
                        </span>
                        {tool.models.fallback && (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              backgroundColor: colors.fallbackBg,
                              color: colors.fallbackText,
                              fontWeight: '500',
                            }}
                          >
                            Fallback: {tool.models.fallback.model}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="settings-divider" />

              {/* API Keys Configuration */}
              <div className="settings-item">
                <div className="settings-item-info">
                  <span className="settings-item-label">AI API Keys</span>
                  <span className="settings-item-description">
                    {hasApiKey ? 'Your cloud AI models are configured and ready' : 'Configure API keys to use cloud AI features'}
                  </span>
                </div>
                <div className="settings-item-status">
                  <span className={`status-badge ${hasApiKey ? 'success' : 'warning'}`}>
                    {hasApiKey ? 'Configured' : 'Not Set'}
                  </span>
                </div>
              </div>
              <button className="settings-action-btn" onClick={openApiKeysDialog}>
                {hasApiKey ? 'Manage API Keys' : 'Add API Keys'}
              </button>

              {/* Model type legend */}
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: colors.legendBg, borderRadius: '6px', border: `1px solid ${colors.legendBorder}` }}>
                <div style={{ fontSize: '11px', color: colors.textMuted, display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colors.localText }}></span>
                    Local (Free)
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colors.gpuText }}></span>
                    GPU (RunPod)
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colors.cloudText }}></span>
                    Cloud (API Key)
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="settings-section">
              {/* Knowledge Management Section */}
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: colors.text }}>
                Knowledge Management
              </h3>

              {/* Obsidian Vault - Local Files */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: colors.cardBg,
                  borderRadius: '8px',
                  border: `1px solid ${colors.cardBorder}`,
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>📁</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: colors.textHeading }}>Obsidian Vault (Local)</span>
                    <p style={{ fontSize: '11px', color: colors.textMuted, marginTop: '2px' }}>
                      Import notes directly from your local Obsidian vault
                    </p>
                  </div>
                  <span className={`status-badge ${session.obsidianVaultName ? 'success' : 'warning'}`} style={{ fontSize: '10px' }}>
                    {session.obsidianVaultName ? 'Connected' : 'Not Set'}
                  </span>
                </div>
                {session.obsidianVaultName && (
                  <p style={{ fontSize: '11px', color: colors.successText, marginBottom: '8px' }}>
                    Current vault: {session.obsidianVaultName}
                  </p>
                )}
                <button className="settings-action-btn" onClick={handleSetVault} style={{ width: '100%' }}>
                  {session.obsidianVaultName ? 'Change Vault' : 'Connect Vault'}
                </button>
              </div>

              {/* Obsidian Quartz - Published Notes */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: colors.cardBg,
                  borderRadius: '8px',
                  border: `1px solid ${colors.cardBorder}`,
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🌐</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: colors.textHeading }}>Obsidian Quartz (Web)</span>
                    <p style={{ fontSize: '11px', color: colors.textMuted, marginTop: '2px' }}>
                      Import notes from your published Quartz site via GitHub
                    </p>
                  </div>
                  <span className="status-badge success" style={{ fontSize: '10px' }}>
                    Available
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '8px', lineHeight: '1.4' }}>
                  Quartz is a static site generator for Obsidian. If you publish your notes with Quartz, you can browse and import them here.
                </p>
                <a
                  href="https://quartz.jzhao.xyz/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '11px',
                    color: colors.linkColor,
                    textDecoration: 'none',
                  }}
                >
                  Learn more about Quartz →
                </a>
              </div>

              <div className="settings-divider" />

              {/* Meeting & Communication Section */}
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', marginTop: '8px', color: colors.text }}>
                Meeting & Communication
              </h3>

              {/* Fathom Meetings */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: colors.cardBg,
                  borderRadius: '8px',
                  border: `1px solid ${colors.cardBorder}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🎥</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: colors.textHeading }}>Fathom Meetings</span>
                    <p style={{ fontSize: '11px', color: colors.textMuted, marginTop: '2px' }}>
                      Import meeting transcripts and AI summaries
                    </p>
                  </div>
                  <span className={`status-badge ${hasFathomApiKey ? 'success' : 'warning'}`} style={{ fontSize: '10px' }}>
                    {hasFathomApiKey ? 'Connected' : 'Not Set'}
                  </span>
                </div>

                {showFathomApiKeyInput ? (
                  <div style={{ marginTop: '8px' }}>
                    <input
                      type="password"
                      value={fathomApiKeyInput}
                      onChange={(e) => setFathomApiKeyInput(e.target.value)}
                      placeholder="Enter Fathom API key..."
                      className="settings-input"
                      style={{ width: '100%', marginBottom: '8px' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && fathomApiKeyInput.trim()) {
                          saveFathomApiKey(fathomApiKeyInput.trim(), session.username)
                          setHasFathomApiKey(true)
                          setShowFathomApiKeyInput(false)
                          setFathomApiKeyInput('')
                        } else if (e.key === 'Escape') {
                          setShowFathomApiKeyInput(false)
                          setFathomApiKeyInput('')
                        }
                      }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="settings-btn-sm primary"
                        style={{ flex: 1 }}
                        onClick={() => {
                          if (fathomApiKeyInput.trim()) {
                            saveFathomApiKey(fathomApiKeyInput.trim(), session.username)
                            setHasFathomApiKey(true)
                            setShowFathomApiKeyInput(false)
                            setFathomApiKeyInput('')
                          }
                        }}
                      >
                        Save
                      </button>
                      <button
                        className="settings-btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => {
                          setShowFathomApiKeyInput(false)
                          setFathomApiKeyInput('')
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                    <a
                      href="https://app.usefathom.com/settings/integrations"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        color: colors.linkColor,
                        textDecoration: 'none',
                        marginTop: '8px',
                      }}
                    >
                      Get your API key from Fathom Settings →
                    </a>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      className="settings-action-btn"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setShowFathomApiKeyInput(true)
                        const currentKey = getFathomApiKey(session.username)
                        if (currentKey) setFathomApiKeyInput(currentKey)
                      }}
                    >
                      {hasFathomApiKey ? 'Change API Key' : 'Add API Key'}
                    </button>
                    {hasFathomApiKey && (
                      <button
                        className="settings-action-btn secondary"
                        onClick={() => {
                          removeFathomApiKey(session.username)
                          setHasFathomApiKey(false)
                        }}
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="settings-divider" />

              {/* Data Import Section */}
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', marginTop: '8px', color: colors.text }}>
                Data Import
              </h3>

              {/* Google Workspace */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: colors.cardBg,
                  borderRadius: '8px',
                  border: `1px solid ${colors.cardBorder}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🔐</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: colors.textHeading }}>Google Workspace</span>
                    <p style={{ fontSize: '11px', color: colors.textMuted, marginTop: '2px' }}>
                      Import Gmail, Drive, Photos & Calendar - encrypted locally
                    </p>
                  </div>
                  <span className={`status-badge ${googleConnected ? 'success' : 'warning'}`} style={{ fontSize: '10px' }}>
                    {googleConnected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>

                {googleConnected && totalGoogleItems > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    marginBottom: '12px',
                    padding: '8px',
                    backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
                    borderRadius: '6px',
                  }}>
                    {googleCounts.gmail > 0 && (
                      <span style={{
                        fontSize: '10px',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor: colors.localBg,
                        color: colors.localText,
                        fontWeight: '500',
                      }}>
                        📧 {googleCounts.gmail} emails
                      </span>
                    )}
                    {googleCounts.drive > 0 && (
                      <span style={{
                        fontSize: '10px',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor: colors.gpuBg,
                        color: colors.gpuText,
                        fontWeight: '500',
                      }}>
                        📁 {googleCounts.drive} files
                      </span>
                    )}
                    {googleCounts.photos > 0 && (
                      <span style={{
                        fontSize: '10px',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor: colors.cloudBg,
                        color: colors.cloudText,
                        fontWeight: '500',
                      }}>
                        📷 {googleCounts.photos} photos
                      </span>
                    )}
                    {googleCounts.calendar > 0 && (
                      <span style={{
                        fontSize: '10px',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor: colors.successBg,
                        color: colors.successText,
                        fontWeight: '500',
                      }}>
                        📅 {googleCounts.calendar} events
                      </span>
                    )}
                  </div>
                )}

                <p style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '12px', lineHeight: '1.4' }}>
                  Your data is encrypted with AES-256 and stored only in your browser.
                  Choose what to share to the board.
                </p>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {googleConnected ? (
                    <>
                      <button
                        className="settings-action-btn"
                        style={{ flex: 1 }}
                        onClick={() => setShowGoogleExportBrowser(true)}
                        disabled={totalGoogleItems === 0}
                      >
                        Open Data Browser
                      </button>
                      <button
                        className="settings-action-btn secondary"
                        onClick={handleGoogleDisconnect}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      className="settings-action-btn"
                      style={{ width: '100%' }}
                      onClick={handleGoogleConnect}
                      disabled={googleLoading}
                    >
                      {googleLoading ? 'Connecting...' : 'Connect Google Account'}
                    </button>
                  )}
                </div>

                {googleConnected && totalGoogleItems === 0 && (
                  <p style={{ fontSize: '11px', color: colors.warningText, marginTop: '8px', textAlign: 'center' }}>
                    No data imported yet. Visit <a href="/google" style={{ color: colors.linkColor }}>/google</a> to import.
                  </p>
                )}
              </div>

              {/* Future Integrations Placeholder */}
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: colors.legendBg, borderRadius: '6px', border: `1px dashed ${colors.cardBorder}` }}>
                <p style={{ fontSize: '12px', color: colors.textMuted, textAlign: 'center' }}>
                  More integrations coming soon: Notion, Slack, and more
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Google Export Browser Modal */}
      <GoogleExportBrowser
        isOpen={showGoogleExportBrowser}
        onClose={() => setShowGoogleExportBrowser(false)}
        onAddToCanvas={handleAddToCanvas}
        isDarkMode={isDarkMode}
      />
    </div>
  )
}
