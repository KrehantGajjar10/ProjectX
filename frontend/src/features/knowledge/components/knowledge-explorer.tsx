"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import type {
  KnowledgeCategory,
  KnowledgeFilterOptions,
  KnowledgeItemDetailRead,
  KnowledgeItemRead,
  KnowledgeOrigin,
  KnowledgeReviewStatus,
} from "../types/knowledge";
import type { ProjectDetailRead } from "@/types/project";
import { KNOWLEDGE_CATEGORIES } from "../lib/knowledge-utils";
import { KnowledgeCard } from "./knowledge-card";
import { KnowledgeDetailView } from "./knowledge-detail-view";
import { fetchKnowledgeListClient } from "../lib/knowledge-client";
import {
  listIngestionJobsClient,
  getIngestionJobStatusClient,
} from "@/features/sources/lib/sources-client";
import type { IngestionJobRead } from "@/features/sources/types/ingestion";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Layers,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

interface KnowledgeExplorerProps {
  project: ProjectDetailRead;
  initialItems: KnowledgeItemRead[];
}

export function KnowledgeExplorer({
  project,
  initialItems,
}: KnowledgeExplorerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = React.useState<KnowledgeItemRead[]>(initialItems);
  const [selectedCategory, setSelectedCategory] = React.useState<
    KnowledgeCategory | "all"
  >("all");
  const [selectedStatus, setSelectedStatus] = React.useState<
    KnowledgeReviewStatus | "all"
  >("all");
  const [selectedOrigin, setSelectedOrigin] = React.useState<
    KnowledgeOrigin | "all"
  >("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const itemIdParam = searchParams.get("item");
  const [selectedItem, setSelectedItem] = React.useState<KnowledgeItemRead | null>(() => {
    if (itemIdParam) {
      return initialItems.find((i) => i.id === itemIdParam) || null;
    }
    return null;
  });

  const [prevItemIdParam, setPrevItemIdParam] = React.useState(itemIdParam);
  if (itemIdParam !== prevItemIdParam) {
    setPrevItemIdParam(itemIdParam);
    if (itemIdParam) {
      const match = items.find((i) => i.id === itemIdParam);
      if (match) {
        setSelectedItem(match);
      }
    }
  }
  const [activeJob, setActiveJob] = React.useState<IngestionJobRead | null>(null);

  // Check for active ingestion jobs on mount
  React.useEffect(() => {
    let isMounted = true;
    const checkJobs = async () => {
      try {
        const jobs = await listIngestionJobsClient(project.id);
        const running = jobs.find(
          (j) => j.status === "queued" || j.status === "processing"
        );
        if (isMounted && running) {
          setActiveJob(running);
        }
      } catch {
        // ignore background poll errors
      }
    };
    checkJobs();
    return () => {
      isMounted = false;
    };
  }, [project.id]);



  const refreshList = React.useCallback(
    async (overrideFilters?: Partial<KnowledgeFilterOptions>) => {
      setIsRefreshing(true);
      try {
        const filters: KnowledgeFilterOptions = {
          category: overrideFilters?.category ?? selectedCategory,
          review_status: overrideFilters?.review_status ?? selectedStatus,
          origin: overrideFilters?.origin ?? selectedOrigin,
          q: overrideFilters?.q ?? searchQuery,
        };
        const fetched = await fetchKnowledgeListClient(project.id, filters);
        setItems(fetched);
        router.refresh();
      } catch (err) {
        console.error("Failed to refresh knowledge list:", err);
      } finally {
        setIsRefreshing(false);
      }
    },
    [project.id, selectedCategory, selectedStatus, selectedOrigin, searchQuery, router]
  );

  // Poll active ingestion job if running
  React.useEffect(() => {
    if (!activeJob || (activeJob.status !== "queued" && activeJob.status !== "processing")) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updated = await getIngestionJobStatusClient(project.id, activeJob.id);
        if (updated) {
          setActiveJob(updated);
          if (updated.status === "completed") {
            // Ingestion complete! Refresh knowledge list
            refreshList();
          }
        }
      } catch {
        // ignore background poll errors
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeJob, project.id, refreshList]);

  // Stats
  const totalApproved = React.useMemo(
    () => items.filter((i) => i.review_status === "approved").length,
    [items]
  );
  const totalPending = React.useMemo(
    () => items.filter((i) => i.review_status === "pending").length,
    [items]
  );
  const totalEvidenceExcerpts = React.useMemo(
    () => items.reduce((acc, i) => acc + (i.evidences?.length || 0), 0),
    [items]
  );

  // Filter items in client for instant typing response while keeping server params aligned
  const filteredItems = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      if (selectedStatus !== "all" && item.review_status !== selectedStatus) {
        return false;
      }
      if (selectedOrigin !== "all" && item.origin !== selectedOrigin) {
        return false;
      }
      if (q) {
        const titleMatch = item.title.toLowerCase().includes(q);
        const descMatch = item.description.toLowerCase().includes(q);
        const evidenceMatch = item.evidences?.some((e) =>
          e.exact_excerpt.toLowerCase().includes(q)
        );
        if (!titleMatch && !descMatch && !evidenceMatch) return false;
      }
      return true;
    });
  }, [items, selectedCategory, selectedStatus, selectedOrigin, searchQuery]);

  const handleItemUpdated = (updated: KnowledgeItemDetailRead) => {
    setItems((prev) =>
      prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i))
    );
    if (selectedItem?.id === updated.id) {
      setSelectedItem(updated);
    }
  };

  const clearAllFilters = () => {
    setSelectedCategory("all");
    setSelectedStatus("all");
    setSelectedOrigin("all");
    setSearchQuery("");
  };

  const hasActiveFilters =
    selectedCategory !== "all" ||
    selectedStatus !== "all" ||
    selectedOrigin !== "all" ||
    Boolean(searchQuery.trim());

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
              Knowledge
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Knowledge & Verification
            </h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-mono font-medium text-primary">
              {items.length} {items.length === 1 ? "record" : "records"}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
            Evidence-grounded project knowledge extracted from specifications, meeting notes, and architecture decisions. Each claim is traced directly to verifiable source excerpts.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => refreshList()}
            disabled={isRefreshing}
            aria-label="Refresh knowledge records"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin text-primary" : ""}`}
            />
          </button>

          <Link
            href={`/app/projects/${project.id}/sources`}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-surface transition-colors"
          >
            <LinkIcon className="h-3.5 w-3.5 text-primary" />
            Manage Sources
          </Link>
        </div>
      </div>

      {/* Active Ingestion Notification Banner */}
      {activeJob && (
        <div
          role="status"
          className={`rounded-xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
            activeJob.status === "failed"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-primary/30 bg-primary/10 text-primary"
          }`}
        >
          <div className="flex items-center gap-3">
            {activeJob.status === "failed" ? (
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            ) : (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            )}
            <div>
              <div className="font-semibold text-foreground">
                {activeJob.status === "failed"
                  ? "Ingestion Job Failed"
                  : `Ingestion in Progress (${activeJob.status.toUpperCase()} • ${activeJob.progress}%)`}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {activeJob.status === "failed"
                  ? activeJob.error || "The background ingestion worker encountered an error while processing documents."
                  : "Documents are currently being parsed and knowledge claims extracted with grounded evidence. When finished, records will automatically appear here."}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {activeJob.status !== "failed" && (
              <div className="w-24 bg-card/60 rounded-full h-2 overflow-hidden border border-border">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${Math.max(activeJob.progress, 5)}%` }}
                />
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refreshList()}
              disabled={isRefreshing}
              className="text-xs h-7"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
              Check Status
            </Button>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-border/80 bg-card p-3.5 flex items-center justify-between shadow-2xs">
          <div className="space-y-0.5">
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Total Knowledge
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">
              {items.length}
            </div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Layers className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3.5 flex items-center justify-between shadow-2xs">
          <div className="space-y-0.5">
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Approved
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">
              {totalApproved}
            </div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <CheckCircle2 className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3.5 flex items-center justify-between shadow-2xs">
          <div className="space-y-0.5">
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Pending Review
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">
              {totalPending}
            </div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-copper/15 text-copper">
            <Clock className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3.5 flex items-center justify-between shadow-2xs">
          <div className="space-y-0.5">
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Source Excerpts
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">
              {totalEvidenceExcerpts}
            </div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet/10 text-violet">
            <LinkIcon className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
              selectedCategory === "all"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-surface"
            }`}
          >
            All Categories
          </button>
          {KNOWLEDGE_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setSelectedCategory(cat.value)}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat.value
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-surface"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Sub-filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search knowledge title, description, or excerpt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-xs sm:text-sm text-foreground shadow-2xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status & Origin Selectors */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) =>
                setSelectedStatus(e.target.value as KnowledgeReviewStatus | "all")
              }
              aria-label="Filter by verification status"
              className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Status: All</option>
              <option value="pending">Status: Pending Review</option>
              <option value="approved">Status: Approved</option>
              <option value="rejected">Status: Rejected</option>
            </select>

            {/* Origin Filter */}
            <select
              value={selectedOrigin}
              onChange={(e) =>
                setSelectedOrigin(e.target.value as KnowledgeOrigin | "all")
              }
              aria-label="Filter by knowledge origin"
              className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Origin: All</option>
              <option value="explicit_fact">Explicit Facts</option>
              <option value="ai_inference">AI Inferences</option>
            </select>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Knowledge Items Grid / Empty State */}
      {items.length === 0 ? (
        /* Zero knowledge items in project */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-surface/40 p-8 sm:p-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 shadow-2xs">
            {activeJob && activeJob.status !== "failed" ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <Layers className="h-7 w-7" />
            )}
          </div>

          <h2 className="text-lg font-semibold text-foreground">
            {activeJob && activeJob.status !== "failed"
              ? "Synthesizing project knowledge..."
              : "No knowledge records in this project yet"}
          </h2>

          <p className="mt-1.5 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {activeJob && activeJob.status !== "failed"
              ? `Ingestion job is currently ${activeJob.status} (${activeJob.progress}%). The pipeline is processing document chunks and extracting evidence-grounded knowledge.`
              : "Knowledge records are synthesized and linked to grounded source evidence during the source ingestion process. Attach engineering specs or notes in Sources to generate knowledge."}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {activeJob && activeJob.status !== "failed" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refreshList()}
                disabled={isRefreshing}
                className="text-xs"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-1.5 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />
                Refresh Knowledge
              </Button>
            ) : (
              <Link
                href={`/app/projects/${project.id}/sources`}
                className="inline-flex items-center gap-2 font-medium text-xs rounded-lg bg-primary text-primary-foreground px-4 py-2 hover:bg-primary/90 transition-colors"
              >
                <LinkIcon className="h-4 w-4" />
                Upload Project Sources
              </Link>
            )}
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        /* Filters produced 0 results */
        <div className="rounded-xl border border-border bg-card/60 p-10 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            No knowledge items matched your current search or filter criteria.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        /* Grid of Knowledge Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <KnowledgeCard
              key={item.id}
              item={item}
              onClick={(it) => setSelectedItem(it)}
            />
          ))}
        </div>
      )}

      {/* Detail Slide-Over / Modal Viewer */}
      {selectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-background/80 backdrop-blur-xs animate-in fade-in-0 duration-200"
        >
          <div
            className="fixed inset-0"
            onClick={() => setSelectedItem(null)}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-5">
              <span className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                Knowledge Detail & Evidence Inspection
              </span>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
                aria-label="Close detail modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <KnowledgeDetailView
              projectId={project.id}
              project={project}
              initialItem={selectedItem}
              onBack={() => setSelectedItem(null)}
              onItemUpdated={handleItemUpdated}
              showBackToExplorerButton={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
