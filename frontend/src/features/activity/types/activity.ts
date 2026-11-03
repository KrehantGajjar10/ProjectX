export interface AuditLogRead {
  id: string;
  project_id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ProjectActivityResponse {
  items: AuditLogRead[];
  total: number;
  skip: number;
  limit: number;
}

export interface ActivityFilterOptions {
  action?: string | null;
  entity_type?: string | null;
  skip?: number;
  limit?: number;
}
