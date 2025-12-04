import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEditor } from 'tldraw';
import { VersionHistoryPanel } from './VersionHistoryPanel';

interface VersionHistoryButtonProps {
  className?: string;
}

/**
 * Version History Button - displays next to the star button
 * Opens a popup panel showing historical versions and diff controls
 */
const VersionHistoryButton: React.FC<VersionHistoryButtonProps> = ({ className = '' }) => {
  const { slug } = useParams<{ slug: string }>();
  const { session } = useAuth();
  const editor = useEditor();
  const [showPanel, setShowPanel] = useState(false);
  const [hasNewChanges, setHasNewChanges] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Check for new changes indicator
  useEffect(() => {
    if (!session.authed || !session.username || !slug) return;

    // Check if there are unseen changes
    const lastSeenKey = `canvas_version_state_${session.username}_${slug}`;
    const lastSeen = localStorage.getItem(lastSeenKey);

    if (lastSeen) {
      try {
        const state = JSON.parse(lastSeen);
        const currentShapes = editor?.getCurrentPageShapes() || [];

        // If shape count differs, there are changes
        if (currentShapes.length !== state.shapeIds.length) {
          setHasNewChanges(true);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [session.authed, session.username, slug, editor]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowPanel(false);
      }
    };

    if (showPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPanel]);

  // Don't show if not authenticated
  if (!session.authed) {
    return null;
  }

  const handleToggle = () => {
    setShowPanel(!showPanel);
    if (!showPanel) {
      // Clear new changes indicator when opening
      setHasNewChanges(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`toolbar-btn version-history-button ${className} ${showPanel ? 'active' : ''}`}
        title="Version History"
        style={{ position: 'relative' }}
      >
        {/* Time rewind icon */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022l-.074.997zm2.004.45a7.003 7.003 0 0 0-.985-.299l.219-.976c.383.086.76.2 1.126.342l-.36.933zm1.37.71a7.01 7.01 0 0 0-.439-.27l.493-.87a8.025 8.025 0 0 1 .979.654l-.615.789a6.996 6.996 0 0 0-.418-.302zm1.834 1.79a6.99 6.99 0 0 0-.653-.796l.724-.69c.27.285.52.59.747.91l-.818.576zm.744 1.352a7.08 7.08 0 0 0-.214-.468l.893-.45a7.976 7.976 0 0 1 .45 1.088l-.95.313a7.023 7.023 0 0 0-.179-.483zm.53 2.507a6.991 6.991 0 0 0-.1-1.025l.985-.17c.067.386.106.778.116 1.17l-1 .025zm-.131 1.538c.033-.17.06-.339.081-.51l.993.123a7.957 7.957 0 0 1-.23 1.155l-.964-.267c.046-.165.086-.332.12-.501zm-.952 2.379c.184-.29.346-.594.486-.908l.914.405c-.16.36-.345.706-.555 1.038l-.845-.535zm-.964 1.205c.122-.122.239-.248.35-.378l.758.653a8.073 8.073 0 0 1-.401.432l-.707-.707z"/>
          <path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0v1z"/>
          <path d="M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5z"/>
        </svg>

        {/* New changes indicator dot */}
        {hasNewChanges && (
          <span
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#fbbf24',
              border: '1px solid white',
              boxShadow: '0 0 4px rgba(251, 191, 36, 0.5)',
            }}
          />
        )}
      </button>

      {/* Version History Panel */}
      {showPanel && (
        <div ref={panelRef}>
          <VersionHistoryPanel
            boardId={slug || ''}
            userId={session.username || ''}
            onClose={() => setShowPanel(false)}
          />
        </div>
      )}
    </div>
  );
};

export default VersionHistoryButton;
