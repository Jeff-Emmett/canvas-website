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
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [popupType, setPopupType] = useState<'success' | 'error' | 'info'>('success');

  // Check if board is starred on mount and when session changes
  useEffect(() => {
    if (session.authed && session.username && slug) {
      const starred = isBoardStarred(session.username, slug);
      setIsStarred(starred);
    } else {
      setIsStarred(false);
    }
  }, [session.authed, session.username, slug]);

  const showPopupMessage = (message: string, type: 'success' | 'error' | 'info') => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
    
    // Auto-hide after 2 seconds
    setTimeout(() => {
      setShowPopup(false);
    }, 2000);
  };

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
          showPopupMessage('Board removed from starred boards', 'success');
        } else {
          showPopupMessage('Failed to remove board from starred boards', 'error');
        }
      } else {
        // Star the board
        const success = starBoard(session.username, slug, slug);
        if (success) {
          setIsStarred(true);
          showPopupMessage('Board added to starred boards', 'success');
        } else {
          showPopupMessage('Board is already starred', 'info');
        }
      }
    } catch (error) {
      console.error('Error toggling star:', error);
      showPopupMessage('Failed to update starred boards', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show the button if user is not authenticated
  if (!session.authed) {
    return null;
  }

  return (
    <div style={{ position: 'relative' }}>
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
      </button>
      
      {/* Custom popup notification */}
      {showPopup && (
        <div 
          className={`star-popup star-popup-${popupType}`}
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100001,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {popupMessage}
        </div>
      )}
    </div>
  );
};

export default StarBoardButton; 