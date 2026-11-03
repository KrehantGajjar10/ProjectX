"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDropzone } from "@/features/sources/components/file-dropzone";
import { SelectedFileList } from "@/features/sources/components/selected-file-list";
import {
  startIngestionJobClient,
  getIngestionJobStatusClient,
  uploadSourcesClient,
} from "@/features/sources/lib/sources-client";
import {
  isAllowedExtension,
  MAX_UPLOAD_SIZE_BYTES,
  type UploadSourceResponse,
} from "@/features/sources/types/source";
import type { IngestionJobRead } from "@/features/sources/types/ingestion";
import { AuthClientError } from "@/lib/auth-client";
import {
  AlertCircle,
  CheckCircle2,
  FolderUp,
  Info,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

interface SourceUploadDialogProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (response: UploadSourceResponse) => void;
}

type DialogStage = "select" | "uploading" | "ingesting" | "completed" | "failed";

export function SourceUploadDialog({
  projectId,
  isOpen,
  onClose,
  onUploadSuccess,
}: SourceUploadDialogProps) {
  const [stagedFiles, setStagedFiles] = React.useState<File[]>([]);
  const [stage, setStage] = React.useState<DialogStage>("select");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successInfo, setSuccessInfo] = React.useState<{
    count: number;
  } | null>(null);
  const [ingestionJob, setIngestionJob] = React.useState<IngestionJobRead | null>(
    null
  );

  const pollTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const uploadResultRef = React.useRef<UploadSourceResponse | null>(null);

  const clearPollTimer = React.useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const resetDialog = React.useCallback(() => {
    clearPollTimer();
    setStagedFiles([]);
    setStage("select");
    setErrorMessage(null);
    setSuccessInfo(null);
    setIngestionJob(null);
    uploadResultRef.current = null;
  }, [clearPollTimer]);

  const handleClose = React.useCallback(() => {
    if (stage !== "uploading") {
      clearPollTimer();
      // If upload finished while ingesting in background, notify parent
      if (uploadResultRef.current) {
        onUploadSuccess(uploadResultRef.current);
      }
      resetDialog();
      onClose();
    }
  }, [stage, clearPollTimer, onUploadSuccess, resetDialog, onClose]);

  // Handle ESC key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && stage !== "uploading") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, stage, handleClose]);

  // Clean up timer on unmount
  React.useEffect(() => {
    return () => {
      clearPollTimer();
    };
  }, [clearPollTimer]);

  if (!isOpen) return null;

  const handleFilesSelected = (newFiles: File[]) => {
    setErrorMessage(null);
    setSuccessInfo(null);

    // Filter duplicates by name and size
    setStagedFiles((prev) => {
      const existingKey = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const nonDuplicates = newFiles.filter(
        (f) => !existingKey.has(`${f.name}-${f.size}`)
      );
      return [...prev, ...nonDuplicates];
    });
  };

  const handleRemoveFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
    setErrorMessage(null);
  };

  const handleClearAll = () => {
    setStagedFiles([]);
    setErrorMessage(null);
  };

  // Check validity
  const hasInvalidFiles = stagedFiles.some(
    (f) => !isAllowedExtension(f.name) || f.size > MAX_UPLOAD_SIZE_BYTES
  );

  const canSubmit =
    stagedFiles.length > 0 && !hasInvalidFiles && stage === "select";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setErrorMessage(null);
    setStage("uploading");

    try {
      // Step 1: Upload the selected documents
      const result = await uploadSourcesClient(projectId, stagedFiles);
      uploadResultRef.current = result;
      setSuccessInfo({ count: stagedFiles.length });
      setStagedFiles([]);

      // Step 2: Trigger automatic ingestion job for the uploaded source
      setStage("ingesting");
      try {
        const job = await startIngestionJobClient(projectId, [
          result.source.id,
        ]);
        setIngestionJob(job);

        // Step 3: Poll ingestion job status until complete or failed
        pollTimerRef.current = setInterval(async () => {
          try {
            const currentJob = await getIngestionJobStatusClient(
              projectId,
              job.id
            );
            setIngestionJob(currentJob);

            if (currentJob.status === "completed") {
              clearPollTimer();
              setStage("completed");
              onUploadSuccess(result);

              // Auto close dialog after brief success presentation
              setTimeout(() => {
                handleClose();
              }, 1800);
            } else if (currentJob.status === "failed") {
              clearPollTimer();
              setStage("failed");
              setErrorMessage(
                currentJob.error ||
                  "Ingestion job failed during processing. Check logs for details."
              );
              onUploadSuccess(result);
            }
          } catch (pollErr) {
            console.error("Error polling ingestion status:", pollErr);
          }
        }, 2000);
      } catch (ingestionErr) {
        // If starting ingestion job failed, notify parent about upload but show ingestion start error
        onUploadSuccess(result);
        setStage("failed");
        setErrorMessage(
          ingestionErr instanceof Error
            ? `Documents uploaded to storage, but automatic ingestion failed to enqueue: ${ingestionErr.message}`
            : "Failed to enqueue ingestion job."
        );
      }
    } catch (err) {
      setStage("select");
      if (err instanceof AuthClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "An unexpected network error occurred during upload."
        );
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-xs animate-in fade-in-50 duration-150"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 -z-10"
        onClick={() => {
          if (stage !== "uploading") handleClose();
        }}
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FolderUp className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="upload-dialog-title"
                className="text-base font-semibold text-foreground tracking-tight"
              >
                Upload Project Documents
              </h2>
              <p className="text-xs text-muted-foreground">
                Attach technical documentation to the evidence-grounded store.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={stage === "uploading"}
            aria-label="Close upload dialog"
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Feedback banners */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Ingestion in Progress Stage */}
        {stage === "ingesting" && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 animate-in fade-in-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-xs font-semibold text-foreground">
                  Ingestion & Knowledge Extraction
                </span>
              </div>
              <Badge
                variant={
                  ingestionJob?.status === "processing" ? "emerald" : "copper"
                }
                className="text-[10px] uppercase font-mono tracking-wider"
              >
                {ingestionJob?.status || "queued"}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {ingestionJob?.status === "queued"
                ? "Job queued in database. Waiting for ingestion worker to claim..."
                : "Parsing documents, generating semantic chunks, and extracting grounded knowledge..."}
            </p>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>Extraction Progress</span>
                <span>{ingestionJob?.progress || 0}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface border border-border/60">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.max(5, ingestionJob?.progress || 0)}%` }}
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                className="text-xs"
              >
                Continue in Background
              </Button>
            </div>
          </div>
        )}

        {/* Completed Stage */}
        {stage === "completed" && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-emerald/30 bg-emerald/10 p-3 text-xs text-emerald animate-in fade-in-50"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Successfully uploaded and ingested {successInfo?.count || 1} document(s). Knowledge records extracted!
            </span>
          </div>
        )}

        {/* Form Body (Visible when selecting or uploading) */}
        {stage !== "ingesting" && stage !== "completed" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FileDropzone
              onFilesSelected={handleFilesSelected}
              disabled={stage === "uploading"}
            />

            <SelectedFileList
              files={stagedFiles}
              onRemoveFile={handleRemoveFile}
              onClearAll={handleClearAll}
              disabled={stage === "uploading"}
            />

            {/* Scope Note */}
            <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-surface/40 p-2.5 text-[11px] text-muted-foreground leading-relaxed">
              <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span>
                Uploaded documents are saved to project storage and automatically enqueued for AI extraction and evidence verification.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/70">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={stage === "uploading"}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={!canSubmit}
                className="gap-1.5 font-medium min-w-32.5"
              >
                {stage === "uploading" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  `Upload & Ingest ${
                    stagedFiles.length > 0 ? `(${stagedFiles.length})` : ""
                  }`
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
