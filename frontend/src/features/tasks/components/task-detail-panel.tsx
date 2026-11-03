"use client";

import * as React from "react";
import Link from "next/link";
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
  ExternalLink,
  History,
  ListTodo,
  User,
  X,
  XCircle,
} from "lucide-react";

interface TaskDetailPanelProps {
  projectId: string;
  task: TaskRead;
  members: ProjectMemberRead[];
  onClose: () => void;
  onEdit: (task: TaskRead) => void;
}

export function TaskDetailPanel({
  projectId,
  task,
  members,
  onClose,
  onEdit,
}: TaskDetailPanelProps) {
  const ownerMember = React.useMemo(() => {
    if (!task.owner_id) return null;
    return members.find((m) => m.user_id === task.owner_id || m.id === task.owner_id);
  }, [task.owner_id, members]);

  const ownerName = ownerMember?.user?.full_name || ownerMember?.user?.email || (task.owner_id ? "Assigned Member" : "Unassigned");

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] uppercase font-semibold gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] uppercase font-semibold gap-1">
            <Clock className="h-3 w-3" />
            In Progress
          </Badge>
        );
      case "blocked":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] uppercase font-semibold gap-1">
            <AlertOctagon className="h-3 w-3" />
            Blocked
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px] uppercase font-semibold gap-1">
            <XCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        );
      case "todo":
      default:
        return (
          <Badge variant="secondary" className="text-[10px] uppercase font-semibold gap-1">
            <ListTodo className="h-3 w-3" />
            To Do
          </Badge>
        );
    }
  };

  const formattedDueDate = React.useMemo(() => {
    if (!task.due_date) return "No due date set";
    const d = new Date(task.due_date);
    return !isNaN(d.getTime())
      ? d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : task.due_date;
  }, [task.due_date]);

  const formattedCreatedAt = React.useMemo(() => {
    const d = new Date(task.created_at);
    return !isNaN(d.getTime())
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : task.created_at;
  }, [task.created_at]);

  // Separate description and audit trail
  const parts = task.description ? task.description.split("\n\n[Audit ") : [];
  const mainDesc = parts.length > 0 ? parts[0] : "";
  const auditTrail = parts.length > 1 ? parts.slice(1).map((p) => `[Audit ${p}`) : null;

  return (
    <div className="flex flex-col h-full bg-card border-l border-border/80 shadow-2xl overflow-hidden animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border/60 bg-muted/30 flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {getStatusBadge(task.status)}
            <Badge variant="outline" className="text-[10px] capitalize font-semibold">
              {task.priority} Priority
            </Badge>
          </div>
          <h2 className="text-sm font-bold text-foreground leading-snug wrap-break-word">
            {task.title}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(task)}
            className="h-7 gap-1 text-xs px-2.5"
          >
            <Edit2 className="h-3 w-3" />
            <span>Edit</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Meta Grid */}
        <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" />
              Assignee
            </span>
            <span className="font-semibold text-foreground truncate max-w-45">
              {ownerName}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-border/50 pt-2">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Due Date
            </span>
            <span className="font-medium text-foreground">
              {formattedDueDate}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
            <span>Created</span>
            <span>{formattedCreatedAt}</span>
          </div>
        </div>

        {/* Linked Knowledge Record */}
        {task.knowledge_item_id && (
          <div className="space-y-1.5">
            <span className="font-semibold text-foreground text-xs">Source Knowledge Entity</span>
            <div>
              <Link
                href={`/app/projects/${projectId}/knowledge/${task.knowledge_item_id}`}
                target="_blank"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-medium text-foreground hover:bg-muted transition-colors shadow-xs"
              >
                <span>Inspect Linked Knowledge Record</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            </div>
          </div>
        )}

        {/* Task Description */}
        <div className="space-y-1.5">
          <span className="font-semibold text-foreground text-xs">Task Scope & Details</span>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap bg-background p-3 rounded-lg border border-border/60 shadow-xs">
            {mainDesc || <span className="italic text-muted-foreground/60">No additional description provided.</span>}
          </p>
        </div>

        {/* Audit Trail Section */}
        {auditTrail && auditTrail.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Change Audit Trail</span>
            </div>

            <div className="space-y-1.5">
              {auditTrail.map((audit, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-muted/30 border border-border/50 p-2 font-mono text-[10px] text-muted-foreground leading-normal"
                >
                  {audit}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
