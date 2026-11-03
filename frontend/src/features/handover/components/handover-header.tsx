"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type {
  ExportFormat,
  HandoverReportDetailRead,
  HandoverReportVersionSummary,
} from "../types/handover";
import type { ProjectRole } from "@/types/project";
import {
  canGenerateHandover,
  canReviewHandover,
  canSubmitHandover,
  formatHandoverDate,
  getHandoverStatusBadge,
} from "../lib/handover-utils";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  FileCheck2,
  FileCode,
  FileText,
  GitCompare,
  History,
  Loader2,
  Plus,
  Send,
  ShieldCheck,
  Target,
  User,
} from "lucide-react";

interface HandoverHeaderProps {
  report: HandoverReportDetailRead | null;
  versions: HandoverReportVersionSummary[];
  userRole?: ProjectRole | null;
  isGenerating: boolean;
  onOpenGenerateDialog: () => void;
  onOpenReviewDialog: () => void;
  onOpenDiffDialog: () => void;
  onOpenHistoryPanel: () => void;
  onSubmitForReview: () => Promise<void>;
  onExport: (format: ExportFormat) => Promise<void>;
  isSubmittingReview: boolean;
  isExporting: boolean;
}

export function HandoverHeader({
  report,
  versions,
  userRole,
  isGenerating,
  onOpenGenerateDialog,
  onOpenReviewDialog,
  onOpenDiffDialog,
  onOpenHistoryPanel,
  onSubmitForReview,
  onExport,
  isSubmittingReview,
  isExporting,
}: HandoverHeaderProps) {
  const [exportOpen, setExportOpen] = React.useState(false);
  const exportRef = React.useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        exportRef.current &&
        !exportRef.current.contains(event.target as Node)
      ) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const canGen = canGenerateHandover(userRole);
  const canSub = report ? canSubmitHandover(userRole, report.status) : false;
  const canRev = report ? canReviewHandover(userRole, report.status) : false;

  const statusBadge = report
    ? getHandoverStatusBadge(report.status)
    : { label: "None", className: "bg-surface text-muted-foreground" };

  const verificationPct =
    report && report.total_claims > 0
      ? Math.round((report.verified_claims / report.total_claims) * 100)
      : 100;

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        {/* Title & Metadata */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileCheck2 className="h-5 w-5" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {report?.title || "Handover Studio"}
                </h1>

                {report && (
                  <>
                    <span className="font-mono text-xs font-bold rounded bg-surface px-2 py-0.5 border border-border/80 text-foreground">
                      v{report.version}
                    </span>

                    <span
                      className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${statusBadge.className}`}
                    >
                      {statusBadge.label}
                    </span>
                  </>
                )}
              </div>

              <p className="text-xs text-muted-foreground mt-0.5">
                Evidence-grounded project handover synthesis and continuation intelligence.
              </p>
            </div>
          </div>

          {report && (
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1 text-xs text-muted-foreground">
              {/* Claims Verification Score */}
              <div className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 border border-border/70 text-[11px]">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-medium text-foreground">
                  {report.verified_claims}/{report.total_claims} Claims Verified
                </span>
                <span className="text-muted-foreground font-mono">
                  ({verificationPct}%)
                </span>
              </div>

              {/* Timestamp */}
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Generated {formatHandoverDate(report.generated_at)}</span>
              </div>

              {/* Departing Person */}
              {report.departing_member_name && (
                <div className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-copper" />
                  <span>
                    Departing:{" "}
                    <strong className="text-foreground font-medium">
                      {report.departing_member_name}
                    </strong>
                  </span>
                </div>
              )}

              {/* Focus Area */}
              {report.focus_area && (
                <div className="flex items-center gap-1">
                  <Target className="h-3.5 w-3.5 text-violet" />
                  <span>
                    Focus:{" "}
                    <strong className="text-foreground font-medium">
                      {report.focus_area}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start">
          {/* Version History Button */}
          {versions.length > 0 && (
            <button
              type="button"
              onClick={onOpenHistoryPanel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card transition-colors"
            >
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <span>History ({versions.length})</span>
            </button>
          )}

          {/* Version Comparison Button */}
          {versions.length > 1 && (
            <button
              type="button"
              onClick={onOpenDiffDialog}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card transition-colors"
            >
              <GitCompare className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Compare</span>
            </button>
          )}

          {/* Export Dropdown */}
          {report && (
            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => setExportOpen(!exportOpen)}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card transition-colors disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span>Export</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>

              {exportOpen && (
                <div className="absolute right-0 mt-1.5 w-44 rounded-xl border border-border bg-card p-1.5 shadow-xl z-20 space-y-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setExportOpen(false);
                      onExport("markdown");
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-foreground hover:bg-surface transition-colors"
                  >
                    <FileCode className="h-3.5 w-3.5 text-primary" />
                    <span>Markdown (.md)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportOpen(false);
                      onExport("pdf");
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-foreground hover:bg-surface transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 text-rose-500" />
                    <span>PDF Document (.pdf)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportOpen(false);
                      onExport("docx");
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-foreground hover:bg-surface transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    <span>Word Document (.docx)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Submit for Review (if draft and authorized) */}
          {canSub && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSubmitForReview}
              disabled={isSubmittingReview}
              className="gap-1.5"
            >
              {isSubmittingReview ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Submit for Review
            </Button>
          )}

          {/* Review Action (if reviewer authorized) */}
          {canRev && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenReviewDialog}
              className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Review / Governance
            </Button>
          )}

          {/* Generate New Report Button */}
          {canGen && (
            <Button
              type="button"
              size="sm"
              onClick={onOpenGenerateDialog}
              disabled={isGenerating}
              className="gap-1.5"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Generate Report
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
