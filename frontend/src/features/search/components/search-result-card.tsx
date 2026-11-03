"use client";

import * as React from "react";
import Link from "next/link";
import type { SearchResultItem } from "../types/search";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Layers,
} from "lucide-react";

interface SearchResultCardProps {
  item: SearchResultItem;
  projectId: string;
}

export function SearchResultCard({ item, projectId }: SearchResultCardProps) {
  const getCategoryTheme = (cat: string | null) => {
    switch (cat) {
      case "decision":
        return {
          bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          label: "Decision",
        };
      case "task":
        return {
          bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          label: "Task",
        };
      case "risk":
        return {
          bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          label: "Risk",
        };
      case "milestone":
        return {
          bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
          label: "Milestone",
        };
      case "insight":
        return {
          bg: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
          label: "Insight",
        };
      default:
        return {
          bg: "bg-muted text-muted-foreground border-border",
          label: "Document",
        };
    }
  };

  const theme = getCategoryTheme(item.category);
  const isKnowledgeItem = item.entity_type === "knowledge_item";
  const relevancePct = Math.min(100, Math.max(0, Math.round(item.score * 100)));

  const locationPage =
    typeof item.location_info?.page === "number"
      ? `Page ${item.location_info.page}`
      : null;

  return (
    <div className="group rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs hover:border-primary/40 hover:shadow-sm transition-all duration-150">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {/* Entity Type Pill */}
          <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground border border-border/60">
            {isKnowledgeItem ? (
              <Layers className="h-3 w-3 text-primary" />
            ) : (
              <FileText className="h-3 w-3 text-copper" />
            )}
            {isKnowledgeItem ? "Knowledge Item" : "Source Chunk"}
          </span>

          {/* Category Badge */}
          {item.category && (
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${theme.bg}`}
            >
              {theme.label}
            </span>
          )}

          {/* Verified Badge */}
          {item.verified && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
              <CheckCircle2 className="h-3 w-3" />
              Verified
            </span>
          )}
        </div>

        {/* Relevance Score */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span>Relevance:</span>
          <span className="font-semibold text-foreground">
            {item.score > 1 ? item.score.toFixed(2) : `${relevancePct}%`}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
        {item.title}
      </h3>

      {/* Content / Excerpt snippet */}
      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-3">
        {item.content}
      </p>

      {/* Footer / Locators and Links */}
      <div className="mt-3.5 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 truncate max-w-[80%] font-mono text-[11px]">
          {item.file_path && (
            <span className="truncate" title={item.file_path}>
              {item.file_path}
            </span>
          )}
          {locationPage && (
            <span className="text-muted-foreground/80">• {locationPage}</span>
          )}
        </div>

        <div>
          {item.knowledge_item_id ? (
            <Link
              href={`/app/projects/${projectId}/knowledge?item=${item.knowledge_item_id}`}
              className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-xs"
            >
              Inspect Knowledge
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : (
            <Link
              href={`/app/projects/${projectId}/sources`}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium text-xs"
            >
              View Sources
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
