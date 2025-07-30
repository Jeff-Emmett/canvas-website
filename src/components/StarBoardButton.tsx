import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { starBoard, unstarBoard, isBoardStarred } from '../lib/starredBoards';

interface StarBoardButtonProps {
  className?: string;
}

const StarBoardButton: React.FC<StarBoardButtonProps> = ({ className = '' }) => {
  const { slug } = useParams<{ slug: string }>();
  const { session } = useAuth();
  const { addNotification } = useNotifications();
  const [isStarred, setIsStarred] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if board is starred on mount and when session changes
  useEffect(() => {
    if (session.authed && session.username && slug) {
      const starred = isBoardStarred(session.username, slug);
      setIsStarred(starred);
    } else {
      setIsStarred(false);
    }
  }, [session.authed, session.username, slug]);

  const handleStarToggle = async () => {
    if (!session.authed || !session.username || !slug) {
      addNotification('Please log in to star boards', 'warning');
      return;
    }

    setIsLoading(true);

    try {
      if (isStarred) {
        // Unstar the board
        const success = unstarBoard(session.username, slug);
        if (success) {
          setIsStarred(false);
          addNotification('Board removed from starred boards', 'success');
        } else {
          addNotification('Failed to remove board from starred boards', 'error');
        }
      } else {
        // Star the board
        const success = starBoard(session.username, slug, slug);
        if (success) {
          setIsStarred(true);
          addNotification('Board added to starred boards', 'success');
        } else {
          addNotification('Board is already starred', 'info');
        }
      }
    } catch (error) {
      console.error('Error toggling star:', error);
      addNotification('Failed to update starred boards', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show the button if user is not authenticated
  if (!session.authed) {
    return null;
  }

  return (
    <button
      onClick={handleStarToggle}
      disabled={isLoading}
      className={`star-board-button ${className} ${isStarred ? 'starred' : ''}`}
      title={isStarred ? 'Remove from starred boards' : 'Add to starred boards'}
    >
      {isLoading ? (
        <span className="loading-spinner">⏳</span>
      ) : isStarred ? (
        <span className="star-icon starred">⭐</span>
      ) : (
        <span className="star-icon">☆</span>
      )}
      <span className="star-text">
        {isStarred ? 'Starred' : 'Star'}
      </span>
    </button>
  );
};

export default StarBoardButton; 