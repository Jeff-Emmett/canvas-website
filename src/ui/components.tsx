import React from "react"
import { createPortal } from "react-dom"
import { useParams } from "react-router-dom"
import { CustomMainMenu } from "./CustomMainMenu"
import { CustomToolbar } from "./CustomToolbar"
import { CustomContextMenu } from "./CustomContextMenu"
import { FocusLockIndicator } from "./FocusLockIndicator"
import { MycelialIntelligenceBar } from "./MycelialIntelligenceBar"
import { CommandPalette, openCommandPalette } from "./CommandPalette"
import { NetworkGraphPanel } from "../components/networking"
import CryptIDDropdown from "../components/auth/CryptIDDropdown"
import StarBoardButton from "../components/StarBoardButton"
import ShareBoardButton from "../components/ShareBoardButton"
import { SettingsDialog } from "./SettingsDialog"
import * as crypto from "../lib/auth/crypto"
// import { VersionHistoryPanel } from "../components/history" // TODO: Re-enable when version reversion is ready
import { useAuth } from "../context/AuthContext"
import { PermissionLevel } from "../lib/auth/types"
import { WORKER_URL } from "../constants/workerUrl"
import {
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  TLComponents,
  TldrawUiMenuItem,
  useTools,
  useActions,
  useDialogs,
} from "tldraw"
import { SlidesPanel } from "@/slides/SlidesPanel"
import { OnboardingTour, startOnboardingTour } from "./OnboardingTour"

// AI tool model configurations
const AI_TOOLS = [
  { id: 'chat', name: 'Chat', icon: '💬', model: 'llama3.1:8b', provider: 'Ollama', type: 'local' },
  { id: 'make-real', name: 'Make Real', icon: '🔧', model: 'claude-sonnet-4-5', provider: 'Anthropic', type: 'cloud' },
  { id: 'image-gen', name: 'Image Gen', icon: '🎨', model: 'SDXL', provider: 'RunPod', type: 'gpu' },
  { id: 'video-gen', name: 'Video Gen', icon: '🎬', model: 'Wan2.1', provider: 'RunPod', type: 'gpu' },
  { id: 'transcription', name: 'Transcribe', icon: '🎤', model: 'Web Speech', provider: 'Browser', type: 'local' },
  { id: 'mycelial', name: 'Mycelial', icon: '🍄', model: 'llama3.1:70b', provider: 'Ollama', type: 'local' },
];

// Permission labels and colors
const PERMISSION_CONFIG: Record<PermissionLevel, { label: string; color: string; icon: string }> = {
  view: { label: 'View Only', color: '#6b7280', icon: '👁️' },
  edit: { label: 'Edit', color: '#3b82f6', icon: '✏️' },
  admin: { label: 'Admin', color: '#10b981', icon: '👑' },
}

