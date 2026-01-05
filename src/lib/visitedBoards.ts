// Service for managing visited boards history

export interface VisitedBoard {
  slug: string;
  title: string;
  visitedAt: number;
}

export interface VisitedBoardsData {
  boards: VisitedBoard[];
  lastUpdated: number;
}

const MAX_HISTORY_SIZE = 50;

/**
 * Get visited boards for a user
 */
export const getVisitedBoards = (username: string): VisitedBoard[] => {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(`visited_boards_${username}`);
    if (!data) return [];

    const parsed: VisitedBoardsData = JSON.parse(data);
    return parsed.boards || [];
  } catch (error) {
    console.error('Error getting visited boards:', error);
    return [];
  }
};

/**
 * Record a board visit - adds or updates the visit timestamp
 */
export const recordBoardVisit = (username: string, slug: string, title?: string): void => {
  if (typeof window === 'undefined') return;

  try {
    let boards = getVisitedBoards(username);

    // Remove existing entry if present (we'll re-add at the front)
    boards = boards.filter(board => board.slug !== slug);

    // Add new visit at the beginning
    const newVisit: VisitedBoard = {
      slug,
      title: title || slug,
      visitedAt: Date.now(),
    };

    boards.unshift(newVisit);

    // Prune to max size
    if (boards.length > MAX_HISTORY_SIZE) {
      boards = boards.slice(0, MAX_HISTORY_SIZE);
    }

    // Save to localStorage
    const data: VisitedBoardsData = {
      boards,
      lastUpdated: Date.now(),
    };

    localStorage.setItem(`visited_boards_${username}`, JSON.stringify(data));
  } catch (error) {
    console.error('Error recording board visit:', error);
  }
};

/**
 * Get recently visited boards sorted by visit time (most recent first)
 */
export const getRecentlyVisitedBoards = (username: string, limit: number = 10): VisitedBoard[] => {
  const boards = getVisitedBoards(username);
  return boards
    .sort((a, b) => b.visitedAt - a.visitedAt)
    .slice(0, limit);
};

/**
 * Remove a single board from visit history
 */
export const removeFromHistory = (username: string, slug: string): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const boards = getVisitedBoards(username);
    const filteredBoards = boards.filter(board => board.slug !== slug);

    if (filteredBoards.length === boards.length) {
      return false; // Board wasn't in history
    }

    // Save to localStorage
    const data: VisitedBoardsData = {
      boards: filteredBoards,
      lastUpdated: Date.now(),
    };

    localStorage.setItem(`visited_boards_${username}`, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error removing from history:', error);
    return false;
  }
};

/**
 * Update the title for a visited board (useful when board title is loaded later)
 */
export const updateVisitedBoardTitle = (username: string, slug: string, title: string): void => {
  if (typeof window === 'undefined') return;

  try {
    const boards = getVisitedBoards(username);
    const boardIndex = boards.findIndex(board => board.slug === slug);

    if (boardIndex !== -1) {
      boards[boardIndex].title = title;

      const data: VisitedBoardsData = {
        boards,
        lastUpdated: Date.now(),
      };

      localStorage.setItem(`visited_boards_${username}`, JSON.stringify(data));
    }
  } catch (error) {
    console.error('Error updating visited board title:', error);
  }
};

/**
 * Format a timestamp as relative time (e.g., "2 hours ago", "Yesterday")
 */
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
};
