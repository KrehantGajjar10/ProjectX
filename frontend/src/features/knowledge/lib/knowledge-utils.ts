import type {
  KnowledgeCategory,
  KnowledgeOrigin,
  KnowledgeReviewStatus,
} from "../types/knowledge";
import type { ProjectRole } from "@/types/project";

export function canReviewKnowledge(role?: ProjectRole | null): boolean {
  if (!role) return false;
  return role === "owner" || role === "admin" || role === "reviewer";
}

export const KNOWLEDGE_CATEGORIES: Array<{
  value: KnowledgeCategory;
  label: string;
  description: string;
}> = [
  {
    value: "decision",
    label: "Decisions",
    description: "Architectural, technical, and product decisions",
  },
  {
    value: "task",
    label: "Tasks",
    description: "Planned, in-progress, or completed action items",
  },
  {
    value: "risk",
    label: "Risks",
    description: "Identified project risks, constraints, and pitfalls",
  },
  {
    value: "milestone",
    label: "Milestones",
    description: "Major project milestones and deliverable targets",
  },
  {
    value: "insight",
    label: "Insights",
    description: "Technical findings and extracted project understanding",
  },
];

export const REVIEW_STATUSES: Array<{
  value: KnowledgeReviewStatus;
  label: string;
}> = [
  { value: "pending", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function getCategoryLabel(category: KnowledgeCategory): string {
  switch (category) {
    case "decision":
      return "Decision";
    case "task":
      return "Task";
    case "risk":
      return "Risk";
    case "milestone":
      return "Milestone";
    case "insight":
      return "Insight";
    default:
      return category;
  }
}

export function getCategoryBadgeVariant(
  category: KnowledgeCategory
): "emerald" | "violet" | "copper" | "secondary" | "default" {
  switch (category) {
    case "decision":
      return "emerald";
    case "milestone":
      return "violet";
    case "risk":
      return "copper";
    case "task":
      return "default";
    case "insight":
      return "secondary";
    default:
      return "secondary";
  }
}

export function getReviewStatusBadgeVariant(
  status: KnowledgeReviewStatus
): "emerald" | "copper" | "destructive" | "secondary" {
  switch (status) {
    case "approved":
      return "emerald";
    case "pending":
      return "copper";
    case "rejected":
      return "destructive";
    default:
      return "secondary";
  }
}

export function getReviewStatusLabel(status: KnowledgeReviewStatus): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "pending":
      return "Pending Review";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

export function getOriginLabel(origin: KnowledgeOrigin): string {
  switch (origin) {
    case "explicit_fact":
      return "Explicit Fact";
    case "ai_inference":
      return "AI Inference";
    default:
      return origin;
  }
}

export function formatConfidence(confidence: number): string {
  const percentage = Math.round(confidence * 100);
  return `${percentage}%`;
}

export function getConfidenceBadgeColor(confidence: number): string {
  if (confidence >= 0.85) return "text-primary border-primary/30 bg-primary/10";
  if (confidence >= 0.6) return "text-copper border-copper/30 bg-copper/10";
  return "text-destructive border-destructive/30 bg-destructive/10";
}
