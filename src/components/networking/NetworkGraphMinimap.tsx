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
  onConnect: (userId: string) => Promise<void>;
  onDisconnect?: (connectionId: string) => Promise<void>;
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  onExpandClick?: () => void;
  width?: number;
  height?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface SimulationNode extends d3.SimulationNodeDatum, GraphNode {}
interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  id: string;
  isMutual: boolean;
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '12px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
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
    borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  title: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#1a1a2e',
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
    color: '#666',
    transition: 'background-color 0.15s',
  },
  canvas: {
    display: 'block',
  },
  tooltip: {
    position: 'absolute' as const,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: '#fff',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    pointerEvents: 'none' as const,
    whiteSpace: 'nowrap' as const,
    zIndex: 1001,
    transform: 'translate(-50%, -100%)',
    marginTop: '-8px',
  },
  collapsedIcon: {
    fontSize: '20px',
  },
  stats: {
    display: 'flex',
    gap: '12px',
    padding: '6px 12px',
    borderTop: '1px solid rgba(0, 0, 0, 0.1)',
    fontSize: '11px',
    color: '#666',
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
};

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
}: NetworkGraphMinimapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);

  // Count stats
  const inRoomCount = nodes.filter(n => n.isInRoom).length;
  const trustedCount = nodes.filter(n => n.trustLevelTo === 'trusted').length;
  const connectedCount = nodes.filter(n => n.trustLevelTo === 'connected').length;
  const unconnectedCount = nodes.filter(n => !n.trustLevelTo && !n.isCurrentUser).length;

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

    // Create the simulation
    const simulation = d3.forceSimulation<SimulationNode>(simNodes)
      .force('link', d3.forceLink<SimulationNode, SimulationLink>(simLinks)
        .id(d => d.id)
        .distance(40))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(12));

    simulationRef.current = simulation;

    // Create container group
    const g = svg.append('g');

    // Helper to get edge color based on trust level
    const getEdgeColor = (d: SimulationLink) => {
      const edge = edges.find(e => e.id === d.id);
      if (!edge) return 'rgba(0, 0, 0, 0.15)';

      // Use effective trust level for mutual connections, otherwise the edge's trust level
      const level = edge.effectiveTrustLevel || edge.trustLevel;
      if (level === 'trusted') {
        return 'rgba(34, 197, 94, 0.6)'; // green
      } else if (level === 'connected') {
        return 'rgba(234, 179, 8, 0.6)'; // yellow
      }
      return 'rgba(0, 0, 0, 0.15)';
    };

    // Create edges
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', d => getEdgeColor(d))
      .attr('stroke-width', d => d.isMutual ? 2.5 : 1.5)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        const edge = edges.find(e => e.id === d.id);
        if (edge && onEdgeClick) {
          onEdgeClick(edge);
        }
      });

    // Helper to get node color based on trust level and room status
    const getNodeColor = (d: SimulationNode) => {
      if (d.isCurrentUser) {
        return '#4f46e5'; // Current user is always purple
      }
      // If in room, use presence color
      if (d.isInRoom && d.roomPresenceColor) {
        return d.roomPresenceColor;
      }
      // Otherwise use trust level color
      if (d.trustLevelTo) {
        return TRUST_LEVEL_COLORS[d.trustLevelTo];
      }
      // Unconnected
      return TRUST_LEVEL_COLORS.unconnected;
    };

    // Create nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', d => d.isCurrentUser ? 8 : 6)
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', d => d.isCurrentUser ? '#fff' : 'none')
      .attr('stroke-width', d => d.isCurrentUser ? 2 : 0)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const rect = svgRef.current!.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          text: d.displayName || d.username,
        });
      })
      .on('mouseleave', () => {
        setTooltip(null);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        if (onNodeClick) {
          onNodeClick(d);
        }
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
          <h3 style={styles.title}>Network</h3>
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

        <div style={{ position: 'relative' }}>
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
          <div style={styles.stat} title="Unconnected (no access)">
            <div style={{ ...styles.statDot, backgroundColor: TRUST_LEVEL_COLORS.unconnected }} />
            <span>{unconnectedCount}</span>
          </div>
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
