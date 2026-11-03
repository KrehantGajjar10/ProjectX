"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ProjectDetailRead } from "@/types/project";
import type {
  RiskCategory,
  RiskItemRead,
  RiskSeverity,
  RiskSourceType,
  RiskSummaryRead,
} from "../types/risk";
import { clientGetProjectRisks, RiskClientError } from "../lib/risk-client";
import { RiskCard } from "./risk-card";
import { RiskDetailPanel } from "./risk-detail-panel";
import {
  AlertCircle,
  AlertOctagon,
  Cpu,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";

interface RisksViewProps {
  project: ProjectDetailRead;
  initialSummary?: RiskSummaryRead;
}

export function RisksView({ project, initialSummary }: RisksViewProps) {
  const [summary, setSummary] = React.useState<RiskSummaryRead>(
    initialSummary || {
      total_risks: 0,
      by_severity: {},
      by_category: {},
      by_source_type: {},
      risks: [],
    }
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [severityFilter, setSeverityFilter] = React.useState<RiskSeverity | "all">("all");
  const [categoryFilter, setCategoryFilter] = React.useState<RiskCategory | "all">("all");
  const [sourceTypeFilter, setSourceTypeFilter] = React.useState<RiskSourceType | "all">("all");

  // Selected Risk
  const [selectedRisk, setSelectedRisk] = React.useState<RiskItemRead | null>(null);

  const fetchRisks = React.useCallback(
    async (
      sev = severityFilter,
      cat = categoryFilter,
      st = sourceTypeFilter
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await clientGetProjectRisks(project.id, {
          severity: sev,
          category: cat,
          source_type: st,
        });
        setSummary(data);
      } catch (err) {
        if (err instanceof RiskClientError) {
          setError(err.message);
        } else {
          setError("Failed to load project risks.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [project.id, severityFilter, categoryFilter, sourceTypeFilter]
  );

  // Client-side text search filtering
  const displayedRisks = React.useMemo(() => {
    if (!searchQuery.trim()) return summary.risks;
    const q = searchQuery.toLowerCase().trim();
    return summary.risks.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
    );
  }, [summary.risks, searchQuery]);

  const criticalCount = summary.by_severity["critical"] || 0;
  const highCount = summary.by_severity["high"] || 0;
  const computedCount = summary.by_source_type["computed_signal"] || 0;
  const extractedCount = summary.by_source_type["extracted"] || 0;

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link
              href={`/app/projects/${project.id}`}
              className="hover:text-foreground transition-colors"
            >
              {project.name}
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Risk Radar</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Project Risk Radar & Signal Intelligence
              </h1>
              <p className="text-xs text-muted-foreground">
                Extracted documentation hazards combined with deterministic schedule and knowledge signals
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRisks()}
            disabled={isLoading}
            className="gap-2 text-xs h-9"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-primary" : ""}`}
            />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* KPI Metrics Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Risks */}
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
          <span className="text-xs font-medium text-muted-foreground">
            Total Flagged
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {summary.total_risks}
            </span>
            <span className="text-[11px] text-muted-foreground">hazards</span>
          </div>
        </div>

        {/* Critical & High */}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 shadow-2xs">
          <span className="text-xs font-medium text-destructive flex items-center gap-1">
            <AlertOctagon className="h-3.5 w-3.5" />
            Critical & High
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-destructive">
              {criticalCount + highCount}
            </span>
            <span className="text-[11px] text-destructive/80 font-mono">
              ({criticalCount} crit / {highCount} high)
            </span>
          </div>
        </div>

        {/* Computed Signals */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-2xs">
          <span className="text-xs font-medium text-primary flex items-center gap-1">
            <Cpu className="h-3.5 w-3.5" />
            Computed Signals
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary">
              {computedCount}
            </span>
            <span className="text-[11px] text-muted-foreground">
              algorithmic
            </span>
          </div>
        </div>

        {/* Document Extracted */}
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 shadow-2xs">
          <span className="text-xs font-medium text-purple-700 dark:text-purple-300 flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            Extracted Risks
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {extractedCount}
            </span>
            <span className="text-[11px] text-muted-foreground">
              documented
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-xs md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search risks by title or keyword..."
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Severity */}
          <select
            value={severityFilter}
            onChange={(e) => {
              const val = e.target.value as RiskSeverity | "all";
              setSeverityFilter(val);
              fetchRisks(val, categoryFilter, sourceTypeFilter);
            }}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              const val = e.target.value as RiskCategory | "all";
              setCategoryFilter(val);
              fetchRisks(severityFilter, val, sourceTypeFilter);
            }}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          >
            <option value="all">All Categories</option>
            <option value="extracted_risk">Extracted Risk</option>
            <option value="schedule">Schedule</option>
            <option value="ownership">Ownership</option>
            <option value="conflict">Conflict</option>
            <option value="unverified_evidence">Unverified Evidence</option>
            <option value="stale_task">Stale Task</option>
            <option value="single_point_of_knowledge">Single Point of Knowledge</option>
          </select>

          {/* Source Type */}
          <select
            value={sourceTypeFilter}
            onChange={(e) => {
              const val = e.target.value as RiskSourceType | "all";
              setSourceTypeFilter(val);
              fetchRisks(severityFilter, categoryFilter, val);
            }}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          >
            <option value="all">All Origins</option>
            <option value="extracted">Extracted from Docs</option>
            <option value="computed_signal">Computed Signal</option>
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchRisks()}
            className="h-7 text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative min-h-100">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-2xs">
            <div className="flex flex-col items-center gap-2 rounded-xl bg-card border border-border p-4 shadow-lg">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground font-medium">
                Scanning Risk Signals...
              </span>
            </div>
          </div>
        )}

        {displayedRisks.length === 0 ? (
          <div className="rounded-2xl border border-border/80 bg-card p-12 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              No Risk Signals Match Filters
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No project hazards match the selected severity, category, or search criteria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {displayedRisks.map((risk) => (
              <RiskCard
                key={risk.id}
                risk={risk}
                isSelected={selectedRisk?.id === risk.id}
                onSelect={(r) => setSelectedRisk(r)}
              />
            ))}
          </div>
        )}

        {/* Selected Risk Slide-over Panel */}
        {selectedRisk && (
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-105 max-w-full shadow-2xl">
            <RiskDetailPanel
              projectId={project.id}
              risk={selectedRisk}
              onClose={() => setSelectedRisk(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
