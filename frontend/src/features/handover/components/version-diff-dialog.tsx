"use client";

import * as React from "react";
import type {
  HandoverDiffResponse,
  HandoverReportVersionSummary,
} from "../types/handover";
import { clientGetDiff } from "../lib/handover-client";
import {
  AlertCircle,
  ArrowRight,
  GitCompare,
  Loader2,
  X,
} from "lucide-react";

interface VersionDiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  versions: HandoverReportVersionSummary[];
  initialV1?: number;
  initialV2?: number;
}

export function VersionDiffDialog({
  open,
  onOpenChange,
  projectId,
  versions,
  initialV1,
  initialV2,
}: VersionDiffDialogProps) {
  const [v1, setV1] = React.useState<number>(initialV1 || 1);
  const [v2, setV2] = React.useState<number>(initialV2 || 2);
  const [diffRequestState, setDiffRequestState] = React.useState<{
    key: string;
    data?: HandoverDiffResponse;
    error?: string;
  } | null>(null);
  const requestKey = JSON.stringify([projectId, v1, v2]);
  const currentRequest =
    diffRequestState?.key === requestKey ? diffRequestState : null;
  const diffData = currentRequest?.data ?? null;
  const error = currentRequest?.error ?? null;
  const isLoading = open && v1 !== v2 && currentRequest === null;

  // Sync state if initial props change
  const [prevInitKey, setPrevInitKey] = React.useState(`${initialV1}-${initialV2}`);
  const currentInitKey = `${initialV1}-${initialV2}`;
  if (currentInitKey !== prevInitKey) {
    setPrevInitKey(currentInitKey);
    if (initialV1) setV1(initialV1);
    if (initialV2) setV2(initialV2);
  }

  // Load diff when open or when v1/v2 change
  React.useEffect(() => {
    if (!open || v1 === v2) return;

    let isMounted = true;

    clientGetDiff(projectId, v1, v2)
      .then((data) => {
        if (isMounted) {
          setDiffRequestState({ key: requestKey, data });
        }
      })
      .catch((err) => {
        if (isMounted) {
          setDiffRequestState({
            key: requestKey,
            error: err?.message || "Failed to load version comparison.",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [open, projectId, requestKey, v1, v2]);

  if (!open) return null;

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
        aria-labelledby="version-diff-dialog-title"
        className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in-50 zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-border/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GitCompare className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="version-diff-dialog-title"
                className="text-base sm:text-lg font-bold text-foreground"
              >
                Version Diff & Evolution Analysis
              </h2>
              <p className="text-xs text-muted-foreground">
                Authoritative section-by-section diff computed by ProjectX backend.
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

        {/* Version Selectors Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface/50 p-3.5 text-xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">Base Version:</span>
              <select
                value={v1}
                onChange={(e) => setV1(Number(e.target.value))}
                className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {versions.map((ver) => (
                  <option key={ver.id} value={ver.version}>
                    v{ver.version} ({ver.status})
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="h-4 w-4 text-muted-foreground" />

            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">Target Version:</span>
              <select
                value={v2}
                onChange={(e) => setV2(Number(e.target.value))}
                className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {versions.map((ver) => (
                  <option key={ver.id} value={ver.version}>
                    v{ver.version} ({ver.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {diffData && (
            <div className="text-[11px] text-muted-foreground font-mono">
              Status transition:{" "}
              <span className="uppercase font-semibold text-foreground">
                {diffData.v1_status} → {diffData.v2_status}
              </span>
            </div>
          )}
        </div>

        {/* Body / Diff List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {v1 === v2 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Please select two distinct versions to compare.</span>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs">Computing authoritative diff across reports...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : diffData ? (
            <div className="space-y-3">
              {diffData.section_diffs.map((sec) => (
                <div
                  key={sec.section_key}
                  className="rounded-xl border border-border/80 bg-card p-4 space-y-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                    <span className="font-bold text-foreground">
                      {sec.section_title}
                    </span>

                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      {sec.content_changed ? (
                        <span className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-amber-600 dark:text-amber-400 font-semibold">
                          Modified
                        </span>
                      ) : (
                        <span className="rounded bg-surface border border-border px-2 py-0.5 text-muted-foreground">
                          Unchanged
                        </span>
                      )}

                      <span className="text-muted-foreground">
                        Claims: {sec.v1_claims_count} → {sec.v2_claims_count}
                      </span>
                      <span>•</span>
                      <span className="text-muted-foreground">
                        Citations: {sec.v1_evidence_count} → {sec.v2_evidence_count}
                      </span>
                    </div>
                  </div>

                  {/* Summary Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="rounded-lg bg-surface/50 border border-border/60 p-3 space-y-1">
                      <div className="text-[10px] font-mono text-muted-foreground uppercase">
                        v{diffData.v1_version} Summary
                      </div>
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        {sec.v1_summary}
                      </p>
                    </div>

                    <div className="rounded-lg bg-surface/50 border border-border/60 p-3 space-y-1">
                      <div className="text-[10px] font-mono text-muted-foreground uppercase">
                        v{diffData.v2_version} Summary
                      </div>
                      <p className="text-foreground text-[11px] leading-relaxed font-medium">
                        {sec.v2_summary}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
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
