/**
 * NetworkGraphMinimap Component
 *
 * A 2D force-directed graph visualization in the bottom-right corner.
 * Shows:
 * - User's full network in grey
 * - Room participants in their presence colors
 * - Connections as edges between nodes
 * - Mutual connections as thicker lines
 *
 * Features:
 * - Click node to view profile / connect
 * - Click edge to edit metadata
 * - Hover for tooltips
 * - Expand button to open full 3D view
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { type GraphNode, type GraphEdge, type TrustLevel } from '../../lib/networking';
import { UserSearchModal } from './UserSearchModal';

// =============================================================================
// Types
// =============================================================================

interface NetworkGraphMinimapProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  myConnections: string[];
  currentUserId?: string;
  onConnect: (userId: string, trustLevel?: TrustLevel) => Promise<void>;
  onDisconnect?: (connectionId: string) => Promise<void>;
  onNodeClick?: (node: GraphNode) => void;
  onGoToUser?: (node: GraphNode) => void;
  onFollowUser?: (node: GraphNode) => void;
  onOpenProfile?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  onExpandClick?: () => void;
  width?: number;
  height?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isDarkMode?: boolean;
}

interface SimulationNode extends d3.SimulationNodeDatum, GraphNode {}
interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  id: string;
  isMutual: boolean;
}

// =============================================================================
// Styles - Theme-aware functions
// =============================================================================

const getStyles = (isDarkMode: boolean) => ({
  container: {
    position: 'fixed' as const,
    bottom: '60px',
    right: '10px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '8px',
  },
  panel: {
    backgroundColor: isDarkMode ? 'rgba(20, 20, 25, 0.95)' : 'rgba(255, 255, 255, 0.98)',
    borderRadius: '12px',
    boxShadow: isDarkMode ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 4px 20px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
    border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
  },
  panelCollapsed: {
    width: '48px',
    height: '48px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
  },
  title: {
    fontSize: '12px',
    fontWeight: 600,
    color: isDarkMode ? '#e0e0e0' : '#374151',
    margin: 0,
  },
  headerButtons: {
    display: 'flex',
    gap: '4px',
  },
  iconButton: {
    width: '28px',
    height: '28px',
    border: 'none',
    background: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    color: isDarkMode ? '#a0a0a0' : '#6b7280',
    transition: 'background-color 0.15s, color 0.15s',
  },
  canvas: {
    display: 'block',
    backgroundColor: isDarkMode ? 'transparent' : 'rgba(249, 250, 251, 0.5)',
  },
  tooltip: {
    position: 'absolute' as const,
    backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.95)',
    color: isDarkMode ? '#fff' : '#1f2937',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    pointerEvents: 'none' as const,
    whiteSpace: 'nowrap' as const,
    zIndex: 1001,
    transform: 'translate(-50%, -100%)',
    marginTop: '-8px',
    boxShadow: isDarkMode ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.15)',
    border: isDarkMode ? 'none' : '1px solid rgba(0, 0, 0, 0.1)',
  },
  collapsedIcon: {
    fontSize: '20px',
  },
});

// =============================================================================
// Component
// =============================================================================

export function NetworkGraphMinimap({
  nodes,
  edges,
  myConnections: _myConnections,
  currentUserId,
  onConnect,
  onDisconnect,
  onNodeClick,
  onGoToUser,
  onFollowUser,
  onOpenProfile,
  onEdgeClick,
  onExpandClick,
  width = 240,
  height = 180,
  isCollapsed = false,
  onToggleCollapse,
  isDarkMode = false,
}: NetworkGraphMinimapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);

  // Get theme-aware styles
  const styles = React.useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  // Initialize and update the D3 simulation
  useEffect(() => {
    if (!svgRef.current || isCollapsed || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create simulation nodes and links
    const simNodes: SimulationNode[] = nodes.map(n => ({ ...n }));
    const nodeMap = new Map(simNodes.map(n => [n.id, n]));

    const simLinks: SimulationLink[] = edges
      .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map(e => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
        id: e.id,
        isMutual: e.isMutual,
      }));

    // Create the simulation with faster decay for stabilization
    const simulation = d3.forceSimulation<SimulationNode>(simNodes)
      .force('link', d3.forceLink<SimulationNode, SimulationLink>(simLinks)
        .id(d => d.id)
        .distance(40))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(12))
      // Speed up stabilization: higher decay = faster settling
      .alphaDecay(0.05)
      // Lower alpha min threshold for stopping
      .alphaMin(0.01);

    simulationRef.current = simulation;

    // Create container group
    const g = svg.append('g');

    // Create arrow marker definitions for edges
    const defs = svg.append('defs');

    // Arrow marker for regular edges (grey)
    defs.append('marker')
      .attr('id', 'arrow-grey')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L10,0L0,4')
      .attr('fill', 'rgba(150, 150, 150, 0.6)');

    // Arrow marker for connected (yellow)
    defs.append('marker')
      .attr('id', 'arrow-connected')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L10,0L0,4')
      .attr('fill', 'rgba(234, 179, 8, 0.8)');

    // Arrow marker for trusted (green)
    defs.append('marker')
      .attr('id', 'arrow-trusted')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L10,0L0,4')
      .attr('fill', 'rgba(34, 197, 94, 0.8)');

    // Helper to get edge color based on trust level
    const getEdgeColor = (d: SimulationLink) => {
      const edge = edges.find(e => e.id === d.id);
      if (!edge) return 'rgba(150, 150, 150, 0.4)';

      // Use effective trust level for mutual connections, otherwise the edge's trust level
      const level = edge.effectiveTrustLevel || edge.trustLevel;
      if (level === 'trusted') {
        return 'rgba(34, 197, 94, 0.7)'; // green
      } else if (level === 'connected') {
        return 'rgba(234, 179, 8, 0.7)'; // yellow
      }
      return 'rgba(150, 150, 150, 0.4)';
    };

    // Helper to get arrow marker based on trust level
    const getArrowMarker = (d: SimulationLink) => {
      const edge = edges.find(e => e.id === d.id);
      if (!edge) return 'url(#arrow-grey)';
      const level = edge.effectiveTrustLevel || edge.trustLevel;
      if (level === 'trusted') return 'url(#arrow-trusted)';
      if (level === 'connected') return 'url(#arrow-connected)';
      return 'url(#arrow-grey)';
    };

    // Create edges as paths (lines) with arrow markers
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', d => getEdgeColor(d))
      .attr('stroke-width', d => d.isMutual ? 2.5 : 1.5)
      .attr('marker-end', d => getArrowMarker(d))
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        const edge = edges.find(e => e.id === d.id);
        if (edge && onEdgeClick) {
          onEdgeClick(edge);
        }
      });

    // Helper to get node color - uses the user's profile/presence color
    const getNodeColor = (d: SimulationNode) => {
      // Use room presence color (user's profile color) if available
      if (d.roomPresenceColor) {
        return d.roomPresenceColor;
      }
      // Use avatar color as fallback
      if (d.avatarColor) {
        return d.avatarColor;
      }
      // Default grey for users without a color
      return '#9ca3af';
    };

    // Create nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', d => d.isCurrentUser ? 8 : 6)
      .attr('fill', d => getNodeColor(d))
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const rect = svgRef.current!.getBoundingClientRect();
        const name = d.displayName || d.username;
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          text: d.isCurrentUser ? `${name} (you)` : name,
        });
      })
      .on('mouseleave', () => {
        setTooltip(null);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        // Don't show popup for current user
        if (d.isCurrentUser) {
          if (onNodeClick) onNodeClick(d);
          return;
        }
        // Show dropdown menu for all other users
        const rect = svgRef.current!.getBoundingClientRect();
        setSelectedNode({
          node: d,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      })
      .call(d3.drag<SVGCircleElement, SimulationNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any);

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as SimulationNode).x!)
        .attr('y1', d => (d.source as SimulationNode).y!)
        .attr('x2', d => (d.target as SimulationNode).x!)
        .attr('y2', d => (d.target as SimulationNode).y!);

      node
        .attr('cx', d => Math.max(8, Math.min(width - 8, d.x!)))
        .attr('cy', d => Math.max(8, Math.min(height - 8, d.y!)));
    });

    // Stop simulation when it stabilizes (alpha reaches alphaMin)
    simulation.on('end', () => {
      // Simulation has stabilized, nodes will stay in place unless dragged
      simulation.stop();
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, width, height, isCollapsed, onNodeClick, onEdgeClick]);

  // Handle collapsed state click
  const handleCollapsedClick = useCallback(() => {
    if (onToggleCollapse) {
      onToggleCollapse();
    }
  }, [onToggleCollapse]);

  if (isCollapsed) {
    return (
      <div style={styles.container}>
        <div
          style={{ ...styles.panel, ...styles.panelCollapsed }}
          onClick={handleCollapsedClick}
          title="Show network graph"
        >
          <span style={styles.collapsedIcon}>🕸️</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <h3 style={styles.title}>Social Network</h3>
          <div style={styles.headerButtons}>
            <button
              style={styles.iconButton}
              onClick={() => setIsSearchOpen(true)}
              title="Find people"
            >
              🔍
            </button>
            {onExpandClick && (
              <button
                style={styles.iconButton}
                onClick={onExpandClick}
                title="Open full view"
              >
                ⛶
              </button>
            )}
            {onToggleCollapse && (
              <button
                style={styles.iconButton}
                onClick={onToggleCollapse}
                title="Collapse"
              >
                −
              </button>
            )}
          </div>
        </div>

        <div style={{ position: 'relative' }} onClick={() => setSelectedNode(null)}>
          <svg
            ref={svgRef}
            width={width}
            height={height}
            style={styles.canvas}
          />

          {tooltip && (
            <div
              style={{
                ...styles.tooltip,
                left: tooltip.x,
                top: tooltip.y,
              }}
            >
              {tooltip.text}
            </div>
          )}

          {/* User action dropdown menu when clicking a node */}
          {selectedNode && !selectedNode.node.isCurrentUser && (
            <div
              style={{
                position: 'absolute',
                left: Math.min(selectedNode.x, width - 160),
                top: Math.max(selectedNode.y - 10, 10),
                backgroundColor: isDarkMode ? '#1e1e2e' : 'white',
                borderRadius: '8px',
                boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
                padding: '6px',
                zIndex: 1002,
                minWidth: '150px',
                border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Connect option - only for non-anonymous users */}
              {!selectedNode.node.isAnonymous && (
                <button
                  onClick={async () => {
                    setIsConnecting(true);
                    try {
                      const userId = selectedNode.node.username || selectedNode.node.id;
                      await onConnect(userId, 'connected');
                    } catch (err) {
                      console.error('Failed to connect:', err);
                    }
                    setSelectedNode(null);
                    setIsConnecting(false);
                  }}
                  disabled={isConnecting}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '11px',
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#fbbf24' : '#92400e',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span>🔗</span> Connect with {selectedNode.node.displayName || selectedNode.node.username}
                </button>
              )}

              {/* Navigate option - only for in-room users */}
              {selectedNode.node.isInRoom && onGoToUser && (
                <button
                  onClick={() => {
                    onGoToUser(selectedNode.node);
                    setSelectedNode(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '11px',
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#a0a0ff' : '#4f46e5',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span>📍</span> Navigate to {selectedNode.node.displayName || selectedNode.node.username}
                </button>
              )}

              {/* Screenfollow option - only for in-room users */}
              {selectedNode.node.isInRoom && onFollowUser && (
                <button
                  onClick={() => {
                    onFollowUser(selectedNode.node);
                    setSelectedNode(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '11px',
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#60a5fa' : '#2563eb',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span>👁️</span> Screenfollow {selectedNode.node.displayName || selectedNode.node.username}
                </button>
              )}

              {/* Open profile option - only for non-anonymous users */}
              {!selectedNode.node.isAnonymous && onOpenProfile && (
                <button
                  onClick={() => {
                    onOpenProfile(selectedNode.node);
                    setSelectedNode(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '11px',
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#e0e0e0' : '#374151',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span>👤</span> Open {selectedNode.node.displayName || selectedNode.node.username}'s profile
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <UserSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onConnect={onConnect}
        onDisconnect={onDisconnect ? (userId) => {
          // Find the connection ID for this user
          const edge = edges.find(e =>
            (e.source === currentUserId && e.target === userId) ||
            (e.target === currentUserId && e.source === userId)
          );
          if (edge && onDisconnect) {
            return onDisconnect(edge.id);
          }
          return Promise.resolve();
        } : undefined}
        currentUserId={currentUserId}
      />
    </div>
  );
}

export default NetworkGraphMinimap;
