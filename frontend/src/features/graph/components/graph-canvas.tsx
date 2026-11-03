"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { GraphEdge, GraphFinding, GraphNode } from "../types/graph";
import {
  Move,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

interface NodePosition {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode: GraphNode | null;
  highlightedNodeIds: string[];
  activeFinding: GraphFinding | null;
  onSelectNode: (node: GraphNode | null) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

function computeAutoLayout(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<string, NodePosition> {
  const posMap = new Map<string, NodePosition>();
  if (nodes.length === 0) {
    return posMap;
  }

  const nodeCount = nodes.length;

  // Partition connected nodes vs isolated
  const connectedNodeIds = new Set<string>();
  edges.forEach((e) => {
    connectedNodeIds.add(e.source_id);
    connectedNodeIds.add(e.target_id);
  });

  // Initial positioning in rings / grid
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodeCount)));
  const spacingX = 260;
  const spacingY = 140;

  nodes.forEach((node, i) => {
    if (connectedNodeIds.has(node.id)) {
      // Spiral / circle around center for connected nodes
      const angle = (i / Math.max(1, connectedNodeIds.size)) * 2 * Math.PI;
      const radius = 220 + Math.floor(i / 8) * 120;
      posMap.set(node.id, {
        x: 500 + radius * Math.cos(angle),
        y: 380 + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      });
    } else {
      // Grid array for isolated nodes at the bottom/side
      const row = Math.floor(i / cols);
      const col = i % cols;
      posMap.set(node.id, {
        x: 100 + col * spacingX,
        y: 750 + row * spacingY,
        vx: 0,
        vy: 0,
      });
    }
  });

  // Run simple force relaxation simulation for 35 iterations
  const iterations = 35;
  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between connected nodes
    nodes.forEach((n1) => {
      const p1 = posMap.get(n1.id);
      if (!p1) return;

      nodes.forEach((n2) => {
        if (n1.id === n2.id) return;
        const p2 = posMap.get(n2.id);
        if (!p2) return;

        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distSq = dx * dx + dy * dy + 100;
        const dist = Math.sqrt(distSq);

        if (dist < 400) {
          const force = 3500 / distSq;
          p1.x += (dx / dist) * force;
          p1.y += (dy / dist) * force;
        }
      });
    });

    // Attraction along edges (Hooke's law)
    edges.forEach((e) => {
      const pSource = posMap.get(e.source_id);
      const pTarget = posMap.get(e.target_id);
      if (!pSource || !pTarget) return;

      const dx = pTarget.x - pSource.x;
      const dy = pTarget.y - pSource.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const desiredDist = 200;
      const force = (dist - desiredDist) * 0.05;

      pSource.x += (dx / dist) * force;
      pSource.y += (dy / dist) * force;
      pTarget.x -= (dx / dist) * force;
      pTarget.y -= (dy / dist) * force;
    });
  }

  return posMap;
}

