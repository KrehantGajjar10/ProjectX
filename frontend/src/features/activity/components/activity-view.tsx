"use client";

import * as React from "react";
import type { AuditLogRead, ProjectActivityResponse } from "../types/activity";
import type { ProjectDetailRead } from "@/types/project";
import { clientGetProjectActivity, ActivityClientError } from "../lib/activity-client";
import { groupActivitiesByDate } from "../lib/activity-utils";
import { ActivityItemCard } from "./activity-item-card";
import { ActivityFilterBar } from "./activity-filter-bar";
import {
  Activity,
  AlertCircle,
  Calendar,
  Clock,
  History,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActivityViewProps {
  project: ProjectDetailRead;
  initialActivity: ProjectActivityResponse | null;
}

export function ActivityView({
  project,
  initialActivity,
}: ActivityViewProps) {
  const [items, setItems] = React.useState<AuditLogRead[]>(
    initialActivity?.items || []
  );
  const [total, setTotal] = React.useState(initialActivity?.total || 0);

  const [selectedAction, setSelectedAction] = React.useState("all");
  const [selectedEntityType, setSelectedEntityType] = React.useState("all");

  const [isLoading, setIsLoading] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch / refetch on filter change
  const fetchActivity = React.useCallback(
    async (action: string, entityType: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const res = await clientGetProjectActivity(project.id, {
          action: action !== "all" ? action : null,
          entity_type: entityType !== "all" ? entityType : null,
          skip: 0,
          limit: 50,
        });
        setItems(res.items);
        setTotal(res.total);
      } catch (err) {
        if (err instanceof ActivityClientError) {
          setError(err.message);
        } else {
          setError("Failed to load project activity. Please try again.");
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [project.id]
  );

  // Handle filter changes
  const handleActionChange = (action: string) => {
    setSelectedAction(action);
    fetchActivity(action, selectedEntityType);
  };

  const handleEntityTypeChange = (entityType: string) => {
    setSelectedEntityType(entityType);
    fetchActivity(selectedAction, entityType);
  };

  const handleRefresh = () => {
    fetchActivity(selectedAction, selectedEntityType, true);
  };

  // Load more pagination
  const handleLoadMore = async () => {
    if (isLoadingMore || items.length >= total) return;
    setIsLoadingMore(true);

    try {
      const res = await clientGetProjectActivity(project.id, {
        action: selectedAction !== "all" ? selectedAction : null,
        entity_type: selectedEntityType !== "all" ? selectedEntityType : null,
        skip: items.length,
        limit: 50,
      });
      setItems((prev) => [...prev, ...res.items]);
      setTotal(res.total);
    } catch (err) {
      if (err instanceof ActivityClientError) {
        setError(err.message);
      } else {
        setError("Failed to load additional activity records.");
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  const grouped = groupActivitiesByDate(items);

  return (
    <div className="space-y-6">
      {/* Activity Header */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Activity Center
            </h1>
            <p className="text-xs text-muted-foreground">
              Audit log of governance events, reviews, member updates, and report exports for {project.name}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground border-t border-border/50">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Immutable Audit Trail
          </span>
          <span>•</span>
          <span className="font-mono text-[11px]">
            {total} Total Events Logged
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <ActivityFilterBar
        selectedAction={selectedAction}
        onSelectAction={handleActionChange}
        selectedEntityType={selectedEntityType}
        onSelectEntityType={handleEntityTypeChange}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        totalCount={total}
      />

      {/* Error Notice */}
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="p-1 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Feed List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs">Loading activity audit log...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/60 p-8 sm:p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-muted-foreground border border-border">
            <History className="h-6 w-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-sm font-semibold text-foreground">
              No Activity Recorded
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {selectedAction !== "all" || selectedEntityType !== "all"
                ? "No audit records match the selected filter criteria."
                : "Activity logs will automatically appear here as team members review knowledge, generate reports, update roles, or perform project operations."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.dateLabel} className="space-y-3">
              {/* Date Group Header */}
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  {group.dateLabel}
                </h3>
                <div className="flex-1 h-px bg-border/60" />
              </div>

              {/* Items in this date group */}
              <div className="grid grid-cols-1 gap-3">
                {group.items.map((activity) => (
                  <ActivityItemCard
                    key={activity.id}
                    activity={activity}
                    projectId={project.id}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Load More Button */}
          {items.length < total && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="gap-2"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading More...
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5" />
                    Load More Events ({items.length} of {total})
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
