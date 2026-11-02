import type { UserRead } from "@/types/auth";

export type ProjectRole = "owner" | "admin" | "reviewer" | "member" | "viewer";

export interface ProjectMemberRead {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  created_at: string;
  updated_at: string;
  user?: UserRead | null;
}

export interface ProjectRead {
  id: string;
  name: string;
  description: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
  my_role?: ProjectRole | null;
}

export interface ProjectDetailRead extends ProjectRead {
  members: ProjectMemberRead[];
}

export interface ProjectCreateInput {
  name: string;
  description?: string | null;
}

export interface TaskProgressSummary {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  todo_tasks: number;
  blocked_tasks: number;
  cancelled_tasks: number;
  completion_percentage: number;
  overdue_tasks: number;
  unassigned_tasks: number;
}

export interface RiskItemHighlight {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  rationale: string;
  source_type: string;
  confidence: number;
}

export interface TaskHighlight {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
}

export interface DecisionHighlight {
  id: string;
  title: string;
  description: string;
  category: string;
  confidence: number;
  review_status: string;
}

export interface DashboardHighlights {
  critical_risks: RiskItemHighlight[];
  blocked_tasks: TaskHighlight[];
  recent_decisions: DecisionHighlight[];
}

export interface TimelineEventItem {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  timestamp: string;
  actor: string | null;
  status: string | null;
}

export interface ProjectDashboardSummary {
  project_id: string;
  name: string;
  description: string | null;
  items_by_category: Record<string, number>;
  items_by_review_status: Record<string, number>;
  unreviewed_items_count: number;
  open_risks_by_severity: Record<string, number>;
  total_risks_count: number;
  gaps_count: number;
  conflicts_count: number;
  tasks_progress: TaskProgressSummary;
  last_ingestion_status: Record<string, unknown> | null;
  recent_activity: TimelineEventItem[];
  highlights: DashboardHighlights;
}
