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
import { type GraphNode, type GraphEdge, type TrustLevel, TRUST_LEVEL_COLORS } from '../../lib/networking';
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
  stats: {
    display: 'flex',
    gap: '12px',
    padding: '6px 12px',
    borderTop: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
    fontSize: '11px',
    color: isDarkMode ? '#888' : '#6b7280',
    backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)',
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  statDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
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

  // Count stats
  const inRoomCount = nodes.filter(n => n.isInRoom).length;
  const anonymousCount = nodes.filter(n => n.isAnonymous).length;
  const trustedCount = nodes.filter(n => n.trustLevelTo === 'trusted').length;
  const connectedCount = nodes.filter(n => n.trustLevelTo === 'connected').length;
  const unconnectedCount = nodes.filter(n => !n.trustLevelTo && !n.isCurrentUser && !n.isAnonymous).length;

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

    // Helper to get node color based on trust level and room status
    // Priority: current user (purple) > anonymous (grey) > trust level > unconnected (white)
    const getNodeColor = (d: SimulationNode) => {
      if (d.isCurrentUser) {
        return '#4f46e5'; // Current user is always purple
      }
      // Anonymous users are grey
      if (d.isAnonymous) {
        return TRUST_LEVEL_COLORS.anonymous;
      }
      // If in room and has presence color, use it for the stroke/ring instead
      // (we still use trust level for fill to maintain visual consistency)
      // Otherwise use trust level color
      if (d.trustLevelTo) {
        return TRUST_LEVEL_COLORS[d.trustLevelTo];
      }
      // Authenticated but unconnected = white
      return TRUST_LEVEL_COLORS.unconnected;
    };

    // Helper to get node stroke color (for in-room presence indicator)
    const getNodeStroke = (d: SimulationNode) => {
      if (d.isCurrentUser) return '#fff';
      // Show room presence color as a ring around the node
      if (d.isInRoom && d.roomPresenceColor) return d.roomPresenceColor;
      // White nodes need a subtle border to be visible
      if (!d.isAnonymous && !d.trustLevelTo) return '#e5e7eb';
      return 'none';
    };

    const getNodeStrokeWidth = (d: SimulationNode) => {
      if (d.isCurrentUser) return 2;
      if (d.isInRoom && d.roomPresenceColor) return 2;
      if (!d.isAnonymous && !d.trustLevelTo) return 1;
      return 0;
    };

    // Create nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', d => d.isCurrentUser ? 8 : 6)
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', d => getNodeStroke(d))
      .attr('stroke-width', d => getNodeStrokeWidth(d))
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const rect = svgRef.current!.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          text: `${d.displayName || d.username}${d.isAnonymous ? ' (anonymous)' : ''}`,
        });
      })
      .on('mouseleave', () => {
        setTooltip(null);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        // Don't show popup for current user or anonymous users
        if (d.isCurrentUser || d.isAnonymous) {
          if (onNodeClick) onNodeClick(d);
          return;
        }
        // Show connection popup
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

          {/* Connection popup when clicking a node */}
          {selectedNode && !selectedNode.node.isCurrentUser && !selectedNode.node.isAnonymous && (
            <div
              style={{
                position: 'absolute',
                left: Math.min(selectedNode.x, width - 140),
                top: Math.max(selectedNode.y - 80, 10),
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                padding: '8px',
                zIndex: 1002,
                minWidth: '130px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#1a1a2e' }}>
                {selectedNode.node.displayName || selectedNode.node.username}
              </div>
              <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>
                @{selectedNode.node.username}
              </div>

              {/* Connection actions */}
              {selectedNode.node.trustLevelTo ? (
                // Already connected - show trust level options
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    onClick={async () => {
                      // Toggle trust level
                      const newLevel = selectedNode.node.trustLevelTo === 'trusted' ? 'connected' : 'trusted';
                      setIsConnecting(true);
                      // This would need updateTrustLevel function passed as prop
                      // For now, just close the popup
                      setSelectedNode(null);
                      setIsConnecting(false);
                    }}
                    disabled={isConnecting}
                    style={{
                      padding: '6px 10px',
                      fontSize: '10px',
                      backgroundColor: selectedNode.node.trustLevelTo === 'trusted' ? '#fef3c7' : '#d1fae5',
                      color: selectedNode.node.trustLevelTo === 'trusted' ? '#92400e' : '#065f46',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {selectedNode.node.trustLevelTo === 'trusted' ? 'Downgrade to Connected' : 'Upgrade to Trusted'}
                  </button>
                  <button
                    onClick={async () => {
                      setIsConnecting(true);
                      try {
                        // Find connection ID and disconnect
                        const edge = edges.find(e =>
                          (e.source === currentUserId && e.target === selectedNode.node.id) ||
                          (e.target === currentUserId && e.source === selectedNode.node.id)
                        );
                        if (edge && onDisconnect) {
                          await onDisconnect(edge.id);
                        }
                      } catch (err) {
                        console.error('Failed to disconnect:', err);
                      }
                      setSelectedNode(null);
                      setIsConnecting(false);
                    }}
                    disabled={isConnecting}
                    style={{
                      padding: '6px 10px',
                      fontSize: '10px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {isConnecting ? 'Removing...' : 'Remove Connection'}
                  </button>
                </div>
              ) : (
                // Not connected - show connect options
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    onClick={async () => {
                      setIsConnecting(true);
                      try {
                        // Use username for API call (CryptID username), not tldraw session id
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
                      padding: '6px 10px',
                      fontSize: '10px',
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {isConnecting ? 'Connecting...' : 'Connect (View)'}
                  </button>
                  <button
                    onClick={async () => {
                      setIsConnecting(true);
                      try {
                        // Use username for API call (CryptID username), not tldraw session id
                        // Connect with trusted level directly
                        const userId = selectedNode.node.username || selectedNode.node.id;
                        await onConnect(userId, 'trusted');
                      } catch (err) {
                        console.error('Failed to connect:', err);
                      }
                      setSelectedNode(null);
                      setIsConnecting(false);
                    }}
                    disabled={isConnecting}
                    style={{
                      padding: '6px 10px',
                      fontSize: '10px',
                      backgroundColor: '#d1fae5',
                      color: '#065f46',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {isConnecting ? 'Connecting...' : 'Trust (Edit)'}
                  </button>
                </div>
              )}

              <button
                onClick={() => setSelectedNode(null)}
                style={{
                  marginTop: '6px',
                  width: '100%',
                  padding: '4px',
                  fontSize: '9px',
                  backgroundColor: 'transparent',
                  color: '#666',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div style={styles.stats}>
          <div style={styles.stat} title="Users in this room">
            <div style={{ ...styles.statDot, backgroundColor: '#4f46e5' }} />
            <span>{inRoomCount}</span>
          </div>
          <div style={styles.stat} title="Trusted (edit access)">
            <div style={{ ...styles.statDot, backgroundColor: TRUST_LEVEL_COLORS.trusted }} />
            <span>{trustedCount}</span>
          </div>
          <div style={styles.stat} title="Connected (view access)">
            <div style={{ ...styles.statDot, backgroundColor: TRUST_LEVEL_COLORS.connected }} />
            <span>{connectedCount}</span>
          </div>
          <div style={styles.stat} title="Unconnected">
            <div style={{ ...styles.statDot, backgroundColor: TRUST_LEVEL_COLORS.unconnected, border: '1px solid #e5e7eb' }} />
            <span>{unconnectedCount}</span>
          </div>
          {anonymousCount > 0 && (
            <div style={styles.stat} title="Anonymous">
              <div style={{ ...styles.statDot, backgroundColor: TRUST_LEVEL_COLORS.anonymous }} />
              <span>{anonymousCount}</span>
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
