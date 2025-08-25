// Service for managing starred boards

export interface StarredBoard {
  slug: string;
  title: string;
  starredAt: number;
  lastVisited?: number;
}

export interface StarredBoardsData {
  boards: StarredBoard[];
  lastUpdated: number;
}

/**
 * Get starred boards for a user
 */
export const getStarredBoards = (username: string): StarredBoard[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const data = localStorage.getItem(`starred_boards_${username}`);
    if (!data) return [];
    
    const parsed: StarredBoardsData = JSON.parse(data);
    return parsed.boards || [];
  } catch (error) {
    console.error('Error getting starred boards:', error);
    return [];
  }
};

/**
 * Add a board to starred boards
 */
export const starBoard = (username: string, slug: string, title?: string): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const boards = getStarredBoards(username);
    
    // Check if already starred
    const existingIndex = boards.findIndex(board => board.slug === slug);
    if (existingIndex !== -1) {
      return false; // Already starred
    }
    
    // Add new starred board
    const newBoard: StarredBoard = {
      slug,
      title: title || slug,
      starredAt: Date.now(),
    };
    
    boards.push(newBoard);
    
    // Save to localStorage
    const data: StarredBoardsData = {
      boards,
      lastUpdated: Date.now(),
    };
    
    localStorage.setItem(`starred_boards_${username}`, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error starring board:', error);
    return false;
  }
};

/**
 * Remove a board from starred boards
 */
export const unstarBoard = (username: string, slug: string): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const boards = getStarredBoards(username);
    const filteredBoards = boards.filter(board => board.slug !== slug);
    
    if (filteredBoards.length === boards.length) {
      return false; // Board wasn't starred
    }
    
    // Save to localStorage
    const data: StarredBoardsData = {
      boards: filteredBoards,
      lastUpdated: Date.now(),
    };
    
    localStorage.setItem(`starred_boards_${username}`, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error unstarring board:', error);
    return false;
  }
};

/**
 * Check if a board is starred
 */
export const isBoardStarred = (username: string, slug: string): boolean => {
  const boards = getStarredBoards(username);
  return boards.some(board => board.slug === slug);
};

/**
 * Update last visited time for a board
 */
export const updateLastVisited = (username: string, slug: string): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const boards = getStarredBoards(username);
    const boardIndex = boards.findIndex(board => board.slug === slug);
    
    if (boardIndex !== -1) {
      boards[boardIndex].lastVisited = Date.now();
      
      const data: StarredBoardsData = {
        boards,
        lastUpdated: Date.now(),
      };
      
      localStorage.setItem(`starred_boards_${username}`, JSON.stringify(data));
    }
  } catch (error) {
    console.error('Error updating last visited:', error);
  }
};

/**
 * Get recently visited starred boards (sorted by last visited)
 */
export const getRecentlyVisitedStarredBoards = (username: string, limit: number = 5): StarredBoard[] => {
  const boards = getStarredBoards(username);
  return boards
    .filter(board => board.lastVisited)
    .sort((a, b) => (b.lastVisited || 0) - (a.lastVisited || 0))
    .slice(0, limit);
}; 