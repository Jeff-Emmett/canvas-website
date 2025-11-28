import { useState, useEffect, useRef } from "react"
import { useAuth } from "../context/AuthContext"
import { useDialogs } from "tldraw"
import { SettingsDialog } from "./SettingsDialog"
import { getFathomApiKey, saveFathomApiKey, removeFathomApiKey, isFathomApiKeyConfigured } from "../lib/fathomApiKey"

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
              <div className="settings-item">
                <div className="settings-item-info">
                  <span className="settings-item-label">AI API Keys</span>
                  <span className="settings-item-description">
                    {hasApiKey ? 'Your AI models are configured and ready' : 'Configure API keys to use AI features'}
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
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="settings-section">
              {/* Obsidian Vault */}
              <div className="settings-item">
                <div className="settings-item-info">
                  <span className="settings-item-label">Obsidian Vault</span>
                  <span className="settings-item-description">
                    {session.obsidianVaultName
                      ? `Connected: ${session.obsidianVaultName}`
                      : 'Connect your Obsidian vault to import notes'}
                  </span>
                </div>
                <div className="settings-item-status">
                  <span className={`status-badge ${session.obsidianVaultName ? 'success' : 'warning'}`}>
                    {session.obsidianVaultName ? 'Connected' : 'Not Set'}
                  </span>
                </div>
              </div>
              <button className="settings-action-btn" onClick={handleSetVault}>
                {session.obsidianVaultName ? 'Change Vault' : 'Connect Vault'}
              </button>

              <div className="settings-divider" />

              {/* Fathom API */}
              <div className="settings-item">
                <div className="settings-item-info">
                  <span className="settings-item-label">Fathom Meetings</span>
                  <span className="settings-item-description">
                    {hasFathomApiKey
                      ? 'Your Fathom account is connected'
                      : 'Connect Fathom to import meeting recordings'}
                  </span>
                </div>
                <div className="settings-item-status">
                  <span className={`status-badge ${hasFathomApiKey ? 'success' : 'warning'}`}>
                    {hasFathomApiKey ? 'Connected' : 'Not Set'}
                  </span>
                </div>
              </div>

              {showFathomApiKeyInput ? (
                <div className="settings-input-group">
                  <input
                    type="password"
                    value={fathomApiKeyInput}
                    onChange={(e) => setFathomApiKeyInput(e.target.value)}
                    placeholder="Enter Fathom API key..."
                    className="settings-input"
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
                  <div className="settings-input-actions">
                    <button
                      className="settings-btn-sm primary"
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
                      onClick={() => {
                        setShowFathomApiKeyInput(false)
                        setFathomApiKeyInput('')
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="settings-button-group">
                  <button
                    className="settings-action-btn"
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
          )}
        </div>
      </div>
    </div>
  )
}
