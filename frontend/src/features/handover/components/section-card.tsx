"use client";

import * as React from "react";
import Link from "next/link";
import type { HandoverSection } from "../types/handover";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  ExternalLink,
  FileText,
  HelpCircle,
  Network,
  Quote,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from "lucide-react";

interface SectionCardProps {
  section: HandoverSection;
  projectId: string;
}

export function SectionCard({ section, projectId }: SectionCardProps) {
  const [evidenceExpanded, setEvidenceExpanded] = React.useState(false);

  const getSectionIcon = (key: string) => {
    switch (key) {
      case "project_overview":
        return <Sparkles className="h-5 w-5 text-primary" />;
      case "completed_work":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "pending_and_blocked_tasks":
        return <Clock className="h-5 w-5 text-amber-500" />;
      case "key_decisions":
        return <BookOpen className="h-5 w-5 text-primary" />;
      case "open_risks":
        return <ShieldAlert className="h-5 w-5 text-rose-500" />;
      case "dependencies":
        return <Network className="h-5 w-5 text-violet" />;
      case "knowledge_gaps":
        return <HelpCircle className="h-5 w-5 text-copper" />;
      case "conflicts":
        return <AlertTriangle className="h-5 w-5 text-rose-500" />;
      case "continuation_plan":
        return <Compass className="h-5 w-5 text-primary" />;
      case "departing_member_knowledge":
        return <UserCheck className="h-5 w-5 text-copper" />;
      default:
        return <FileText className="h-5 w-5 text-primary" />;
    }
  };

  const claims = section.claims || [];
  const evidences = section.evidence_references || [];

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-4 hover:border-border transition-colors">
      {/* Section Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface border border-border/80">
            {getSectionIcon(section.key)}
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              {section.title}
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
              <span>{claims.length} {claims.length === 1 ? "claim" : "claims"}</span>
              <span>•</span>
              <span>{evidences.length} {evidences.length === 1 ? "citation" : "citations"}</span>
            </div>
          </div>
        </div>

        {evidences.length > 0 && (
          <button
            type="button"
            onClick={() => setEvidenceExpanded(!evidenceExpanded)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Quote className="h-3.5 w-3.5 text-primary" />
            <span>{evidenceExpanded ? "Hide Evidence" : "View Evidence"}</span>
            {evidenceExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {/* Narrative Body */}
      {section.narrative && (
        <div className="rounded-xl bg-surface/40 border border-border/50 p-4 text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line font-sans">
          {section.narrative}
        </div>
      )}

      {/* Claims List */}
      {claims.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Structured Statements & Grounded Claims
          </div>

          <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card overflow-hidden">
            {claims.map((claim, idx) => {
              const isVerified = claim.verified && !claim.flagged_unverified;

              return (
                <div key={idx} className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-foreground leading-relaxed">
                      {claim.text}
                    </p>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isVerified ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          <AlertCircle className="h-3 w-3" />
                          Unverified
                        </span>
                      )}

                      {claim.origin === "ai_inference" && (
                        <span className="inline-flex items-center rounded border border-border bg-surface px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">
                          Inference
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Inline claim citations if present */}
                  {claim.evidence_references && claim.evidence_references.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        Sources:
                      </span>
                      {claim.evidence_references.map((ref, rIdx) => (
                        <Link
                          key={rIdx}
                          href={`/app/projects/${projectId}/knowledge?item=${ref.knowledge_item_id}`}
                          className="inline-flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-primary hover:underline font-mono"
                          title={ref.exact_excerpt}
                        >
                          <span>{ref.document_name || "Document"}</span>
                          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expanded Evidence References Drawer */}
      {evidenceExpanded && evidences.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <Quote className="h-4 w-4" />
            <span>Primary Evidence Citations ({evidences.length})</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {evidences.map((ev, evIdx) => (
              <div
                key={evIdx}
                className="rounded-lg border border-border bg-card p-3 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3.5 w-3.5 text-copper shrink-0" />
                    <span className="font-semibold text-foreground truncate">
                      {ev.document_name || "Primary Source"}
                    </span>
                    {ev.source_locator && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        • {ev.source_locator}
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/app/projects/${projectId}/knowledge?item=${ev.knowledge_item_id}`}
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0"
                  >
                    View Knowledge Claim
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                <div className="rounded bg-surface/70 border border-border/40 p-2 text-muted-foreground italic font-serif text-[11px] leading-relaxed">
                  &ldquo;{ev.exact_excerpt}&rdquo;
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
