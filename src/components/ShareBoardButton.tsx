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
      <span style={{ fontSize: "12px" }}>Share</span>
    </button>
  );
};

export default ShareBoardButton;
