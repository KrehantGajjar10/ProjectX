"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteSourceClient } from "@/features/sources/lib/sources-client";
import {
  formatFileSize,
  type SourceRead,
  type UploadFileDetail,
} from "@/features/sources/types/source";
import { AuthClientError } from "@/lib/auth-client";
import {
  AlertCircle,
  AlertTriangle,
  FolderGit2,
  HardDrive,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";

interface DeleteSourceDialogProps {
  projectId: string;
  source: SourceRead | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (sourceId: string) => void;
}

export function DeleteSourceDialog({
  projectId,
  source,
  isOpen,
  onClose,
  onDeleted,
}: DeleteSourceDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const resetState = React.useCallback(() => {
    setIsDeleting(false);
    setErrorMessage(null);
  }, []);

  const handleClose = React.useCallback(() => {
    if (!isDeleting) {
      resetState();
      onClose();
    }
  }, [isDeleting, resetState, onClose]);

  // Handle ESC key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isDeleting) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDeleting, handleClose]);

  if (!isOpen || !source) return null;

  const parsedConfig = (() => {
    if (!source.config) return {};
    if (typeof source.config === "string") {
      try {
        return JSON.parse(source.config);
      } catch {
        return {};
      }
    }
    return source.config;
  })();

  const files: UploadFileDetail[] = Array.isArray(parsedConfig?.files)
    ? parsedConfig.files
    : [];
  const totalSizeBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const isUploadType = source.type === "upload";

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteSourceClient(projectId, source.id);
      onDeleted(source.id);
      handleClose();
    } catch (err) {
      if (err instanceof AuthClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while deleting the source."
        );
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-source-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in-0 duration-200"
    >
      <div
        className="fixed inset-0"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="delete-source-title"
                className="text-base font-semibold text-foreground"
              >
                Delete Knowledge Source
              </h2>
              <p className="text-xs text-muted-foreground">
                This action is irreversible.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="rounded-lg p-1 text-muted-foreground hover:bg-surface hover:text-foreground transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Source Identification & Summary */}
        <div className="rounded-xl border border-border/80 bg-surface/50 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isUploadType ? (
                <Upload className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <FolderGit2 className="h-4 w-4 text-violet shrink-0" />
              )}
              <span className="font-semibold text-sm text-foreground truncate">
                {source.name}
              </span>
            </div>

            <Badge
              variant={isUploadType ? "emerald" : "violet"}
              className="text-[10px] uppercase font-mono tracking-wider shrink-0"
            >
              {source.type}
            </Badge>
          </div>

          {isUploadType ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <HardDrive className="h-3.5 w-3.5" />
              <span>
                {files.length} document{files.length === 1 ? "" : "s"} ({formatFileSize(totalSizeBytes)})
              </span>
            </div>
          ) : (
            parsedConfig?.repo_url && (
              <p className="text-xs text-muted-foreground font-mono truncate">
                {parsedConfig.repo_url}
              </p>
            )
          )}
        </div>

        {/* Warning text */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          Are you sure you want to delete this source? This will remove the source
          record from the database and permanently delete all associated documents
          from physical storage. Any associated knowledge embeddings or ingestion
          jobs will also be removed.
        </p>

        {/* Error message */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/70">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="gap-1.5 font-medium min-w-32"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Delete Source
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
