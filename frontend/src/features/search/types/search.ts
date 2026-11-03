import type { KnowledgeCategory } from "@/features/knowledge/types/knowledge";
import type { KnowledgeItemRead } from "@/features/knowledge/types/knowledge";

export type { KnowledgeCategory };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CitationRead {
  document_id: string | null;
  chunk_id: string | null;
  knowledge_item_id: string | null;
  document_title: string;
  file_path: string;
  location_info: Record<string, unknown>;
  exact_excerpt: string;
  verified: boolean;
  relevance_score: number;
}

export interface QARequest {
  question: string;
  categories?: KnowledgeCategory[] | null;
  source_ids?: string[] | null;
  verified_only?: boolean;
  top_k?: number;
  include_answer?: boolean;
  conversation_history?: ChatMessage[] | null;
}

export interface QAResponse {
  question: string;
  answer: string;
  is_sufficient: boolean;
  confidence: number;
  citations: CitationRead[];
  related_knowledge_items: KnowledgeItemRead[];
  retrieval_mode: "hybrid" | "vector_only" | "keyword_fallback";
  retrieved_count: number;
}

export interface SearchResultItem {
  id: string;
  entity_type: "chunk" | "knowledge_item" | string;
  title: string;
  content: string;
  file_path: string | null;
  location_info: Record<string, unknown>;
  category: KnowledgeCategory | null;
  score: number;
  verified: boolean;
  document_id: string | null;
  chunk_id: string | null;
  knowledge_item_id: string | null;
}

export interface SearchResultsResponse {
  query: string;
  total_results: number;
  retrieval_mode: "hybrid" | "vector_only" | "keyword_fallback";
  results: SearchResultItem[];
}

export interface SearchFilterOptions {
  q: string;
  category?: KnowledgeCategory | "all";
  verified_only?: boolean;
  limit?: number;
}
