"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ProjectDetailRead } from "@/types/project";
import type {
  TimelineEventRead,
  TimelineResponse,
} from "../types/timeline";
import {
  clientGetProjectTimeline,
  TimelineClientError,
} from "../lib/timeline-client";
import { TimelineEventCard } from "./timeline-event-card";
import { TimelineDetailPanel } from "./timeline-detail-panel";
import {
  AlertCircle,
  Calendar,
  CheckSquare,
  Code,
  Flag,
  GitCommit,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

interface TimelineViewProps {
  project: ProjectDetailRead;
  initialTimeline?: TimelineResponse;
}

export function TimelineView({ project, initialTimeline }: TimelineViewProps) {
  const [timeline, setTimeline] = React.useState<TimelineResponse>(
    initialTimeline || { events: [], total_events: 0 }
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [selectedEventType, setSelectedEventType] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Selected event for detail drawer
  const [selectedEvent, setSelectedEvent] = React.useState<TimelineEventRead | null>(null);

  const fetchTimeline = React.useCallback(
    async (type = selectedEventType) => {
      setIsLoading(true);
      setError(null);
      try {
        const types = type === "all" ? undefined : [type];
        const data = await clientGetProjectTimeline(project.id, {
          event_types: types,
          limit: 100,
        });
        setTimeline(data);
      } catch (err) {
        if (err instanceof TimelineClientError) {
          setError(err.message);
        } else {
          setError("Failed to load project timeline.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [project.id, selectedEventType]
  );

  // Group events by formatted date string
  const groupedEvents = React.useMemo(() => {
    let list = timeline.events;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.description && e.description.toLowerCase().includes(q)) ||
          (e.actor && e.actor.toLowerCase().includes(q))
      );
    }

    const groups: { [dateStr: string]: TimelineEventRead[] } = {};
    list.forEach((event) => {
      const d = new Date(event.timestamp);
      const dateKey = !isNaN(d.getTime())
        ? d.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Undated";

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });

    return groups;
  }, [timeline.events, searchQuery]);

  const dateKeys = Object.keys(groupedEvents);

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
            <span className="text-foreground font-medium">Timeline</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Project Chronology & Milestone Timeline
              </h1>
              <p className="text-xs text-muted-foreground">
                Synthesized chronological narrative of milestones, key decisions, tasks, and commit provenance
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTimeline()}
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

      {/* Filter and Tab Strip */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-xs md:flex-row md:items-center md:justify-between">
        {/* Type Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: "All Events" },
            { id: "milestone", label: "Milestones", icon: Flag },
            { id: "decision", label: "Decisions", icon: GitCommit },
            { id: "task", label: "Tasks", icon: CheckSquare },
            { id: "commit", label: "Commits", icon: Code },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedEventType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedEventType(tab.id);
                  fetchTimeline(tab.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events..."
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
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchTimeline()}
            className="h-7 text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Timeline Stream */}
      <div className="relative min-h-100">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-2xs">
            <div className="flex flex-col items-center gap-2 rounded-xl bg-card border border-border p-4 shadow-lg">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground font-medium">
                Loading Chronology...
              </span>
            </div>
          </div>
        )}

        {dateKeys.length === 0 ? (
          <div className="rounded-2xl border border-border/80 bg-card p-12 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              No Timeline Events Found
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No milestones, decisions, or commit activity recorded yet matching your filter.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {dateKeys.map((dateStr) => {
              const dayEvents = groupedEvents[dateStr];
              return (
                <div key={dateStr} className="space-y-3">
                  {/* Date Header Badge */}
                  <div className="sticky top-20 z-10 flex items-center gap-3">
                    <span className="rounded-full border border-border bg-card/95 px-3 py-1 text-xs font-semibold text-foreground shadow-xs backdrop-blur-md">
                      {dateStr}
                    </span>
                    <div className="h-px flex-1 bg-border/60" />
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {dayEvents.length} event{dayEvents.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Events in this Date */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2 sm:pl-4">
                    {dayEvents.map((event) => (
                      <TimelineEventCard
                        key={event.id}
                        event={event}
                        isSelected={selectedEvent?.id === event.id}
                        onSelect={(ev) => setSelectedEvent(ev)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Event Detail Drawer */}
        {selectedEvent && (
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-105 max-w-full shadow-2xl">
            <TimelineDetailPanel
              projectId={project.id}
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
