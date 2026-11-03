"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { TaskProgressSummary } from "../types/task";
import {
  AlertOctagon,
  AlertTriangle,
  UserX,
} from "lucide-react";

interface TaskProgressCardProps {
  progress: TaskProgressSummary;
}

export function TaskProgressCard({ progress }: TaskProgressCardProps) {
  const percentage = Math.min(Math.max(progress.completion_percentage, 0), 100);

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
      {/* Top row: Completion rate & KPI counts */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Project Execution Velocity
            </span>
            <Badge variant="secondary" className="font-mono text-xs">
              {progress.total_tasks} Total Tasks
            </Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-foreground tracking-tight">
              {percentage}%
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              Completed ({progress.completed_tasks} / {progress.total_tasks})
            </span>
          </div>
        </div>

        {/* Warning Indicators (Overdue & Unassigned) */}
        <div className="flex flex-wrap items-center gap-2">
          {progress.overdue_tasks > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{progress.overdue_tasks} Overdue</span>
            </div>
          )}

          {progress.blocked_tasks > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <AlertOctagon className="h-3.5 w-3.5" />
              <span>{progress.blocked_tasks} Blocked</span>
            </div>
          )}

          {progress.unassigned_tasks > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
              <UserX className="h-3.5 w-3.5" />
              <span>{progress.unassigned_tasks} Unassigned</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="h-2.5 w-full rounded-full bg-muted/60 overflow-hidden flex">
          {progress.completed_tasks > 0 && (
            <div
              style={{
                width: `${(progress.completed_tasks / progress.total_tasks) * 100}%`,
              }}
              className="bg-emerald-500 transition-all duration-300"
              title={`Completed: ${progress.completed_tasks}`}
            />
          )}
          {progress.in_progress_tasks > 0 && (
            <div
              style={{
                width: `${(progress.in_progress_tasks / progress.total_tasks) * 100}%`,
              }}
              className="bg-blue-500 transition-all duration-300"
              title={`In Progress: ${progress.in_progress_tasks}`}
            />
          )}
          {progress.blocked_tasks > 0 && (
            <div
              style={{
                width: `${(progress.blocked_tasks / progress.total_tasks) * 100}%`,
              }}
              className="bg-amber-500 transition-all duration-300"
              title={`Blocked: ${progress.blocked_tasks}`}
            />
          )}
          {progress.todo_tasks > 0 && (
            <div
              style={{
                width: `${(progress.todo_tasks / progress.total_tasks) * 100}%`,
              }}
              className="bg-zinc-400/50 dark:bg-zinc-600/50 transition-all duration-300"
              title={`To Do: ${progress.todo_tasks}`}
            />
          )}
        </div>
      </div>

      {/* Status Breakdown Pills */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 pt-1 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          <span>Completed:</span>
          <span className="font-semibold text-foreground font-mono">
            {progress.completed_tasks}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
          <span>In Progress:</span>
          <span className="font-semibold text-foreground font-mono">
            {progress.in_progress_tasks}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-zinc-400 shrink-0" />
          <span>To Do:</span>
          <span className="font-semibold text-foreground font-mono">
            {progress.todo_tasks}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
          <span>Blocked:</span>
          <span className="font-semibold text-foreground font-mono">
            {progress.blocked_tasks}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-zinc-600 shrink-0" />
          <span>Cancelled:</span>
          <span className="font-semibold text-foreground font-mono">
            {progress.cancelled_tasks}
          </span>
        </div>
      </div>
    </div>
  );
}
