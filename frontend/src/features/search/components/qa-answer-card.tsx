"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { CitationRead, QAResponse } from "../types/search";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Layers,
  Quote,
  Sparkles,
} from "lucide-react";

interface QAAnswerCardProps {
  response: QAResponse;
  projectId: string;
}

export function QAAnswerCard({ response, projectId }: QAAnswerCardProps) {
  const [citationsExpanded, setCitationsExpanded] = React.useState(true);

  const confidencePct = Math.round(response.confidence * 100);

  const getConfidenceBadge = (pct: number) => {
    if (pct >= 85) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    }
    if (pct >= 60) {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
    }
    return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-5 sm:p-7 shadow-md space-y-6 animate-in fade-in-50 duration-200">
      {/* Header: Question & Metadata */}
      <div className="space-y-3 pb-4 border-b border-border/70">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            ProjectX Contextual AI
          </div>

          <div className="flex items-center gap-2 text-xs">
            {/* Retrieval Mode */}
            <span className="rounded bg-surface px-2 py-0.5 font-mono text-[11px] text-muted-foreground border border-border/60">
              {response.retrieval_mode.replace("_", " ")}
            </span>

            {/* Confidence Score */}
            <span
              className={`rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${getConfidenceBadge(
                confidencePct
              )}`}
            >
              Confidence: {confidencePct}%
            </span>
          </div>
        </div>

        <h2 className="text-base sm:text-lg font-bold text-foreground">
          {response.question}
        </h2>
      </div>

      {/* Sufficiency Warning Banner (if evidence is partial or insufficient) */}
      {!response.is_sufficient && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold">Partial Evidence Available</div>
            <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
              The project sources do not contain sufficient conclusive facts to fully answer this question with 100% certainty. The answer below is grounded strictly in what was available.
            </p>
          </div>
        </div>
      )}

      {/* Synthesized Answer Body */}
      <div className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          Grounded Answer
        </div>
        <div className="rounded-xl bg-surface/50 border border-border/70 p-4 sm:p-5 text-sm sm:text-base text-foreground leading-relaxed whitespace-pre-line">
          {response.answer}
        </div>
      </div>

      {/* Citations & Evidence Section */}
      {response.citations && response.citations.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">
                Supporting Evidence & Citations ({response.citations.length})
              </span>
            </div>

            <button
              type="button"
              onClick={() => setCitationsExpanded(!citationsExpanded)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium"
            >
              {citationsExpanded ? (
                <>
                  <span>Collapse</span>
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  <span>Expand</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>

          {citationsExpanded && (
            <div className="grid grid-cols-1 gap-3">
              {response.citations.map((citation, index) => {
                const pageNumber =
                  typeof citation.location_info?.page === "number"
                    ? `Page ${citation.location_info.page}`
                    : null;

                return (
                  <div
                    key={index}
                    className="rounded-xl border border-border bg-card p-3.5 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-copper shrink-0" />
                        <span className="font-semibold text-foreground truncate">
                          {citation.document_title || citation.file_path || "Project Document"}
                        </span>
                        {pageNumber && (
                          <span className="text-muted-foreground font-mono text-[10px]">
                            • {pageNumber}
                          </span>
                        )}
                      </div>

                      {citation.verified && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20 shrink-0">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified Excerpt
                        </span>
                      )}
                    </div>

                    {/* Quoted Excerpt */}
                    <div className="flex items-start gap-2 rounded-lg bg-surface/70 border border-border/40 p-2.5 text-muted-foreground italic font-serif text-[11px] leading-relaxed">
                      <Quote className="h-3.5 w-3.5 text-primary shrink-0 not-italic mt-0.5" />
                      <span>{citation.exact_excerpt}</span>
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-end pt-1">
                      {citation.knowledge_item_id ? (
                        <Link
                          href={`/app/projects/${projectId}/knowledge?item=${citation.knowledge_item_id}`}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                        >
                          View Knowledge Claim
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <Link
                          href={`/app/projects/${projectId}/sources`}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium"
                        >
                          View Source Document
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Related Knowledge Items (if any returned by backend) */}
      {response.related_knowledge_items && response.related_knowledge_items.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Layers className="h-4 w-4 text-violet" />
            <span>Related Project Knowledge Records</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {response.related_knowledge_items.map((kitem) => (
              <Link
                key={kitem.id}
                href={`/app/projects/${projectId}/knowledge?item=${kitem.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:border-primary/50 hover:bg-surface transition-colors"
              >
                <span className="capitalize text-[10px] text-muted-foreground font-mono">
                  [{kitem.category}]
                </span>
                <span className="font-medium truncate max-w-50">{kitem.title}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
