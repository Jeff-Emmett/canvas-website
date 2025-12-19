/**
 * NetworkGraphMinimap Component
 *
 * A force-directed social graph visualization positioned above the minimap.
 * Shows:
 * - User's full network with trust-level coloring
 * - Room participants in their presence colors
 * - Connections as edges between nodes
 * - Mutual connections as thicker lines
 *
 * Features:
 * - Three display modes: minimized (icon), normal (small window), maximized (modal)
 * - Click node to view profile / connect
 * - Click edge to edit metadata
 * - Hover for tooltips
 * - Stable simulation that doesn't constantly reinitialize
 *
 * Positioned in bottom-left, above the tldraw minimap.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo, Suspense, lazy } from 'react';
import * as d3 from 'd3';
import { type GraphNode, type GraphEdge, type TrustLevel } from '../../lib/networking';
import { UserSearchModal } from './UserSearchModal';

// Lazy load the 3D component to avoid loading Three.js unless needed
const NetworkGraph3D = lazy(() => import('./NetworkGraph3D'));

// =============================================================================
// Types
// =============================================================================

type DisplayMode = 'minimized' | 'normal' | 'maximized';

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

// Match tldraw minimap dimensions
const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 100;
const MINIMAP_BOTTOM = 40; // tldraw minimap position from bottom
const MINIMAP_LEFT = 8;    // tldraw minimap position from left
const STACK_GAP = 8;       // gap between network panel and minimap

const getStyles = (isDarkMode: boolean, displayMode: DisplayMode) => ({
  // Container - positioned bottom LEFT, directly above the tldraw minimap
  container: {
    position: 'fixed' as const,
    // Stack directly above tldraw minimap: minimap_bottom + minimap_height + gap
    bottom: displayMode === 'maximized' ? '0' : `${MINIMAP_BOTTOM + MINIMAP_HEIGHT + STACK_GAP}px`,
    left: displayMode === 'maximized' ? '0' : `${MINIMAP_LEFT}px`,
    right: displayMode === 'maximized' ? '0' : 'auto',
    top: displayMode === 'maximized' ? '0' : 'auto',
    zIndex: displayMode === 'maximized' ? 10000 : 1000,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: displayMode === 'maximized' ? 'center' : 'flex-start',
    justifyContent: displayMode === 'maximized' ? 'center' : 'flex-start',
    gap: '8px',
    backgroundColor: displayMode === 'maximized' ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
    pointerEvents: displayMode === 'maximized' ? 'auto' as const : 'none' as const,
  },
  // Main panel
  panel: {
    backgroundColor: isDarkMode ? 'rgba(20, 20, 25, 0.95)' : 'rgba(255, 255, 255, 0.98)',
    borderRadius: displayMode === 'maximized' ? '16px' : '12px',
    boxShadow: isDarkMode
      ? '0 4px 20px rgba(0, 0, 0, 0.4)'
      : displayMode === 'maximized'
        ? '0 8px 40px rgba(0, 0, 0, 0.3)'
        : '0 4px 20px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
    pointerEvents: 'auto' as const,
    // Sphere-like gradient background for the graph area
    background: isDarkMode
      ? 'radial-gradient(ellipse at center, rgba(40, 40, 50, 0.95) 0%, rgba(20, 20, 25, 0.98) 100%)'
      : 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.98) 0%, rgba(245, 245, 250, 0.98) 100%)',
  },
  // Minimized state - small icon
  panelMinimized: {
    width: '40px',
    height: '40px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    background: isDarkMode
      ? 'radial-gradient(circle, rgba(60, 60, 80, 0.9) 0%, rgba(30, 30, 40, 0.95) 100%)'
      : 'radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(240, 240, 245, 0.98) 100%)',
    boxShadow: isDarkMode
      ? '0 2px 12px rgba(100, 100, 255, 0.2), inset 0 0 20px rgba(100, 100, 255, 0.1)'
      : '0 2px 12px rgba(0, 0, 0, 0.15), inset 0 0 20px rgba(100, 100, 255, 0.05)',
    border: isDarkMode ? '1px solid rgba(100, 100, 255, 0.3)' : '1px solid rgba(100, 100, 255, 0.2)',
  },
  // Normal state dimensions - match tldraw minimap width
  panelNormal: {
    width: `${MINIMAP_WIDTH}px`,
    maxHeight: '200px',
  },
  // Maximized state dimensions
  panelMaximized: {
    width: '90vw',
    maxWidth: '800px',
    maxHeight: '80vh',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: displayMode === 'maximized' ? '12px 16px' : '8px 12px',
    borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
  },
  title: {
    fontSize: displayMode === 'maximized' ? '14px' : '12px',
    fontWeight: 600,
    color: isDarkMode ? '#e0e0e0' : '#374151',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headerButtons: {
    display: 'flex',
    gap: '4px',
  },
  iconButton: {
    width: displayMode === 'maximized' ? '32px' : '28px',
    height: displayMode === 'maximized' ? '32px' : '28px',
    border: 'none',
    background: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: displayMode === 'maximized' ? '16px' : '14px',
    color: isDarkMode ? '#a0a0a0' : '#6b7280',
    transition: 'background-color 0.15s, color 0.15s',
  },
  canvas: {
    display: 'block',
    // Sphere-like inner gradient
    background: isDarkMode
      ? 'radial-gradient(ellipse at center, rgba(50, 50, 70, 0.3) 0%, transparent 70%)'
      : 'radial-gradient(ellipse at center, rgba(200, 200, 255, 0.15) 0%, transparent 70%)',
  },
  tooltip: {
    position: 'absolute' as const,
    backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.98)',
    color: isDarkMode ? '#fff' : '#1f2937',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    pointerEvents: 'none' as const,
    whiteSpace: 'nowrap' as const,
    zIndex: 1001,
    transform: 'translate(-50%, -100%)',
    marginTop: '-10px',
    boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
    border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
  },
  minimizedIcon: {
    fontSize: '18px',
    filter: 'drop-shadow(0 0 4px rgba(100, 100, 255, 0.4))',
  },
  // Network stats in maximized view
  statsBar: {
    display: 'flex',
    gap: '16px',
    padding: '8px 16px',
    borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
    fontSize: '11px',
    color: isDarkMode ? '#888' : '#666',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  statValue: {
    fontWeight: 600,
    color: isDarkMode ? '#a0a0ff' : '#4f46e5',
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
  width: propWidth = MINIMAP_WIDTH - 16, // Account for padding
  height: propHeight = 120,              // Compact height to match minimap proportions
  isCollapsed = false,
  onToggleCollapse,
  isDarkMode = false,
}: NetworkGraphMinimapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);
  const simNodesRef = useRef<SimulationNode[]>([]);
  const simLinksRef = useRef<SimulationLink[]>([]);
  const isInitializedRef = useRef(false);

  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Three-state display mode: minimized, normal, maximized
  const [displayMode, setDisplayMode] = useState<DisplayMode>(isCollapsed ? 'minimized' : 'normal');

  // Sync with legacy isCollapsed prop
  useEffect(() => {
    if (isCollapsed && displayMode !== 'minimized') {
      setDisplayMode('minimized');
    }
  }, [isCollapsed]);

  // Calculate dimensions based on display mode
  const { width, height } = useMemo(() => {
    switch (displayMode) {
      case 'minimized':
        return { width: 0, height: 0 };
      case 'normal':
        return { width: propWidth, height: propHeight };
      case 'maximized':
        return {
          width: Math.min(700, window.innerWidth * 0.85),
          height: Math.min(500, window.innerHeight * 0.6)
        };
      default:
        return { width: propWidth, height: propHeight };
    }
  }, [displayMode, propWidth, propHeight]);

  // Get theme-aware styles
  const styles = useMemo(() => getStyles(isDarkMode, displayMode), [isDarkMode, displayMode]);

  // Network stats for maximized view
  const networkStats = useMemo(() => {
    const inRoomCount = nodes.filter(n => n.isInRoom).length;
    const connectionCount = edges.length;
    const mutualCount = edges.filter(e => e.isMutual).length;
    const trustedCount = edges.filter(e => e.trustLevel === 'trusted').length;
    return { inRoomCount, connectionCount, mutualCount, trustedCount, totalNodes: nodes.length };
  }, [nodes, edges]);

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
      isInitializedRef.current = false;
      simNodesRef.current = [];
      simLinksRef.current = [];
    };
  }, []);

  // Initialize and update the D3 simulation - STABLE VERSION
  // This effect uses refs to persist simulation state and only updates incrementally
  useEffect(() => {
    if (!svgRef.current || displayMode === 'minimized' || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);

    // Check if we need to initialize or just update
    const needsInit = !isInitializedRef.current || !simulationRef.current;
    const nodeMap = new Map(simNodesRef.current.map(n => [n.id, n]));

    if (needsInit) {
      // Full initialization - only happens once
      svg.selectAll('*').remove();

      // Create simulation nodes, preserving existing positions if available
      simNodesRef.current = nodes.map(n => {
        const existing = nodeMap.get(n.id);
        return {
          ...n,
          x: existing?.x ?? width / 2 + (Math.random() - 0.5) * 100,
          y: existing?.y ?? height / 2 + (Math.random() - 0.5) * 100,
          vx: existing?.vx ?? 0,
          vy: existing?.vy ?? 0,
        };
      });

      const newNodeMap = new Map(simNodesRef.current.map(n => [n.id, n]));

      simLinksRef.current = edges
        .filter(e => newNodeMap.has(e.source) && newNodeMap.has(e.target))
        .map(e => ({
          source: newNodeMap.get(e.source)!,
          target: newNodeMap.get(e.target)!,
          id: e.id,
          isMutual: e.isMutual,
        }));

      // Create the simulation with smooth, stable parameters
      const simulation = d3.forceSimulation<SimulationNode>(simNodesRef.current)
        .force('link', d3.forceLink<SimulationNode, SimulationLink>(simLinksRef.current)
          .id(d => d.id)
          .distance(displayMode === 'maximized' ? 80 : 50)
          .strength(0.5))
        .force('charge', d3.forceManyBody()
          .strength(displayMode === 'maximized' ? -150 : -100)
          .distanceMax(displayMode === 'maximized' ? 300 : 200))
        .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
        .force('collision', d3.forceCollide().radius(d => (d as SimulationNode).isCurrentUser ? 14 : 10))
        // Gentler alpha decay for smoother settling
        .alphaDecay(0.02)
        // Higher alpha min so it stops sooner
        .alphaMin(0.05)
        // Add velocity decay for smoother movement
        .velocityDecay(0.4);

      simulationRef.current = simulation;
      isInitializedRef.current = true;
    } else {
      // Incremental update - preserve existing node positions
      const existingNodeMap = new Map(simNodesRef.current.map(n => [n.id, n]));

      // Update existing nodes and add new ones
      const newNodes: SimulationNode[] = nodes.map(n => {
        const existing = existingNodeMap.get(n.id);
        if (existing) {
          // Update properties but keep position
          return { ...existing, ...n, x: existing.x, y: existing.y, vx: existing.vx, vy: existing.vy };
        }
        // New node - place near center with slight randomness
        return {
          ...n,
          x: width / 2 + (Math.random() - 0.5) * 50,
          y: height / 2 + (Math.random() - 0.5) * 50,
        };
      });

      simNodesRef.current = newNodes;
      const newNodeMap = new Map(newNodes.map(n => [n.id, n]));

      simLinksRef.current = edges
        .filter(e => newNodeMap.has(e.source) && newNodeMap.has(e.target))
        .map(e => ({
          source: newNodeMap.get(e.source)!,
          target: newNodeMap.get(e.target)!,
          id: e.id,
          isMutual: e.isMutual,
        }));

      // Update simulation with new nodes/links
      simulationRef.current!
        .nodes(simNodesRef.current)
        .force('link', d3.forceLink<SimulationNode, SimulationLink>(simLinksRef.current)
          .id(d => d.id)
          .distance(displayMode === 'maximized' ? 80 : 50)
          .strength(0.5))
        .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05));

      // Gentle reheat to settle new nodes
      simulationRef.current!.alpha(0.3).restart();

      // Re-render the graph with updated data
      svg.selectAll('*').remove();
    }

    const simulation = simulationRef.current!;

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
      .data(simLinksRef.current)
      .join('line')
      .attr('stroke', d => getEdgeColor(d))
      .attr('stroke-width', d => d.isMutual ? (displayMode === 'maximized' ? 3 : 2.5) : (displayMode === 'maximized' ? 2 : 1.5))
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

    // Node sizes based on display mode
    const nodeRadius = displayMode === 'maximized' ? 10 : 6;
    const currentUserRadius = displayMode === 'maximized' ? 14 : 8;

    // Create nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(simNodesRef.current)
      .join('circle')
      .attr('r', d => d.isCurrentUser ? currentUserRadius : nodeRadius)
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', d => d.isInRoom ? 'rgba(100, 200, 255, 0.8)' : 'transparent')
      .attr('stroke-width', d => d.isInRoom ? 2 : 0)
      .style('cursor', 'pointer')
      .style('filter', d => d.isInRoom ? 'drop-shadow(0 0 4px rgba(100, 200, 255, 0.5))' : 'none')
      .on('mouseenter', (event, d) => {
        const rect = svgRef.current!.getBoundingClientRect();
        const name = d.displayName || d.username;
        const status = d.isInRoom ? ' (in room)' : '';
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          text: d.isCurrentUser ? `${name} (you)` : `${name}${status}`,
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

      const margin = displayMode === 'maximized' ? 12 : 8;
      node
        .attr('cx', d => Math.max(margin, Math.min(width - margin, d.x!)))
        .attr('cy', d => Math.max(margin, Math.min(height - margin, d.y!)));
    });

    // Stop simulation when it stabilizes (alpha reaches alphaMin)
    simulation.on('end', () => {
      // Simulation has stabilized, nodes will stay in place unless dragged
      // Don't call stop() - let it stay ready for interactions
    });

    // Cleanup function - only stop if component unmounts
    return () => {
      // Don't reset simulation on every re-render
      // Only cleanup on actual unmount
    };
  }, [nodes, edges, width, height, displayMode, onNodeClick, onEdgeClick]);

  // Handle display mode changes
  const handleMinimize = useCallback(() => {
    setDisplayMode('minimized');
    onToggleCollapse?.();
  }, [onToggleCollapse]);

  const handleNormal = useCallback(() => {
    setDisplayMode('normal');
  }, []);

  const handleMaximize = useCallback(() => {
    setDisplayMode('maximized');
    onExpandClick?.();
  }, [onExpandClick]);

  const handleMinimizedClick = useCallback(() => {
    setDisplayMode('normal');
    onToggleCollapse?.();
  }, [onToggleCollapse]);

  // Handle ESC to close maximized view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && displayMode === 'maximized') {
        setDisplayMode('normal');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayMode]);

  // Minimized state - small circular icon
  if (displayMode === 'minimized') {
    return (
      <div style={styles.container}>
        <div
          style={{ ...styles.panel, ...styles.panelMinimized }}
          onClick={handleMinimizedClick}
          title="Show social network"
        >
          <span style={styles.minimizedIcon}>🕸️</span>
        </div>
      </div>
    );
  }

  // Get panel size styles based on display mode
  const panelSizeStyle = displayMode === 'maximized' ? styles.panelMaximized : styles.panelNormal;

  return (
    <div
      style={styles.container}
      onClick={displayMode === 'maximized' ? handleNormal : undefined}
    >
      <div
        style={{ ...styles.panel, ...panelSizeStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={styles.header}>
          <h3 style={styles.title}>
            <span>🕸️</span>
            Social Network
            {displayMode === 'maximized' && (
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '10px',
                background: isDarkMode ? 'rgba(100, 100, 255, 0.2)' : 'rgba(100, 100, 255, 0.1)',
                color: isDarkMode ? '#a0a0ff' : '#4f46e5',
                marginLeft: '8px',
              }}>
                {networkStats.totalNodes} people
              </span>
            )}
          </h3>
          <div style={styles.headerButtons}>
            {/* Search button */}
            <button
              style={styles.iconButton}
              onClick={() => setIsSearchOpen(true)}
              title="Find people"
              onMouseEnter={(e) => { e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
            >
              🔍
            </button>

            {/* Maximize/Restore button */}
            {displayMode === 'normal' && (
              <button
                style={styles.iconButton}
                onClick={handleMaximize}
                title="Expand to full view"
                onMouseEnter={(e) => { e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                ⛶
              </button>
            )}
            {displayMode === 'maximized' && (
              <button
                style={styles.iconButton}
                onClick={handleNormal}
                title="Restore to small view"
                onMouseEnter={(e) => { e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                ⛶
              </button>
            )}

            {/* Minimize button */}
            <button
              style={styles.iconButton}
              onClick={handleMinimize}
              title="Minimize"
              onMouseEnter={(e) => { e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
            >
              −
            </button>

            {/* Close button (maximized only) */}
            {displayMode === 'maximized' && (
              <button
                style={styles.iconButton}
                onClick={handleNormal}
                title="Close (Esc)"
                onMouseEnter={(e) => { e.currentTarget.style.background = isDarkMode ? 'rgba(255,100,100,0.2)' : 'rgba(255,0,0,0.1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Stats bar (maximized only) */}
        {displayMode === 'maximized' && (
          <div style={styles.statsBar}>
            <div style={styles.statItem}>
              <span>👥</span>
              <span>In room:</span>
              <span style={styles.statValue}>{networkStats.inRoomCount}</span>
            </div>
            <div style={styles.statItem}>
              <span>🔗</span>
              <span>Connections:</span>
              <span style={styles.statValue}>{networkStats.connectionCount}</span>
            </div>
            <div style={styles.statItem}>
              <span>🤝</span>
              <span>Mutual:</span>
              <span style={styles.statValue}>{networkStats.mutualCount}</span>
            </div>
            <div style={styles.statItem}>
              <span>⭐</span>
              <span>Trusted:</span>
              <span style={styles.statValue}>{networkStats.trustedCount}</span>
            </div>
          </div>
        )}

        {/* 3D View for maximized mode */}
        {displayMode === 'maximized' ? (
          <Suspense
            fallback={
              <div
                style={{
                  width: '100%',
                  height: height,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDarkMode
                    ? 'radial-gradient(ellipse at center, #1a1a2e 0%, #0d0d1a 100%)'
                    : 'radial-gradient(ellipse at center, #f8f8ff 0%, #e8e8f0 100%)',
                  color: isDarkMode ? '#888' : '#666',
                  fontSize: '14px',
                }}
              >
                Loading 3D view...
              </div>
            }
          >
            <div style={{ width: '100%', height: height }}>
              <NetworkGraph3D
                nodes={nodes}
                edges={edges}
                currentUserId={currentUserId}
                onNodeClick={onNodeClick}
                onConnect={onConnect}
                onZoomToUser={onGoToUser}
                onViewAsUser={onFollowUser}
                isDarkMode={isDarkMode}
                sphereRadius={3}
              />
            </div>
          </Suspense>
        ) : (
          /* 2D SVG View for normal mode */
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
        )}
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
