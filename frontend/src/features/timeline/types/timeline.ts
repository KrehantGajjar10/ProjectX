import type { EvidenceRead } from "@/features/knowledge/types/knowledge";

export type TimelineEventType = "milestone" | "decision" | "task" | "commit" | string;

export interface TimelineEventRead {
  id: string;
  event_type: TimelineEventType;
  title: string;
  description: string | null;
  timestamp: string;
  actor: string | null;
  status: string | null;
  metadata_info: Record<string, unknown>;
  evidence: EvidenceRead[];
}

export interface TimelineResponse {
  events: TimelineEventRead[];
  total_events: number;
}

export interface TimelineFilterOptions {
  event_types?: TimelineEventType[];
  start_date?: string;
  end_date?: string;
  skip?: number;
  limit?: number;
}