export function GraphCanvas({
  nodes,
  edges,
  selectedNode,
  highlightedNodeIds,
  activeFinding,
  onSelectNode,
}: GraphCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  // Pan & Zoom transform state
  const [transform, setTransform] = React.useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });

  // Node position map
  const [positions, setPositions] = React.useState<Map<string, NodePosition>>(() =>
    computeAutoLayout(nodes, edges)
  );
  const [prevProps, setPrevProps] = React.useState({ nodes, edges });
  if (nodes !== prevProps.nodes || edges !== prevProps.edges) {
    setPrevProps({ nodes, edges });
    setPositions(computeAutoLayout(nodes, edges));
  }

  const [draggingNodeId, setDraggingNodeId] = React.useState<string | null>(null);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const hasMovedDuringDrag = React.useRef(false);

  // Initial center fit when nodes or edges change
  React.useEffect(() => {
    if (nodes.length === 0) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const posMap = computeAutoLayout(nodes, edges);
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      posMap.forEach((pos) => {
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
      });

      if (minX !== Infinity) {
        const graphW = maxX - minX + NODE_WIDTH + 100;
        const graphH = maxY - minY + NODE_HEIGHT + 100;
        const scaleX = rect.width / Math.max(graphW, 400);
        const scaleY = rect.height / Math.max(graphH, 400);
        const autoScale = Math.min(Math.max(Math.min(scaleX, scaleY) * 0.9, 0.4), 1.1);

        const centerX = (minX + maxX + NODE_WIDTH) / 2;
        const centerY = (minY + maxY + NODE_HEIGHT) / 2;

        setTransform({
          x: rect.width / 2 - centerX * autoScale,
          y: rect.height / 2 - centerY * autoScale,
          scale: autoScale,
        });
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [nodes, edges]);

  // Convert screen coordinates to canvas world coordinates
  const screenToWorld = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - transform.x) / transform.scale,
        y: (clientY - rect.top - transform.y) / transform.scale,
      };
    },
    [transform]
  );

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newScale = Math.min(Math.max(transform.scale * zoomFactor, 0.25), 2.5);

    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform({
      x: mouseX - (mouseX - transform.x) * (newScale / transform.scale),
      y: mouseY - (mouseY - transform.y) * (newScale / transform.scale),
      scale: newScale,
    });
  };

  // Mouse Down for Pan or Node Drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    if (draggingNodeId) return;

    setIsPanning(true);
    setPanStart({
      x: e.clientX - transform.x,
      y: e.clientY - transform.y,
    });
  };

  // Mouse Move for Pan or Node Drag
  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId) {
      hasMovedDuringDrag.current = true;
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setPositions((prev) => {
        const next = new Map(prev);
        next.set(draggingNodeId, {
          x: worldPos.x - dragOffset.x,
          y: worldPos.y - dragOffset.y,
        });
        return next;
      });
      return;
    }

    if (isPanning) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    }
  };

  // Mouse Up
  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Node Drag Start
  const handleNodeMouseDown = (
    e: React.MouseEvent,
    node: GraphNode,
    pos: NodePosition
  ) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    const world = screenToWorld(e.clientX, e.clientY);
    setDraggingNodeId(node.id);
    setDragOffset({
      x: world.x - pos.x,
      y: world.y - pos.y,
    });
    hasMovedDuringDrag.current = false;
  };

  const handleNodeClick = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    if (!hasMovedDuringDrag.current) {
      onSelectNode(selectedNode?.id === node.id ? null : node);
    }
  };

  // Reset View
  const handleResetView = () => {
    if (!containerRef.current || positions.size === 0) {
      setTransform({ x: 0, y: 0, scale: 1 });
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    positions.forEach((pos) => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    });

    const graphW = maxX - minX + NODE_WIDTH + 100;
    const graphH = maxY - minY + NODE_HEIGHT + 100;
    const scaleX = rect.width / Math.max(graphW, 400);
    const scaleY = rect.height / Math.max(graphH, 400);
    const autoScale = Math.min(Math.max(Math.min(scaleX, scaleY) * 0.9, 0.4), 1.1);

    const centerX = (minX + maxX + NODE_WIDTH) / 2;
    const centerY = (minY + maxY + NODE_HEIGHT) / 2;

    setTransform({
      x: rect.width / 2 - centerX * autoScale,
      y: rect.height / 2 - centerY * autoScale,
      scale: autoScale,
    });
  };

  const getNodeColor = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes("decision")) return { stroke: "#10b981", fill: "#064e3b15", text: "#059669" };
    if (c.includes("task")) return { stroke: "#3b82f6", fill: "#1e3a8a15", text: "#2563eb" };
    if (c.includes("risk")) return { stroke: "#f59e0b", fill: "#78350f15", text: "#d97706" };
    if (c.includes("milestone")) return { stroke: "#a855f7", fill: "#581c8715", text: "#9333ea" };
    return { stroke: "#8b5cf6", fill: "#4c1d9515", text: "#7c3aed" };
  };

  // Connected edges for selected node
  const activeEdgeIds = React.useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const set = new Set<string>();
    edges.forEach((e) => {
      if (e.source_id === selectedNode.id || e.target_id === selectedNode.id) {
        set.add(e.id);
      }
    });
    return set;
  }, [edges, selectedNode]);

  // Finding cycle node set
  const highlightedNodeSet = React.useMemo(() => {
    return new Set(highlightedNodeIds);
  }, [highlightedNodeIds]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-145 bg-background/50 border border-border/80 rounded-2xl overflow-hidden select-none cursor-grab active:cursor-grabbing shadow-inner"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Background Grid Pattern */}
      <svg
        ref={svgRef}
        className="w-full h-full absolute inset-0"
        style={{ touchAction: "none" }}
      >
        <defs>
          <pattern
            id="graph-grid"
            width={40 * transform.scale}
            height={40 * transform.scale}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${transform.x}, ${transform.y})`}
          >
            <circle
              cx={2}
              cy={2}
              r={1}
              className="fill-border/60"
            />
          </pattern>

          {/* Standard Arrow Marker */}
          <marker
            id="arrowhead"
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" className="fill-muted-foreground/60" />
          </marker>

          {/* Active / Highlighted Arrow Marker */}
          <marker
            id="arrowhead-active"
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerWidth={7}
            markerHeight={7}
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" className="fill-primary" />
          </marker>

          {/* Critical Cycle Arrow Marker */}
          <marker
            id="arrowhead-critical"
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerWidth={7}
            markerHeight={7}
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" className="fill-destructive" />
          </marker>
        </defs>

        {/* Grid Background */}
        <rect width="100%" height="100%" fill="url(#graph-grid)" />

        {/* Graph World Group with Pan & Zoom Transform */}
        <g
          transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
        >
          {/* Edges */}
          {edges.map((edge) => {
            const sourcePos = positions.get(edge.source_id);
            const targetPos = positions.get(edge.target_id);
            if (!sourcePos || !targetPos) return null;

            const sx = sourcePos.x + NODE_WIDTH / 2;
            const sy = sourcePos.y + NODE_HEIGHT / 2;
            const tx = targetPos.x + NODE_WIDTH / 2;
            const ty = targetPos.y + NODE_HEIGHT / 2;

            // Compute edge vector & clip to node box
            const dx = tx - sx;
            const dy = ty - sy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            // Offset endpoint so arrowhead doesn't hide under target rect
            const targetOffsetX = (dx / dist) * (NODE_WIDTH / 2 + 6);
            const targetOffsetY = (dy / dist) * (NODE_HEIGHT / 2 + 6);
            const endX = tx - targetOffsetX;
            const endY = ty - targetOffsetY;

            const isEdgeActive = activeEdgeIds.has(edge.id);
            const isCriticalCycle =
              activeFinding &&
              highlightedNodeSet.has(edge.source_id) &&
              highlightedNodeSet.has(edge.target_id);

            const midX = (sx + endX) / 2;
            const midY = (sy + endY) / 2;

            return (
              <g key={edge.id} className="transition-opacity">
                {/* Connecting Line */}
                <line
                  x1={sx}
                  y1={sy}
                  x2={endX}
                  y2={endY}
                  stroke={
                    isCriticalCycle
                      ? "#ef4444"
                      : isEdgeActive
                      ? "var(--primary)"
                      : "currentColor"
                  }
                  strokeWidth={isCriticalCycle ? 2.5 : isEdgeActive ? 2 : 1.2}
                  strokeDasharray={edge.type === "relates_to" ? "4 4" : undefined}
                  className={
                    isCriticalCycle
                      ? "opacity-100"
                      : isEdgeActive
                      ? "opacity-100"
                      : "text-muted-foreground/30"
                  }
                  markerEnd={
                    isCriticalCycle
                      ? "url(#arrowhead-critical)"
                      : isEdgeActive
                      ? "url(#arrowhead-active)"
                      : "url(#arrowhead)"
                  }
                />

                {/* Edge Label Pill */}
                {edge.type && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x={-28}
                      y={-9}
                      width={56}
                      height={18}
                      rx={9}
                      className="fill-background/90 stroke-border/70"
                      strokeWidth={1}
                    />
                    <text
                      textAnchor="middle"
                      dy={3.5}
                      className="fill-muted-foreground text-[9px] font-mono pointer-events-none"
                    >
                      {edge.type.slice(0, 8)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;

            const isSelected = selectedNode?.id === node.id;
            const isHighlighted = highlightedNodeSet.has(node.id);
            const colors = getNodeColor(node.category);

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseDown={(e) => handleNodeMouseDown(e, node, pos)}
                onClick={(e) => handleNodeClick(e, node)}
                className="cursor-pointer group"
              >
                {/* Outer Glow / Ring when selected or highlighted in finding */}
                {(isSelected || isHighlighted) && (
                  <rect
                    x={-4}
                    y={-4}
                    width={NODE_WIDTH + 8}
                    height={NODE_HEIGHT + 8}
                    rx={14}
                    fill="none"
                    stroke={isHighlighted ? "#ef4444" : colors.stroke}
                    strokeWidth={isHighlighted ? 3 : 2.5}
                    strokeDasharray={isHighlighted ? "6 3" : undefined}
                    className="animate-pulse"
                  />
                )}

                {/* Node Card Rectangle */}
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={10}
                  className="fill-card stroke-border/90 shadow-lg transition-all group-hover:stroke-primary/80"
                  strokeWidth={1.5}
                />

                {/* Category Color Accent Strip */}
                <rect
                  x={0}
                  y={0}
                  width={6}
                  height={NODE_HEIGHT}
                  rx={3}
                  fill={colors.stroke}
                />

                {/* Category Pill Text */}
                <text
                  x={14}
                  y={18}
                  fill={colors.stroke}
                  className="text-[9px] font-bold uppercase tracking-wider pointer-events-none"
                >
                  {node.category.slice(0, 14)}
                </text>

                {/* Confidence Badge */}
                <text
                  x={NODE_WIDTH - 12}
                  y={18}
                  textAnchor="end"
                  className="fill-muted-foreground text-[9px] font-mono pointer-events-none"
                >
                  {Math.round(node.confidence * 100)}%
                </text>

                {/* Title (Truncated) */}
                <text
                  x={14}
                  y={38}
                  className="fill-foreground text-[11px] font-semibold pointer-events-none"
                >
                  {node.title.length > 21
                    ? node.title.slice(0, 21) + "…"
                    : node.title}
                </text>

                {/* Review status indicator dot */}
                <circle
                  cx={NODE_WIDTH - 14}
                  cy={NODE_HEIGHT - 12}
                  r={3.5}
                  fill={
                    node.review_status === "verified"
                      ? "#10b981"
                      : node.review_status === "rejected"
                      ? "#ef4444"
                      : "#f59e0b"
                  }
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Canvas Navigation Toolbar */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-card/90 border border-border/80 shadow-lg rounded-xl p-1.5 backdrop-blur-md">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setTransform((prev) => ({
              ...prev,
              scale: Math.min(prev.scale * 1.2, 2.5),
            }))
          }
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setTransform((prev) => ({
              ...prev,
              scale: Math.max(prev.scale * 0.8, 0.25),
            }))
          }
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-border/80 mx-0.5" />

        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetView}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title="Reset View / Fit to Graph"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <span className="text-[10px] font-mono text-muted-foreground px-1.5 min-w-10.5 text-center">
          {Math.round(transform.scale * 100)}%
        </span>
      </div>

      {/* Canvas Help Hint */}
      <div className="absolute bottom-4 left-4 pointer-events-none hidden sm:flex items-center gap-2 bg-background/80 border border-border/60 text-muted-foreground text-[10px] px-2.5 py-1 rounded-lg backdrop-blur-sm shadow-sm">
        <Move className="h-3 w-3" />
        <span>Click & drag to pan &bull; Scroll to zoom &bull; Drag nodes to rearrange</span>
      </div>

      {/* Empty State */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              No Graph Nodes Available
            </h3>
            <p className="text-xs text-muted-foreground">
              No project knowledge entities or dependencies match the current filter selection.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
