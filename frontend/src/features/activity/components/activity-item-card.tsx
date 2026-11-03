"use client";

import * as React from "react";
import Link from "next/link";
import type { AuditLogRead } from "../types/activity";
import {
  formatActivityDate,
  getActionDisplayInfo,
  getResourceNavigationLink,
} from "../lib/activity-utils";
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileText,
  Layers,
  ShieldAlert,
  Users,
} from "lucide-react";

interface ActivityItemCardProps {
  activity: AuditLogRead;
  projectId: string;
}

export function ActivityItemCard({ activity, projectId }: ActivityItemCardProps) {
  const actionInfo = getActionDisplayInfo(activity.action);
  const resourceLink = getResourceNavigationLink(
    projectId,
    activity.entity_type,
    activity.entity_id
  );

  const getEntityIcon = (type: string) => {
    switch (type) {
      case "handover_report":
        return <FileCheck2 className="h-4 w-4 text-primary" />;
      case "project_member":
        return <Users className="h-4 w-4 text-emerald-500" />;
      case "knowledge_item":
        return <Layers className="h-4 w-4 text-violet" />;
      case "task":
        return <CheckCircle2 className="h-4 w-4 text-copper" />;
      case "risk":
        return <ShieldAlert className="h-4 w-4 text-rose-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const actorInitials = activity.actor_name
    ? activity.actor_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "PX";

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs hover:border-border transition-colors space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        {/* Actor & Action Title */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface border border-border font-mono text-xs font-bold text-foreground">
            {actorInitials}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground text-xs sm:text-sm">
                {activity.actor_name || "System"}
              </span>

              {activity.actor_email && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  &lt;{activity.actor_email}&gt;
                </span>
              )}

              <span
                className={`rounded border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${actionInfo.badgeClass}`}
              >
                {activity.action.replace(/_/g, " ")}
              </span>
            </div>

            <p className="text-xs text-foreground/90 leading-relaxed font-medium">
              {actionInfo.title}
            </p>
          </div>
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0 self-start">
          <Calendar className="h-3 w-3" />
          <span>{formatActivityDate(activity.created_at)}</span>
        </div>
      </div>

      {/* Details Box */}
      {activity.details && Object.keys(activity.details).length > 0 && (
        <div className="rounded-lg bg-surface/50 border border-border/60 p-3 text-xs space-y-1 font-mono text-[11px] text-muted-foreground">
          {Object.entries(activity.details).map(([k, v]) => (
            <div key={k} className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}:</span>
              <span className="text-foreground font-medium">
                {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Resource Footer / Navigation */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
          {getEntityIcon(activity.entity_type)}
          <span className="capitalize">{activity.entity_type.replace(/_/g, " ")}</span>
          {activity.entity_id && (
            <span className="font-mono text-[10px] opacity-75">
              ({activity.entity_id.slice(0, 8)}...)
            </span>
          )}
        </div>

        {resourceLink && (
          <Link
            href={resourceLink.href}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            <span>{resourceLink.label}</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
