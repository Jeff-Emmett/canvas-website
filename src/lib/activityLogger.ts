// Service for per-board activity logging

export interface ActivityEntry {
  id: string;
  action: 'created' | 'deleted' | 'updated';
  shapeType: string;
  shapeId: string;
  user: string;
  timestamp: number;
}

export interface BoardActivity {
  slug: string;
  entries: ActivityEntry[];
  lastUpdated: number;
}

const MAX_ENTRIES = 100;

// Map internal shape types to friendly display names
const SHAPE_DISPLAY_NAMES: Record<string, string> = {
  // Default tldraw shapes
  'text': 'text',
  'geo': 'shape',
  'draw': 'drawing',
  'arrow': 'arrow',
  'note': 'sticky note',
  'image': 'image',
  'video': 'video',
  'embed': 'embed',
  'frame': 'frame',
  'line': 'line',
  'highlight': 'highlight',
  'bookmark': 'bookmark',
  'group': 'group',
  // Custom shapes
  'ChatBox': 'chat box',
  'VideoChat': 'video chat',
  'Embed': 'embed',
  'Markdown': 'markdown note',
  'Slide': 'slide',
  'MycrozineTemplate': 'zine template',
  'MycroZineGenerator': 'zine generator',
  'Prompt': 'prompt',
  'ObsNote': 'Obsidian note',
  'Transcription': 'transcription',
  'Holon': 'holon',
  'HolonBrowser': 'holon browser',
  'ObsidianBrowser': 'Obsidian browser',
  'FathomMeetingsBrowser': 'Fathom browser',
  'FathomNote': 'Fathom note',
  'ImageGen': 'AI image',
  'VideoGen': 'AI video',
  'BlenderGen': '3D model',
  'Drawfast': 'drawfast',
  'Multmux': 'multmux',
  'MycelialIntelligence': 'mycelial AI',
  'PrivateWorkspace': 'private workspace',
  'GoogleItem': 'Google item',
  'Map': 'map',
  'WorkflowBlock': 'workflow block',
  'Calendar': 'calendar',
  'CalendarEvent': 'calendar event',
};

// Get action icons
const ACTION_ICONS: Record<string, string> = {
  'created': '+',
  'deleted': '-',
  'updated': '~',
};

/**
 * Get the activity log for a board
 */
export const getActivityLog = (slug: string, limit: number = 50): ActivityEntry[] => {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(`board_activity_${slug}`);
    if (!data) return [];

    const parsed: BoardActivity = JSON.parse(data);
    return (parsed.entries || []).slice(0, limit);
  } catch (error) {
    console.error('Error getting activity log:', error);
    return [];
  }
};

/**
 * Log an activity entry for a board
 */
export const logActivity = (
  slug: string,
  entry: Omit<ActivityEntry, 'id' | 'timestamp'>
): void => {
  if (typeof window === 'undefined') return;

  try {
    const entries = getActivityLog(slug, MAX_ENTRIES - 1);

    const newEntry: ActivityEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    // Add new entry at the beginning
    entries.unshift(newEntry);

    // Prune to max size
    const prunedEntries = entries.slice(0, MAX_ENTRIES);

    const data: BoardActivity = {
      slug,
      entries: prunedEntries,
      lastUpdated: Date.now(),
    };

    localStorage.setItem(`board_activity_${slug}`, JSON.stringify(data));
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

/**
 * Clear all activity for a board
 */
export const clearActivityLog = (slug: string): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(`board_activity_${slug}`);
  } catch (error) {
    console.error('Error clearing activity log:', error);
  }
};

/**
 * Get display name for a shape type
 */
export const getShapeDisplayName = (shapeType: string): string => {
  return SHAPE_DISPLAY_NAMES[shapeType] || shapeType;
};

/**
 * Get icon for an action
 */
export const getActionIcon = (action: string): string => {
  return ACTION_ICONS[action] || '?';
};

/**
 * Format timestamp as relative time
 */
export const formatActivityTime = (timestamp: number): string => {
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

/**
 * Format an activity entry as a human-readable string
 */
export const formatActivityEntry = (entry: ActivityEntry): string => {
  const shapeName = getShapeDisplayName(entry.shapeType);
  const action = entry.action === 'created' ? 'added' :
                 entry.action === 'deleted' ? 'deleted' :
                 'updated';

  return `${entry.user} ${action} ${shapeName}`;
};

/**
 * Group activity entries by date
 */
export const groupActivitiesByDate = (entries: ActivityEntry[]): Map<string, ActivityEntry[]> => {
  const groups = new Map<string, ActivityEntry[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const entry of entries) {
    const entryDate = new Date(entry.timestamp);
    entryDate.setHours(0, 0, 0, 0);

    let groupKey: string;
    if (entryDate.getTime() === today.getTime()) {
      groupKey = 'Today';
    } else if (entryDate.getTime() === yesterday.getTime()) {
      groupKey = 'Yesterday';
    } else {
      groupKey = entryDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(entry);
  }

  return groups;
};
