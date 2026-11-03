import type { AuditLogRead } from "../types/activity";

export function formatActivityDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function formatActivityTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function groupActivitiesByDate(
  items: AuditLogRead[]
): Array<{ dateLabel: string; items: AuditLogRead[] }> {
  const groups: Map<string, AuditLogRead[]> = new Map();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const oneWeekAgo = today - 86400000 * 7;

  items.forEach((item) => {
    let dateLabel = "Older";
    try {
      const itemDate = new Date(item.created_at);
      const itemMidnight = new Date(
        itemDate.getFullYear(),
        itemDate.getMonth(),
        itemDate.getDate()
      ).getTime();

      if (itemMidnight === today) {
        dateLabel = "Today";
      } else if (itemMidnight === yesterday) {
        dateLabel = "Yesterday";
      } else if (itemMidnight >= oneWeekAgo) {
        dateLabel = "Earlier This Week";
      } else {
        dateLabel = itemDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
      }
    } catch {
      dateLabel = "Recorded Events";
    }

    if (!groups.has(dateLabel)) {
      groups.set(dateLabel, []);
    }
    groups.get(dateLabel)!.push(item);
  });

  return Array.from(groups.entries()).map(([dateLabel, groupItems]) => ({
    dateLabel,
    items: groupItems,
  }));
}

export function getActionDisplayInfo(action: string): {
  title: string;
  badgeClass: string;
} {
  switch (action) {
    case "member_add":
      return {
        title: "Added team member",
        badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      };
    case "member_role_update":
      return {
        title: "Updated member role",
        badgeClass: "bg-primary/10 text-primary border-primary/30",
      };
    case "member_remove":
      return {
        title: "Removed team member",
        badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
      };
    case "handover_generate":
      return {
        title: "Generated handover report",
        badgeClass: "bg-primary/10 text-primary border-primary/30",
      };
    case "handover_submit":
      return {
        title: "Submitted handover report for review",
        badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      };
    case "handover_approve":
      return {
        title: "Approved handover report (sealed immutable)",
        badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      };
    case "handover_reject":
      return {
        title: "Returned handover report with requested changes",
        badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
      };
    case "handover_export":
      return {
        title: "Exported handover document",
        badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
      };
    case "knowledge_review":
      return {
        title: "Reviewed knowledge claim",
        badgeClass: "bg-violet/10 text-violet border-violet/30",
      };
    case "task_update":
      return {
        title: "Updated task details",
        badgeClass: "bg-copper/10 text-copper border-copper/30",
      };
    default:
      return {
        title: action.replace(/_/g, " "),
        badgeClass: "bg-surface text-muted-foreground border-border",
      };
  }
}

export function getResourceNavigationLink(
  projectId: string,
  entityType: string,
  entityId?: string | null
): { href: string; label: string } | null {
  switch (entityType) {
    case "handover_report":
      return {
        href: `/app/projects/${projectId}/handover`,
        label: "View Handover Studio",
      };
    case "project_member":
      return {
        href: `/app/projects/${projectId}/settings`,
        label: "View Team Settings",
      };
    case "knowledge_item":
      return {
        href: entityId
          ? `/app/projects/${projectId}/knowledge?item=${entityId}`
          : `/app/projects/${projectId}/knowledge`,
        label: "View Knowledge Record",
      };
    case "task":
      return {
        href: `/app/projects/${projectId}/tasks`,
        label: "View Tasks",
      };
    case "document":
    case "source":
      return {
        href: `/app/projects/${projectId}/sources`,
        label: "View Sources",
      };
    default:
      return null;
  }
}
