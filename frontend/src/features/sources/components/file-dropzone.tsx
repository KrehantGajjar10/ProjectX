"use client";

import * as React from "react";
import { ALLOWED_UPLOAD_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES } from "@/features/sources/types/source";
import { cn } from "@/lib/utils";
import { FileUp, UploadCloud } from "lucide-react";

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function FileDropzone({ onFilesSelected, disabled }: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      onFilesSelected(droppedFiles);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      onFilesSelected(selected);
      // Reset input value so same files can be re-selected if removed
      e.target.value = "";
    }
  };

  const openFilePicker = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openFilePicker}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFilePicker();
        }
      }}
      aria-label="Upload documents dropzone. Click or drag files to upload."
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 select-none",
        isDragOver
          ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20"
          : "border-border/80 bg-surface/40 hover:border-primary/50 hover:bg-surface/80",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_UPLOAD_EXTENSIONS.join(",")}
        onChange={handleFileInputChange}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
      />

      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-200 shadow-2xs mb-3",
          isDragOver
            ? "scale-110 bg-primary text-primary-foreground"
            : "bg-primary/10 text-primary"
        )}
      >
        {isDragOver ? (
          <FileUp className="h-6 w-6 animate-bounce" />
        ) : (
          <UploadCloud className="h-6 w-6" />
        )}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {isDragOver ? "Drop files to stage for upload" : "Drag & drop project documents here"}
        </p>
        <p className="text-xs text-muted-foreground">
          or <span className="text-primary font-medium underline underline-offset-2">browse your computer</span> to select multiple files
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-muted-foreground/80 font-mono">
        <span className="rounded bg-surface px-1.5 py-0.5 border border-border/60">
          PDF, Markdown, DOCX, PPTX
        </span>
        <span className="rounded bg-surface px-1.5 py-0.5 border border-border/60">
          TS, JS, PY, JSON, YAML
        </span>
        <span className="rounded bg-surface px-1.5 py-0.5 border border-border/60 font-semibold text-foreground/80">
          Max {MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB / file
        </span>
      </div>
    </div>
  );
}
