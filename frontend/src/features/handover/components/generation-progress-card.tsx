"use client";

import * as React from "react";
import type { HandoverGenerationJobStatus } from "../types/handover";
import { Loader2, Sparkles, ShieldCheck } from "lucide-react";

interface GenerationProgressCardProps {
  job: HandoverGenerationJobStatus;
}

export function GenerationProgressCard({ job }: GenerationProgressCardProps) {
  const getStageDescription = (progress: number) => {
    if (progress <= 15) return "Queuing background task & preparing environment...";
    if (progress <= 40) return "Gathering knowledge items, tasks, risks & dependency graphs...";
    if (progress <= 70) return "Synthesizing evidence-grounded narratives...";
    if (progress < 100) return "Validating evidence references & building audit logs...";
    return "Finalizing handover report...";
  };

  return (
    <div className="rounded-2xl border border-primary/40 bg-card p-5 sm:p-6 shadow-md space-y-4 animate-in fade-in-50 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary animate-pulse">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Generating Handover Report
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase">
                <Loader2 className="h-3 w-3 animate-spin" />
                {job.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {getStageDescription(job.progress)}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="font-mono text-lg font-bold text-primary">
            {job.progress}%
          </span>
          <div className="text-[11px] text-muted-foreground">
            Job ID: {job.job_id.slice(0, 8)}...
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-surface rounded-full h-2.5 overflow-hidden border border-border/80">
        <div
          className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.max(5, Math.min(100, job.progress))}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          All claims are verified against primary project evidence.
        </span>
        <span className="font-mono">Auto-refreshing status</span>
      </div>
    </div>
  );
}
