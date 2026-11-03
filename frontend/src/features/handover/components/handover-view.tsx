"use client";

import * as React from "react";
import type { ProjectDetailRead } from "@/types/project";
import type {
  ExportFormat,
  HandoverGenerateRequest,
  HandoverGenerationJobStatus,
  HandoverReportDetailRead,
  HandoverReportVersionSummary,
  HandoverReviewRequest,
  LatestHandoverResponse,
} from "../types/handover";
import {
  clientDownloadExport,
  clientGetLatestHandover,
  clientGetVersion,
  clientListVersions,
  clientReviewReport,
  clientStartGeneration,
  clientSubmitForReview,
  HandoverClientError,
} from "../lib/handover-client";
import { canGenerateHandover } from "../lib/handover-utils";
import { HandoverHeader } from "./handover-header";
import { GenerationProgressCard } from "./generation-progress-card";
import { SectionCard } from "./section-card";
import { GenerateHandoverDialog } from "./generate-handover-dialog";
import { ReviewHandoverDialog } from "./review-handover-dialog";
import { VersionHistoryPanel } from "./version-history-panel";
import { VersionDiffDialog } from "./version-diff-dialog";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  Layers,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface HandoverViewProps {
  project: ProjectDetailRead;
  initialLatest: LatestHandoverResponse | null;
  initialVersions: HandoverReportVersionSummary[];
}

