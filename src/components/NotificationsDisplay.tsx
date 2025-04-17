import React, { useEffect, useState } from 'react';
import { useNotifications, Notification } from '../context/NotificationContext';

/**
 * Component to display a single notification
 */
const NotificationItem: React.FC<{
  notification: Notification;
  onClose: (id: string) => void;
}> = ({ notification, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);
  const exitDuration = 300; // ms for exit animation

  // Set up automatic dismissal based on notification timeout
  useEffect(() => {
    if (notification.timeout > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        
        // Wait for exit animation before removing
        setTimeout(() => {
          onClose(notification.id);
        }, exitDuration);
      }, notification.timeout);
      
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  // Handle manual close
  const handleClose = () => {
    setIsExiting(true);
    
    // Wait for exit animation before removing
    setTimeout(() => {
      onClose(notification.id);
    }, exitDuration);
  };

  // Determine icon based on notification type
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  return (
    <div 
      className={`notification ${notification.type} ${isExiting ? 'exiting' : ''}`}
      style={{ 
        animationDuration: `${exitDuration}ms`,
      }}
    >
      <div className="notification-icon">
        {getIcon()}
      </div>
      
      <div className="notification-content">
        {notification.msg}
      </div>
      
      <button 
        className="notification-close" 
        onClick={handleClose}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
};

/**
 * Component that displays all active notifications
 */
const NotificationsDisplay: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  // Don't render anything if there are no notifications
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notifications-container">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={removeNotification}
        />
      ))}
    </div>
  );
};

export default NotificationsDisplay;