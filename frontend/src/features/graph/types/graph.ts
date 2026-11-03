import type { KnowledgeCategory, KnowledgeReviewStatus } from "@/features/knowledge/types/knowledge";

export interface GraphNode {
  id: string;
  title: string;
  category: string;
  review_status: string;
  confidence: number;
  status: string | null;
  metadata_info: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  evidence_text: string | null;
  review_status: string | null;
}

export interface GraphFinding {
  type: "circular_dependency" | "blocked_chain" | string;
  severity: "critical" | "high" | "medium" | string;
  title: string;
  description: string;
  involved_node_ids: string[];
  details: Record<string, unknown>;
}

export interface DependencyGraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  findings: GraphFinding[];
  total_nodes: number;
  total_edges: number;
}

export interface SubgraphResponse {
  center_node_id: string;
  depth: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  upstream_count: number;
  downstream_count: number;
}

export interface Neo4jSyncResponse {
  enabled: boolean;
  synced_nodes: number;
  synced_edges: number;
  message?: string;
  details?: Record<string, unknown>;
}

export type GraphCategoryFilter = KnowledgeCategory | "all";
export type GraphReviewStatusFilter = "all" | "verified" | "unverified" | "rejected" | KnowledgeReviewStatus;

export interface GraphFilterOptions {
  category?: GraphCategoryFilter;
  review_status?: GraphReviewStatusFilter;
}
