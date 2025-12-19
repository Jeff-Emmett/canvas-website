// @ts-nocheck
/**
 * NetworkGraph3D Component
 *
 * A 3D force-directed social graph visualization using Three.js.
 * Renders users as spheres within a bounded transparent sphere,
 * with connections shown as animated flowing lines between nodes.
 *
 * Features:
 * - Trust-level clustering (trusted → inner, connected → middle, unconnected → outer)
 * - Node size proportional to decision power/influence
 * - Animated edge flows showing delegation direction
 * - Orbit controls for camera navigation (drag to rotate, scroll to zoom)
 * - Zoom to user with camera animation
 * - View as user (broadcast mode) for screen following
 * - Click nodes to select and interact
 *
 * Note: @ts-nocheck is used because React Three Fiber JSX types are not
 * being properly recognized. The code works correctly at runtime.
 */

import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { type GraphNode, type GraphEdge, type TrustLevel } from '../../lib/networking';

// =============================================================================
// Types
// =============================================================================

interface NetworkGraph3DProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  currentUserId?: string;
  onNodeClick?: (node: GraphNode) => void;
  onNodeSelect?: (node: GraphNode | null) => void;
  onConnect?: (userId: string, trustLevel?: TrustLevel) => Promise<void>;
  onZoomToUser?: (node: GraphNode) => void;
  onViewAsUser?: (node: GraphNode) => void;
  isDarkMode?: boolean;
  sphereRadius?: number;
}

interface Node3D extends GraphNode {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetRadius: number; // Target distance from center based on trust level
  decisionPower: number; // Calculated influence metric
}

interface SelectedNodeInfo {
  node: GraphNode;
  screenPosition: { x: number; y: number };
}

// =============================================================================
// Force Simulation Constants
// =============================================================================

const FORCE_CONFIG = {
  // Repulsion between all nodes
  repulsion: 0.6,
  repulsionDistance: 2.5,
  // Attraction along edges
  linkStrength: 0.015,
  linkDistance: 1.2,
  // Centering force (now per-shell)
  shellStrength: 0.03,
  // Velocity damping
  damping: 0.88,
  // Sphere boundary
  boundaryStrength: 0.4,
  // Minimum movement threshold to stop simulation
  minVelocity: 0.0008,
  // Trust level shell radii (as fraction of sphere radius)
  trustedShell: 0.35,    // Inner - most trusted
  connectedShell: 0.6,   // Middle - connected
  outerShell: 0.85,      // Outer - unconnected/anonymous
};

// =============================================================================
// Helper Functions
// =============================================================================

function getNodeColor(node: GraphNode, isDarkMode: boolean): string {
  if (node.roomPresenceColor) return node.roomPresenceColor;
  if (node.avatarColor) return node.avatarColor;
  return isDarkMode ? '#6b7280' : '#9ca3af';
}

function getEdgeColor(edge: GraphEdge, isDarkMode: boolean): string {
  const level = edge.effectiveTrustLevel || edge.trustLevel;
  if (level === 'trusted') return isDarkMode ? '#22c55e' : '#16a34a';
  if (level === 'connected') return isDarkMode ? '#eab308' : '#ca8a04';
  return isDarkMode ? 'rgba(150, 150, 150, 0.5)' : 'rgba(100, 100, 100, 0.4)';
}

/**
 * Calculate decision power for a node based on incoming connections
 * Higher power = more people trust/delegate to this user
 */
function calculateDecisionPower(
  nodeId: string,
  edges: GraphEdge[],
  currentUserId?: string
): number {
  let power = 1; // Base power

  for (const edge of edges) {
    // Count incoming connections (where this node is the target)
    if (edge.target === nodeId) {
      const weight = edge.trustLevel === 'trusted' ? 2 : 1;
      power += weight;
    }
    // Mutual connections add extra weight
    if (edge.isMutual && (edge.source === nodeId || edge.target === nodeId)) {
      power += 0.5;
    }
  }

  // Current user gets a small boost for visibility
  if (nodeId === currentUserId) {
    power += 0.5;
  }

  return power;
}

/**
 * Determine which shell a node belongs to based on trust relationships
 */
