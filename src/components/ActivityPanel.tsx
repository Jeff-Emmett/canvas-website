import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getActivityLog,
  ActivityEntry,
  formatActivityTime,
  getShapeDisplayName,
  groupActivitiesByDate,
} from '../lib/activityLogger';
import '../css/activity-panel.css';

interface ActivityPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActivityPanel({ isOpen, onClose }: ActivityPanelProps) {
  const { slug } = useParams<{ slug: string }>();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load activities and refresh periodically
  useEffect(() => {
    if (!slug || !isOpen) return;

    const loadActivities = () => {
      const log = getActivityLog(slug, 50);
      setActivities(log);
      setIsLoading(false);
    };

    loadActivities();

    // Refresh every 5 seconds when panel is open
    const interval = setInterval(loadActivities, 5000);

    return () => clearInterval(interval);
  }, [slug, isOpen]);

  if (!isOpen) return null;

  const groupedActivities = groupActivitiesByDate(activities);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created': return '+';
      case 'deleted': return '-';
      case 'updated': return '~';
      default: return '?';
    }
  };

  const getActionClass = (action: string) => {
    switch (action) {
      case 'created': return 'activity-action-created';
      case 'deleted': return 'activity-action-deleted';
      case 'updated': return 'activity-action-updated';
      default: return '';
    }
  };

  return (
    <div className="activity-panel">
      <div className="activity-panel-header">
        <h3>Activity</h3>
        <button className="activity-panel-close" onClick={onClose} title="Close">
          &times;
        </button>
      </div>

      <div className="activity-panel-content">
        {isLoading ? (
          <div className="activity-loading">Loading...</div>
        ) : activities.length === 0 ? (
          <div className="activity-empty">
            <div className="activity-empty-icon">~</div>
            <p>No activity yet</p>
            <p className="activity-empty-hint">Actions will appear here as you work</p>
          </div>
        ) : (
          <div className="activity-list">
            {Array.from(groupedActivities.entries()).map(([dateGroup, entries]) => (
              <div key={dateGroup} className="activity-group">
                <div className="activity-group-header">{dateGroup}</div>
                {entries.map((entry) => (
                  <div key={entry.id} className="activity-item">
                    <span className={`activity-icon ${getActionClass(entry.action)}`}>
                      {getActionIcon(entry.action)}
                    </span>
                    <div className="activity-details">
                      <span className="activity-text">
                        <span className="activity-user">{entry.user}</span>
                        {' '}
                        {entry.action === 'created' ? 'added' :
                         entry.action === 'deleted' ? 'deleted' : 'updated'}
                        {' '}
                        <span className="activity-shape">{getShapeDisplayName(entry.shapeType)}</span>
                      </span>
                      <span className="activity-time">{formatActivityTime(entry.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Toggle button component for the toolbar
export function ActivityToggleButton({ onClick, isActive }: { onClick: () => void; isActive: boolean }) {
  return (
    <button
      className={`activity-toggle-btn ${isActive ? 'active' : ''}`}
      onClick={onClick}
      title="Activity Log"
    >
      <span className="activity-toggle-icon">~</span>
    </button>
  );
}
