import type { EvidenceRead } from "@/features/knowledge/types/knowledge";

export type RiskSeverity = "critical" | "high" | "medium" | "low";

export type RiskCategory =
  | "extracted_risk"
  | "schedule"
  | "ownership"
  | "conflict"
  | "unverified_evidence"
  | "stale_task"
  | "single_point_of_knowledge"
  | string;

export type RiskSourceType = "extracted" | "computed_signal";

export interface RiskItemRead {
  id: string;
  title: string;
  description: string;
  category: RiskCategory;
  severity: RiskSeverity;
  rationale: string;
  source_type: RiskSourceType;
  confidence: number;
  entity_id?: string | null;
  evidence: EvidenceRead[];
}

export interface RiskSummaryRead {
  total_risks: number;
  by_severity: Record<string, number>;
  by_category: Record<string, number>;
  by_source_type: Record<string, number>;
  risks: RiskItemRead[];
}

export interface RiskFilterOptions {
  severity?: RiskSeverity | "all";
  category?: RiskCategory | "all";
  source_type?: RiskSourceType | "all";
  search?: string;
}