// Custom SharePanel with layout: CryptID -> Star -> Gear -> Question mark
// On mobile: Single gear icon that opens consolidated menu
function CustomSharePanel() {
  const { addDialog, removeDialog } = useDialogs()
  const { session } = useAuth()
  const { slug } = useParams<{ slug: string }>()
  const boardId = slug || 'mycofi33'

  // Mobile detection
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== 'undefined' && window.innerWidth < 640
  )

  // Listen for resize to update mobile state
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [showSettingsDropdown, setShowSettingsDropdown] = React.useState(false)
  const [showMobileMenu, setShowMobileMenu] = React.useState(false)
  const [mobileMenuSection, setMobileMenuSection] = React.useState<'main' | 'signin' | 'share' | 'settings'>('main')
  // const [showVersionHistory, setShowVersionHistory] = React.useState(false) // TODO: Re-enable when version reversion is ready
  const [showAISection, setShowAISection] = React.useState(false)
  const [hasApiKey, setHasApiKey] = React.useState(false)
  const [permissionRequestStatus, setPermissionRequestStatus] = React.useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [requestMessage, setRequestMessage] = React.useState('')

  // Board protection state
  const [boardProtected, setBoardProtected] = React.useState(false)
  const [protectionLoading, setProtectionLoading] = React.useState(false)
  const [isGlobalAdmin, setIsGlobalAdmin] = React.useState(false)
  const [isBoardAdmin, setIsBoardAdmin] = React.useState(false)
  const [editors, setEditors] = React.useState<Array<{ userId: string; username: string; permission: string }>>([])
  const [inviteInput, setInviteInput] = React.useState('')
  const [inviteStatus, setInviteStatus] = React.useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  // Refs for dropdown positioning
  const settingsButtonRef = React.useRef<HTMLButtonElement>(null)
  const mobileMenuButtonRef = React.useRef<HTMLButtonElement>(null)
  const [settingsDropdownPos, setSettingsDropdownPos] = React.useState<{ top: number; right: number } | null>(null)
  const [mobileMenuPos, setMobileMenuPos] = React.useState<{ top: number; right: number } | null>(null)

  // Get current permission from session
  // Authenticated users default to 'edit', unauthenticated to 'view'
  const currentPermission: PermissionLevel = session.currentBoardPermission || (session.authed ? 'edit' : 'view')

  // Request permission upgrade
  const handleRequestPermission = async (requestedLevel: PermissionLevel) => {
    if (!session.authed || !session.username) {
      setRequestMessage('Please sign in to request permissions')
      return
    }

    setPermissionRequestStatus('sending')
    try {
      const response = await fetch(`${WORKER_URL}/boards/${boardId}/permission-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: session.username,
          email: session.email,
          requestedPermission: requestedLevel,
          currentPermission,
          boardId,
        }),
      })

      if (response.ok) {
        setPermissionRequestStatus('sent')
        setRequestMessage(`Request for ${PERMISSION_CONFIG[requestedLevel].label} access sent to board admins`)
        setTimeout(() => {
          setPermissionRequestStatus('idle')
          setRequestMessage('')
        }, 5000)
      } else {
        throw new Error('Failed to send request')
      }
    } catch (error) {
      console.error('Permission request error:', error)
      setPermissionRequestStatus('error')
      setRequestMessage('Failed to send request. Please try again.')
      setTimeout(() => {
        setPermissionRequestStatus('idle')
        setRequestMessage('')
      }, 3000)
    }
  }

  // Update dropdown positions when they open
  React.useEffect(() => {
    if (showSettingsDropdown && settingsButtonRef.current) {
      const rect = settingsButtonRef.current.getBoundingClientRect()
      setSettingsDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
  }, [showSettingsDropdown])

  // Update mobile menu position when it opens
  React.useEffect(() => {
    if (showMobileMenu && mobileMenuButtonRef.current) {
      const rect = mobileMenuButtonRef.current.getBoundingClientRect()
      setMobileMenuPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
  }, [showMobileMenu])

  // ESC key handler for closing dropdowns
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (showSettingsDropdown) setShowSettingsDropdown(false)
        if (showMobileMenu) {
          if (mobileMenuSection !== 'main') {
            setMobileMenuSection('main')
          } else {
            setShowMobileMenu(false)
          }
        }
      }
    }
    if (showSettingsDropdown || showMobileMenu) {
      // Use capture phase to intercept before tldraw
      document.addEventListener('keydown', handleKeyDown, true)
    }
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [showSettingsDropdown, showMobileMenu, mobileMenuSection])

  // Detect dark mode - use state to trigger re-render on change
  const [isDarkMode, setIsDarkMode] = React.useState(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  // Check for API keys on mount
  React.useEffect(() => {
    const checkApiKeys = () => {
      const keys = localStorage.getItem('apiKeys')
      if (keys) {
        try {
          const parsed = JSON.parse(keys)
          setHasApiKey(!!(parsed.openai || parsed.anthropic || parsed.google))
        } catch {
          setHasApiKey(false)
        }
      }
    }
    checkApiKeys()
  }, [])

  const handleToggleDarkMode = () => {
    const newIsDark = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light')
    setIsDarkMode(newIsDark)
  }

  const handleManageApiKeys = () => {
    setShowSettingsDropdown(false)
    addDialog({
      id: "api-keys",
      component: ({ onClose: dialogClose }: { onClose: () => void }) => (
        <SettingsDialog
          onClose={() => {
            dialogClose()
            removeDialog("api-keys")
            // Recheck API keys after dialog closes
            const keys = localStorage.getItem('apiKeys')
            if (keys) {
              try {
                const parsed = JSON.parse(keys)
                setHasApiKey(!!(parsed.openai || parsed.anthropic || parsed.google))
              } catch {
                setHasApiKey(false)
              }
            }
          }}
        />
      ),
    })
  }

  // Get auth headers for API calls
  const getAuthHeaders = React.useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (session.authed && session.username) {
      const publicKey = crypto.getPublicKey(session.username)
      if (publicKey) {
        headers['X-CryptID-PublicKey'] = publicKey
      }
    }
    return headers
  }, [session.authed, session.username])

  // Fetch board info when settings dropdown opens
  const fetchBoardInfo = React.useCallback(async () => {
    if (!showSettingsDropdown) return

    setProtectionLoading(true)
    try {
      const headers = getAuthHeaders()

      // Fetch board info
      const infoRes = await fetch(`${WORKER_URL}/boards/${boardId}/info`, { headers })
      if (infoRes.ok) {
        const infoData = await infoRes.json() as { board?: { isProtected?: boolean } }
        if (infoData.board) {
          setBoardProtected(infoData.board.isProtected || false)
        }
      }

      // Fetch permission to check if admin
      const permRes = await fetch(`${WORKER_URL}/boards/${boardId}/permission`, { headers })
      if (permRes.ok) {
        const permData = await permRes.json() as { permission?: string; isGlobalAdmin?: boolean }
        setIsBoardAdmin(permData.permission === 'admin')
        setIsGlobalAdmin(permData.isGlobalAdmin || false)

        // If admin, fetch editors list
        if (permData.permission === 'admin') {
          const editorsRes = await fetch(`${WORKER_URL}/boards/${boardId}/editors`, { headers })
          if (editorsRes.ok) {
            const editorsData = await editorsRes.json() as { editors?: Array<{ userId: string; username: string; permission: string }> }
            setEditors(editorsData.editors || [])
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch board data:', error)
    } finally {
      setProtectionLoading(false)
    }
  }, [showSettingsDropdown, boardId, getAuthHeaders])

  // Fetch board info when dropdown opens
  React.useEffect(() => {
    if (showSettingsDropdown) {
      fetchBoardInfo()
    }
  }, [showSettingsDropdown, fetchBoardInfo])

  // Toggle board protection
  const handleToggleProtection = async () => {
    if (protectionLoading) return

    setProtectionLoading(true)
    try {
      const headers = getAuthHeaders()
      const res = await fetch(`${WORKER_URL}/boards/${boardId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isProtected: !boardProtected }),
      })

      if (res.ok) {
        setBoardProtected(!boardProtected)
        // Refresh editors list if now protected
        if (!boardProtected) {
          const editorsRes = await fetch(`${WORKER_URL}/boards/${boardId}/editors`, { headers })
          if (editorsRes.ok) {
            const editorsData = await editorsRes.json() as { editors?: Array<{ userId: string; username: string; permission: string }> }
            setEditors(editorsData.editors || [])
          }
        }
      }
    } catch (error) {
      console.error('Failed to toggle protection:', error)
    } finally {
      setProtectionLoading(false)
    }
  }

  // Invite user as editor
  const handleInviteEditor = async () => {
    if (!inviteInput.trim() || inviteStatus === 'sending') return

    setInviteStatus('sending')
    try {
      const headers = getAuthHeaders()
      const res = await fetch(`${WORKER_URL}/boards/${boardId}/permissions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          usernameOrEmail: inviteInput.trim(),
          permission: 'edit',
        }),
      })

      if (res.ok) {
        setInviteStatus('sent')
        setInviteInput('')
        // Refresh editors list
        const editorsRes = await fetch(`${WORKER_URL}/boards/${boardId}/editors`, { headers })
        if (editorsRes.ok) {
          const editorsData = await editorsRes.json() as { editors?: Array<{ userId: string; username: string; permission: string }> }
          setEditors(editorsData.editors || [])
        }
        setTimeout(() => setInviteStatus('idle'), 2000)
      } else {
        setInviteStatus('error')
        setTimeout(() => setInviteStatus('idle'), 3000)
      }
    } catch (error) {
      console.error('Failed to invite editor:', error)
      setInviteStatus('error')
      setTimeout(() => setInviteStatus('idle'), 3000)
    }
  }

  // Remove editor
  const handleRemoveEditor = async (userId: string) => {
    try {
      const headers = getAuthHeaders()
      await fetch(`${WORKER_URL}/boards/${boardId}/permissions/${userId}`, {
        method: 'DELETE',
        headers,
      })
      setEditors(prev => prev.filter(e => e.userId !== userId))
    } catch (error) {
      console.error('Failed to remove editor:', error)
    }
  }

  // Separator component for unified menu
  const Separator = () => (
    <div style={{
      width: '1px',
      height: '20px',
      background: 'var(--color-panel-contrast)',
      opacity: 0.5,
    }} />
  )

  // Mobile consolidated menu component
  const MobileMenu = () => (
    <div
      className="tlui-share-zone"
      draggable={false}
      style={{
        position: 'fixed',
        top: '8px',
        right: '8px',
        pointerEvents: 'all',
        zIndex: 1000,
      }}
    >
      {/* Single gear icon for mobile - positioned to match top-left menu */}
      <button
        ref={mobileMenuButtonRef}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setShowMobileMenu(!showMobileMenu)
          setMobileMenuSection('main')
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: isDarkMode ? '#2d2d2d' : '#f3f4f6',
          border: `1px solid ${isDarkMode ? '#404040' : '#e5e7eb'}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          color: 'var(--color-text-1)',
          transition: 'all 0.15s',
          pointerEvents: 'all',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        }}
        title="Menu"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      {/* Mobile menu dropdown */}
      {showMobileMenu && mobileMenuPos && createPortal(
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99998,
              background: 'rgba(0,0,0,0.3)',
            }}
            onClick={() => {
              setShowMobileMenu(false)
              setMobileMenuSection('main')
            }}
          />
          {/* Menu */}
          <div
            style={{
              position: 'fixed',
              top: mobileMenuPos.top,
              right: Math.max(8, mobileMenuPos.right - 100),
              width: 'calc(100vw - 16px)',
              maxWidth: '320px',
              maxHeight: '70vh',
              overflowY: 'auto',
              background: 'var(--color-panel)',
              border: '1px solid var(--color-panel-contrast)',
              borderRadius: '12px',
              boxShadow: isDarkMode ? '0 4px 24px rgba(0,0,0,0.6)' : '0 4px 24px rgba(0,0,0,0.2)',
              zIndex: 99999,
              padding: '8px 0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Main menu */}
            {mobileMenuSection === 'main' && (
              <>
                {/* Header */}
                <div style={{
                  padding: '8px 16px 12px',
                  borderBottom: '1px solid var(--color-panel-contrast)',
                  marginBottom: '4px',
                }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                    Menu
                  </span>
                </div>

                {/* Sign In / Account */}
                <button
                  onClick={() => setMobileMenuSection('signin')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '18px' }}>👤</span>
                    <span>{session.authed ? `@${session.username}` : 'Sign In'}</span>
                  </span>
                  <span style={{ color: 'var(--color-text-3)' }}>→</span>
                </button>

                {/* Share */}
                <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '18px' }}>🔗</span>
                  <ShareBoardButton className="mobile-menu-item" />
                </div>

                {/* Star */}
                <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '18px' }}>⭐</span>
                  <StarBoardButton className="mobile-menu-item" />
                </div>

                <div style={{ height: '1px', background: 'var(--color-panel-contrast)', margin: '8px 0' }} />

                {/* Appearance */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: 'var(--color-text)' }}>
                    <span style={{ fontSize: '18px' }}>🎨</span>
                    <span>Dark Mode</span>
                  </span>
                  <button
                    onClick={handleToggleDarkMode}
                    style={{
                      width: '44px',
                      height: '24px',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      background: isDarkMode ? '#3b82f6' : '#d1d5db',
                      position: 'relative',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '10px',
                      background: 'white',
                      position: 'absolute',
                      top: '2px',
                      left: isDarkMode ? '22px' : '2px',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>

                {/* Settings */}
                <button
                  onClick={() => setMobileMenuSection('settings')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '18px' }}>⚙️</span>
                    <span>Settings & Permissions</span>
                  </span>
                  <span style={{ color: 'var(--color-text-3)' }}>→</span>
                </button>

                {/* Keyboard Shortcuts */}
                <button
                  onClick={() => {
                    setShowMobileMenu(false)
                    openCommandPalette()
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '18px' }}>⌨️</span>
                    <span>Keyboard Shortcuts</span>
                  </span>
                </button>

                {/* API Keys */}
                <button
                  onClick={() => {
                    setShowMobileMenu(false)
                    handleManageApiKeys()
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '18px' }}>🔑</span>
                    <span>API Keys</span>
                  </span>
                </button>

                {/* Show Tutorial */}
                <button
                  onClick={() => {
                    setShowMobileMenu(false)
                    startOnboardingTour()
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '18px' }}>🎓</span>
                    <span>Show Tutorial</span>
                  </span>
                </button>
              </>
            )}

            {/* Sign In Section */}
            {mobileMenuSection === 'signin' && (
              <>
                {/* Back button */}
                <button
                  onClick={() => setMobileMenuSection('main')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--color-panel-contrast)',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                >
                  <span>←</span>
                  <span style={{ fontWeight: 600 }}>Account</span>
                </button>
                <div style={{ padding: '16px' }}>
                  {/* Render CryptIDDropdown which handles its own modal */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <CryptIDDropdown isDarkMode={isDarkMode} />
                  </div>
                  {session.authed && (
                    <div style={{ marginTop: '16px', textAlign: 'center' }}>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-3)', marginBottom: '8px' }}>
                        Signed in as <strong>@{session.username}</strong>
                      </p>
                      {session.email && (
                        <p style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
                          {session.email}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Settings Section */}
            {mobileMenuSection === 'settings' && (
              <>
                {/* Back button */}
                <button
                  onClick={() => setMobileMenuSection('main')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--color-panel-contrast)',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                >
                  <span>←</span>
                  <span style={{ fontWeight: 600 }}>Settings & Permissions</span>
                </button>

                {/* Permission info */}
                <div style={{ padding: '16px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                  }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>Your Permission</span>
                    <span style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      background: `${PERMISSION_CONFIG[currentPermission].color}20`,
                      color: PERMISSION_CONFIG[currentPermission].color,
                      fontWeight: 600,
                    }}>
                      {PERMISSION_CONFIG[currentPermission].icon} {PERMISSION_CONFIG[currentPermission].label}
                    </span>
                  </div>

                  {/* Request higher permission */}
                  {session.authed && currentPermission !== 'admin' && (
                    <button
                      onClick={() => handleRequestPermission(currentPermission === 'view' ? 'edit' : 'admin')}
                      disabled={permissionRequestStatus === 'sending'}
                      style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '13px',
                        fontWeight: 500,
                        fontFamily: 'inherit',
                        borderRadius: '8px',
                        border: '1px solid var(--color-primary, #3b82f6)',
                        background: 'transparent',
                        color: 'var(--color-primary, #3b82f6)',
                        cursor: permissionRequestStatus === 'sending' ? 'wait' : 'pointer',
                        marginBottom: '12px',
                      }}
                    >
                      {permissionRequestStatus === 'sending' ? 'Sending...' :
                       permissionRequestStatus === 'sent' ? 'Request Sent!' :
                       `Request ${currentPermission === 'view' ? 'Edit' : 'Admin'} Access`}
                    </button>
                  )}

                  {/* Board protection toggle for admins */}
                  {isBoardAdmin && (
                    <div style={{
                      padding: '12px',
                      background: 'var(--color-muted-2)',
                      borderRadius: '8px',
                      marginTop: '8px',
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                      }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                          🛡️ View-only Mode
                        </span>
                        <button
                          onClick={handleToggleProtection}
                          disabled={protectionLoading}
                          style={{
                            width: '44px',
                            height: '24px',
                            borderRadius: '12px',
                            border: 'none',
                            cursor: protectionLoading ? 'not-allowed' : 'pointer',
                            background: boardProtected ? '#3b82f6' : '#d1d5db',
                            position: 'relative',
                            transition: 'background 0.2s',
                          }}
                        >
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '10px',
                            background: 'white',
                            position: 'absolute',
                            top: '2px',
                            left: boardProtected ? '22px' : '2px',
                            transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }} />
                        </button>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-3)', margin: 0 }}>
                        {boardProtected ? 'Only listed editors can make changes' : 'Anyone can edit this board'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  )

  // Return mobile menu on small screens, full menu on larger screens
  if (isMobile) {
    return <MobileMenu />
  }

  return (
    <div className="tlui-share-zone" draggable={false} style={{ position: 'relative' }}>
      {/* Unified menu container - grey oval */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        background: isDarkMode ? '#2d2d2d' : '#f3f4f6',
        backgroundColor: isDarkMode ? '#2d2d2d' : '#f3f4f6',
        backdropFilter: 'none',
        opacity: 1,
        borderRadius: '20px',
        border: `1px solid ${isDarkMode ? '#404040' : '#e5e7eb'}`,
        padding: '4px 6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        {/* CryptID dropdown - leftmost */}
        <div className="cryptid-dropdown-trigger" style={{ padding: '0 4px' }}>
          <CryptIDDropdown isDarkMode={isDarkMode} />
        </div>

        <Separator />

        {/* Share board button */}
        <div className="share-board-button" style={{ padding: '0 2px' }}>
          <ShareBoardButton className="share-panel-btn" />
        </div>

        <Separator />

        {/* Star board button */}
        <div style={{ padding: '0 2px' }}>
          <StarBoardButton className="share-panel-btn" />
        </div>

        <Separator />

        {/* Settings gear button with dropdown */}
        <div style={{ padding: '0 2px' }}>
          <button
            ref={settingsButtonRef}
            onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
            className="share-panel-btn"
            style={{
              background: showSettingsDropdown ? 'var(--color-muted-2)' : 'none',
              border: 'none',
              padding: '6px',
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-1)',
              opacity: showSettingsDropdown ? 1 : 0.7,
              transition: 'opacity 0.15s, background 0.15s',
              pointerEvents: 'all',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.background = 'var(--color-muted-2)'
            }}
            onMouseLeave={(e) => {
              if (!showSettingsDropdown) {
                e.currentTarget.style.opacity = '0.7'
                e.currentTarget.style.background = 'none'
              }
            }}
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>

          {/* Settings dropdown - rendered via portal to break out of parent container */}
          {showSettingsDropdown && settingsDropdownPos && createPortal(
            <>
              {/* Backdrop - only uses onClick, not onPointerDown */}
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 99998,
                  background: 'transparent',
                }}
                onClick={() => setShowSettingsDropdown(false)}
              />
              {/* Dropdown menu */}
              <div
                style={{
                  position: 'fixed',
                  top: settingsDropdownPos.top,
                  right: settingsDropdownPos.right,
                  minWidth: '220px',
                  maxHeight: '60vh',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  background: isDarkMode ? '#2d2d2d' : '#ffffff',
                  backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
                  border: `1px solid ${isDarkMode ? '#404040' : '#e5e5e5'}`,
                  borderRadius: '8px',
                  boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.25)',
                  zIndex: 99999,
                  padding: '8px 0',
                  pointerEvents: 'auto',
                  backdropFilter: 'none',
                  opacity: 1,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                }}
                onWheel={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Board Permission Section */}
                <div style={{ padding: '12px 16px 16px' }}>
                  {/* Section Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid var(--color-panel-contrast)',
                  }}>
                    <span style={{ fontSize: '14px' }}>🔐</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Board Permission</span>
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '10px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: `${PERMISSION_CONFIG[currentPermission].color}20`,
                      color: PERMISSION_CONFIG[currentPermission].color,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                    }}>
                      {PERMISSION_CONFIG[currentPermission].label}
                    </span>
                  </div>

                  {/* Permission levels - indented to show hierarchy */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    marginLeft: '4px',
                    padding: '8px 12px',
                    background: 'var(--color-muted-2)',
                    borderRadius: '8px',
                    border: '1px solid var(--color-panel-contrast)',
                  }}>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-3)', marginBottom: '4px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Access Levels
                    </span>
                    {(['view', 'edit', 'admin'] as PermissionLevel[]).map((level) => {
                      const config = PERMISSION_CONFIG[level]
                      const isCurrent = currentPermission === level
                      const canRequest = session.authed && !isCurrent && (
                        (level === 'edit' && currentPermission === 'view') ||
                        (level === 'admin' && currentPermission !== 'admin')
                      )

                      return (
                        <div
                          key={level}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            background: isCurrent ? `${config.color}15` : 'var(--color-panel)',
                            border: isCurrent ? `2px solid ${config.color}` : '1px solid var(--color-panel-contrast)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12px',
                            color: isCurrent ? config.color : 'var(--color-text)',
                            fontWeight: isCurrent ? 600 : 400,
                          }}>
                            <span style={{ fontSize: '14px' }}>{config.icon}</span>
                            <span>{config.label}</span>
                            {isCurrent && (
                              <span style={{
                                fontSize: '9px',
                                padding: '2px 6px',
                                borderRadius: '10px',
                                background: config.color,
                                color: 'white',
                                fontWeight: 500,
                              }}>
                                Current
                              </span>
                            )}
                          </span>

                          {canRequest && (
                            <button
                              onClick={() => handleRequestPermission(level)}
                              disabled={permissionRequestStatus === 'sending'}
                              style={{
                                padding: '4px 10px',
                                fontSize: '10px',
                                fontWeight: 600,
                                borderRadius: '4px',
                                border: `1px solid ${config.color}`,
                                background: 'transparent',
                                color: config.color,
                                cursor: permissionRequestStatus === 'sending' ? 'wait' : 'pointer',
                                opacity: permissionRequestStatus === 'sending' ? 0.6 : 1,
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = config.color
                                e.currentTarget.style.color = 'white'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent'
                                e.currentTarget.style.color = config.color
                              }}
                            >
                              {permissionRequestStatus === 'sending' ? '...' : 'Request'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Request status message */}
                  {requestMessage && (
                    <p style={{
                      margin: '10px 0 0',
                      fontSize: '11px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: permissionRequestStatus === 'sent' ? '#d1fae5' :
                                 permissionRequestStatus === 'error' ? '#fee2e2' : 'var(--color-muted-2)',
                      color: permissionRequestStatus === 'sent' ? '#065f46' :
                             permissionRequestStatus === 'error' ? '#dc2626' : 'var(--color-text-3)',
                      textAlign: 'center',
                    }}>
                      {requestMessage}
                    </p>
                  )}

                  {!session.authed && (
                    <p style={{
                      margin: '10px 0 0',
                      fontSize: '10px',
                      color: 'var(--color-text-3)',
                      textAlign: 'center',
                      fontStyle: 'italic',
                    }}>
                      Sign in to request higher permissions
                    </p>
                  )}
                </div>

                <div style={{ height: '1px', background: 'var(--color-panel-contrast)', margin: '0' }} />

                {/* Board Protection Section - only for admins */}
                {isBoardAdmin && (
                  <div style={{ padding: '12px 16px' }}>
                    {/* Section Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px',
                    }}>
                      <span style={{ fontSize: '14px' }}>🛡️</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Board Protection</span>
                      {isGlobalAdmin && (
                        <span style={{
                          fontSize: '9px',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          background: '#3b82f620',
                          color: '#3b82f6',
                          fontWeight: 600,
                        }}>
                          Global Admin
                        </span>
                      )}
                    </div>

                    {/* Protection Toggle */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--color-muted-2)',
                      borderRadius: '8px',
                      border: '1px solid var(--color-panel-contrast)',
                      marginBottom: boardProtected ? '12px' : '0',
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)' }}>
                          View-only Mode
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>
                          {boardProtected ? 'Only listed editors can make changes' : 'Anyone can edit this board'}
                        </div>
                      </div>
                      <button
                        onClick={handleToggleProtection}
                        disabled={protectionLoading}
                        style={{
                          width: '44px',
                          height: '24px',
                          borderRadius: '12px',
                          border: 'none',
                          cursor: protectionLoading ? 'not-allowed' : 'pointer',
                          background: boardProtected ? '#3b82f6' : '#d1d5db',
                          position: 'relative',
                          transition: 'background 0.2s',
                          opacity: protectionLoading ? 0.5 : 1,
                        }}
                      >
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '10px',
                          background: 'white',
                          position: 'absolute',
                          top: '2px',
                          left: boardProtected ? '22px' : '2px',
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </button>
                    </div>

                    {/* Editor Management - only when protected */}
                    {boardProtected && (
                      <div style={{
                        padding: '10px 12px',
                        background: 'var(--color-muted-2)',
                        borderRadius: '8px',
                        border: '1px solid var(--color-panel-contrast)',
                      }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-3)', marginBottom: '8px', textTransform: 'uppercase' }}>
                          Editors ({editors.length})
                        </div>

                        {/* Add Editor Input */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: editors.length > 0 ? '10px' : '0' }}>
                          <input
                            type="text"
                            placeholder="Username or email..."
                            value={inviteInput}
                            onChange={(e) => setInviteInput(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation()
                              if (e.key === 'Enter') handleInviteEditor()
                            }}
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              fontSize: '12px',
                              fontFamily: 'inherit',
                              border: '1px solid var(--color-panel-contrast)',
                              borderRadius: '6px',
                              background: 'var(--color-panel)',
                              color: 'var(--color-text)',
                              outline: 'none',
                            }}
                          />
                          <button
                            onClick={handleInviteEditor}
                            disabled={!inviteInput.trim() || inviteStatus === 'sending'}
                            style={{
                              padding: '8px 14px',
                              backgroundColor: inviteStatus === 'sent' ? '#10b981' : '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: !inviteInput.trim() || inviteStatus === 'sending' ? 'not-allowed' : 'pointer',
                              fontSize: '11px',
                              fontWeight: 500,
                              fontFamily: 'inherit',
                              opacity: !inviteInput.trim() ? 0.5 : 1,
                            }}
                          >
                            {inviteStatus === 'sending' ? '...' : inviteStatus === 'sent' ? 'Added' : 'Add'}
                          </button>
                        </div>

                        {/* Editor List */}
                        {editors.length > 0 && (
                          <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                            {editors.map((editor) => (
                              <div
                                key={editor.userId}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  marginBottom: '4px',
                                  background: 'var(--color-panel)',
                                }}
                              >
                                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)' }}>
                                  @{editor.username}
                                </span>
                                <button
                                  onClick={() => handleRemoveEditor(editor.userId)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#ef4444',
                                    fontSize: '12px',
                                    padding: '2px 6px',
                                    opacity: 0.7,
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}
                                  title="Remove editor"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {editors.length === 0 && (
                          <div style={{ fontSize: '10px', color: 'var(--color-text-3)', textAlign: 'center', padding: '4px' }}>
                            No editors added yet
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {isBoardAdmin && (
                  <div style={{ height: '1px', background: 'var(--color-panel-contrast)', margin: '0' }} />
                )}

                {/* Appearance Toggle */}
                <div style={{ padding: '12px 16px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                      <span style={{ fontSize: '14px' }}>🎨</span>
                      <span>Appearance</span>
                    </span>

                    {/* Toggle Switch */}
                    <button
                      onClick={handleToggleDarkMode}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0',
                        padding: '3px',
                        background: isDarkMode ? '#374151' : '#e5e7eb',
                        border: 'none',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      {/* Sun icon */}
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: !isDarkMode ? '#ffffff' : 'transparent',
                        boxShadow: !isDarkMode ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                        transition: 'all 0.2s ease',
                        fontSize: '14px',
                      }}>
                        ☀️
                      </span>
                      {/* Moon icon */}
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: isDarkMode ? '#1f2937' : 'transparent',
                        boxShadow: isDarkMode ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                        transition: 'all 0.2s ease',
                        fontSize: '14px',
                      }}>
                        🌙
                      </span>
                    </button>
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--color-panel-contrast)', margin: '0' }} />

                {/* Show Tutorial Button */}
                <div style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => {
                      setShowSettingsDropdown(false)
                      startOnboardingTour()
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      background: 'none',
                      border: `1px solid ${isDarkMode ? '#404040' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      fontWeight: 500,
                      fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
                      e.currentTarget.style.borderColor = '#10b981'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none'
                      e.currentTarget.style.borderColor = isDarkMode ? '#404040' : '#e5e7eb'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>🎓</span>
                    <span>Show Tutorial</span>
                  </button>
                </div>

                <div style={{ height: '1px', background: 'var(--color-panel-contrast)', margin: '0' }} />

                {/* AI Models Accordion */}
                <div>
                  <button
                    onClick={() => setShowAISection(!showAISection)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: showAISection ? 'var(--color-muted-2)' : 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      fontWeight: 600,
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      if (!showAISection) e.currentTarget.style.background = 'var(--color-muted-2)'
                    }}
                    onMouseLeave={(e) => {
                      if (!showAISection) e.currentTarget.style.background = 'none'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>🤖</span>
                      <span>AI Models</span>
                      <span style={{
                        fontSize: '9px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        background: 'var(--color-muted-2)',
                        color: 'var(--color-text-3)',
                      }}>
                        {AI_TOOLS.length}
                      </span>
                    </span>
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      background: showAISection ? 'var(--color-panel)' : 'var(--color-muted-2)',
                      transition: 'all 0.2s ease',
                    }}>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        style={{
                          transform: showAISection ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                          color: 'var(--color-text-3)',
                        }}
                      >
                        <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                      </svg>
                    </span>
                  </button>

                  {showAISection && (
                    <div style={{
                      padding: '12px 16px',
                      background: 'var(--color-muted-2)',
                      borderTop: '1px solid var(--color-panel-contrast)',
                    }}>
                      <p style={{
                        fontSize: '11px',
                        color: 'var(--color-text-3)',
                        marginBottom: '12px',
                        padding: '8px 10px',
                        background: 'var(--color-panel)',
                        borderRadius: '6px',
                        border: '1px solid var(--color-panel-contrast)',
                      }}>
                        💡 <strong>Local models</strong> are free. <strong>Cloud models</strong> require API keys.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {AI_TOOLS.map((tool) => (
                          <div
                            key={tool.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              background: 'var(--color-panel)',
                              borderRadius: '6px',
                              border: '1px solid var(--color-panel-contrast)',
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--color-text)' }}>
                              <span style={{ fontSize: '14px' }}>{tool.icon}</span>
                              <span style={{ fontWeight: 500 }}>{tool.name}</span>
                            </span>
                            <span
                              style={{
                                fontSize: '9px',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                backgroundColor: tool.type === 'local' ? '#d1fae5' : tool.type === 'gpu' ? '#e0e7ff' : '#fef3c7',
                                color: tool.type === 'local' ? '#065f46' : tool.type === 'gpu' ? '#3730a3' : '#92400e',
                                fontWeight: 600,
                              }}
                            >
                              {tool.model}
                            </span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleManageApiKeys}
                        style={{
                          width: '100%',
                          marginTop: '12px',
                          padding: '8px 12px',
                          fontSize: '11px',
                          fontWeight: 500,
                          fontFamily: 'inherit',
                          backgroundColor: 'var(--color-primary, #3b82f6)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#2563eb'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-primary, #3b82f6)'
                        }}
                      >
                        <span>🔑</span>
                        {hasApiKey ? 'Manage API Keys' : 'Add API Keys'}
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ height: '1px', background: 'var(--color-panel-contrast)', margin: '0' }} />

                {/* Version Reversion - Coming Soon */}
                <div style={{ padding: '12px 16px' }}>
                  {/* Section Header - matches other headers */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '10px',
                  }}>
                    <span style={{ fontSize: '14px' }}>🕐</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Version Reversion</span>
                  </div>

                  {/* Coming Soon Button */}
                  <button
                    disabled
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      background: 'var(--color-muted-2)',
                      border: '1px solid var(--color-panel-contrast)',
                      borderRadius: '6px',
                      cursor: 'not-allowed',
                      color: 'var(--color-text-3)',
                      fontSize: '11px',
                      fontWeight: 500,
                      fontFamily: 'inherit',
                    }}
                  >
                    Coming soon
                  </button>
                </div>

              </div>
            </>,
            document.body
          )}
        </div>

        <Separator />

        {/* Help/Keyboard shortcuts button - rightmost - opens Command Palette */}
        <div className="help-button" style={{ padding: '0 4px' }}>
          <button
            onClick={() => openCommandPalette()}
            className="share-panel-btn"
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-1)',
              opacity: 0.7,
              transition: 'opacity 0.15s, background 0.15s',
              pointerEvents: 'all',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.background = 'var(--color-muted-2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7'
              e.currentTarget.style.background = 'none'
            }}
            title="Keyboard shortcuts (?)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Version Reversion Panel - Coming Soon */}
      {/* TODO: Re-enable when version history backend is fully tested
      {showVersionHistory && createPortal(
        <VersionHistoryPanel
          roomId={boardId}
          onClose={() => setShowVersionHistory(false)}
          onRevert={(hash) => {
            console.log('Reverted to version:', hash)
            window.location.reload()
          }}
          isDarkMode={isDarkMode}
        />,
        document.body
      )}
      */}

    </div>
  )
}

// Combined InFrontOfCanvas component for floating UI elements
function CustomInFrontOfCanvas() {
  return (
    <>
      <MycelialIntelligenceBar />
      <FocusLockIndicator />
      <CommandPalette />
      {/* NetworkGraphPanel temporarily disabled for main branch - re-enable when ready */}
      {/* <NetworkGraphPanel /> */}
      <OnboardingTour />
    </>
  )
}

export const components: TLComponents = {
  Toolbar: CustomToolbar,
  MainMenu: CustomMainMenu,
  ContextMenu: CustomContextMenu,
  HelperButtons: SlidesPanel,
  SharePanel: CustomSharePanel,
  InFrontOfTheCanvas: CustomInFrontOfCanvas,
  KeyboardShortcutsDialog: (props: any) => {
    const tools = useTools()
    const actions = useActions()
    
    // Get all custom tools with keyboard shortcuts
    const customTools = [
      tools["VideoChat"],
      tools["ChatBox"],
      tools["Embed"],
      tools["Slide"],
      tools["Markdown"],
      tools["MycrozineTemplate"],
      tools["Prompt"],
      tools["ObsidianNote"],
      tools["Transcription"],
      tools["Holon"],
      tools["FathomMeetings"],
      tools["ImageGen"],
      // tools["VideoGen"], // Temporarily hidden
      tools["Multmux"],
      // MycelialIntelligence moved to permanent floating bar
    ].filter(tool => tool && tool.kbd)
    
    // Get all custom actions with keyboard shortcuts
    const customActions = [
      actions["zoom-in"],
      actions["zoom-out"],
      actions["zoom-to-selection"],
      actions["copy-link-to-current-view"],
      actions["copy-focus-link"],
      actions["unlock-camera-focus"],
      actions["revert-camera"],
      actions["lock-element"],
      actions["save-to-pdf"],
      actions["search-shapes"],
      actions["llm"],
      actions["open-obsidian-browser"],
    ].filter(action => action && action.kbd)
    
    return (
      <DefaultKeyboardShortcutsDialog {...props}>
        {/* Custom Tools */}
        {customTools.map(tool => (
          <TldrawUiMenuItem 
            key={tool.id} 
            id={tool.id}
            label={tool.label}
            icon={typeof tool.icon === 'string' ? tool.icon : undefined}
            kbd={tool.kbd}
            onSelect={tool.onSelect}
          />
        ))}
        
        {/* Custom Actions */}
        {customActions.map(action => (
          <TldrawUiMenuItem 
            key={action.id} 
            id={action.id}
            label={action.label}
            icon={typeof action.icon === 'string' ? action.icon : undefined}
            kbd={action.kbd}
            onSelect={action.onSelect}
          />
        ))}
        
        {/* Default content (includes standard TLDraw shortcuts) */}
        <DefaultKeyboardShortcutsDialogContent />
      </DefaultKeyboardShortcutsDialog>
    )
  },
}
