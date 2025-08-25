import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { getStarredBoards, unstarBoard, StarredBoard } from '../lib/starredBoards';
import { getBoardScreenshot, removeBoardScreenshot } from '../lib/screenshotService';

export function Dashboard() {
  const { session } = useAuth();
  const { addNotification } = useNotifications();
  const [starredBoards, setStarredBoards] = useState<StarredBoard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Note: We don't redirect automatically - let the component show auth required message

  // Load starred boards
  useEffect(() => {
    if (session.authed && session.username) {
      const boards = getStarredBoards(session.username);
      setStarredBoards(boards);
      setIsLoading(false);
    }
  }, [session.authed, session.username]);

  const handleUnstarBoard = (slug: string) => {
    if (!session.username) return;

    const success = unstarBoard(session.username, slug);
    if (success) {
      setStarredBoards(prev => prev.filter(board => board.slug !== slug));
      removeBoardScreenshot(slug); // Remove screenshot when unstarring
      addNotification('Board removed from starred boards', 'success');
    } else {
      addNotification('Failed to remove board from starred boards', 'error');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (session.loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  if (!session.authed) {
    return (
      <div className="dashboard-container">
        <div className="auth-required">
          <h2>Authentication Required</h2>
          <p>Please log in to access your dashboard.</p>
          <Link to="/" className="back-link">Go Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>My Dashboard</h1>
        <p>Welcome back, {session.username}!</p>
      </header>

      <div className="dashboard-content">
        <section className="starred-boards-section">
          <div className="section-header">
            <h2>Starred Boards</h2>
            <span className="board-count">{starredBoards.length} board{starredBoards.length !== 1 ? 's' : ''}</span>
          </div>

          {isLoading ? (
            <div className="loading">Loading starred boards...</div>
          ) : starredBoards.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⭐</div>
              <h3>No starred boards yet</h3>
              <p>Star boards you want to save for quick access.</p>
              <Link to="/" className="browse-link">Browse Boards</Link>
            </div>
          ) : (
            <div className="boards-grid">
              {starredBoards.map((board) => {
                const screenshot = getBoardScreenshot(board.slug);
                return (
                  <div key={board.slug} className="board-card">
                    {screenshot && (
                      <div className="board-screenshot">
                        <img 
                          src={screenshot.dataUrl} 
                          alt={`Screenshot of ${board.title}`}
                          className="screenshot-image"
                        />
                      </div>
                    )}
                    
                    <div className="board-card-header">
                      <h3 className="board-title">{board.title}</h3>
                      <button
                        onClick={() => handleUnstarBoard(board.slug)}
                        className="unstar-button"
                        title="Remove from starred boards"
                      >
                        ⭐
                      </button>
                    </div>
                    
                    <div className="board-card-content">
                      <p className="board-slug">/{board.slug}</p>
                      <div className="board-meta">
                        <span className="starred-date">
                          Starred: {formatDate(board.starredAt)}
                        </span>
                        {board.lastVisited && (
                          <span className="last-visited">
                            Last visited: {formatDate(board.lastVisited)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="board-card-actions">
                      <Link 
                        to={`/board/${board.slug}`} 
                        className="open-board-button"
                      >
                        Open Board
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
} 