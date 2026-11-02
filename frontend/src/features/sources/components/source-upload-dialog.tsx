"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/features/sources/components/file-dropzone";
import { SelectedFileList } from "@/features/sources/components/selected-file-list";
import { uploadSourcesClient } from "@/features/sources/lib/sources-client";
import {
  isAllowedExtension,
  MAX_UPLOAD_SIZE_BYTES,
  type UploadSourceResponse,
} from "@/features/sources/types/source";
import { AuthClientError } from "@/lib/auth-client";
import {
  AlertCircle,
  CheckCircle2,
  FolderUp,
  Info,
  Loader2,
  X,
} from "lucide-react";

interface SourceUploadDialogProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (response: UploadSourceResponse) => void;
}

export function SourceUploadDialog({
  projectId,
  isOpen,
  onClose,
  onUploadSuccess,
}: SourceUploadDialogProps) {
  const [stagedFiles, setStagedFiles] = React.useState<File[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successInfo, setSuccessInfo] = React.useState<{
    count: number;
  } | null>(null);

  const resetDialog = React.useCallback(() => {
    setStagedFiles([]);
    setIsUploading(false);
    setErrorMessage(null);
    setSuccessInfo(null);
  }, []);

  const handleClose = React.useCallback(() => {
    if (!isUploading) {
      resetDialog();
      onClose();
    }
  }, [isUploading, resetDialog, onClose]);

  // Handle ESC key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isUploading) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isUploading, handleClose]);

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

  const canSubmit = stagedFiles.length > 0 && !hasInvalidFiles && !isUploading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setErrorMessage(null);
    setIsUploading(true);

    try {
      const result = await uploadSourcesClient(projectId, stagedFiles);
      setSuccessInfo({ count: stagedFiles.length });
      setStagedFiles([]);

      // Inform parent view to refresh source list
      onUploadSuccess(result);

      // Auto close after brief display
      setTimeout(() => {
        handleClose();
      }, 1400);
    } catch (err) {
      if (err instanceof AuthClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected network error occurred during upload.");
      }
    } finally {
      setIsUploading(false);
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
          if (!isUploading) handleClose();
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
            disabled={isUploading}
            aria-label="Close upload dialog"
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
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

        {successInfo && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-emerald/30 bg-emerald/10 p-3 text-xs text-emerald animate-in fade-in-50"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Successfully uploaded {successInfo.count} document(s). Source list updated.
            </span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <FileDropzone
            onFilesSelected={handleFilesSelected}
            disabled={isUploading}
          />

          <SelectedFileList
            files={stagedFiles}
            onRemoveFile={handleRemoveFile}
            onClearAll={handleClearAll}
            disabled={isUploading}
          />

          {/* Scope Note */}
          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-surface/40 p-2.5 text-[11px] text-muted-foreground leading-relaxed">
            <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <span>
              Uploaded documents are securely saved to project storage. Source ingestion, chunking, and knowledge extraction will be triggered in the ingestion pipeline.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/70">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isUploading}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit}
              className="gap-1.5 font-medium min-w-32.5"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                `Upload ${stagedFiles.length > 0 ? `(${stagedFiles.length})` : "Files"}`
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
