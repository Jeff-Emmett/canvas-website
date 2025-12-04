import { useState, useEffect, useRef } from "react"
import { useAuth } from "../context/AuthContext"
import { useDialogs } from "tldraw"
import { SettingsDialog } from "./SettingsDialog"
import { getFathomApiKey, saveFathomApiKey, removeFathomApiKey, isFathomApiKeyConfigured } from "../lib/fathomApiKey"

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
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="settings-section">
              {/* AI Tools Overview */}
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                  AI Tools & Models
                </h3>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px', lineHeight: '1.4' }}>
                  Each tool uses optimized AI models. Local models run on your private server for free, cloud models require API keys.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {AI_TOOLS.map((tool) => (
                    <div
                      key={tool.id}
                      style={{
                        padding: '12px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '16px' }}>{tool.icon}</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937' }}>{tool.name}</span>
                      </div>
                      <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>{tool.description}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            backgroundColor: tool.models.primary.type === 'local' ? '#d1fae5' : tool.models.primary.type === 'gpu' ? '#e0e7ff' : '#fef3c7',
                            color: tool.models.primary.type === 'local' ? '#065f46' : tool.models.primary.type === 'gpu' ? '#3730a3' : '#92400e',
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
                              backgroundColor: '#f3f4f6',
                              color: '#6b7280',
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
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                    Local (Free)
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1' }}></span>
                    GPU (RunPod)
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></span>
                    Cloud (API Key)
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="settings-section">
              {/* Knowledge Management Section */}
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                Knowledge Management
              </h3>

              {/* Obsidian Vault - Local Files */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>📁</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937' }}>Obsidian Vault (Local)</span>
                    <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                      Import notes directly from your local Obsidian vault
                    </p>
                  </div>
                  <span className={`status-badge ${session.obsidianVaultName ? 'success' : 'warning'}`} style={{ fontSize: '10px' }}>
                    {session.obsidianVaultName ? 'Connected' : 'Not Set'}
                  </span>
                </div>
                {session.obsidianVaultName && (
                  <p style={{ fontSize: '11px', color: '#059669', marginBottom: '8px' }}>
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
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🌐</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937' }}>Obsidian Quartz (Web)</span>
                    <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                      Import notes from your published Quartz site via GitHub
                    </p>
                  </div>
                  <span className="status-badge success" style={{ fontSize: '10px' }}>
                    Available
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', lineHeight: '1.4' }}>
                  Quartz is a static site generator for Obsidian. If you publish your notes with Quartz, you can browse and import them here.
                </p>
                <a
                  href="https://quartz.jzhao.xyz/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '11px',
                    color: '#3b82f6',
                    textDecoration: 'none',
                  }}
                >
                  Learn more about Quartz →
                </a>
              </div>

              <div className="settings-divider" />

              {/* Meeting & Communication Section */}
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', marginTop: '8px', color: '#374151' }}>
                Meeting & Communication
              </h3>

              {/* Fathom Meetings */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🎥</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937' }}>Fathom Meetings</span>
                    <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
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
                        color: '#3b82f6',
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

              {/* Future Integrations Placeholder */}
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                  More integrations coming soon: Google Calendar, Notion, and more
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
