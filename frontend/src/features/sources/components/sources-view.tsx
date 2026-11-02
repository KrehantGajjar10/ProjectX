"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SourceCard } from "@/features/sources/components/source-card";
import { SourceUploadDialog } from "@/features/sources/components/source-upload-dialog";
import { DeleteSourceDialog } from "@/features/sources/components/delete-source-dialog";
import { fetchSourcesClient } from "@/features/sources/lib/sources-client";
import {
  formatFileSize,
  type SourceRead,
  type UploadFileDetail,
} from "@/features/sources/types/source";
import type { ProjectDetailRead } from "@/types/project";
import {
  ArrowLeft,
  CheckCircle2,
  FileCode,
  FileText,
  Files,
  FolderPlus,
  HardDrive,
  RefreshCw,
  Search,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";

interface SourcesViewProps {
  project: ProjectDetailRead;
  initialSources: SourceRead[];
}

function extractFilesFromSource(source: SourceRead): UploadFileDetail[] {
  if (!source?.config) return [];
  const cfg =
    typeof source.config === "string"
      ? (() => {
          try {
            return JSON.parse(source.config);
          } catch {
            return {};
          }
        })()
      : source.config;
  return Array.isArray(cfg?.files) ? cfg.files : [];
}

export function SourcesView({ project, initialSources }: SourcesViewProps) {
  const router = useRouter();
  const [sources, setSources] = React.useState<SourceRead[]>(initialSources);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [sourceToDelete, setSourceToDelete] = React.useState<SourceRead | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deleteSuccessNotice, setDeleteSuccessNotice] = React.useState<string | null>(null);

  // Compute stats across all sources
  const totalFiles = React.useMemo(() => {
    return sources.reduce((acc, s) => {
      const files = extractFilesFromSource(s);
      return acc + files.length;
    }, 0);
  }, [sources]);

  const totalBytes = React.useMemo(() => {
    return sources.reduce((acc, s) => {
      const files = extractFilesFromSource(s);
      return acc + files.reduce((fAcc, f) => fAcc + (f.size || 0), 0);
    }, 0);
  }, [sources]);

  const refreshSources = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const refreshed = await fetchSourcesClient(project.id);
      setSources(refreshed);
      router.refresh();
    } catch (err) {
      console.error("Failed to refresh sources:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [project.id, router]);

  const handleUploadSuccess = () => {
    // Treat backend as authoritative persisted state: fetch fresh sources list
    refreshSources();
  };

  const handleDeleteClick = (source: SourceRead) => {
    setSourceToDelete(source);
    setIsDeleteDialogOpen(true);
  };

  const handleSourceDeleted = (sourceId: string) => {
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
    setDeleteSuccessNotice("Knowledge source deleted successfully.");
    refreshSources();
    setTimeout(() => {
      setDeleteSuccessNotice(null);
    }, 5000);
  };

  const filteredSources = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sources;

    return sources.filter((s) => {
      if (s.name.toLowerCase().includes(q)) return true;
      if (s.type.toLowerCase().includes(q)) return true;
      if (s.config?.repo_url?.toLowerCase().includes(q)) return true;

      const files = extractFilesFromSource(s);
      return files.some(
        (f) =>
          f.filename.toLowerCase().includes(q) ||
          (f.mime_type && f.mime_type.toLowerCase().includes(q))
      );
    });
  }, [sources, searchQuery]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-border/80 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              href={`/app/projects/${project.id}`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>{project.name}</span>
            </Link>
            <span className="text-muted-foreground/60 text-xs">/</span>
            <span className="text-xs font-semibold text-primary font-mono">
              Sources
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Knowledge Sources
            </h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-mono font-medium text-primary">
              {sources.length} {sources.length === 1 ? "source" : "sources"}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
            Upload specifications, architecture RFCs, meeting notes, and documentation. All project handover claims and architectural decisions are grounded in these verified sources.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => refreshSources()}
            disabled={isRefreshing}
            aria-label="Refresh sources list"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin text-primary" : ""}`}
            />
          </button>

          <Button
            onClick={() => setUploadDialogOpen(true)}
            className="gap-2 font-medium"
          >
            <UploadCloud className="h-4 w-4" />
            Upload Documents
          </Button>
        </div>
      </div>

      {/* Deletion Feedback Banner */}
      {deleteSuccessNotice && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald/30 bg-emerald/10 p-3.5 text-xs text-emerald animate-in fade-in-50"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-medium">{deleteSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteSuccessNotice(null)}
            className="text-emerald hover:opacity-80 p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald"
            aria-label="Dismiss message"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-xl border border-border/80 bg-card p-3.5 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Connected Sources
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">
              {sources.length}
            </div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Files className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3.5 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Stored Documents
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">
              {totalFiles}
            </div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet/10 text-violet">
            <FileText className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3.5 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Total Storage
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">
              {formatFileSize(totalBytes)}
            </div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-copper/10 text-copper">
            <HardDrive className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {sources.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-surface/40 p-8 sm:p-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 shadow-2xs">
            <FolderPlus className="h-7 w-7" />
          </div>

          <h2 className="text-lg font-semibold text-foreground">
            No knowledge sources connected
          </h2>

          <p className="mt-1.5 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Attach your engineering specifications, design docs, or architectural decisions to anchor the project knowledge graph to verifiable evidence.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={() => setUploadDialogOpen(true)}
              className="gap-2 font-medium"
            >
              <UploadCloud className="h-4 w-4" />
              Upload Documents
            </Button>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="rounded-lg border border-border/60 bg-card p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Documentation
              </div>
              <p className="text-[11px] text-muted-foreground">
                Upload Markdown, PDF, DOCX, and PPTX technical specs.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-card p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <FileCode className="h-3.5 w-3.5 text-violet" />
                Codebase Configs
              </div>
              <p className="text-[11px] text-muted-foreground">
                Attach YAML, JSON, TS, and Python architecture schemas.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-card p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-copper" />
                Evidence Links
              </div>
              <p className="text-[11px] text-muted-foreground">
                Every claim in handovers links directly back to these sources.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Sources Grid / List */
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search sources or file names..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-xs sm:text-sm text-foreground shadow-2xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {filteredSources.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No sources or files matched &ldquo;{searchQuery}&rdquo;.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  filterQuery={searchQuery}
                  onDeleteClick={handleDeleteClick}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Dialog */}
      <SourceUploadDialog
        projectId={project.id}
        isOpen={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Delete Source Dialog */}
      <DeleteSourceDialog
        projectId={project.id}
        source={sourceToDelete}
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onDeleted={handleSourceDeleted}
      />
    </div>
  );
}
