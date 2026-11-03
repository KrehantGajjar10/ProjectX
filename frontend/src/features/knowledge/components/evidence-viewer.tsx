"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { EvidenceRead } from "../types/knowledge";
import { formatConfidence } from "../lib/knowledge-utils";
import { CheckCircle2, FileText, Link as LinkIcon, ShieldAlert } from "lucide-react";

interface EvidenceViewerProps {
  evidences: EvidenceRead[];
  className?: string;
}

export function EvidenceViewer({ evidences, className }: EvidenceViewerProps) {
  if (!evidences || evidences.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-surface/30 p-6 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-2.5">
          <FileText className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-semibold text-foreground">
          No Direct Evidence Attached
        </h4>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          This knowledge item does not currently have linked source excerpts. Grounded evidence will be automatically indexed when the source ingestion pipeline processes corresponding technical documents.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3.5 ${className || ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
            Grounded Source Evidence ({evidences.length})
          </h4>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          {evidences.filter((e) => e.verified).length} of {evidences.length} verified
        </span>
      </div>

      <div className="space-y-3">
        {evidences.map((evidence, idx) => (
          <div
            key={evidence.id || `evidence-${idx}`}
            className="rounded-xl border border-primary/25 bg-surface/60 p-4 space-y-3 transition-colors hover:border-primary/45 shadow-2xs"
          >
            {/* Header: Locator and status */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="font-mono text-xs font-semibold text-foreground truncate max-w-md">
                  {evidence.source_locator || "Unknown source locator"}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {evidence.verified ? (
                  <Badge variant="emerald" className="gap-1 text-[10px] font-mono">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified Evidence
                  </Badge>
                ) : (
                  <Badge variant="copper" className="gap-1 text-[10px] font-mono">
                    <ShieldAlert className="h-3 w-3" />
                    Unverified Evidence
                  </Badge>
                )}

                {typeof evidence.confidence === "number" && (
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-mono font-medium border border-border/60 bg-card text-muted-foreground"
                    title={`Confidence: ${evidence.confidence}`}
                  >
                    {formatConfidence(evidence.confidence)}
                  </span>
                )}
              </div>
            </div>

            {/* Exact Excerpt (Visually distinct from AI summaries) */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <span>Exact Source Excerpt</span>
                <span className="text-primary font-normal">(verifiable ground truth)</span>
              </div>

              <blockquote className="rounded-lg border-l-2 border-primary bg-background/80 p-3 text-xs leading-relaxed text-foreground/90 font-sans italic font-normal selection:bg-primary/20">
                &ldquo;{evidence.exact_excerpt}&rdquo;
              </blockquote>
            </div>

            {/* Metadata footer */}
            {(evidence.document_id || evidence.chunk_id) && (
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground/80 font-mono pt-1">
                {evidence.document_id && (
                  <span>doc: {evidence.document_id.slice(0, 8)}…</span>
                )}
                {evidence.chunk_id && (
                  <span>chunk: {evidence.chunk_id.slice(0, 8)}…</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
