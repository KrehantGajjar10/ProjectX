import type { HandoverReportStatus } from "../types/handover";
import type { ProjectRole } from "@/types/project";

export function canGenerateHandover(role?: ProjectRole | null): boolean {
  if (!role) return false;
  return (
    role === "owner" ||
    role === "admin" ||
    role === "reviewer" ||
    role === "member"
  );
}

export function canSubmitHandover(
  role?: ProjectRole | null,
  status?: HandoverReportStatus
): boolean {
  if (!role || !status) return false;
  const hasRole =
    role === "owner" ||
    role === "admin" ||
    role === "reviewer" ||
    role === "member";
  return hasRole && (status === "draft" || status === "rejected");
}

export function canReviewHandover(
  role?: ProjectRole | null,
  status?: HandoverReportStatus
): boolean {
  if (!role || !status) return false;
  const isReviewer =
    role === "owner" || role === "admin" || role === "reviewer";
  return isReviewer && status !== "approved";
}

export function getHandoverStatusBadge(status: HandoverReportStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "approved":
      return {
        label: "Approved",
        className:
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      };
    case "in_review":
      return {
        label: "In Review",
        className:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      };
    case "rejected":
      return {
        label: "Changes Requested",
        className:
          "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
      };
    case "draft":
    default:
      return {
        label: "Draft",
        className:
          "bg-secondary/80 text-muted-foreground border-border",
      };
  }
}

export function formatHandoverDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
