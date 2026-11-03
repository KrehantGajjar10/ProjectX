"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GraphEdge, GraphNode, SubgraphResponse } from "../types/graph";
import { clientGetNodeSubgraph, GraphClientError } from "../lib/graph-client";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Focus,
  GitCommit,
  HelpCircle,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";

interface NodeDetailPanelProps {
  projectId: string;
  node: GraphNode;
  nodesMap: Map<string, GraphNode>;
  edges: GraphEdge[];
  onClose: () => void;
  onSelectNode: (node: GraphNode) => void;
  onApplySubgraph: (subgraph: SubgraphResponse) => void;
}

export function NodeDetailPanel({
  projectId,
  node,
  nodesMap,
  edges,
  onClose,
  onSelectNode,
  onApplySubgraph,
}: NodeDetailPanelProps) {
  const [subgraphDepth, setSubgraphDepth] = React.useState<number>(2);
  const [isLoadingSubgraph, setIsLoadingSubgraph] = React.useState(false);
  const [subgraphError, setSubgraphError] = React.useState<string | null>(null);

  // Upstream: incoming or outgoing dependencies
  // In typical dependency models: if A depends_on B, A -> B.
  // Upstream of A: targets where source is A (A depends on B).
  // Downstream of A: sources where target is A (B depends on A).
  const upstreamEdges = React.useMemo(() => {
    return edges.filter((e) => e.source_id === node.id);
  }, [edges, node.id]);

  const downstreamEdges = React.useMemo(() => {
    return edges.filter((e) => e.target_id === node.id);
  }, [edges, node.id]);

  const handleFetchSubgraph = async () => {
    setIsLoadingSubgraph(true);
    setSubgraphError(null);
    try {
      const subgraph = await clientGetNodeSubgraph(
        projectId,
        node.id,
        subgraphDepth
      );
      onApplySubgraph(subgraph);
    } catch (err) {
      if (err instanceof GraphClientError) {
        setSubgraphError(err.message);
      } else {
        setSubgraphError("Failed to isolate subgraph for this node.");
      }
    } finally {
      setIsLoadingSubgraph(false);
    }
  };

  const getCategoryStyles = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes("decision")) {
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    }
    if (cat.includes("task")) {
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
    }
    if (cat.includes("risk")) {
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    }
    if (cat.includes("milestone")) {
      return "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30";
    }
    return "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30";
  };

  const getReviewStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "verified") {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[10px]">
          <CheckCircle2 className="h-3 w-3" />
          Verified
        </Badge>
      );
    }
    if (s === "rejected") {
      return (
        <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1 text-[10px]">
          <XCircle className="h-3 w-3" />
          Rejected
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-amber-600 dark:text-amber-400 gap-1 text-[10px]">
        <HelpCircle className="h-3 w-3" />
        Unverified
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card/95 border-l border-border/80 shadow-2xl backdrop-blur-md overflow-hidden animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border/60 bg-muted/30 flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${getCategoryStyles(
                node.category
              )}`}
            >
              {node.category}
            </span>
            {getReviewStatusBadge(node.review_status)}
            <Badge variant="secondary" className="text-[10px] font-mono">
              {Math.round(node.confidence * 100)}% conf
            </Badge>
          </div>
          <h2 className="text-sm font-bold text-foreground leading-snug wrap-break-word">
            {node.title}
          </h2>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Quick Link to Knowledge */}
        <div className="flex items-center gap-2">
          <Link
            href={`/app/projects/${projectId}/knowledge/${node.id}`}
            target="_blank"
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border/80 bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors shadow-sm"
          >
            <span>Inspect Knowledge Record</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </div>

        {/* Subgraph Isolation Controls */}
        <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Focus className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold text-foreground">Isolate Subgraph</span>
            </div>
            <div className="flex items-center gap-1 bg-background/80 border border-border/60 rounded-md p-0.5">
              {[1, 2, 3].map((depth) => (
                <button
                  key={depth}
                  onClick={() => setSubgraphDepth(depth)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    subgraphDepth === depth
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {depth} hop{depth > 1 ? "s" : ""}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Extract and focus strictly on connected dependencies within {subgraphDepth} degree{subgraphDepth > 1 ? "s" : ""} of separation.
          </p>

          <Button
            size="sm"
            variant="outline"
            onClick={handleFetchSubgraph}
            disabled={isLoadingSubgraph}
            className="w-full gap-2 text-xs h-8"
          >
            {isLoadingSubgraph ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Focus className="h-3.5 w-3.5 text-primary" />
            )}
            <span>Isolate {subgraphDepth}-Hop Subgraph</span>
          </Button>

          {subgraphError && (
            <p className="text-[11px] text-destructive leading-tight">{subgraphError}</p>
          )}
        </div>

        {/* Upstream Dependencies */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5 text-primary" />
              Depends On ({upstreamEdges.length})
            </span>
            <span className="text-[10px]">Outward</span>
          </div>

          {upstreamEdges.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic bg-muted/20 p-2.5 rounded-lg border border-border/50">
              No outgoing dependencies detected.
            </p>
          ) : (
            <div className="space-y-1.5">
              {upstreamEdges.map((edge) => {
                const targetNode = nodesMap.get(edge.target_id);
                return (
                  <div
                    key={edge.id}
                    onClick={() => targetNode && onSelectNode(targetNode)}
                    className="p-2.5 rounded-lg border border-border/60 bg-background hover:bg-muted/40 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {targetNode?.title || edge.target_id.slice(0, 8)}
                      </span>
                      <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                        {edge.type}
                      </Badge>
                    </div>
                    {edge.evidence_text && (
                      <p className="mt-1 text-[10px] text-muted-foreground line-clamp-1 italic">
                        &ldquo;{edge.evidence_text}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Downstream Dependents */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5 text-amber-500" />
              Dependents ({downstreamEdges.length})
            </span>
            <span className="text-[10px]">Inward</span>
          </div>

          {downstreamEdges.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic bg-muted/20 p-2.5 rounded-lg border border-border/50">
              No other entities depend on this item.
            </p>
          ) : (
            <div className="space-y-1.5">
              {downstreamEdges.map((edge) => {
                const sourceNode = nodesMap.get(edge.source_id);
                return (
                  <div
                    key={edge.id}
                    onClick={() => sourceNode && onSelectNode(sourceNode)}
                    className="p-2.5 rounded-lg border border-border/60 bg-background hover:bg-muted/40 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground group-hover:text-amber-600 transition-colors truncate">
                        {sourceNode?.title || edge.source_id.slice(0, 8)}
                      </span>
                      <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                        {edge.type}
                      </Badge>
                    </div>
                    {edge.evidence_text && (
                      <p className="mt-1 text-[10px] text-muted-foreground line-clamp-1 italic">
                        &ldquo;{edge.evidence_text}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Metadata info */}
        {node.metadata_info && Object.keys(node.metadata_info).length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-border/60">
            <span className="font-semibold text-muted-foreground text-[11px]">
              Attributes & Metadata
            </span>
            <div className="rounded-lg bg-muted/30 p-2 font-mono text-[10px] text-muted-foreground max-h-36 overflow-y-auto">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(node.metadata_info, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