function getNodeShellRadius(
  node: GraphNode,
  edges: GraphEdge[],
  currentUserId: string | undefined,
  sphereRadius: number
): number {
  // Current user is always at center
  if (node.id === currentUserId || node.isCurrentUser) {
    return sphereRadius * 0.15;
  }

  // Check if this node has trusted relationship with current user
  const hasTrustedConnection = edges.some(
    (e) =>
      ((e.source === currentUserId && e.target === node.id) ||
        (e.target === currentUserId && e.source === node.id)) &&
      (e.trustLevel === 'trusted' || e.effectiveTrustLevel === 'trusted')
  );

  if (hasTrustedConnection) {
    return sphereRadius * FORCE_CONFIG.trustedShell;
  }

  // Check if connected
  const hasConnection = edges.some(
    (e) =>
      (e.source === currentUserId && e.target === node.id) ||
      (e.target === currentUserId && e.source === node.id)
  );

  if (hasConnection) {
    return sphereRadius * FORCE_CONFIG.connectedShell;
  }

  // Unconnected - outer shell
  return sphereRadius * FORCE_CONFIG.outerShell;
}

// =============================================================================
// Animated Edge Flow Component
// =============================================================================

interface AnimatedEdgeProps {
  sourcePosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  edge: GraphEdge;
  isDarkMode: boolean;
}

