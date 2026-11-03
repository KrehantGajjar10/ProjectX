"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ProjectDetailRead } from "@/types/project";
import type {
  TaskPriority,
  TaskProgressSummary,
  TaskRead,
  TaskStatus,
} from "../types/task";
import {
  clientGetProjectTasks,
  clientGetTaskProgress,
  TaskClientError,
} from "../lib/task-client";
import { TaskProgressCard } from "./task-progress-card";
import { TaskCard } from "./task-card";
import { TaskDetailPanel } from "./task-detail-panel";
import { TaskEditDialog } from "./task-edit-dialog";
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

interface TasksViewProps {
  project: ProjectDetailRead;
  initialTasks?: TaskRead[];
  initialProgress?: TaskProgressSummary;
}

export function TasksView({
  project,
  initialTasks = [],
  initialProgress,
}: TasksViewProps) {
  const [tasks, setTasks] = React.useState<TaskRead[]>(initialTasks);
  const [progress, setProgress] = React.useState<TaskProgressSummary>(
    initialProgress || {
      total_tasks: initialTasks.length,
      completed_tasks: initialTasks.filter((t) => t.status === "completed").length,
      in_progress_tasks: initialTasks.filter((t) => t.status === "in_progress").length,
      todo_tasks: initialTasks.filter((t) => t.status === "todo").length,
      blocked_tasks: initialTasks.filter((t) => t.status === "blocked").length,
      cancelled_tasks: initialTasks.filter((t) => t.status === "cancelled").length,
      completion_percentage: 0,
      overdue_tasks: 0,
      unassigned_tasks: initialTasks.filter((t) => !t.owner_id).length,
    }
  );

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = React.useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = React.useState<TaskPriority | "all">("all");
  const [ownerFilter, setOwnerFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Drawers and Modals
  const [selectedTask, setSelectedTask] = React.useState<TaskRead | null>(null);
  const [editingTask, setEditingTask] = React.useState<TaskRead | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  // Success Notification
  const [successToast, setSuccessToast] = React.useState<string | null>(null);
  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const fetchTasks = React.useCallback(
    async (
      st = statusFilter,
      pr = priorityFilter,
      own = ownerFilter
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const [tasksData, progressData] = await Promise.all([
          clientGetProjectTasks(project.id, {
            status: st,
            priority: pr,
            owner_id: own,
            limit: 100,
          }),
          clientGetTaskProgress(project.id),
        ]);
        setTasks(tasksData);
        setProgress(progressData);
      } catch (err) {
        if (err instanceof TaskClientError) {
          setError(err.message);
        } else {
          setError("Failed to load project tasks and progress.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [project.id, statusFilter, priorityFilter, ownerFilter]
  );

  // Handle successful task update
  const handleTaskUpdated = async (updated: TaskRead) => {
    // 1. Update task in local array
    setTasks((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );

    // 2. If detail drawer is open for this task, update it
    if (selectedTask?.id === updated.id) {
      setSelectedTask(updated);
    }

    // 3. Reconcile progress metrics from backend
    try {
      const updatedProgress = await clientGetTaskProgress(project.id);
      setProgress(updatedProgress);
    } catch {
      // Ignore background progress refresh failure
    }

    // 4. Show success message
    setSuccessToast(`Task "${updated.title}" successfully updated.`);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setSuccessToast(null);
      toastTimeoutRef.current = null;
    }, 4000);
  };

  // Client-side text search filter
  const displayedTasks = React.useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase().trim();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }, [tasks, searchQuery]);

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
            <span className="text-foreground font-medium">Tasks</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CheckSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Task Execution & Handover Progress
              </h1>
              <p className="text-xs text-muted-foreground">
                Audited task state tracking, ownership assignment, milestone delivery, and blocker mitigation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTasks()}
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

      {/* Progress Overview Card */}
      <TaskProgressCard progress={progress} />

      {/* Success Notification Banner */}
      {successToast && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-800 dark:text-emerald-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 dark:hover:text-emerald-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-xs md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks by title or keyword..."
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
          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => {
              const val = e.target.value as TaskStatus | "all";
              setStatusFilter(val);
              fetchTasks(val, priorityFilter, ownerFilter);
            }}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          >
            <option value="all">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="blocked">Blocked</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Priority */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              const val = e.target.value as TaskPriority | "all";
              setPriorityFilter(val);
              fetchTasks(statusFilter, val, ownerFilter);
            }}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Owner */}
          <select
            value={ownerFilter}
            onChange={(e) => {
              const val = e.target.value;
              setOwnerFilter(val);
              fetchTasks(statusFilter, priorityFilter, val);
            }}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          >
            <option value="all">All Owners</option>
            {project.members?.map((m) => {
              const name = m.user?.full_name || m.user?.email || m.user_id.slice(0, 8);
              return (
                <option key={m.id} value={m.user_id}>
                  {name}
                </option>
              );
            })}
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
            onClick={() => fetchTasks()}
            className="h-7 text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Tasks Grid */}
      <div className="relative min-h-100">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-2xs">
            <div className="flex flex-col items-center gap-2 rounded-xl bg-card border border-border p-4 shadow-lg">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground font-medium">
                Fetching Project Tasks...
              </span>
            </div>
          </div>
        )}

        {displayedTasks.length === 0 ? (
          <div className="rounded-2xl border border-border/80 bg-card p-12 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <CheckSquare className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              No Tasks Found
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No project tasks match the selected status, priority, or search criteria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {displayedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                members={project.members || []}
                isSelected={selectedTask?.id === task.id}
                onSelect={(t) => setSelectedTask(t)}
                onEdit={(t) => {
                  setEditingTask(t);
                  setIsEditDialogOpen(true);
                }}
              />
            ))}
          </div>
        )}

        {/* Selected Task Detail Drawer */}
        {selectedTask && (
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-105 max-w-full shadow-2xl">
            <TaskDetailPanel
              projectId={project.id}
              task={selectedTask}
              members={project.members || []}
              onClose={() => setSelectedTask(null)}
              onEdit={(t) => {
                setEditingTask(t);
                setIsEditDialogOpen(true);
              }}
            />
          </div>
        )}
      </div>

      {/* Task Edit Dialog */}
      <TaskEditDialog
        projectId={project.id}
        task={editingTask}
        members={project.members || []}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onTaskUpdated={handleTaskUpdated}
      />
    </div>
  );
}
