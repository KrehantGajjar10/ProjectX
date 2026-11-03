"use client";

import * as React from "react";
import type { HandoverReportVersionSummary } from "../types/handover";
import { formatHandoverDate, getHandoverStatusBadge } from "../lib/handover-utils";
import {
  Calendar,
  CheckCircle2,
  GitCompare,
  History,
  Layers,
  Sparkles,
  X,
} from "lucide-react";

interface VersionHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: HandoverReportVersionSummary[];
  currentVersion: number;
  onSelectVersion: (versionNum: number) => void;
  onOpenDiffWith: (v1: number, v2: number) => void;
}

export function VersionHistoryPanel({
  open,
  onOpenChange,
  versions,
  currentVersion,
  onSelectVersion,
  onOpenDiffWith,
}: VersionHistoryPanelProps) {
  if (!open) return null;

  const latestVersionNum = versions.length > 0 ? versions[0].version : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-history-panel-title"
        className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in-50 zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-border/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="version-history-panel-title"
                className="text-base sm:text-lg font-bold text-foreground"
              >
                Version History
              </h2>
              <p className="text-xs text-muted-foreground">
                All generated handover releases and governance versions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Versions List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {versions.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No versions available yet.
            </div>
          ) : (
            versions.map((v) => {
              const isSelected = v.version === currentVersion;
              const isLatest = v.version === latestVersionNum;
              const badge = getHandoverStatusBadge(v.status);

              return (
                <div
                  key={v.id}
                  className={`rounded-xl border p-4 space-y-3 transition-colors ${
                    isSelected
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/70 bg-surface/40 hover:bg-surface/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">
                          v{v.version}
                        </span>

                        <span
                          className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge.className}`}
                        >
                          {badge.label}
                        </span>

                        {isLatest && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-primary font-medium">
                            <Sparkles className="h-3 w-3" />
                            Latest
                          </span>
                        )}

                        {isSelected && (
                          <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground border border-border">
                            Active in Viewer
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatHandoverDate(v.generated_at)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {v.total_claims} claims
                        </span>
                        <span>•</span>
                        <span>{v.evidence_count} citations</span>
                      </div>

                      {v.departing_member_name && (
                        <div className="text-[11px] text-muted-foreground">
                          Departing Contributor:{" "}
                          <span className="text-foreground font-medium">
                            {v.departing_member_name}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isSelected && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectVersion(v.version);
                            onOpenChange(false);
                          }}
                          className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface transition-colors"
                        >
                          View
                        </button>
                      )}

                      {versions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenDiffWith(
                              v.version === latestVersionNum ? (versions[1]?.version || 1) : v.version,
                              latestVersionNum
                            );
                            onOpenChange(false);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                          title="Compare with latest"
                        >
                          <GitCompare className="h-3 w-3" />
                          Compare
                        </button>
                      )}
                    </div>
                  </div>

                  {v.approved_at && (
                    <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 border-t border-border/50 pt-2">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Approved on {formatHandoverDate(v.approved_at)}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-border/70 flex justify-end shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-card transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
