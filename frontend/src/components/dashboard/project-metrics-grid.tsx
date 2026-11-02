import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProjectDashboardSummary } from "@/types/project";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  GitPullRequestDraft,
  ListTodo,
  ShieldAlert,
} from "lucide-react";

interface ProjectMetricsGridProps {
  summary: ProjectDashboardSummary;
}

export function ProjectMetricsGrid({ summary }: ProjectMetricsGridProps) {
  const { tasks_progress } = summary;
  const percentage = Math.round(tasks_progress.completion_percentage || 0);

  const totalRisks = summary.total_risks_count || 0;
  const criticalRisksCount = summary.open_risks_by_severity?.critical || 0;
  const highRisksCount = summary.open_risks_by_severity?.high || 0;

  const totalItems = Object.values(summary.items_by_category || {}).reduce(
    (acc, cur) => acc + cur,
    0
  );

  const totalGapsAndConflicts = (summary.gaps_count || 0) + (summary.conflicts_count || 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Task Progress Card */}
      <Card className="border-border/80 bg-card shadow-xs transition-all hover:border-primary/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-mono">
            Task Execution
          </CardTitle>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ListTodo className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {percentage}%
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {tasks_progress.completed_tasks} / {tasks_progress.total_tasks} done
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>
              {tasks_progress.in_progress_tasks} in progress
            </span>
            {tasks_progress.blocked_tasks > 0 ? (
              <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                {tasks_progress.blocked_tasks} blocked
              </Badge>
            ) : (
              <span className="text-emerald font-medium">0 blocked</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Open Risks Card */}
      <Card className="border-border/80 bg-card shadow-xs transition-all hover:border-copper/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-mono">
            Open Risks
          </CardTitle>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-copper/10 text-copper">
            <ShieldAlert className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {totalRisks}
            </span>
            {criticalRisksCount > 0 ? (
              <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                {criticalRisksCount} critical
              </Badge>
            ) : highRisksCount > 0 ? (
              <Badge variant="copper" className="text-[10px] py-0 px-1.5">
                {highRisksCount} high
              </Badge>
            ) : (
              <Badge variant="emerald" className="text-[10px] py-0 px-1.5">
                Normal
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {totalRisks === 0
              ? "No architectural risks registered."
              : `${criticalRisksCount} critical, ${highRisksCount} high priority.`}
          </p>

          <div className="pt-2 text-[11px] text-muted-foreground flex items-center gap-1.5 border-t border-border/50">
            <AlertCircle className="h-3 w-3 text-copper" />
            <span>Traceable to code & pull requests</span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Knowledge Items Card */}
      <Card className="border-border/80 bg-card shadow-xs transition-all hover:border-primary/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-mono">
            Knowledge Base
          </CardTitle>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileSearch className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {totalItems}
            </span>
            {summary.unreviewed_items_count > 0 ? (
              <Badge variant="copper" className="text-[10px] py-0 px-1.5">
                {summary.unreviewed_items_count} unreviewed
              </Badge>
            ) : (
              <Badge variant="emerald" className="text-[10px] py-0 px-1.5">
                Verified
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {summary.unreviewed_items_count === 0
              ? "All knowledge entries reviewed."
              : `${summary.unreviewed_items_count} items require engineer review.`}
          </p>

          <div className="pt-2 text-[11px] text-muted-foreground flex items-center gap-1.5 border-t border-border/50">
            <CheckCircle2 className="h-3 w-3 text-primary" />
            <span>Evidence-grounded claims</span>
          </div>
        </CardContent>
      </Card>

      {/* 4. Gaps & Conflicts Card */}
      <Card className="border-border/80 bg-card shadow-xs transition-all hover:border-violet/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-mono">
            Gaps & Conflicts
          </CardTitle>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet/10 text-violet">
            <GitPullRequestDraft className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {totalGapsAndConflicts}
            </span>
            {totalGapsAndConflicts > 0 ? (
              <Badge variant="violet" className="text-[10px] py-0 px-1.5">
                Needs Attention
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                Consistent
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {summary.gaps_count} knowledge gaps • {summary.conflicts_count} contradictory claims.
          </p>

          <div className="pt-2 text-[11px] text-muted-foreground flex items-center gap-1.5 border-t border-border/50">
            <AlertTriangle className="h-3 w-3 text-violet" />
            <span>Highlights ambiguities before handoff</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
