export type KnowledgeCategory =
  | "decision"
  | "task"
  | "risk"
  | "milestone"
  | "insight";

export type KnowledgeOrigin = "explicit_fact" | "ai_inference";

export type KnowledgeReviewStatus = "pending" | "approved" | "rejected";

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "completed"
  | "blocked"
  | "cancelled";

export interface EvidenceRead {
  id: string;
  project_id: string;
  knowledge_item_id: string;
  document_id: string | null;
  chunk_id: string | null;
  source_locator: string;
  exact_excerpt: string;
  verified: boolean;
  confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface DependencyRead {
  id: string;
  project_id: string;
  source_knowledge_item_id: string | null;
  target_knowledge_item_id: string | null;
  source_task_id: string | null;
  target_task_id: string | null;
  type: string;
  evidence_text: string | null;
  created_at: string;
  updated_at: string;
}

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

export interface KnowledgeItemRead {
  id: string;
  project_id: string;
  category: KnowledgeCategory;
  title: string;
  description: string;
  confidence: number;
  origin: KnowledgeOrigin;
  review_status: KnowledgeReviewStatus;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  evidences: EvidenceRead[];
}

export interface KnowledgeItemDetailRead extends KnowledgeItemRead {
  tasks: TaskRead[];
  source_dependencies: DependencyRead[];
  target_dependencies: DependencyRead[];
}

export interface KnowledgeItemReviewRequest {
  review_status: KnowledgeReviewStatus;
  review_note?: string | null;
  title?: string | null;
  description?: string | null;
}

export interface BulkReviewRequest {
  item_ids: string[];
  review_status: KnowledgeReviewStatus;
  review_note?: string | null;
}

export interface BulkReviewResponse {
  updated_count: number;
  review_status: KnowledgeReviewStatus;
}

export interface KnowledgeFilterOptions {
  category?: KnowledgeCategory | "all";
  review_status?: KnowledgeReviewStatus | "all";
  origin?: KnowledgeOrigin | "all";
  verified?: boolean;
  q?: string;
  min_confidence?: number;
  max_confidence?: number;
  skip?: number;
  limit?: number;
}
