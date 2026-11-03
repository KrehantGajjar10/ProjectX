"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { formatFileSize, type SourceRead, type UploadFileDetail } from "@/features/sources/types/source";
import {
  AlertCircle,
  FileText,
  Info,
  Trash2,
  X,
} from "lucide-react";

interface DeleteFileDialogProps {
  projectId: string;
  source: SourceRead | null;
  file: UploadFileDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteFileDialog({
  source,
  file,
  isOpen,
  onClose,
}: DeleteFileDialogProps) {
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Handle ESC key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !source || !file) return null;

  const handleAttemptDelete = () => {
    // In accordance with Chapter 6.1 strict instructions:
    // The backend does not expose an endpoint to delete an individual file.
    // We strictly do NOT delete the entire source or simulate deletion in React state.
    setErrorMessage(
      "Individual-file deletion is not supported by the backend API. The backend currently only exposes DELETE /projects/{project_id}/sources/{source_id} for entire sources. Please see the implementation report for the exact backend endpoint specification required."
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-file-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in-0 duration-200"
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="delete-file-title"
                className="text-base font-semibold text-foreground"
              >
                Delete Uploaded File
              </h2>
              <p className="text-xs text-muted-foreground">
                Remove individual document from source.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Selected File Details */}
        <div className="rounded-xl border border-border/80 bg-surface/50 p-3.5 space-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="font-semibold text-xs text-foreground truncate">
              {file.filename}
            </span>
          </div>

          <div className="space-y-1 text-[11px] font-mono text-muted-foreground">
            <div className="truncate">
              Path: <span className="text-foreground">{file.storage_path}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Size: {formatFileSize(file.size)}</span>
              <span className="rounded bg-card px-1.5 py-0.2 border border-border/60">
                {file.mime_type}
              </span>
            </div>
          </div>
        </div>

        {/* Backend limitation explanation */}
        <div className="rounded-lg border border-copper/30 bg-copper/10 p-3 flex items-start gap-2.5 text-xs text-copper leading-relaxed">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-semibold">Backend Endpoint Required</strong>
            <span>
              The backend currently only supports deleting the entire knowledge source. Deleting an individual file without removing the parent source record requires a dedicated backend route.
            </span>
          </div>
        </div>

        {/* Error message if user tries to trigger */}
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
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleAttemptDelete}
            className="gap-1.5 font-medium"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete File
          </Button>
        </div>
      </div>
    </div>
  );
}
