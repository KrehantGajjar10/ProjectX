"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GraphFinding, GraphNode } from "../types/graph";
import {
  AlertOctagon,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";

interface GraphFindingsPanelProps {
  findings: GraphFinding[];
  nodesMap: Map<string, GraphNode>;
  selectedFinding: GraphFinding | null;
  onSelectFinding: (finding: GraphFinding | null) => void;
  onHighlightNodes: (nodeIds: string[]) => void;
}

export function GraphFindingsPanel({
  findings,
  nodesMap,
  selectedFinding,
  onSelectFinding,
  onHighlightNodes,
}: GraphFindingsPanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  if (!findings || findings.length === 0) {
    return null;
  }

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;

  return (
    <div className="rounded-xl border border-border/80 bg-card/95 shadow-md backdrop-blur-sm transition-all overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
            <AlertOctagon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Structural Issues & Cycle Findings
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                {findings.length}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Automated topological checks for circular loops and blocked dependency paths
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">
              {criticalCount} Critical
            </Badge>
          )}
          {highCount > 0 && (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">
              {highCount} High
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 w-7 p-0 text-muted-foreground"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded findings list */}
      {isExpanded && (
        <div className="divide-y divide-border/50 max-h-64 overflow-y-auto">
          {findings.map((finding, idx) => {
            const isSelected = selectedFinding === finding;
            const isCritical = finding.severity === "critical";

            return (
              <div
                key={`${finding.type}-${idx}`}
                className={`p-3.5 transition-colors ${
                  isSelected
                    ? "bg-primary/5 border-l-4 border-l-primary"
                    : "hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isCritical ? (
                        <AlertOctagon className="h-3.5 w-3.5 text-destructive shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-foreground truncate">
                        {finding.title}
                      </span>
                      <span
                        className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${
                          isCritical
                            ? "bg-destructive/15 text-destructive"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {finding.severity}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {finding.description}
                    </p>

                    {/* Involved Nodes */}
                    {finding.involved_node_ids && finding.involved_node_ids.length > 0 && (
                      <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Nodes:
                        </span>
                        {finding.involved_node_ids.map((nodeId) => {
                          const node = nodesMap.get(nodeId);
                          const title = node?.title || nodeId.slice(0, 8);
                          return (
                            <span
                              key={nodeId}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground font-mono truncate max-w-35"
                              title={node?.title || nodeId}
                            >
                              {title}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (isSelected) {
                          onSelectFinding(null);
                          onHighlightNodes([]);
                        } else {
                          onSelectFinding(finding);
                          onHighlightNodes(finding.involved_node_ids || []);
                        }
                      }}
                      className="h-7 text-xs gap-1.5 px-2.5"
                    >
                      <Eye className="h-3 w-3" />
                      {isSelected ? "Active" : "Highlight"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
