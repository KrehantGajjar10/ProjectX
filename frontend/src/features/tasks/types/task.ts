export type TaskStatus =
  | "todo"
  | "in_progress"
  | "completed"
  | "blocked"
  | "cancelled";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface TaskRead {
  id: string;
  project_id: string;
  knowledge_item_id: string | null;
  owner_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskUpdateInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  owner_id?: string | null;
  priority?: TaskPriority | string;
  due_date?: string | null;
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

export interface TaskFilterOptions {
  status?: TaskStatus | "all";
  priority?: TaskPriority | "all";
  owner_id?: string | "all" | "unassigned";
  is_completed?: boolean;
  is_blocked?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
}
