"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatFileSize,
  type SourceRead,
  type UploadFileDetail,
} from "@/features/sources/types/source";
import { getFileIcon } from "@/features/sources/components/selected-file-list";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  FolderGit2,
  GitBranch,
  HardDrive,
  Trash2,
  Upload,
} from "lucide-react";

interface SourceCardProps {
  source: SourceRead;
  filterQuery?: string;
  onDeleteClick?: (source: SourceRead) => void;
}

export function SourceCard({
  source,
  filterQuery = "",
  onDeleteClick,
}: SourceCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  const formattedDate = new Date(source.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const parsedConfig = React.useMemo(() => {
    if (!source.config) return {};
    if (typeof source.config === "string") {
      try {
        return JSON.parse(source.config);
      } catch {
        return {};
      }
    }
    return source.config;
  }, [source.config]);

  const files: UploadFileDetail[] = React.useMemo(() => {
    return Array.isArray(parsedConfig?.files) ? parsedConfig.files : [];
  }, [parsedConfig]);

  const totalSizeBytes = React.useMemo(
    () => files.reduce((acc, f) => acc + (f.size || 0), 0),
    [files]
  );

  const filteredFiles = React.useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return files;
    return files.filter(
      (f) =>
        f.filename.toLowerCase().includes(q) ||
        (f.mime_type && f.mime_type.toLowerCase().includes(q))
    );
  }, [files, filterQuery]);

  const isUploadType = source.type === "upload";

  return (
    <Card className="border-border/80 bg-card shadow-xs transition-all duration-200 hover:border-primary/40 space-y-0">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {isUploadType ? (
                <Upload className="h-5 w-5" />
              ) : (
                <FolderGit2 className="h-5 w-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-foreground">
                  {source.name}
                </CardTitle>
                <Badge
                  variant={isUploadType ? "emerald" : "violet"}
                  className="text-[10px] uppercase font-mono tracking-wider"
                >
                  {source.type}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground font-mono">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formattedDate}
                </span>

                {isUploadType && (
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3" />
                    {files.length} {files.length === 1 ? "file" : "files"} ({formatFileSize(totalSizeBytes)})
                  </span>
                )}

                {parsedConfig?.repo_url && (
                  <span className="flex items-center gap-1 text-violet font-semibold">
                    <GitBranch className="h-3 w-3" />
                    {parsedConfig.branch || "main"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {isUploadType && files.length > 0 && (
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md border border-border/60 bg-surface/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>{isExpanded ? "Hide files" : `Show all (${files.length})`}</span>
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            )}

            {onDeleteClick && (
              <button
                type="button"
                onClick={() => onDeleteClick(source)}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border/60 bg-surface/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Delete source"
                aria-label={`Delete ${source.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {/* For Upload Sources */}
        {isUploadType && (
          <div>
            {files.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No files uploaded to this source yet.
              </p>
            ) : isExpanded ? (
              <div className="space-y-1.5">
                {filteredFiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    No files matched &ldquo;{filterQuery}&rdquo;.
                  </p>
                ) : (
                  filteredFiles.map((file, idx) => (
                    <div
                      key={`${file.storage_path || file.filename}-${idx}`}
                      className="flex items-center justify-between rounded-lg border border-border/70 bg-surface/40 p-2.5 text-xs transition-colors hover:bg-surface/80"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 mr-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-card border border-border/60">
                          {getFileIcon(file.filename)}
                        </div>

                        <div className="truncate">
                          <span className="font-medium text-foreground truncate block">
                            {file.filename}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono truncate block">
                            {file.storage_path}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-right">
                        <span className="rounded bg-card px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border/60">
                          {file.mime_type.split("/")[1] || file.mime_type}
                        </span>

                        <span className="font-mono text-[11px] font-medium text-foreground min-w-[55px]">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {files.length} document(s) stored ({formatFileSize(totalSizeBytes)}). Click &ldquo;Show all&rdquo; to inspect individual files.
              </p>
            )}
          </div>
        )}

        {/* For GitHub Sources */}
        {!isUploadType && parsedConfig?.repo_url && (
          <div className="rounded-lg border border-border/70 bg-surface/40 p-3 text-xs space-y-1 font-mono">
            <div className="text-muted-foreground">Repository URL:</div>
            <div className="text-foreground font-semibold truncate">
              {parsedConfig.repo_url}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
