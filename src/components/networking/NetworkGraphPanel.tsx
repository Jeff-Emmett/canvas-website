/**
 * NetworkGraphPanel Component
 *
 * Wrapper that integrates the NetworkGraphMinimap with tldraw.
 * Extracts room participants from the editor and provides connection actions.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useEditor, useValue } from 'tldraw';
import { NetworkGraphMinimap } from './NetworkGraphMinimap';
import { useNetworkGraph } from './useNetworkGraph';
import { useAuth } from '../../context/AuthContext';
import type { GraphEdge, TrustLevel } from '../../lib/networking';

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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  // Detect dark mode
  const [isDarkMode, setIsDarkMode] = useState(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  // Listen for theme changes
  React.useEffect(() => {
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
  const handleNodeClick = useCallback((node: any) => {
    // Could open a profile modal or navigate to user
    console.log('Node clicked:', node);
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
      console.log('Could not find cursor position for user:', node.username);
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
      console.log('Now following user:', node.username);
    } else {
      console.log('Could not find user to follow:', node.username);
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
    console.log('Edge clicked:', edge);
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
  );
}

export default NetworkGraphPanel;
