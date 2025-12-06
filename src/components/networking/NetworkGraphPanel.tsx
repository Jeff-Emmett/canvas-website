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
import { useSession } from '../../context/AuthContext';
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
  const { session } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

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

    // Add collaborators
    collaborators.forEach((c: any) => {
      participants.push({
        id: c.id || c.userId || c.instanceId,
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

  // Handle connect with default trust level
  const handleConnect = useCallback(async (userId: string) => {
    await connect(userId);
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

  // Don't render if not authenticated
  if (!session.authed) {
    return null;
  }

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
      onEdgeClick={handleEdgeClick}
      onExpandClick={handleExpand}
      isCollapsed={isCollapsed}
      onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
    />
  );
}

export default NetworkGraphPanel;
