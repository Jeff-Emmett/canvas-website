import React from 'react';
import { useParams } from 'react-router-dom';
import { useDialogs } from 'tldraw';
import { InviteDialog } from '../ui/InviteDialog';

interface ShareBoardButtonProps {
  className?: string;
}

const ShareBoardButton: React.FC<ShareBoardButtonProps> = ({ className = '' }) => {
  const { slug } = useParams<{ slug: string }>();
  const { addDialog, removeDialog } = useDialogs();

  const handleShare = () => {
    const boardSlug = slug || 'mycofi33';
    const boardUrl = `${window.location.origin}/board/${boardSlug}`;

    addDialog({
      id: "invite-dialog",
      component: ({ onClose }: { onClose: () => void }) => (
        <InviteDialog
          onClose={() => {
            onClose();
            removeDialog("invite-dialog");
          }}
          boardUrl={boardUrl}
          boardSlug={boardSlug}
        />
      ),
    });
  };

  // Detect if we're in share-panel (compact) vs toolbar (full button)
  const isCompact = className.includes('share-panel-btn');

  if (isCompact) {
    // Icon-only version for the top-right share panel
    return (
      <button
        onClick={handleShare}
        className={`share-board-button ${className}`}
        title="Invite others to this board"
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
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.background = 'var(--color-muted-2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.7';
          e.currentTarget.style.background = 'none';
        }}
      >
        {/* User with plus icon (invite/add person) */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {/* User outline */}
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          {/* Plus sign */}
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="16" y1="11" x2="22" y2="11" />
        </svg>
      </button>
    );
  }

  // Full button version for other contexts (toolbar, etc.)
  return (
    <button
      onClick={handleShare}
      className={`share-board-button ${className}`}
      title="Invite others to this board"
      style={{
        padding: "4px 8px",
        borderRadius: "4px",
        background: "#3b82f6",
        color: "white",
        border: "none",
        cursor: "pointer",
        fontWeight: 500,
        transition: "background 0.2s ease",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        whiteSpace: "nowrap",
        userSelect: "none",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        height: "22px",
        minHeight: "22px",
        boxSizing: "border-box",
        fontSize: "0.75rem",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#2563eb";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#3b82f6";
      }}
    >
      {/* User with plus icon (invite/add person) */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="16" y1="11" x2="22" y2="11" />
      </svg>
    </button>
  );
};

export default ShareBoardButton;
