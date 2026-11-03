"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  connectGitHubSourceClient,
  startIngestionJobClient,
  getIngestionJobStatusClient,
} from "@/features/sources/lib/sources-client";
import type { SourceRead } from "@/features/sources/types/source";
import type { IngestionJobRead } from "@/features/sources/types/ingestion";
import { AuthClientError } from "@/lib/auth-client";
import {
  AlertCircle,
  CheckCircle2,
  FolderGit2,
  GitBranch,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

interface GitHubSourceDialogProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onConnected: (source: SourceRead) => void;
}

type DialogStage = "input" | "connecting" | "ingesting" | "completed" | "failed";

function isValidRepoFormat(value: string): boolean {
  const clean = value.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  // Pattern 1: owner/repo
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(clean)) {
    return true;
  }
  // Pattern 2: https://github.com/owner/repo or http://
  if (/^(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(clean)) {
    return true;
  }
  // Pattern 3: git@github.com:owner/repo
  if (/^git@github\.com:[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(clean)) {
    return true;
  }
  return false;
}

export function GitHubSourceDialog({
  projectId,
  isOpen,
  onClose,
  onConnected,
}: GitHubSourceDialogProps) {
  const [repoUrl, setRepoUrl] = React.useState("");
  const [branch, setBranch] = React.useState("");
  const [name, setName] = React.useState("");

  const [stage, setStage] = React.useState<DialogStage>("input");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [ingestionJob, setIngestionJob] = React.useState<IngestionJobRead | null>(null);

  const pollTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const createdSourceRef = React.useRef<SourceRead | null>(null);

  const clearPollTimer = React.useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const resetDialog = React.useCallback(() => {
    clearPollTimer();
    setRepoUrl("");
    setBranch("");
    setName("");
    setStage("input");
    setErrorMessage(null);
    setIngestionJob(null);
    createdSourceRef.current = null;
  }, [clearPollTimer]);

  const handleClose = React.useCallback(() => {
    if (stage !== "connecting") {
      clearPollTimer();
      // If a source was successfully created before closing, notify parent to refresh
      if (createdSourceRef.current) {
        onConnected(createdSourceRef.current);
      }
      resetDialog();
      onClose();
    }
  }, [stage, clearPollTimer, onConnected, resetDialog, onClose]);

  // Handle ESC key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && stage !== "connecting") {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = repoUrl.trim();

    if (!trimmedUrl) {
      setErrorMessage("Repository URL is required.");
      return;
    }

    if (!isValidRepoFormat(trimmedUrl)) {
      setErrorMessage(
        "Please enter a valid GitHub repository URL (e.g. 'https://github.com/owner/repository') or identifier ('owner/repository')."
      );
      return;
    }

    setErrorMessage(null);
    setStage("connecting");

    try {
      // Step 1: Connect GitHub repository via BFF
      const source = await connectGitHubSourceClient(projectId, {
        repo_url: trimmedUrl,
        branch: branch.trim() || null,
        name: name.trim() || null,
      });

      createdSourceRef.current = source;

      // Step 2: Trigger automatic ingestion job
      setStage("ingesting");
      try {
        const job = await startIngestionJobClient(projectId, [source.id]);
        setIngestionJob(job);

        // Step 3: Poll ingestion job status until complete or failed
        pollTimerRef.current = setInterval(async () => {
          try {
            const currentJob = await getIngestionJobStatusClient(projectId, job.id);
            setIngestionJob(currentJob);

            if (currentJob.status === "completed") {
              clearPollTimer();
              setStage("completed");
              onConnected(source);

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
              onConnected(source);
            }
          } catch (pollErr) {
            console.error("Error polling ingestion status:", pollErr);
          }
        }, 2000);
      } catch (ingestionErr) {
        // Source created successfully, but automatic ingestion failed to enqueue
        onConnected(source);
        setStage("failed");
        setErrorMessage(
          ingestionErr instanceof Error
            ? `Repository connected as a knowledge source, but automatic ingestion failed to enqueue: ${ingestionErr.message}. You can trigger ingestion at any time using the 'Ingest Knowledge' button on the source card.`
            : "Repository connected, but failed to enqueue ingestion job. You can trigger ingestion from the source card."
        );
      }
    } catch (err) {
      setStage("input");
      if (err instanceof AuthClientError) {
        if (err.statusCode === 403) {
          setErrorMessage(
            "Permission denied: Admin or Owner role is required to connect GitHub repositories."
          );
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Failed to connect to GitHub repository. Please verify the URL and backend network connectivity."
        );
      }
    }
  };

  const isSubmitting = stage === "connecting";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="github-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-xs animate-in fade-in-50 duration-150"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 -z-10"
        onClick={() => {
          if (stage !== "connecting") handleClose();
        }}
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="github-dialog-title"
                className="text-base font-semibold text-foreground tracking-tight"
              >
                Connect GitHub Repository
              </h2>
              <p className="text-xs text-muted-foreground">
                Attach a repository to ground architecture and code in verifiable evidence.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
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
            <div className="space-y-1">
              <span className="leading-relaxed block">{errorMessage}</span>
              {errorMessage.toLowerCase().includes("failed to connect") && (
                <span className="text-[11px] opacity-90 block">
                  Tip: If this is a private repository, ensure that the backend environment has <code>GITHUB_ACCESS_TOKEN</code> configured.
                </span>
              )}
            </div>
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
                ? "Repository connected! Ingestion job queued in database. Waiting for worker to claim..."
                : "Parsing repository tree, extracting README and documentation, and generating knowledge chunks..."}
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
              Successfully connected and ingested repository. Knowledge records and evidence links extracted!
            </span>
          </div>
        )}

        {/* Form Body (Visible when in input, connecting, or failed stage) */}
        {stage !== "ingesting" && stage !== "completed" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Repo URL Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="github-repo-url"
                className="block text-xs font-medium text-foreground"
              >
                Repository URL or Shorthand <span className="text-destructive">*</span>
              </label>
              <input
                id="github-repo-url"
                type="text"
                placeholder="https://github.com/owner/repo or owner/repo"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  setErrorMessage(null);
                }}
                disabled={isSubmitting}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-xs sm:text-sm text-foreground shadow-2xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 font-mono"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Accepted: <code>https://github.com/owner/repository</code> or <code>owner/repository</code>
              </p>
            </div>

            {/* Branch Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="github-branch"
                className="block text-xs font-medium text-foreground"
              >
                Branch / Reference <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <div className="relative">
                <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  id="github-branch"
                  type="text"
                  placeholder="main (default if left blank)"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  disabled={isSubmitting}
                  className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-xs sm:text-sm text-foreground shadow-2xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 font-mono"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Leave blank to automatically use the repository&apos;s default branch.
              </p>
            </div>

            {/* Custom Name Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="github-source-name"
                className="block text-xs font-medium text-foreground"
              >
                Display Name <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="github-source-name"
                type="text"
                placeholder="e.g. Core Engine Repository"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-xs sm:text-sm text-foreground shadow-2xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              />
              <p className="text-[11px] text-muted-foreground">
                Defaults to <code>owner/repository</code> if omitted.
              </p>
            </div>

            {/* Security Note */}
            <div className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-surface/50 p-3 text-[11px] text-muted-foreground leading-relaxed">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                Public repositories connect without authentication. For private repositories, backend access tokens are managed strictly on the server environment. No personal access tokens are stored in the browser.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/70">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !repoUrl.trim()}
                className="gap-1.5 font-medium min-w-32.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <FolderGit2 className="h-3.5 w-3.5" />
                    <span>Connect Repository</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
