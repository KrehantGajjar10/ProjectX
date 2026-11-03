"use client";

import * as React from "react";
import { Filter, RefreshCw } from "lucide-react";

interface ActivityFilterBarProps {
  selectedAction: string;
  onSelectAction: (action: string) => void;
  selectedEntityType: string;
  onSelectEntityType: (entityType: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  totalCount: number;
}

export function ActivityFilterBar({
  selectedAction,
  onSelectAction,
  selectedEntityType,
  onSelectEntityType,
  onRefresh,
  isRefreshing,
  totalCount,
}: ActivityFilterBarProps) {
  const actionOptions = [
    { value: "all", label: "All Actions" },
    { value: "handover_generate", label: "Handover Generate" },
    { value: "handover_submit", label: "Handover Submit" },
    { value: "handover_approve", label: "Handover Approve" },
    { value: "handover_reject", label: "Handover Reject" },
    { value: "handover_export", label: "Handover Export" },
    { value: "member_add", label: "Member Added" },
    { value: "member_role_update", label: "Role Updated" },
    { value: "member_remove", label: "Member Removed" },
    { value: "knowledge_review", label: "Knowledge Review" },
  ];

  const entityOptions = [
    { value: "all", label: "All Entities" },
    { value: "handover_report", label: "Handover Reports" },
    { value: "project_member", label: "Project Members" },
    { value: "knowledge_item", label: "Knowledge Items" },
    { value: "task", label: "Tasks" },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
          <Filter className="h-3.5 w-3.5" />
          <span>Filters:</span>
        </div>

        {/* Action Select */}
        <select
          value={selectedAction}
          onChange={(e) => onSelectAction(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {actionOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Entity Select */}
        <select
          value={selectedEntityType}
          onChange={(e) => onSelectEntityType(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {entityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Counter & Refresh */}
      <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
        <span className="font-mono text-muted-foreground text-[11px]">
          {totalCount} {totalCount === 1 ? "audit entry" : "audit entries"}
        </span>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-card transition-colors disabled:opacity-50"
          aria-label="Refresh activity feed"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
}
