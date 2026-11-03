"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProjectDetailRead } from "@/types/project";
import type {
  DependencyGraphResponse,
  GraphCategoryFilter,
  GraphFinding,
  GraphNode,
  GraphReviewStatusFilter,
  SubgraphResponse,
} from "../types/graph";
import {
  clientGetProjectGraph,
  GraphClientError,
} from "../lib/graph-client";
import { GraphCanvas } from "./graph-canvas";
import { NodeDetailPanel } from "./node-detail-panel";
import { GraphFindingsPanel } from "./graph-findings-panel";
import { Neo4jSyncModal } from "./neo4j-sync-modal";
import {
  AlertCircle,
  Database,
  Filter,
  Focus,
  Loader2,
  Network,
  RefreshCw,
  X,
} from "lucide-react";

interface DependencyGraphViewProps {
  project: ProjectDetailRead;
  initialGraph?: DependencyGraphResponse;
}

export function DependencyGraphView({
  project,
  initialGraph,
}: DependencyGraphViewProps) {
  // Graph Data State
  const [graphData, setGraphData] = React.useState<DependencyGraphResponse>(
    initialGraph || {
      nodes: [],
      edges: [],
      findings: [],
      total_nodes: 0,
      total_edges: 0,
    }
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = React.useState<GraphCategoryFilter>("all");
  const [selectedReviewStatus, setSelectedReviewStatus] = React.useState<GraphReviewStatusFilter>("all");

  // Selection & Inspector State
  const [selectedNode, setSelectedNode] = React.useState<GraphNode | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = React.useState<string[]>([]);
  const [activeFinding, setActiveFinding] = React.useState<GraphFinding | null>(null);
  const [isolatedSubgraph, setIsolatedSubgraph] = React.useState<SubgraphResponse | null>(null);

  // Neo4j Sync Dialog
  const [isNeo4jModalOpen, setIsNeo4jModalOpen] = React.useState(false);

  // Quick lookup map of nodes
  const nodesMap = React.useMemo(() => {
    const map = new Map<string, GraphNode>();
    const currentNodes = isolatedSubgraph ? isolatedSubgraph.nodes : graphData.nodes;
    currentNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [graphData.nodes, isolatedSubgraph]);

  // Active nodes & edges to render on canvas
  const displayedNodes = React.useMemo(() => {
    return isolatedSubgraph ? isolatedSubgraph.nodes : graphData.nodes;
  }, [graphData.nodes, isolatedSubgraph]);

  const displayedEdges = React.useMemo(() => {
    return isolatedSubgraph ? isolatedSubgraph.edges : graphData.edges;
  }, [graphData.edges, isolatedSubgraph]);

  // Load Graph Data
  const loadGraph = React.useCallback(
    async (
      cat: GraphCategoryFilter = selectedCategory,
      status: GraphReviewStatusFilter = selectedReviewStatus
    ) => {
      setIsLoading(true);
      setError(null);
      setIsolatedSubgraph(null);

      try {
        const res = await clientGetProjectGraph(project.id, {
          category: cat,
          review_status: status,
        });
        setGraphData(res);
      } catch (err) {
        if (err instanceof GraphClientError) {
          setError(err.message);
        } else {
          setError("Failed to load project dependency graph.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [project.id, selectedCategory, selectedReviewStatus]
  );

  // Handle Subgraph Focus
  const handleApplySubgraph = (subgraph: SubgraphResponse) => {
    setIsolatedSubgraph(subgraph);
    setActiveFinding(null);
    setHighlightedNodeIds([]);
  };

  // Exit Subgraph Focus
  const handleExitSubgraph = () => {
    setIsolatedSubgraph(null);
  };

  const centerNodeTitle = React.useMemo(() => {
    if (!isolatedSubgraph) return null;
    const center = graphData.nodes.find((n) => n.id === isolatedSubgraph.center_node_id);
    return center?.title || isolatedSubgraph.center_node_id.slice(0, 8);
  }, [isolatedSubgraph, graphData.nodes]);

  return (
    <div className="space-y-5">
      {/* Header and Project Context */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link
              href={`/app/projects/${project.id}`}
              className="hover:text-foreground transition-colors"
            >
              {project.name}
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Dependency Graph</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Dependency Topology & Cycle Analysis
              </h1>
              <p className="text-xs text-muted-foreground">
                Interactive entity relationships, blocking dependency chains, and graph analytics
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsNeo4jModalOpen(true)}
            className="gap-2 text-xs h-9"
          >
            <Database className="h-4 w-4 text-primary" />
            <span>Sync Neo4j</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadGraph()}
            disabled={isLoading}
            className="gap-2 text-xs h-9"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-primary" : ""}`}
            />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Metric Counters & Filter Strip */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 border-r border-border/80 pr-4">
            <span className="text-xs font-semibold text-foreground">Nodes:</span>
            <Badge variant="secondary" className="font-mono text-xs">
              {displayedNodes.length}
            </Badge>
          </div>

          <div className="flex items-center gap-2 border-r border-border/80 pr-4">
            <span className="text-xs font-semibold text-foreground">Edges:</span>
            <Badge variant="secondary" className="font-mono text-xs">
              {displayedEdges.length}
            </Badge>
          </div>

          {graphData.findings.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-destructive">
                Findings:
              </span>
              <Badge className="bg-destructive/15 text-destructive border-destructive/30 font-mono text-xs">
                {graphData.findings.length}
              </Badge>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters:</span>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              const val = e.target.value as GraphCategoryFilter;
              setSelectedCategory(val);
              loadGraph(val, selectedReviewStatus);
            }}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
          >
            <option value="all">All Categories</option>
            <option value="decision">Decision</option>
            <option value="task">Task</option>
            <option value="risk">Risk</option>
            <option value="milestone">Milestone</option>
            <option value="insight">Insight</option>
          </select>

          {/* Review Status Filter */}
          <select
            value={selectedReviewStatus}
            onChange={(e) => {
              const val = e.target.value as GraphReviewStatusFilter;
              setSelectedReviewStatus(val);
              loadGraph(selectedCategory, val);
            }}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
          >
            <option value="all">All Review Statuses</option>
            <option value="verified">Verified Only</option>
            <option value="unverified">Unverified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Subgraph Isolation Banner */}
      {isolatedSubgraph && (
        <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-xs text-primary shadow-sm">
          <div className="flex items-center gap-2.5">
            <Focus className="h-4 w-4 shrink-0" />
            <div>
              <span className="font-semibold">
                Focused on {isolatedSubgraph.depth}-Hop Subgraph around &ldquo;{centerNodeTitle}&rdquo;
              </span>
              <p className="text-[11px] text-primary/80">
                Displaying {isolatedSubgraph.nodes.length} nodes &bull; {isolatedSubgraph.edges.length} edges &bull; {isolatedSubgraph.upstream_count} upstream &bull; {isolatedSubgraph.downstream_count} downstream
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExitSubgraph}
            className="h-7 text-xs gap-1.5 hover:bg-primary/20 text-primary"
          >
            <X className="h-3.5 w-3.5" />
            <span>Reset to Full Graph</span>
          </Button>
        </div>
      )}

      {/* Findings Panel */}
      {!isolatedSubgraph && graphData.findings.length > 0 && (
        <GraphFindingsPanel
          findings={graphData.findings}
          nodesMap={nodesMap}
          selectedFinding={activeFinding}
          onSelectFinding={(f) => setActiveFinding(f)}
          onHighlightNodes={(ids) => setHighlightedNodeIds(ids)}
        />
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadGraph()}
            className="h-7 text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Main Canvas & Inspector Drawer */}
      <div className="relative min-h-155 rounded-2xl overflow-hidden border border-border/80 shadow-sm bg-card">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-xs">
            <div className="flex flex-col items-center gap-2 rounded-xl bg-card border border-border/80 p-5 shadow-lg">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground font-medium">
                Rendering Graph Topology...
              </span>
            </div>
          </div>
        )}

        <GraphCanvas
          nodes={displayedNodes}
          edges={displayedEdges}
          selectedNode={selectedNode}
          highlightedNodeIds={highlightedNodeIds}
          activeFinding={activeFinding}
          onSelectNode={(node) => setSelectedNode(node)}
        />

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="absolute top-0 right-0 bottom-0 z-10 w-full sm:w-95 max-w-full">
            <NodeDetailPanel
              projectId={project.id}
              node={selectedNode}
              nodesMap={nodesMap}
              edges={displayedEdges}
              onClose={() => setSelectedNode(null)}
              onSelectNode={(n) => setSelectedNode(n)}
              onApplySubgraph={handleApplySubgraph}
            />
          </div>
        )}
      </div>

      {/* Neo4j Manual Sync Modal */}
      <Neo4jSyncModal
        projectId={project.id}
        projectName={project.name}
        open={isNeo4jModalOpen}
        onOpenChange={setIsNeo4jModalOpen}
        onSyncCompleted={() => loadGraph()}
      />
    </div>
  );
}
