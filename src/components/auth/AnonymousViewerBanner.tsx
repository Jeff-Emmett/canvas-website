import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import CryptID from './CryptID';
import '../../css/anonymous-banner.css';

interface AnonymousViewerBannerProps {
  /** Callback when user successfully signs up/logs in */
  onAuthenticated?: () => void;
  /** Whether the banner was triggered by an edit attempt */
  triggeredByEdit?: boolean;
}

/**
 * Banner shown to anonymous (unauthenticated) users viewing a board.
 * Explains CryptID and provides a smooth sign-up flow.
 *
 * Note: This component should only be rendered when user is NOT authenticated.
 * The parent component (Board.tsx) handles the auth check via:
 * {(!session.authed || showEditPrompt) && <AnonymousViewerBanner ... />}
 */
const AnonymousViewerBanner: React.FC<AnonymousViewerBannerProps> = ({
  onAuthenticated,
  triggeredByEdit = false
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  // Note: We intentionally do NOT persist banner dismissal across page loads.
  // The banner should appear on each new page load for anonymous users
  // to remind them about CryptID. Only dismiss within the current component lifecycle.
  //
  // Previous implementation used sessionStorage to remember dismissal, but this caused
  // issues where users who dismissed once would never see it again until they closed
  // their browser entirely - even if they logged out or their session expired.
  //
  // If triggeredByEdit is true, always show regardless of dismiss state.

  // If dismissed and not triggered by edit, don't show
  if (isDismissed && !triggeredByEdit) {
    return null;
  }

  const handleDismiss = () => {
    // Just set local state - don't persist to sessionStorage
    // This allows the banner to show again on page refresh
    setIsDismissed(true);
  };

  const handleSignUpClick = () => {
    setShowSignUp(true);
  };

  const handleSignUpSuccess = () => {
    setShowSignUp(false);
    // Dismiss the banner when user signs in successfully
    // No need to persist - the parent condition (!session.authed) will hide us
    setIsDismissed(true);
    if (onAuthenticated) {
      onAuthenticated();
    }
  };

  const handleSignUpCancel = () => {
    setShowSignUp(false);
  };

  return (
    <div className={`anonymous-viewer-banner ${triggeredByEdit ? 'edit-triggered' : ''}`}>
      {/* Dismiss button in top-right corner */}
      {!triggeredByEdit && (
        <button
          className="banner-dismiss-btn"
          onClick={handleDismiss}
          title="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="currentColor"/>
          </svg>
        </button>
      )}

      <div className="banner-content">
        <div className="banner-header">
          <div className="banner-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="currentColor"/>
            </svg>
          </div>

          <div className="banner-text">
            {triggeredByEdit ? (
              <p className="banner-headline">
                <strong>Sign in to edit</strong>
              </p>
            ) : (
              <p className="banner-headline">
                <strong>Viewing anonymously</strong>
              </p>
            )}
            <p className="banner-summary">
              Sign in with enCryptID to edit
            </p>
          </div>
        </div>

        {/* Action button */}
        <div className="banner-actions">
          <button
            className="banner-signup-btn"
            onClick={handleSignUpClick}
          >
            Sign in
          </button>
        </div>
      </div>

      {triggeredByEdit && (
        <div className="banner-edit-notice">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/>
          </svg>
          <span>Read-only for anonymous viewers</span>
        </div>
      )}

      {/* CryptID Sign In Modal - same as CryptIDDropdown */}
      {showSignUp && createPortal(
        <div
          className="cryptid-modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleSignUpCancel();
            }
          }}
        >
          <div
            className="cryptid-modal"
            style={{
              backgroundColor: 'var(--color-panel, #ffffff)',
              borderRadius: '16px',
              padding: '0',
              maxWidth: '580px',
              width: '95vw',
              maxHeight: '90vh',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.4)',
              overflow: 'auto',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleSignUpCancel}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'var(--color-muted-2, #f3f4f6)',
                border: 'none',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-2, #6b7280)',
                fontSize: '16px',
                zIndex: 1,
              }}
            >
              ×
            </button>

            <CryptID
              onSuccess={handleSignUpSuccess}
              onCancel={handleSignUpCancel}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AnonymousViewerBanner;
