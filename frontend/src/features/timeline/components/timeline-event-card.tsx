"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { TimelineEventRead } from "../types/timeline";
import {
  CheckSquare,
  Clock,
  Code,
  FileText,
  Flag,
  GitCommit,
  User,
} from "lucide-react";

interface TimelineEventCardProps {
  event: TimelineEventRead;
  isSelected?: boolean;
  onSelect: (event: TimelineEventRead) => void;
}

export function TimelineEventCard({
  event,
  isSelected,
  onSelect,
}: TimelineEventCardProps) {
  const getEventConfig = (type: string) => {
    switch (type.toLowerCase()) {
      case "milestone":
        return {
          icon: Flag,
          color: "text-purple-600 dark:text-purple-400",
          bgColor: "bg-purple-500/10",
          borderColor: "border-purple-500/30",
          badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
          label: "Milestone",
        };
      case "decision":
        return {
          icon: GitCommit,
          color: "text-emerald-600 dark:text-emerald-400",
          bgColor: "bg-emerald-500/10",
          borderColor: "border-emerald-500/30",
          badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
          label: "Decision",
        };
      case "task":
        return {
          icon: CheckSquare,
          color: "text-blue-600 dark:text-blue-400",
          bgColor: "bg-blue-500/10",
          borderColor: "border-blue-500/30",
          badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
          label: "Task",
        };
      case "commit":
      default:
        return {
          icon: Code,
          color: "text-zinc-600 dark:text-zinc-400",
          bgColor: "bg-zinc-500/10",
          borderColor: "border-zinc-500/30",
          badgeClass: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
          label: "Commit",
        };
    }
  };

  const config = getEventConfig(event.event_type);
  const Icon = config.icon;

  const dateObj = new Date(event.timestamp);
  const formattedTime = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      onClick={() => onSelect(event)}
      className={`group relative flex items-start gap-4 rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
        isSelected
          ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/40"
          : "border-border/80 bg-card hover:border-primary/50 hover:bg-muted/30 shadow-xs"
      }`}
    >
      {/* Event Icon Node */}
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${config.borderColor} ${config.bgColor} ${config.color} shadow-2xs`}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Badge className={`${config.badgeClass} text-[10px] uppercase font-semibold`}>
              {config.label}
            </Badge>

            {event.status && (
              <Badge variant="outline" className="text-[10px] font-mono capitalize">
                {event.status}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
            <Clock className="h-3 w-3" />
            <span>{formattedTime}</span>
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
          {event.title}
        </h4>

        {/* Description snippet */}
        {event.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {event.description}
          </p>
        )}

        {/* Footer meta: actor and evidence */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
          {event.actor ? (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="truncate max-w-37.5">{event.actor}</span>
            </div>
          ) : (
            <span />
          )}

          {event.evidence && event.evidence.length > 0 && (
            <div className="flex items-center gap-1 text-primary font-medium">
              <FileText className="h-3 w-3" />
              <span>{event.evidence.length} evidence</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
