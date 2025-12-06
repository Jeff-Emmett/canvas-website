import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
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
 */
const AnonymousViewerBanner: React.FC<AnonymousViewerBannerProps> = ({
  onAuthenticated,
  triggeredByEdit = false
}) => {
  const { session } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [isExpanded, setIsExpanded] = useState(triggeredByEdit);

  // Check if banner was previously dismissed this session
  useEffect(() => {
    const dismissed = sessionStorage.getItem('anonymousBannerDismissed');
    if (dismissed && !triggeredByEdit) {
      setIsDismissed(true);
    }
  }, [triggeredByEdit]);

  // If user is authenticated, don't show banner
  if (session.authed) {
    return null;
  }

  // If dismissed and not triggered by edit, don't show
  if (isDismissed && !triggeredByEdit) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem('anonymousBannerDismissed', 'true');
    setIsDismissed(true);
  };

  const handleSignUpClick = () => {
    setShowSignUp(true);
  };

  const handleSignUpSuccess = () => {
    setShowSignUp(false);
    if (onAuthenticated) {
      onAuthenticated();
    }
  };

  const handleSignUpCancel = () => {
    setShowSignUp(false);
  };

  // Show CryptID modal when sign up is clicked
  if (showSignUp) {
    return (
      <div className="anonymous-banner-modal-overlay">
        <div className="anonymous-banner-modal">
          <CryptID
            onSuccess={handleSignUpSuccess}
            onCancel={handleSignUpCancel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`anonymous-viewer-banner ${triggeredByEdit ? 'edit-triggered' : ''} ${isExpanded ? 'expanded' : ''}`}>
      <div className="banner-content">
        <div className="banner-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="currentColor"/>
          </svg>
        </div>

        <div className="banner-text">
          {triggeredByEdit ? (
            <p className="banner-headline">
              <strong>Want to edit this board?</strong>
            </p>
          ) : (
            <p className="banner-headline">
              <strong>You're viewing this board anonymously</strong>
            </p>
          )}

          {isExpanded ? (
            <div className="banner-details">
              <p>
                Sign in by creating a username as your <strong>CryptID</strong> &mdash; no password required!
              </p>
              <ul className="cryptid-benefits">
                <li>
                  <span className="benefit-icon">&#x1F512;</span>
                  <span>Secured with encrypted keys, right in your browser, by a <a href="https://www.w3.org/TR/WebCryptoAPI/" target="_blank" rel="noopener noreferrer">W3C standard</a> algorithm</span>
                </li>
                <li>
                  <span className="benefit-icon">&#x1F4BE;</span>
                  <span>Your session is stored for offline access, encrypted in browser storage by the same key</span>
                </li>
                <li>
                  <span className="benefit-icon">&#x1F4E6;</span>
                  <span>Full data portability &mdash; use your canvas securely any time you like</span>
                </li>
              </ul>
            </div>
          ) : (
            <p className="banner-summary">
              Create a free CryptID to edit this board &mdash; no password needed!
            </p>
          )}
        </div>

        <div className="banner-actions">
          <button
            className="banner-signup-btn"
            onClick={handleSignUpClick}
          >
            Create CryptID
          </button>

          {!triggeredByEdit && (
            <button
              className="banner-dismiss-btn"
              onClick={handleDismiss}
              title="Dismiss"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="currentColor"/>
              </svg>
            </button>
          )}

          {!isExpanded && (
            <button
              className="banner-expand-btn"
              onClick={() => setIsExpanded(true)}
              title="Learn more"
            >
              Learn more
            </button>
          )}
        </div>
      </div>

      {triggeredByEdit && (
        <div className="banner-edit-notice">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/>
          </svg>
          <span>This board is in read-only mode for anonymous viewers</span>
        </div>
      )}
    </div>
  );
};

export default AnonymousViewerBanner;
