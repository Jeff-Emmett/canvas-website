import { useState, useEffect, useRef } from 'react'

interface VisibilityChangeModalProps {
  isOpen: boolean
  itemTitle: string
  currentVisibility: 'local' | 'shared'
  newVisibility: 'local' | 'shared'
  onConfirm: (dontAskAgain: boolean) => void
  onCancel: () => void
  isDarkMode: boolean
}

export function VisibilityChangeModal({
  isOpen,
  itemTitle,
  currentVisibility,
  newVisibility,
  onConfirm,
  onCancel,
  isDarkMode,
}: VisibilityChangeModalProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onCancel])

  // Dark mode colors
  const colors = isDarkMode ? {
    bg: '#1f2937',
    cardBg: '#252525',
    cardBorder: '#404040',
    text: '#e4e4e7',
    textMuted: '#a1a1aa',
    textHeading: '#f4f4f5',
    warningBg: 'rgba(251, 191, 36, 0.15)',
    warningBorder: 'rgba(251, 191, 36, 0.3)',
    warningText: '#fbbf24',
    btnPrimaryBg: '#6366f1',
    btnPrimaryText: '#ffffff',
    btnSecondaryBg: '#333333',
    btnSecondaryText: '#e4e4e4',
    checkboxBg: '#333333',
    checkboxBorder: '#555555',
    localColor: '#6366f1',
    sharedColor: '#22c55e',
  } : {
    bg: '#ffffff',
    cardBg: '#f9fafb',
    cardBorder: '#e5e7eb',
    text: '#374151',
    textMuted: '#6b7280',
    textHeading: '#1f2937',
    warningBg: 'rgba(251, 191, 36, 0.1)',
    warningBorder: 'rgba(251, 191, 36, 0.3)',
    warningText: '#92400e',
    btnPrimaryBg: '#6366f1',
    btnPrimaryText: '#ffffff',
    btnSecondaryBg: '#f3f4f6',
    btnSecondaryText: '#374151',
    checkboxBg: '#ffffff',
    checkboxBorder: '#d1d5db',
    localColor: '#6366f1',
    sharedColor: '#22c55e',
  }

  if (!isOpen) return null

  const isSharing = currentVisibility === 'local' && newVisibility === 'shared'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100010,
      }}
      onClick={onCancel}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: colors.bg,
          borderRadius: '12px',
          width: '90%',
          maxWidth: '420px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: `1px solid ${colors.cardBorder}`,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '24px' }}>
            {isSharing ? '⚠️' : '🔒'}
          </span>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.textHeading,
              margin: 0,
            }}
          >
            {isSharing ? 'Change Visibility?' : 'Make Private?'}
          </h2>
        </div>

        {/* Content */}
        <div style={{ padding: '0 24px 20px' }}>
          <p style={{ fontSize: '14px', color: colors.text, margin: '0 0 16px 0', lineHeight: '1.5' }}>
            {isSharing
              ? "You're about to make this item visible to others:"
              : "You're about to make this item private:"}
          </p>

          {/* Item preview */}
          <div
            style={{
              backgroundColor: colors.cardBg,
              padding: '12px 14px',
              borderRadius: '8px',
              border: `1px solid ${colors.cardBorder}`,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '18px' }}>📄</span>
            <span
              style={{
                fontSize: '14px',
                fontWeight: '500',
                color: colors.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {itemTitle}
            </span>
          </div>

          {/* Current vs New state */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                backgroundColor: isSharing ? `${colors.localColor}20` : `${colors.sharedColor}20`,
                borderRadius: '6px',
                color: isSharing ? colors.localColor : colors.sharedColor,
              }}
            >
              <span>{isSharing ? '🔒' : '🌐'}</span>
              <span>{isSharing ? 'Private' : 'Shared'}</span>
            </div>
            <span style={{ color: colors.textMuted }}>→</span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                backgroundColor: isSharing ? `${colors.sharedColor}20` : `${colors.localColor}20`,
                borderRadius: '6px',
                color: isSharing ? colors.sharedColor : colors.localColor,
              }}
            >
              <span>{isSharing ? '🌐' : '🔒'}</span>
              <span>{isSharing ? 'Shared' : 'Private'}</span>
            </div>
          </div>

          {/* Warning for sharing */}
          {isSharing && (
            <div
              style={{
                backgroundColor: colors.warningBg,
                border: `1px solid ${colors.warningBorder}`,
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '16px',
              }}
            >
              <p
                style={{
                  fontSize: '12px',
                  color: colors.warningText,
                  margin: 0,
                  lineHeight: '1.5',
                }}
              >
                <strong>Note:</strong> Shared items will be visible to all collaborators
                on this board and may be uploaded to cloud storage.
              </p>
            </div>
          )}

          {/* Info for making private */}
          {!isSharing && (
            <div
              style={{
                backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                border: `1px solid ${isDarkMode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '16px',
              }}
            >
              <p
                style={{
                  fontSize: '12px',
                  color: isDarkMode ? '#a5b4fc' : '#4f46e5',
                  margin: 0,
                  lineHeight: '1.5',
                }}
              >
                <strong>Note:</strong> Private items are only visible to you and remain
                encrypted in your browser. Other collaborators won't be able to see this item.
              </p>
            </div>
          )}

          {/* Don't ask again checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              color: colors.textMuted,
            }}
          >
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
              }}
            />
            Don't ask again for this session
          </label>
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '16px 24px',
            borderTop: `1px solid ${colors.cardBorder}`,
            backgroundColor: colors.cardBg,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: `1px solid ${colors.cardBorder}`,
              backgroundColor: colors.btnSecondaryBg,
              color: colors.btnSecondaryText,
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(dontAskAgain)}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isSharing ? colors.sharedColor : colors.localColor,
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{isSharing ? '🌐' : '🔒'}</span>
            {isSharing ? 'Make Shared' : 'Make Private'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Session storage key for "don't ask again" preference
const DONT_ASK_KEY = 'visibility-change-dont-ask'

export function shouldSkipVisibilityPrompt(): boolean {
  try {
    return sessionStorage.getItem(DONT_ASK_KEY) === 'true'
  } catch {
    return false
  }
}

export function setSkipVisibilityPrompt(skip: boolean): void {
  try {
    if (skip) {
      sessionStorage.setItem(DONT_ASK_KEY, 'true')
    } else {
      sessionStorage.removeItem(DONT_ASK_KEY)
    }
  } catch {
    // Ignore storage errors
  }
}