function AnimatedEdge({ sourcePosition, targetPosition, edge, isDarkMode }: AnimatedEdgeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.Line | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const flowOffset = useRef(0);

  const color = getEdgeColor(edge, isDarkMode);
  const isTrusted = edge.trustLevel === 'trusted' || edge.effectiveTrustLevel === 'trusted';
  const particleCount = isTrusted ? 5 : 3;

  // Create and setup line and particles on mount
  useEffect(() => {
    if (!groupRef.current) return;

    // Create line
    const lineGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      sourcePosition.x, sourcePosition.y, sourcePosition.z,
      targetPosition.x, targetPosition.y, targetPosition.z,
    ]);
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: edge.isMutual ? 0.6 : 0.3,
    });

    const line = new THREE.Line(lineGeometry, lineMaterial);
    lineRef.current = line;
    groupRef.current.add(line);

    // Create particles
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      color: isTrusted ? '#22c55e' : '#eab308',
      size: isTrusted ? 0.06 : 0.04,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particlesRef.current = particles;
    groupRef.current.add(particles);

    return () => {
      if (groupRef.current) {
        if (lineRef.current) {
          groupRef.current.remove(lineRef.current);
          lineRef.current.geometry.dispose();
          (lineRef.current.material as THREE.Material).dispose();
        }
        if (particlesRef.current) {
          groupRef.current.remove(particlesRef.current);
          particlesRef.current.geometry.dispose();
          (particlesRef.current.material as THREE.Material).dispose();
        }
      }
    };
  }, [color, edge.isMutual, isTrusted, particleCount]);

  // Update line positions when nodes move
  useFrame(() => {
    if (!lineRef.current) return;
    const positions = lineRef.current.geometry.attributes.position.array as Float32Array;
    positions[0] = sourcePosition.x;
    positions[1] = sourcePosition.y;
    positions[2] = sourcePosition.z;
    positions[3] = targetPosition.x;
    positions[4] = targetPosition.y;
    positions[5] = targetPosition.z;
    lineRef.current.geometry.attributes.position.needsUpdate = true;
  });

  // Animate particles flowing along the edge
  useFrame(() => {
    if (!particlesRef.current) return;

    flowOffset.current = (flowOffset.current + 0.008) % 1;

    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < particleCount; i++) {
      const t = ((flowOffset.current + i / particleCount) % 1);
      positions[i * 3] = sourcePosition.x + (targetPosition.x - sourcePosition.x) * t;
      positions[i * 3 + 1] = sourcePosition.y + (targetPosition.y - sourcePosition.y) * t;
      positions[i * 3 + 2] = sourcePosition.z + (targetPosition.z - sourcePosition.z) * t;
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return <group ref={groupRef} />;
}

// =============================================================================
// 3D Node Component with Power-Based Sizing
// =============================================================================

interface NodeSphereProps {
  node: Node3D;
  isSelected: boolean;
  isCurrentUser: boolean;
  isDarkMode: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}

function NodeSphere({
  node,
  isSelected,
  isCurrentUser,
  isDarkMode,
  onClick,
  onPointerOver,
  onPointerOut,
}: NodeSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const color = getNodeColor(node, isDarkMode);

  // Size based on decision power (logarithmic scale to prevent huge nodes)
  const powerScale = Math.log2(node.decisionPower + 1) / 3;
  const baseSize = 0.08 + powerScale * 0.08;
  const size = isCurrentUser ? baseSize * 1.4 : baseSize;
  const displaySize = isSelected ? size * 1.2 : size;

  // Animate glow for in-room users and selection ring
  useFrame((state) => {
    if (glowRef.current && node.isInRoom) {
      const scale = 1.4 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
      glowRef.current.scale.setScalar(scale);
    }
    if (ringRef.current && isSelected) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.5;
    }
  });

  // Power indicator color (more power = more vibrant)
  const powerIndicatorOpacity = Math.min(0.4, 0.1 + node.decisionPower * 0.03);

  return (
    <group position={node.position}>
      {/* Power aura (larger for more influential nodes) */}
      {node.decisionPower > 2 && (
        <mesh>
          <sphereGeometry args={[displaySize * 2, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={powerIndicatorOpacity}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Glow ring for in-room users */}
      {node.isInRoom && (
        <mesh ref={glowRef}>
          <sphereGeometry args={[displaySize * 1.6, 16, 16]} />
          <meshBasicMaterial
            color="#64b5f6"
            transparent
            opacity={0.25}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Main node sphere */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <sphereGeometry args={[displaySize, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={isSelected ? color : '#000000'}
          emissiveIntensity={isSelected ? 0.6 : 0}
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>

      {/* Selection ring (animated) */}
      {isSelected && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[displaySize * 1.5, displaySize * 1.7, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Username label */}
      <Billboard position={[0, displaySize + 0.12, 0]}>
        <Text
          fontSize={0.07}
          color={isDarkMode ? '#ffffff' : '#1f2937'}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.004}
          outlineColor={isDarkMode ? '#000000' : '#ffffff'}
        >
          {node.displayName || node.username}
        </Text>
        {/* Power indicator */}
        {node.decisionPower > 1.5 && (
          <Text
            fontSize={0.04}
            color={isDarkMode ? '#a0a0ff' : '#6366f1'}
            anchorX="center"
            anchorY="top"
            position={[0, -0.02, 0]}
          >
            ◆ {node.decisionPower.toFixed(1)}
          </Text>
        )}
      </Billboard>
    </group>
  );
}

// =============================================================================
// Shell Indicator Rings
// =============================================================================

interface ShellRingsProps {
  sphereRadius: number;
  isDarkMode: boolean;
}

function ShellRings({ sphereRadius, isDarkMode }: ShellRingsProps) {
  return (
    <group>
      {/* Trusted shell ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[
          sphereRadius * FORCE_CONFIG.trustedShell - 0.02,
          sphereRadius * FORCE_CONFIG.trustedShell + 0.02,
          64
        ]} />
        <meshBasicMaterial
          color="#22c55e"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Connected shell ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[
          sphereRadius * FORCE_CONFIG.connectedShell - 0.02,
          sphereRadius * FORCE_CONFIG.connectedShell + 0.02,
          64
        ]} />
        <meshBasicMaterial
          color="#eab308"
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Outer boundary sphere */}
      <mesh>
        <sphereGeometry args={[sphereRadius, 64, 64]} />
        <meshBasicMaterial
          color={isDarkMode ? '#1a1a2e' : '#e8e8f8'}
          transparent
          opacity={0.04}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

// =============================================================================
// Camera Controller for Zoom-to-User
// =============================================================================

interface CameraControllerProps {
  targetPosition: THREE.Vector3 | null;
  sphereRadius: number;
  controlsRef: React.RefObject<any>;
}

function CameraController({ targetPosition, sphereRadius, controlsRef }: CameraControllerProps) {
  const { camera } = useThree();
  const isAnimating = useRef(false);
  const animationProgress = useRef(0);
  const startPosition = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    if (targetPosition) {
      isAnimating.current = true;
      animationProgress.current = 0;
      startPosition.current.copy(camera.position);
      if (controlsRef.current) {
        startTarget.current.copy(controlsRef.current.target);
      }
    }
  }, [targetPosition, camera, controlsRef]);

  useFrame(() => {
    if (!isAnimating.current || !targetPosition || !controlsRef.current) return;

    animationProgress.current += 0.02;
    const t = Math.min(1, animationProgress.current);
    const easeT = 1 - Math.pow(1 - t, 3); // Ease out cubic

    // Calculate target camera position (offset from node)
    const targetCameraPos = targetPosition.clone().add(
      new THREE.Vector3(0, 0.5, sphereRadius * 0.8)
    );

    // Lerp camera position
    camera.position.lerpVectors(startPosition.current, targetCameraPos, easeT);

    // Lerp controls target
    controlsRef.current.target.lerpVectors(startTarget.current, targetPosition, easeT);
    controlsRef.current.update();

    if (t >= 1) {
      isAnimating.current = false;
    }
  });

  return null;
}

// =============================================================================
// Force Simulation Hook with Trust Clustering
// =============================================================================

function useForceSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  sphereRadius: number,
  currentUserId?: string
): Node3D[] {
  const nodes3DRef = useRef<Node3D[]>([]);
  const isSettledRef = useRef(false);
  const frameCountRef = useRef(0);

  // Initialize or update nodes
  const nodes3D = useMemo(() => {
    const existingMap = new Map(nodes3DRef.current.map(n => [n.id, n]));

    const newNodes: Node3D[] = nodes.map((node) => {
      const existing = existingMap.get(node.id);
      const targetRadius = getNodeShellRadius(node, edges, currentUserId, sphereRadius);
      const decisionPower = calculateDecisionPower(node.id, edges, currentUserId);

      if (existing) {
        return {
          ...existing,
          ...node,
          targetRadius,
          decisionPower,
        };
      }

      // New node - place randomly at its target shell
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = targetRadius * (0.9 + Math.random() * 0.2);

      return {
        ...node,
        position: new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        ),
        velocity: new THREE.Vector3(0, 0, 0),
        targetRadius,
        decisionPower,
      };
    });

    nodes3DRef.current = newNodes;
    isSettledRef.current = false;
    frameCountRef.current = 0;
    return newNodes;
  }, [nodes, edges, sphereRadius, currentUserId]);

  // Apply forces each frame
  useFrame(() => {
    frameCountRef.current++;

    // Allow occasional updates even after settling (for smooth animation)
    if (isSettledRef.current && frameCountRef.current % 60 !== 0) return;

    const nodeMap = new Map(nodes3D.map(n => [n.id, n]));
    let maxVelocity = 0;

    for (const node of nodes3D) {
      const force = new THREE.Vector3(0, 0, 0);

      // 1. Repulsion from other nodes
      for (const other of nodes3D) {
        if (node.id === other.id) continue;

        const diff = node.position.clone().sub(other.position);
        const dist = diff.length();

        if (dist < FORCE_CONFIG.repulsionDistance && dist > 0.01) {
          // Stronger repulsion for nodes in same shell
          const sameShell = Math.abs(node.targetRadius - other.targetRadius) < 0.3;
          const repulsionMult = sameShell ? 1.5 : 1;
          const repulsionForce = diff
            .normalize()
            .multiplyScalar((FORCE_CONFIG.repulsion * repulsionMult) / (dist * dist));
          force.add(repulsionForce);
        }
      }

      // 2. Attraction along edges
      for (const edge of edges) {
        let linkedNode: Node3D | undefined;

        if (edge.source === node.id) {
          linkedNode = nodeMap.get(edge.target);
        } else if (edge.target === node.id) {
          linkedNode = nodeMap.get(edge.source);
        }

        if (linkedNode) {
          const diff = linkedNode.position.clone().sub(node.position);
          const dist = diff.length();
          const isTrusted = edge.trustLevel === 'trusted';
          const linkDist = isTrusted ? FORCE_CONFIG.linkDistance * 0.8 : FORCE_CONFIG.linkDistance;

          if (dist > linkDist) {
            const strength = isTrusted ? FORCE_CONFIG.linkStrength * 1.5 : FORCE_CONFIG.linkStrength;
            const attractionForce = diff
              .normalize()
              .multiplyScalar((dist - linkDist) * strength);
            force.add(attractionForce);
          }
        }
      }

      // 3. Shell-based radial force (pull toward target shell radius)
      const currentRadius = node.position.length();
      const radiusDiff = node.targetRadius - currentRadius;
      if (Math.abs(radiusDiff) > 0.1) {
        const shellForce = node.position
          .clone()
          .normalize()
          .multiplyScalar(radiusDiff * FORCE_CONFIG.shellStrength);
        force.add(shellForce);
      }

      // 4. Sphere boundary constraint
      if (currentRadius > sphereRadius * 0.95) {
        const boundaryForce = node.position
          .clone()
          .normalize()
          .multiplyScalar(-(currentRadius - sphereRadius * 0.9) * FORCE_CONFIG.boundaryStrength);
        force.add(boundaryForce);
      }

      // Apply force to velocity
      node.velocity.add(force);
      node.velocity.multiplyScalar(FORCE_CONFIG.damping);

      const vel = node.velocity.length();
      if (vel > maxVelocity) maxVelocity = vel;
    }

    // Apply velocity to positions
    for (const node of nodes3D) {
      node.position.add(node.velocity);

      // Hard boundary
      const distFromCenter = node.position.length();
      if (distFromCenter > sphereRadius) {
        node.position.normalize().multiplyScalar(sphereRadius * 0.98);
        node.velocity.multiplyScalar(0.3);
      }
    }

    // Check if settled
    if (maxVelocity < FORCE_CONFIG.minVelocity) {
      isSettledRef.current = true;
    }
  });

  return nodes3D;
}

// =============================================================================
// Scene Content Component
// =============================================================================

interface SceneContentProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  currentUserId?: string;
  isDarkMode: boolean;
  sphereRadius: number;
  selectedNodeId: string | null;
  onNodeClick: (node: GraphNode, screenPos: { x: number; y: number }) => void;
  hoveredNodeId: string | null;
  setHoveredNodeId: (id: string | null) => void;
  zoomTargetPosition: THREE.Vector3 | null;
  controlsRef: React.RefObject<any>;
}

function SceneContent({
  nodes,
  edges,
  currentUserId,
  isDarkMode,
  sphereRadius,
  selectedNodeId,
  onNodeClick,
  hoveredNodeId: _hoveredNodeId,
  setHoveredNodeId,
  zoomTargetPosition,
  controlsRef,
}: SceneContentProps) {
  const { camera, gl } = useThree();

  // Use force simulation with clustering
  const nodes3D = useForceSimulation(nodes, edges, sphereRadius, currentUserId);

  // Create node map for edge rendering
  const nodeMap = useMemo(
    () => new Map(nodes3D.map(n => [n.id, n])),
    [nodes3D]
  );

  // Handle node click with screen position
  const handleNodeClick = useCallback(
    (node: Node3D, e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();

      const vector = node.position.clone().project(camera);
      const rect = gl.domElement.getBoundingClientRect();
      const screenX = ((vector.x + 1) / 2) * rect.width;
      const screenY = ((-vector.y + 1) / 2) * rect.height;

      onNodeClick(node, { x: screenX, y: screenY });
    },
    [camera, gl, onNodeClick]
  );

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={isDarkMode ? 0.35 : 0.5} />
      <directionalLight position={[5, 5, 5]} intensity={0.5} />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={0.4} color="#6060ff" />

      {/* Shell indicator rings */}
      <ShellRings sphereRadius={sphereRadius} isDarkMode={isDarkMode} />

      {/* Animated edges */}
      {edges.map((edge) => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        if (!sourceNode || !targetNode) return null;

        return (
          <AnimatedEdge
            key={edge.id}
            sourcePosition={sourceNode.position}
            targetPosition={targetNode.position}
            edge={edge}
            isDarkMode={isDarkMode}
          />
        );
      })}

      {/* Nodes */}
      {nodes3D.map((node) => (
        <NodeSphere
          key={node.id}
          node={node}
          isSelected={selectedNodeId === node.id}
          isCurrentUser={node.id === currentUserId || node.isCurrentUser}
          isDarkMode={isDarkMode}
          onClick={(e) => handleNodeClick(node, e)}
          onPointerOver={() => setHoveredNodeId(node.id)}
          onPointerOut={() => setHoveredNodeId(null)}
        />
      ))}

      {/* Camera controller for zoom animation */}
      <CameraController
        targetPosition={zoomTargetPosition}
        sphereRadius={sphereRadius}
        controlsRef={controlsRef}
      />
    </>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function NetworkGraph3D({
  nodes,
  edges,
  currentUserId,
  onNodeClick,
  onNodeSelect,
  onConnect,
  onZoomToUser,
  onViewAsUser,
  isDarkMode = false,
  sphereRadius = 3,
}: NetworkGraph3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [zoomTargetPosition, setZoomTargetPosition] = useState<THREE.Vector3 | null>(null);

  // Calculate power stats
  const powerStats = useMemo(() => {
    const powers = nodes.map(n => calculateDecisionPower(n.id, edges, currentUserId));
    const maxPower = Math.max(...powers, 1);
    const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length || 0;
    return { maxPower: maxPower.toFixed(1), avgPower: avgPower.toFixed(1) };
  }, [nodes, edges, currentUserId]);

  // Handle node click
  const handleNodeClick = useCallback(
    (node: GraphNode, screenPos: { x: number; y: number }) => {
      if (node.isCurrentUser || node.id === currentUserId) {
        setSelectedNode(null);
        onNodeSelect?.(null);
        return;
      }

      setSelectedNode({ node, screenPosition: screenPos });
      onNodeSelect?.(node);
      onNodeClick?.(node);
    },
    [onNodeClick, onNodeSelect, currentUserId]
  );

  // Handle background click
  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    onNodeSelect?.(null);
    setZoomTargetPosition(null);
  }, [onNodeSelect]);

  // Handle connect
  const handleConnect = useCallback(async () => {
    if (!selectedNode || !onConnect) return;

    setIsConnecting(true);
    try {
      const userId = selectedNode.node.username || selectedNode.node.id;
      await onConnect(userId, 'connected');
    } catch (err) {
      console.error('Failed to connect:', err);
    }
    setIsConnecting(false);
    setSelectedNode(null);
  }, [selectedNode, onConnect]);

  // Handle zoom to user
  const handleZoomToUser = useCallback(() => {
    if (!selectedNode) return;

    // Find the node's 3D position
    const power = calculateDecisionPower(selectedNode.node.id, edges, currentUserId);
    const targetRadius = getNodeShellRadius(selectedNode.node, edges, currentUserId, sphereRadius);

    // Approximate position (actual position is managed by simulation)
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.PI / 2;
    const position = new THREE.Vector3(
      targetRadius * Math.sin(phi) * Math.cos(theta),
      targetRadius * Math.sin(phi) * Math.sin(theta),
      targetRadius * Math.cos(phi)
    );

    setZoomTargetPosition(position);
    onZoomToUser?.(selectedNode.node);
  }, [selectedNode, edges, currentUserId, sphereRadius, onZoomToUser]);

  // Handle view as user (broadcast mode)
  const handleViewAsUser = useCallback(() => {
    if (!selectedNode) return;
    onViewAsUser?.(selectedNode.node);
    setSelectedNode(null);
  }, [selectedNode, onViewAsUser]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNode(null);
        onNodeSelect?.(null);
        setZoomTargetPosition(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNodeSelect]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: isDarkMode
          ? 'radial-gradient(ellipse at center, #1a1a2e 0%, #0d0d1a 100%)'
          : 'radial-gradient(ellipse at center, #f8f8ff 0%, #e8e8f0 100%)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, sphereRadius * 2.5], fov: 50 }}
        onPointerMissed={handleBackgroundClick}
      >
        <SceneContent
          nodes={nodes}
          edges={edges}
          currentUserId={currentUserId}
          isDarkMode={isDarkMode}
          sphereRadius={sphereRadius}
          selectedNodeId={selectedNode?.node.id ?? null}
          onNodeClick={handleNodeClick}
          hoveredNodeId={hoveredNodeId}
          setHoveredNodeId={setHoveredNodeId}
          zoomTargetPosition={zoomTargetPosition}
          controlsRef={controlsRef}
        />

        <OrbitControls
          ref={controlsRef}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={sphereRadius * 1.2}
          maxDistance={sphereRadius * 5}
          autoRotate={!selectedNode}
          autoRotateSpeed={0.3}
        />
      </Canvas>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          padding: '10px',
          background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)',
          borderRadius: '8px',
          fontSize: '10px',
          color: isDarkMode ? '#ccc' : '#444',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '6px' }}>Trust Shells</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }} />
          <span>Trusted (inner)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#eab308' }} />
          <span>Connected (middle)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6b7280' }} />
          <span>Unconnected (outer)</span>
        </div>
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${isDarkMode ? '#333' : '#ddd'}` }}>
          <div>◆ = Decision Power</div>
          <div style={{ marginTop: '2px' }}>Max: {powerStats.maxPower} | Avg: {powerStats.avgPower}</div>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredNodeId && !selectedNode && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            padding: '8px 12px',
            background: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.95)',
            color: isDarkMode ? '#fff' : '#1f2937',
            borderRadius: '8px',
            fontSize: '12px',
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}
        >
          {nodes.find(n => n.id === hoveredNodeId)?.displayName ||
            nodes.find(n => n.id === hoveredNodeId)?.username}
        </div>
      )}

      {/* Selected node panel */}
      {selectedNode && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            padding: '14px',
            background: isDarkMode ? 'rgba(30, 30, 46, 0.95)' : 'rgba(255, 255, 255, 0.98)',
            borderRadius: '12px',
            boxShadow: isDarkMode
              ? '0 4px 20px rgba(0, 0, 0, 0.4)'
              : '0 4px 20px rgba(0, 0, 0, 0.15)',
            border: isDarkMode
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(0, 0, 0, 0.1)',
            minWidth: '200px',
          }}
        >
          {/* User info header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '12px',
              paddingBottom: '10px',
              borderBottom: isDarkMode
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: getNodeColor(selectedNode.node, isDarkMode),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: isDarkMode ? '#e0e0e0' : '#1f2937' }}>
                {selectedNode.node.displayName || selectedNode.node.username}
              </div>
              <div style={{ fontSize: '10px', color: isDarkMode ? '#888' : '#666', display: 'flex', gap: '8px' }}>
                {selectedNode.node.isInRoom && <span style={{ color: '#64b5f6' }}>● In room</span>}
                <span>◆ {calculateDecisionPower(selectedNode.node.id, edges, currentUserId).toFixed(1)} power</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Connect */}
            {!selectedNode.node.isAnonymous && onConnect && (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                style={{
                  padding: '10px 12px',
                  fontSize: '12px',
                  background: isDarkMode ? 'rgba(234, 179, 8, 0.15)' : 'rgba(234, 179, 8, 0.1)',
                  color: isDarkMode ? '#fbbf24' : '#92400e',
                  border: `1px solid ${isDarkMode ? 'rgba(234, 179, 8, 0.3)' : 'rgba(234, 179, 8, 0.4)'}`,
                  borderRadius: '8px',
                  cursor: isConnecting ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>🔗</span>
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            )}

            {/* Zoom to user */}
            <button
              onClick={handleZoomToUser}
              style={{
                padding: '10px 12px',
                fontSize: '12px',
                background: isDarkMode ? 'rgba(100, 149, 237, 0.15)' : 'rgba(100, 149, 237, 0.1)',
                color: isDarkMode ? '#64b5f6' : '#2563eb',
                border: `1px solid ${isDarkMode ? 'rgba(100, 149, 237, 0.3)' : 'rgba(100, 149, 237, 0.4)'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>🎯</span>
              Zoom to User
            </button>

            {/* View as user (broadcast mode) */}
            {selectedNode.node.isInRoom && onViewAsUser && (
              <button
                onClick={handleViewAsUser}
                style={{
                  padding: '10px 12px',
                  fontSize: '12px',
                  background: isDarkMode ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.1)',
                  color: isDarkMode ? '#c084fc' : '#7c3aed',
                  border: `1px solid ${isDarkMode ? 'rgba(168, 85, 247, 0.3)' : 'rgba(168, 85, 247, 0.4)'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>👁️</span>
                View as User (Broadcast)
              </button>
            )}

            {/* Cancel */}
            <button
              onClick={() => setSelectedNode(null)}
              style={{
                padding: '10px 12px',
                fontSize: '12px',
                background: 'transparent',
                color: isDarkMode ? '#666' : '#888',
                border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          padding: '8px 12px',
          background: isDarkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.8)',
          color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)',
          borderRadius: '8px',
          fontSize: '10px',
          pointerEvents: 'none',
        }}
      >
        Drag to rotate | Scroll to zoom | Click node to interact
      </div>
    </div>
  );
}

export default NetworkGraph3D;
