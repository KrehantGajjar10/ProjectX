"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TimelineEventRead } from "../types/timeline";
import {
  Calendar,
  CheckCircle2,
  CheckSquare,
  Code,
  FileText,
  Flag,
  GitCommit,
  Info,
  User,
  X,
} from "lucide-react";

interface TimelineDetailPanelProps {
  projectId?: string;
  event: TimelineEventRead;
  onClose: () => void;
}

export function TimelineDetailPanel({
  event,
  onClose,
}: TimelineDetailPanelProps) {
  const getEventBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case "milestone":
        return (
          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 text-[10px] uppercase font-semibold gap-1">
            <Flag className="h-3 w-3" />
            Milestone
          </Badge>
        );
      case "decision":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] uppercase font-semibold gap-1">
            <GitCommit className="h-3 w-3" />
            Decision
          </Badge>
        );
      case "task":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] uppercase font-semibold gap-1">
            <CheckSquare className="h-3 w-3" />
            Task
          </Badge>
        );
      case "commit":
      default:
        return (
          <Badge className="bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30 text-[10px] uppercase font-semibold gap-1">
            <Code className="h-3 w-3" />
            Commit
          </Badge>
        );
    }
  };

  const dateObj = new Date(event.timestamp);
  const formattedDateTime = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : event.timestamp;

  return (
    <div className="flex flex-col h-full bg-card border-l border-border/80 shadow-2xl overflow-hidden animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border/60 bg-muted/30 flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {getEventBadge(event.event_type)}
            {event.status && (
              <Badge variant="outline" className="text-[10px] font-mono capitalize">
                {event.status}
              </Badge>
            )}
          </div>
          <h2 className="text-sm font-bold text-foreground leading-snug wrap-break-word">
            {event.title}
          </h2>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Timestamp & Actor Card */}
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Event Time
            </span>
            <span className="font-mono text-foreground font-medium">
              {formattedDateTime}
            </span>
          </div>

          {event.actor && (
            <div className="flex items-center justify-between border-t border-border/50 pt-2">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" />
                Actor / Author
              </span>
              <span className="font-medium text-foreground truncate max-w-45">
                {event.actor}
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <div className="space-y-1.5">
            <span className="font-semibold text-foreground text-xs">Event Detail</span>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap bg-background p-3 rounded-lg border border-border/60 shadow-xs">
              {event.description}
            </p>
          </div>
        )}

        {/* Metadata info */}
        {event.metadata_info && Object.keys(event.metadata_info).length > 0 && (
          <div className="space-y-1.5">
            <span className="font-semibold text-foreground text-xs">Event Metadata</span>
            <div className="rounded-lg bg-muted/30 p-2.5 font-mono text-[11px] text-muted-foreground border border-border/60 space-y-1">
              {Object.entries(event.metadata_info).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground capitalize">{k}:</span>
                  <span className="text-foreground font-semibold truncate max-w-50">
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Supporting Evidence */}
        <div className="space-y-2.5 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Grounded Evidence ({event.evidence ? event.evidence.length : 0})
            </span>
          </div>

          {!event.evidence || event.evidence.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic bg-muted/20 p-3 rounded-lg border border-border/50">
              No textual evidence directly linked to this event.
            </p>
          ) : (
            <div className="space-y-2">
              {event.evidence.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-lg border border-border/70 bg-background p-3 space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground truncate">
                      {ev.source_locator}
                    </span>
                    {ev.verified ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[9px] gap-1 px-1.5 py-0">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 dark:text-amber-400 text-[9px] gap-1 px-1.5 py-0">
                        <Info className="h-2.5 w-2.5" />
                        Unverified
                      </Badge>
                    )}
                  </div>

                  <p className="text-[11px] text-foreground font-serif italic border-l-2 border-primary/50 pl-2 leading-relaxed">
                    &ldquo;{ev.exact_excerpt}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
