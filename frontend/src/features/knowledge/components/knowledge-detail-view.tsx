"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type {
  KnowledgeItemDetailRead,
  KnowledgeItemRead,
} from "../types/knowledge";
import type { ProjectDetailRead } from "@/types/project";
import {
  formatConfidence,
  getCategoryBadgeVariant,
  getCategoryLabel,
  getConfidenceBadgeColor,
  getOriginLabel,
  getReviewStatusBadgeVariant,
  getReviewStatusLabel,
} from "../lib/knowledge-utils";
import { EvidenceViewer } from "./evidence-viewer";
import { ReviewControls } from "./review-controls";
import { fetchKnowledgeDetailClient } from "../lib/knowledge-client";
import {
  ArrowLeft,
  Calendar,
  GitFork,
  ListTodo,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";

interface KnowledgeDetailViewProps {
  projectId: string;
  project?: ProjectDetailRead | null;
  initialItem: KnowledgeItemRead | KnowledgeItemDetailRead;
  onBack?: () => void;
  onItemUpdated?: (updated: KnowledgeItemDetailRead) => void;
  showBackToExplorerButton?: boolean;
}

export function KnowledgeDetailView({
  projectId,
  project,
  initialItem,
  onBack,
  onItemUpdated,
  showBackToExplorerButton = true,
}: KnowledgeDetailViewProps) {
  const [item, setItem] = React.useState<KnowledgeItemDetailRead>(
    "tasks" in initialItem
      ? (initialItem as KnowledgeItemDetailRead)
      : {
          ...initialItem,
          tasks: [],
          source_dependencies: [],
          target_dependencies: [],
        }
  );
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(
    !("tasks" in initialItem) || !initialItem.tasks
  );

  // Sync state if initialItem changes from parent during render
  const [prevItemId, setPrevItemId] = React.useState(initialItem.id);
  if (initialItem.id !== prevItemId) {
    setPrevItemId(initialItem.id);
    setItem(
      "tasks" in initialItem && initialItem.tasks
        ? (initialItem as KnowledgeItemDetailRead)
        : {
            ...initialItem,
            tasks: [],
            source_dependencies: [],
            target_dependencies: [],
          }
    );
    setIsLoadingDetail(!("tasks" in initialItem) || !initialItem.tasks);
  }

  // If initialItem is only KnowledgeItemRead, fetch full detail (tasks, dependencies) in background
  React.useEffect(() => {
    let isMounted = true;
    if (!("tasks" in initialItem) || !initialItem.tasks) {
      fetchKnowledgeDetailClient(projectId, initialItem.id)
        .then((detail) => {
          if (isMounted) {
            setItem(detail);
          }
        })
        .catch((err) => {
          console.warn("Could not load full detail for knowledge item:", err);
        })
        .finally(() => {
          if (isMounted) {
            setIsLoadingDetail(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [projectId, initialItem]);

  const handleReviewSuccess = (updatedItem: KnowledgeItemDetailRead) => {
    setItem(updatedItem);
    onItemUpdated?.(updatedItem);
  };

  const formattedCreatedDate = new Date(item.created_at).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  const isAiInference = item.origin === "ai_inference";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Navigation & Header */}
      <div className="space-y-3">
        {showBackToExplorerButton && (
          <div className="flex items-center gap-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Return to Knowledge Explorer</span>
              </button>
            ) : (
              <Link
                href={`/app/projects/${projectId}/knowledge`}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
              >
                <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Return to Knowledge Explorer</span>
              </Link>
            )}
          </div>
        )}

        {/* Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-b border-border/70 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={getCategoryBadgeVariant(item.category)}
              className="text-xs uppercase font-mono tracking-wider px-2.5 py-0.5 font-semibold"
            >
              {getCategoryLabel(item.category)}
            </Badge>

            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-mono border ${
                isAiInference
                  ? "border-violet/30 bg-violet/10 text-violet"
                  : "border-primary/30 bg-primary/10 text-primary"
              }`}
            >
              {isAiInference ? (
                <Sparkles className="h-3 w-3" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              {getOriginLabel(item.origin)}
            </span>

            <Badge
              variant={getReviewStatusBadgeVariant(item.review_status)}
              className="text-xs font-mono uppercase tracking-wider"
            >
              {getReviewStatusLabel(item.review_status)}
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span
              className={`rounded-md px-2 py-0.5 font-medium border ${getConfidenceBadgeColor(
                item.confidence
              )}`}
              title={`Confidence metric: ${item.confidence}`}
            >
              Confidence: {formatConfidence(item.confidence)}
            </span>

            <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
              <Calendar className="h-3 w-3" />
              {formattedCreatedDate}
            </span>

            {isLoadingDetail && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug pt-1">
          {item.title}
        </h1>
      </div>

      {/* Description / Summary Section */}
      <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 space-y-2.5 shadow-xs">
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground uppercase tracking-wider">
          <span className="font-semibold">Knowledge Description & Synthesis</span>
          {isAiInference && (
            <span className="text-violet font-normal flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> AI Extracted
            </span>
          )}
        </div>
        <p className="text-sm text-foreground/95 leading-relaxed whitespace-pre-wrap">
          {item.description}
        </p>
      </div>

      {/* Evidence Viewer Section */}
      <EvidenceViewer evidences={item.evidences || []} />

      {/* Linked Tasks (if any) */}
      {item.tasks && item.tasks.length > 0 && (
        <div className="rounded-xl border border-border/80 bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              Linked Tasks ({item.tasks.length})
            </h4>
          </div>

          <div className="space-y-2">
            {item.tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-lg border border-border/70 bg-surface/50 p-3 text-xs"
              >
                <div>
                  <span className="font-semibold text-foreground">
                    {task.title}
                  </span>
                  {task.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {task.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {task.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {task.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked Dependencies (if any) */}
      {((item.source_dependencies && item.source_dependencies.length > 0) ||
        (item.target_dependencies && item.target_dependencies.length > 0)) && (
        <div className="rounded-xl border border-border/80 bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2">
            <GitFork className="h-4 w-4 text-violet" />
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              Knowledge Dependencies
            </h4>
          </div>

          <div className="space-y-2 text-xs">
            {item.source_dependencies?.map((dep) => (
              <div
                key={dep.id}
                className="rounded-lg border border-border/60 bg-surface/50 p-2.5 flex items-center justify-between"
              >
                <span className="text-muted-foreground">
                  Upstream relation: <strong className="text-foreground">{dep.type}</strong>
                </span>
                {dep.evidence_text && (
                  <span className="italic text-muted-foreground font-mono text-[11px]">
                    &ldquo;{dep.evidence_text}&rdquo;
                  </span>
                )}
              </div>
            ))}
            {item.target_dependencies?.map((dep) => (
              <div
                key={dep.id}
                className="rounded-lg border border-border/60 bg-surface/50 p-2.5 flex items-center justify-between"
              >
                <span className="text-muted-foreground">
                  Downstream dependency: <strong className="text-foreground">{dep.type}</strong>
                </span>
                {dep.evidence_text && (
                  <span className="italic text-muted-foreground font-mono text-[11px]">
                    &ldquo;{dep.evidence_text}&rdquo;
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviewer Verification Controls */}
      <ReviewControls
        projectId={projectId}
        item={item}
        userRole={project?.my_role}
        onReviewSuccess={handleReviewSuccess}
      />
    </div>
  );
}
