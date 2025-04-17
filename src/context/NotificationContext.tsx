import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * Types of notifications supported by the system
 */
export type NotificationType = 'success' | 'error' | 'info' | 'warning';

/**
 * Notification object structure
 */
export type Notification = {
  id: string;
  msg: string;
  type: NotificationType;
  timeout: number;
};

/**
 * Interface for the notification context
 */
interface NotificationContextType {
  notifications: Notification[];
  addNotification: (msg: string, type?: NotificationType, timeout?: number) => string;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

// Create context with a default undefined value
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * NotificationProvider component - provides notification functionality to the app
 */
export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  /**
   * Remove a notification by ID
   */
  const removeNotification = useCallback((id: string) => {
    setNotifications(current => current.filter(notification => notification.id !== id));
  }, []);

  /**
   * Add a new notification
   * @param msg The message to display
   * @param type The type of notification (success, error, info, warning)
   * @param timeout Time in ms before notification is automatically removed
   * @returns The ID of the created notification
   */
  const addNotification = useCallback(
    (msg: string, type: NotificationType = 'info', timeout: number = 5000): string => {
      // Create a unique ID for the notification
      const id = crypto.randomUUID();

      // Add notification to the array
      setNotifications(current => [
        ...current,
        {
          id,
          msg,
          type,
          timeout,
        }
      ]);

      // Set up automatic removal after timeout
      if (timeout > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, timeout);
      }

      // Return the notification ID for reference
      return id;
    },
    [removeNotification]
  );

  /**
   * Clear all current notifications
   */
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Create the context value with all functions and state
  const contextValue: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * Hook to access the notification context
 */
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};