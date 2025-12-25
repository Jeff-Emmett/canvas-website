/**
 * NetworkGraphPanel Component
 *
 * Wrapper that integrates the NetworkGraphMinimap with tldraw.
 * Extracts room participants from the editor and provides connection actions.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useEditor, useValue } from 'tldraw';
import { NetworkGraphMinimap } from './NetworkGraphMinimap';
import { useNetworkGraph } from './useNetworkGraph';
import { useAuth } from '../../context/AuthContext';
import type { GraphEdge, TrustLevel } from '../../lib/networking';

// =============================================================================
// Broadcast Mode Indicator Component
// =============================================================================

interface BroadcastIndicatorProps {
  followingUser: { id: string; username: string; color?: string } | null;
  onStop: () => void;
  isDarkMode: boolean;
}

function BroadcastIndicator({ followingUser, onStop, isDarkMode }: BroadcastIndicatorProps) {
  if (!followingUser) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        background: isDarkMode
          ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.95), rgba(139, 92, 246, 0.95))'
          : 'linear-gradient(135deg, rgba(168, 85, 247, 0.95), rgba(139, 92, 246, 0.95))',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(168, 85, 247, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        animation: 'pulse-glow 2s ease-in-out infinite',
      }}
    >
      <style>
        {`
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 4px 20px rgba(168, 85, 247, 0.4); }
            50% { box-shadow: 0 4px 30px rgba(168, 85, 247, 0.6); }
          }
        `}
      </style>

      {/* Live indicator */}
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: '#ef4444',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.9); }
          }
        `}
      </style>

      {/* User avatar */}
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: followingUser.color || '#6366f1',
          border: '2px solid rgba(255, 255, 255, 0.5)',
        }}
      />

      {/* Text */}
      <div style={{ color: '#fff', fontSize: '13px', fontWeight: 500 }}>
        <span style={{ opacity: 0.8 }}>Viewing as</span>{' '}
        <strong>{followingUser.username}</strong>
      </div>

      {/* Exit hint */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginLeft: '8px',
          padding: '4px 8px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '6px',
        }}
      >
        <kbd
          style={{
            padding: '2px 6px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#fff',
            fontFamily: 'monospace',
          }}
        >
          ESC
        </kbd>
        <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '11px' }}>to exit</span>
      </div>

      {/* Close button */}
      <button
        onClick={onStop}
        style={{
          marginLeft: '4px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255, 255, 255, 0.2)',
          color: '#fff',
          fontSize: '14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
      >
        ✕
      </button>
    </div>
  );
}

// =============================================================================
// Types
// =============================================================================

interface NetworkGraphPanelProps {
  onExpand?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function NetworkGraphPanel({ onExpand }: NetworkGraphPanelProps) {
  const editor = useEditor();
  const { session } = useAuth();

  // Start collapsed on mobile for less cluttered UI
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const [isCollapsed, setIsCollapsed] = useState(isMobile);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  // Broadcast mode state - tracks who we're following
  const [followingUser, setFollowingUser] = useState<{
    id: string;
    username: string;
    color?: string;
  } | null>(null);

  // Detect dark mode
  const [isDarkMode, setIsDarkMode] = useState(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  // Listen for theme changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDarkMode(document.documentElement.classList.contains('dark'));
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // Stop following user - cleanup function
  const stopFollowingUser = useCallback(() => {
    if (!editor) return;

    editor.stopFollowingUser();
    setFollowingUser(null);

    // Remove followId from URL if present
    const url = new URL(window.location.href);
    if (url.searchParams.has('followId')) {
      url.searchParams.delete('followId');
      window.history.replaceState(null, '', url.toString());
    }

  }, [editor]);

  // Keyboard handler for ESC and X to exit broadcast mode
  useEffect(() => {
    if (!followingUser) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC or X (lowercase or uppercase) stops following
      if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        e.stopPropagation();
        stopFollowingUser();
      }
    };

    // Use capture phase to intercept before tldraw
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [followingUser, stopFollowingUser]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (followingUser && editor) {
        editor.stopFollowingUser();
      }
    };
  }, [followingUser, editor]);

  // Get collaborators from tldraw
  const collaborators = useValue(
    'collaborators',
    () => editor.getCollaborators(),
    [editor]
  );

  const myColor = useValue('myColor', () => editor.user.getColor(), [editor]);
  const myName = useValue('myName', () => editor.user.getName() || 'Anonymous', [editor]);

  // Convert collaborators to room participants format
  const roomParticipants = useMemo(() => {
    // Add current user
    const participants = [
      {
        id: session.username || 'me', // Use CryptID username if available
        username: myName,
        color: myColor,
      },
    ];

    // Add collaborators - TLInstancePresence has userId and userName
    collaborators.forEach((c: any) => {
      participants.push({
        id: c.userId || c.id,
        username: c.userName || 'Anonymous',
        color: c.color,
      });
    });

    return participants;
  }, [session.username, myName, myColor, collaborators]);

  // Use the network graph hook
  const {
    nodes,
    edges,
    myConnections,
    isLoading,
    error,
    connect,
    disconnect,
  } = useNetworkGraph({
    roomParticipants,
    refreshInterval: 30000, // Refresh every 30 seconds
    useCache: true,
  });

  // Handle connect with optional trust level
  const handleConnect = useCallback(async (userId: string, trustLevel: TrustLevel = 'connected') => {
    await connect(userId, trustLevel);
  }, [connect]);

  // Handle disconnect
  const handleDisconnect = useCallback(async (connectionId: string) => {
    await disconnect(connectionId);
  }, [disconnect]);

  // Handle node click
  const handleNodeClick = useCallback((_node: any) => {
    // Could open a profile modal or navigate to user
  }, []);

  // Handle going to a user's cursor on canvas (navigate/pan to their location)
  const handleGoToUser = useCallback((node: any) => {
    if (!editor) return;

    // Find the collaborator's cursor position
    // TLInstancePresence has userId and userName properties
    const targetCollaborator = collaborators.find((c: any) =>
      c.id === node.id ||
      c.userId === node.id ||
      c.userName === node.username
    );

    if (targetCollaborator && targetCollaborator.cursor) {
      // Pan to the user's cursor position
      const { x, y } = targetCollaborator.cursor;
      editor.centerOnPoint({ x, y });
    } else {
      // If no cursor position, try to find any presence data
    }
  }, [editor, collaborators]);

  // Handle screen following a user (camera follows their view)
  const handleFollowUser = useCallback((node: any) => {
    if (!editor) return;

    // Find the collaborator to follow
    // TLInstancePresence has userId and userName properties
    const targetCollaborator = collaborators.find((c: any) =>
      c.id === node.id ||
      c.userId === node.id ||
      c.userName === node.username
    );

    if (targetCollaborator) {
      // Use tldraw's built-in follow functionality - needs userId
      const userId = targetCollaborator.userId || targetCollaborator.id;
      editor.startFollowingUser(userId);

      // Set state to show broadcast indicator and enable keyboard exit
      setFollowingUser({
        id: userId,
        username: node.username || node.displayName || 'User',
        color: targetCollaborator.color || node.avatarColor || node.roomPresenceColor,
      });

      // Optionally add followId to URL for deep linking
      const url = new URL(window.location.href);
      url.searchParams.set('followId', userId);
      window.history.replaceState(null, '', url.toString());

    } else {
    }
  }, [editor, collaborators]);

  // Handle opening a user's profile
  const handleOpenProfile = useCallback((node: any) => {
    // Open user profile in a new tab or modal
    const username = node.username || node.id;
    // Navigate to user profile page
    window.open(`/profile/${username}`, '_blank');
  }, []);

  // Handle edge click
  const handleEdgeClick = useCallback((edge: GraphEdge) => {
    setSelectedEdge(edge);
    // Could open an edge metadata editor modal
  }, []);

  // Handle expand to full 3D view
  const handleExpand = useCallback(() => {
    if (onExpand) {
      onExpand();
    } else {
      // Default: open in new tab
      window.open('/graph', '_blank');
    }
  }, [onExpand]);

  // Show loading state briefly
  if (isLoading && nodes.length === 0) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '60px',
        right: '10px',
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
      }}>
        Loading network...
      </div>
    );
  }

  return (
    <>
      {/* Broadcast mode indicator - shows when following a user */}
      <BroadcastIndicator
        followingUser={followingUser}
        onStop={stopFollowingUser}
        isDarkMode={isDarkMode}
      />

      {/* Network graph minimap */}
      <NetworkGraphMinimap
        nodes={nodes}
        edges={edges}
        myConnections={myConnections}
        currentUserId={session.username}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onNodeClick={handleNodeClick}
        onGoToUser={handleGoToUser}
        onFollowUser={handleFollowUser}
        onOpenProfile={handleOpenProfile}
        onEdgeClick={handleEdgeClick}
        onExpandClick={handleExpand}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        isDarkMode={isDarkMode}
      />
    </>
  );
}

export default NetworkGraphPanel;
