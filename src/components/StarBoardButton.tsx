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
        className={`toolbar-btn star-board-button ${className} ${isStarred ? 'starred' : ''}`}
        title={isStarred ? 'Remove from starred boards' : 'Add to starred boards'}
      >
        {isLoading ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="loading-spinner">
            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            {isStarred ? (
              <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
            ) : (
              <path d="M2.866 14.85c-.078.444.36.791.746.593l4.39-2.256 4.389 2.256c.386.198.824-.149.746-.592l-.83-4.73 3.522-3.356c.33-.314.16-.888-.282-.95l-4.898-.696L8.465.792a.513.513 0 0 0-.927 0L5.354 5.12l-4.898.696c-.441.062-.612.636-.283.95l3.523 3.356-.83 4.73zm4.905-2.767-3.686 1.894.694-3.957a.565.565 0 0 0-.163-.505L1.71 6.745l4.052-.576a.525.525 0 0 0 .393-.288L8 2.223l1.847 3.658a.525.525 0 0 0 .393.288l4.052.575-2.906 2.77a.565.565 0 0 0-.163.506l.694 3.957-3.686-1.894a.503.503 0 0 0-.461 0z"/>
            )}
          </svg>
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