export function HandoverView({
  project,
  initialLatest,
  initialVersions,
}: HandoverViewProps) {
  // Primary state
  const [report, setReport] = React.useState<HandoverReportDetailRead | null>(
    initialLatest?.report || null
  );
  const [activeJob, setActiveJob] =
    React.useState<HandoverGenerationJobStatus | null>(
      initialLatest?.active_job || null
    );
  const [versions, setVersions] =
    React.useState<HandoverReportVersionSummary[]>(initialVersions);

  // Modals & Panels
  const [isGenerateOpen, setIsGenerateOpen] = React.useState(false);
  const [isReviewOpen, setIsReviewOpen] = React.useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [isDiffOpen, setIsDiffOpen] = React.useState(false);
  const [diffV1, setDiffV1] = React.useState(1);
  const [diffV2, setDiffV2] = React.useState(2);

  // Loading & Feedback
  const [isStartingGeneration, setIsStartingGeneration] = React.useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = React.useState(false);
  const [isRecordingReview, setIsRecordingReview] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isGenerating = Boolean(
    activeJob &&
      (activeJob.status === "queued" || activeJob.status === "processing")
  );

  const latestVersionNumber =
    versions.length > 0 ? versions[0].version : report?.version || 1;
  const isViewingHistorical = Boolean(
    report && report.version < latestVersionNumber
  );

  // Poll for background generation progress
  React.useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(async () => {
      try {
        const latest = await clientGetLatestHandover(project.id);
        if (latest.active_job) {
          setActiveJob(latest.active_job);
        } else {
          // Completed
          setActiveJob(null);
          if (latest.report) {
            setReport(latest.report);
            setFeedback({
              type: "success",
              text: `Handover report v${latest.report.version} generated successfully!`,
            });
          }
          const updatedVersions = await clientListVersions(project.id);
          setVersions(updatedVersions);
        }
      } catch (err) {
        console.error("Failed to check generation progress:", err);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [isGenerating, project.id]);

  // Start Generation
  const handleStartGeneration = async (data: HandoverGenerateRequest) => {
    setIsStartingGeneration(true);
    setFeedback(null);

    try {
      const res = await clientStartGeneration(project.id, data);
      setActiveJob({
        job_id: res.id,
        status: res.status,
        progress: res.progress || 10,
        error: null,
        report_id: null,
        created_at: new Date().toISOString(),
      });
      setIsGenerateOpen(false);
      setFeedback({
        type: "success",
        text: "Generation job enqueued. Progress is being tracked automatically.",
      });
    } catch (err) {
      if (err instanceof HandoverClientError) {
        setFeedback({ type: "error", text: err.message });
      } else {
        setFeedback({
          type: "error",
          text: "Failed to trigger report generation.",
        });
      }
    } finally {
      setIsStartingGeneration(false);
    }
  };

  // Submit for Review
  const handleSubmitForReview = async () => {
    if (!report) return;
    setIsSubmittingReview(true);
    setFeedback(null);

    try {
      const updated = await clientSubmitForReview(project.id, report.id);
      setReport(updated);
      const updatedVersions = await clientListVersions(project.id);
      setVersions(updatedVersions);
      setFeedback({
        type: "success",
        text: `Report v${updated.version} submitted for peer review.`,
      });
    } catch (err) {
      if (err instanceof HandoverClientError) {
        setFeedback({ type: "error", text: err.message });
      } else {
        setFeedback({
          type: "error",
          text: "Failed to submit report for review.",
        });
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Record Review Decision
  const handleReviewDecision = async (data: HandoverReviewRequest) => {
    if (!report) return;
    setIsRecordingReview(true);
    setFeedback(null);

    try {
      const updated = await clientReviewReport(project.id, report.id, data);
      setReport(updated);
      setIsReviewOpen(false);
      const updatedVersions = await clientListVersions(project.id);
      setVersions(updatedVersions);
      setFeedback({
        type: "success",
        text:
          data.action === "approve"
            ? `Report v${updated.version} approved and sealed as immutable.`
            : `Report v${updated.version} returned to draft status with audited feedback.`,
      });
    } catch (err) {
      if (err instanceof HandoverClientError) {
        setFeedback({ type: "error", text: err.message });
      } else {
        setFeedback({
          type: "error",
          text: `Failed to record review decision.`,
        });
      }
    } finally {
      setIsRecordingReview(false);
    }
  };

  // Export File
  const handleExport = async (format: ExportFormat) => {
    if (!report) return;
    setIsExporting(true);
    setFeedback(null);

    try {
      await clientDownloadExport(project.id, report.id, format);
      setFeedback({
        type: "success",
        text: `Exported handover report as ${format.toUpperCase()}.`,
      });
    } catch (err) {
      if (err instanceof HandoverClientError) {
        setFeedback({ type: "error", text: err.message });
      } else {
        setFeedback({
          type: "error",
          text: `Failed to download ${format.toUpperCase()} export.`,
        });
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Load a specific historical version
  const handleSelectVersion = async (versionNum: number) => {
    try {
      const vReport = await clientGetVersion(project.id, String(versionNum));
      setReport(vReport);
      setFeedback(null);
    } catch {
      setFeedback({
        type: "error",
        text: `Could not load version v${versionNum}.`,
      });
    }
  };

  // Open diff with specific version numbers
  const handleOpenDiffWith = (v1: number, v2: number) => {
    setDiffV1(v1);
    setDiffV2(v2);
    setIsDiffOpen(true);
  };

  const sectionsList = report?.sections ? Object.values(report.sections) : [];

  return (
    <div className="space-y-6">
      {/* Handover Header */}
      <HandoverHeader
        report={report}
        versions={versions}
        userRole={project.my_role}
        isGenerating={isGenerating}
        onOpenGenerateDialog={() => setIsGenerateOpen(true)}
        onOpenReviewDialog={() => setIsReviewOpen(true)}
        onOpenDiffDialog={() => {
          if (versions.length >= 2) {
            setDiffV1(versions[1].version);
            setDiffV2(versions[0].version);
          } else {
            setDiffV1(1);
            setDiffV2(1);
          }
          setIsDiffOpen(true);
        }}
        onOpenHistoryPanel={() => setIsHistoryOpen(true)}
        onSubmitForReview={handleSubmitForReview}
        onExport={handleExport}
        isSubmittingReview={isSubmittingReview}
        isExporting={isExporting}
      />

      {/* Dismissible Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-xs transition-colors ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
            )}
            <span className="leading-relaxed font-medium">
              {feedback.text}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss message"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Historical Version Notice Banner */}
      {isViewingHistorical && report && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              Viewing Historical Release:
            </span>
            <span className="font-mono font-bold">v{report.version}</span>
            <span>(Latest is v{latestVersionNumber})</span>
          </div>

          <button
            type="button"
            onClick={() => handleSelectVersion(latestVersionNumber)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Return to Latest (v{latestVersionNumber})
          </button>
        </div>
      )}

      {/* Active Generation Job Progress Card */}
      {activeJob && isGenerating && (
        <GenerationProgressCard job={activeJob} />
      )}

      {/* Sections Content or Empty State */}
      {report && sectionsList.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-mono">
                Handover Document Sections ({sectionsList.length})
              </h2>
            </div>

            <span className="text-[11px] text-muted-foreground font-mono">
              Grounded in {report.total_claims} verified claims
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {sectionsList.map((section) => (
              <SectionCard
                key={section.key}
                section={section}
                projectId={project.id}
              />
            ))}
          </div>
        </div>
      ) : !isGenerating ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/60 p-8 sm:p-12 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileCheck2 className="h-7 w-7" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-bold text-foreground">
              No Handover Report Generated Yet
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Synthesize an evidence-backed handover report for this project. The report will extract decisions, risks, completed work, tasks, and ownership continuity grounded in primary source documents.
            </p>
          </div>

          {canGenerateHandover(project.my_role) ? (
            <div className="pt-2">
              <Button
                type="button"
                onClick={() => setIsGenerateOpen(true)}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Generate First Handover Report
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              You need Member or higher permissions to generate a handover report.
            </p>
          )}
        </div>
      ) : null}

      {/* Modals & Dialogs */}
      <GenerateHandoverDialog
        open={isGenerateOpen}
        onOpenChange={setIsGenerateOpen}
        onGenerate={handleStartGeneration}
        isSubmitting={isStartingGeneration}
      />

      {report && (
        <ReviewHandoverDialog
          open={isReviewOpen}
          onOpenChange={setIsReviewOpen}
          reportVersion={report.version}
          onReview={handleReviewDecision}
          isSubmitting={isRecordingReview}
        />
      )}

      <VersionHistoryPanel
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        versions={versions}
        currentVersion={report?.version || 1}
        onSelectVersion={handleSelectVersion}
        onOpenDiffWith={handleOpenDiffWith}
      />

      <VersionDiffDialog
        open={isDiffOpen}
        onOpenChange={setIsDiffOpen}
        projectId={project.id}
        versions={versions}
        initialV1={diffV1}
        initialV2={diffV2}
      />
    </div>
  );
}
