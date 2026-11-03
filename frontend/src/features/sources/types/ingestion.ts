export type IngestionJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "failed";

export interface IngestionJobRead {
  id: string;
  project_id: string;
  source_id: string | null;
  status: IngestionJobStatus;
  progress: number;
  error: string | null;
  retry_count: number;
  max_retries: number;
  metadata_info: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IngestionJobCreateInput {
  source_ids?: string[] | null;
}
