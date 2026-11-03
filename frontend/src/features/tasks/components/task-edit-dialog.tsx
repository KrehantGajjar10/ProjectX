"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { TaskRead, TaskStatus, TaskUpdateInput } from "../types/task";
import type { ProjectMemberRead } from "@/types/project";
import { clientUpdateTask, TaskClientError } from "../lib/task-client";
import {
  AlertCircle,
  CheckSquare,
  Loader2,
  Save,
} from "lucide-react";

interface TaskEditDialogProps {
  projectId: string;
  task: TaskRead | null;
  members: ProjectMemberRead[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated: (updatedTask: TaskRead) => void;
}

export function TaskEditDialog({
  projectId,
  task,
  members,
  open,
  onOpenChange,
  onTaskUpdated,
}: TaskEditDialogProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState<TaskStatus>("todo");
  const [priority, setPriority] = React.useState<string>("medium");
  const [ownerId, setOwnerId] = React.useState<string>("");
  const [dueDate, setDueDate] = React.useState<string>("");

  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Sync state when task changes or dialog opens without useEffect
  const [prevTaskKey, setPrevTaskKey] = React.useState<string | null>(null);
  const currentTaskKey = task && open ? `${task.id}-${task.updated_at}` : null;

  if (open && task && currentTaskKey !== prevTaskKey) {
    setPrevTaskKey(currentTaskKey);
    setTitle(task.title || "");
    setDescription(task.description || "");
    setStatus(task.status || "todo");
    setPriority(task.priority || "medium");
    setOwnerId(task.owner_id || "");

    if (task.due_date) {
      const d = new Date(task.due_date);
      setDueDate(!isNaN(d.getTime()) ? d.toISOString().split("T")[0] : "");
    } else {
      setDueDate("");
    }
    setError(null);
  } else if (!open && prevTaskKey !== null) {
    setPrevTaskKey(null);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;

    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload: TaskUpdateInput = {
      title: title.trim(),
      description: description.trim() ? description : null,
      status,
      priority,
      owner_id: ownerId && ownerId !== "unassigned" ? ownerId : null,
      due_date: dueDate ? new Date(`${dueDate}T00:00:00Z`).toISOString() : null,
    };

    try {
      const updated = await clientUpdateTask(projectId, task.id, payload);
      onTaskUpdated(updated);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof TaskClientError) {
        setError(err.message);
      } else {
        setError("Failed to save task updates. Please check your network or permissions.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!task) return null;

  return (
    open && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onOpenChange(false);
        }}
      >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-edit-dialog-title"
        className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CheckSquare className="h-4 w-4" />
              </div>
              <div>
                <h2 id="task-edit-dialog-title" className="text-base font-semibold">
                  Edit Task Details
                </h2>
                <p className="text-xs text-muted-foreground">
                  Task ID: {task.id.slice(0, 8)}...
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 py-3 text-xs">
            {/* Title */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">
                Task Title <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={500}
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                placeholder="Enter task title..."
              />
            </div>

            {/* Status & Priority Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="blocked">Blocked</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Assignee & Due Date Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Assignee</label>
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => {
                    const name = m.user?.full_name || m.user?.email || m.user_id.slice(0, 8);
                    return (
                      <option key={m.id} value={m.user_id}>
                        {name} ({m.role})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-background p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs resize-y"
                placeholder="Task description, requirements, or execution criteria..."
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Task
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
      </div>
    )
  );
}
