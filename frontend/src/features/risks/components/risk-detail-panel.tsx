"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RiskItemRead } from "../types/risk";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  ExternalLink,
  FileText,
  Info,
  Sparkles,
  X,
} from "lucide-react";

interface RiskDetailPanelProps {
  projectId: string;
  risk: RiskItemRead;
  onClose: () => void;
}

export function RiskDetailPanel({
  projectId,
  risk,
  onClose,
}: RiskDetailPanelProps) {
  const isComputed = risk.source_type === "computed_signal";

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return (
          <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] uppercase font-semibold gap-1">
            <AlertOctagon className="h-3 w-3" />
            Critical Severity
          </Badge>
        );
      case "high":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] uppercase font-semibold gap-1">
            <AlertTriangle className="h-3 w-3" />
            High Severity
          </Badge>
        );
      case "medium":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] uppercase font-semibold gap-1">
            <Info className="h-3 w-3" />
            Medium Severity
          </Badge>
        );
      case "low":
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px] uppercase font-semibold">
            Low Severity
          </Badge>
        );
    }
  };

  const formatCategory = (cat: string) => {
    return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border/80 shadow-2xl overflow-hidden animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border/60 bg-muted/30 flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {getSeverityBadge(risk.severity)}
            <Badge variant="secondary" className="text-[10px]">
              {formatCategory(risk.category)}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono">
              {Math.round(risk.confidence * 100)}% Confidence
            </Badge>
          </div>
          <h2 className="text-sm font-bold text-foreground leading-snug wrap-break-word">
            {risk.title}
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
        {/* Source Type & Origin Callout */}
        <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-2.5">
          <div className="flex items-center gap-2">
            {isComputed ? (
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Cpu className="h-4 w-4" />
              </div>
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Sparkles className="h-4 w-4" />
              </div>
            )}
            <div>
              <span className="font-semibold text-foreground">
                {isComputed ? "Computed Risk Signal" : "Document Extracted Risk"}
              </span>
              <p className="text-[10px] text-muted-foreground">
                {isComputed
                  ? "Generated via deterministic project schedule and graph rules"
                  : "Extracted directly from project documentation sources"}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <span className="font-semibold text-foreground text-xs">Description</span>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap bg-background p-3 rounded-lg border border-border/60 shadow-xs">
            {risk.description}
          </p>
        </div>

        {/* Rationale / Why this is flagged */}
        {risk.rationale && (
          <div className="space-y-1.5">
            <span className="font-semibold text-foreground text-xs">Analytical Rationale</span>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-primary leading-relaxed">
              {risk.rationale}
            </div>
          </div>
        )}

        {/* Related Entity Link if available */}
        {risk.entity_id && (
          <div className="space-y-1.5">
            <span className="font-semibold text-foreground text-xs">Linked Knowledge Record</span>
            <div>
              <Link
                href={`/app/projects/${projectId}/knowledge/${risk.entity_id}`}
                target="_blank"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-medium text-foreground hover:bg-muted transition-colors shadow-xs"
              >
                <span>Inspect Source Knowledge Item</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            </div>
          </div>
        )}

        {/* Supporting Evidence List */}
        <div className="space-y-2.5 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Supporting Evidence ({risk.evidence ? risk.evidence.length : 0})
            </span>
          </div>

          {!risk.evidence || risk.evidence.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic bg-muted/20 p-3 rounded-lg border border-border/50">
              No direct document text evidence is attached to this computed signal.
            </p>
          ) : (
            <div className="space-y-2">
              {risk.evidence.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-lg border border-border/70 bg-background p-3 space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground truncate">
                      {ev.source_locator}
                    </span>
                    {ev.verified ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[9px] gap-1 px-1.5 py-0">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 dark:text-amber-400 text-[9px] gap-1 px-1.5 py-0">
                        <Info className="h-2.5 w-2.5" />
                        Unverified
                      </Badge>
                    )}
                  </div>

                  <p className="text-[11px] text-foreground font-serif italic border-l-2 border-primary/50 pl-2 leading-relaxed">
                    &ldquo;{ev.exact_excerpt}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
