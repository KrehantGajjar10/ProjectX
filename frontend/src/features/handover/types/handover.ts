export type HandoverReportStatus = "draft" | "in_review" | "approved" | "rejected";

export interface EvidenceReference {
  evidence_id: string;
  knowledge_item_id: string;
  knowledge_item_title: string;
  document_name: string | null;
  source_locator: string;
  exact_excerpt: string;
  verified: boolean;
  review_status: string;
  origin: string;
  confidence: number;
}

export interface HandoverClaim {
  text: string;
  referenced_item_ids: string[];
  verified: boolean;
  evidence_references: EvidenceReference[];
  review_status: string;
  origin: string;
  flagged_unverified: boolean;
}

export interface HandoverSection {
  key: string;
  title: string;
  narrative: string;
  claims: HandoverClaim[];
  evidence_references: EvidenceReference[];
  stats: Record<string, unknown>;
}

export interface HandoverReportDetailRead {
  id: string;
  project_id: string;
  title: string;
  version: number;
  status: HandoverReportStatus;
  departing_member_name: string | null;
  focus_area: string | null;
  approved_only: boolean;
  review_comment: string | null;
  sections: Record<string, HandoverSection>;
  all_evidence_references: EvidenceReference[];
  total_claims: number;
  verified_claims: number;
  unverified_claims: number;
  generated_at: string;
  created_by_id: string | null;
  approved_by_id: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HandoverReportVersionSummary {
  id: string;
  project_id: string;
  title: string;
  version: number;
  status: HandoverReportStatus;
  departing_member_name: string | null;
  focus_area: string | null;
  total_claims: number;
  evidence_count: number;
  generated_at: string;
  approved_at: string | null;
  approved_by_id: string | null;
}

export interface HandoverGenerationJobStatus {
  job_id: string;
  status: string; // "queued" | "processing" | "completed" | "failed"
  progress: number;
  error: string | null;
  report_id: string | null;
  created_at: string;
}

export interface LatestHandoverResponse {
  report: HandoverReportDetailRead | null;
  active_job: HandoverGenerationJobStatus | null;
}

export interface HandoverGenerateRequest {
  departing_member_name?: string | null;
  focus_area?: string | null;
  approved_only?: boolean;
}

export interface HandoverReviewRequest {
  action: "approve" | "reject";
  comment?: string | null;
}

export interface HandoverDiffSection {
  section_key: string;
  section_title: string;
  v1_claims_count: number;
  v2_claims_count: number;
  v1_evidence_count: number;
  v2_evidence_count: number;
  content_changed: boolean;
  v1_summary: string;
  v2_summary: string;
}

export interface HandoverDiffResponse {
  project_id: string;
  v1_version: number;
  v2_version: number;
  v1_status: string;
  v2_status: string;
  section_diffs: HandoverDiffSection[];
}

export type ExportFormat = "markdown" | "pdf" | "docx";
