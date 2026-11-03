"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TaskRead, TaskStatus } from "../types/task";
import type { ProjectMemberRead } from "@/types/project";
import {
  AlertOctagon,
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  ListTodo,
  User,
  XCircle,
} from "lucide-react";

const emptySubscribe = () => () => {};

interface TaskCardProps {
  task: TaskRead;
  members: ProjectMemberRead[];
  isSelected?: boolean;
  onSelect: (task: TaskRead) => void;
  onEdit: (task: TaskRead) => void;
}

export function TaskCard({
  task,
  members,
  isSelected,
  onSelect,
  onEdit,
}: TaskCardProps) {
  // Find owner name if assigned
  const ownerMember = React.useMemo(() => {
    if (!task.owner_id) return null;
    return members.find((m) => m.user_id === task.owner_id || m.id === task.owner_id);
  }, [task.owner_id, members]);

  const ownerName = ownerMember?.user?.full_name || ownerMember?.user?.email || (task.owner_id ? "Assigned" : "Unassigned");

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] uppercase font-semibold gap-1">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] uppercase font-semibold gap-1">
            <Clock className="h-2.5 w-2.5" />
            In Progress
          </Badge>
        );
      case "blocked":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] uppercase font-semibold gap-1">
            <AlertOctagon className="h-2.5 w-2.5" />
            Blocked
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px] uppercase font-semibold gap-1">
            <XCircle className="h-2.5 w-2.5" />
            Cancelled
          </Badge>
        );
      case "todo":
      default:
        return (
          <Badge variant="secondary" className="text-[10px] uppercase font-semibold gap-1">
            <ListTodo className="h-2.5 w-2.5" />
            To Do
          </Badge>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    const p = priority.toLowerCase();
    switch (p) {
      case "critical":
        return (
          <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] font-semibold">
            Critical
          </Badge>
        );
      case "high":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold">
            High
          </Badge>
        );
      case "medium":
        return (
          <Badge variant="outline" className="text-foreground text-[10px] font-medium">
            Medium
          </Badge>
        );
      case "low":
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px]">
            Low
          </Badge>
        );
    }
  };

  // Due date & overdue check via external store to avoid purity/hydration issues
  const currentTime = React.useSyncExternalStore(
    emptySubscribe,
    () => Date.now(),
    () => 0
  );

  const isOverdue = React.useMemo(() => {
    if (!currentTime || !task.due_date || task.status === "completed" || task.status === "cancelled") {
      return false;
    }
    const dueTime = new Date(task.due_date).getTime();
    return !isNaN(dueTime) && dueTime < currentTime;
  }, [currentTime, task.due_date, task.status]);

  const formattedDueDate = React.useMemo(() => {
    if (!task.due_date) return null;
    const d = new Date(task.due_date);
    return !isNaN(d.getTime())
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : null;
  }, [task.due_date]);

  return (
    <div
      onClick={() => onSelect(task)}
      className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 cursor-pointer text-left ${
        isSelected
          ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/40"
          : "border-border/80 bg-card hover:border-primary/50 hover:bg-muted/30 shadow-xs"
      }`}
    >
      <div className="space-y-2">
        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {getStatusBadge(task.status)}
            {getPriorityBadge(task.priority)}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground opacity-70 group-hover:opacity-100 transition-opacity"
            title="Edit Task"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {task.title}
        </h3>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {task.description.split("\n\n[Audit")[0]}
          </p>
        )}
      </div>

      {/* Footer Info: Assignee & Due Date */}
      <div className="mt-3.5 flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5 truncate max-w-40">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{ownerName}</span>
        </div>

        {formattedDueDate ? (
          <div
            className={`flex items-center gap-1 shrink-0 font-medium ${
              isOverdue
                ? "text-destructive font-semibold"
                : "text-muted-foreground"
            }`}
          >
            <Calendar className="h-3 w-3" />
            <span>{formattedDueDate}</span>
            {isOverdue && (
              <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-destructive/15 text-destructive">
                Overdue
              </span>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground/60 italic">
            No due date
          </span>
        )}
      </div>
    </div>
  );
}
