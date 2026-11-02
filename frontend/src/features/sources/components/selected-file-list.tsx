"use client";

import * as React from "react";
import {
  formatFileSize,
  isAllowedExtension,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/features/sources/types/source";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  FileCode,
  FileSpreadsheet,
  FileText,
  Trash2,
  X,
} from "lucide-react";

interface SelectedFileListProps {
  files: File[];
  onRemoveFile: (index: number) => void;
  onClearAll: () => void;
  disabled?: boolean;
}

export function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "py":
    case "ts":
    case "js":
    case "json":
    case "yaml":
    case "yml":
      return <FileCode className="h-4 w-4 text-violet" />;
    case "pdf":
      return <FileText className="h-4 w-4 text-copper" />;
    case "docx":
    case "pptx":
      return <FileSpreadsheet className="h-4 w-4 text-primary" />;
    case "md":
    case "markdown":
    case "txt":
    default:
      return <FileText className="h-4 w-4 text-foreground/80" />;
  }
}

export function SelectedFileList({
  files,
  onRemoveFile,
  onClearAll,
  disabled,
}: SelectedFileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground font-mono">
          Selected Documents ({files.length})
        </span>
        <button
          type="button"
          onClick={onClearAll}
          disabled={disabled}
          className="text-muted-foreground hover:text-destructive text-[11px] font-medium transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:underline"
        >
          <Trash2 className="h-3 w-3" />
          Clear all
        </button>
      </div>

      <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
        {files.map((file, idx) => {
          const isValidExt = isAllowedExtension(file.name);
          const isSizeOk = file.size <= MAX_UPLOAD_SIZE_BYTES;
          const hasError = !isValidExt || !isSizeOk;

          return (
            <div
              key={`${file.name}-${idx}-${file.size}`}
              className={`flex items-center justify-between rounded-lg border p-2.5 text-xs transition-colors ${
                hasError
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-border/70 bg-card hover:bg-surface"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 mr-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface border border-border/60">
                  {getFileIcon(file.name)}
                </div>

                <div className="truncate">
                  <div className="truncate font-medium text-foreground text-xs">
                    {file.name}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                    <span>{formatFileSize(file.size)}</span>

                    {hasError && (
                      <span className="flex items-center gap-1 text-destructive font-semibold">
                        <AlertCircle className="h-3 w-3" />
                        {!isValidExt
                          ? "Unsupported file type"
                          : `Exceeds ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {hasError && (
                  <Badge variant="destructive" className="text-[9px] px-1 py-0">
                    Invalid
                  </Badge>
                )}

                <button
                  type="button"
                  onClick={() => onRemoveFile(idx)}
                  disabled={disabled}
                  aria-label={`Remove ${file.name}`}
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
