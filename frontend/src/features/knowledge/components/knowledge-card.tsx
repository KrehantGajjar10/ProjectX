"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { KnowledgeItemRead } from "../types/knowledge";
import {
  formatConfidence,
  getCategoryBadgeVariant,
  getCategoryLabel,
  getConfidenceBadgeColor,
  getOriginLabel,
  getReviewStatusBadgeVariant,
  getReviewStatusLabel,
} from "../lib/knowledge-utils";
import {
  ArrowRight,
  Link as LinkIcon,
  Sparkles,
  Zap,
} from "lucide-react";

interface KnowledgeCardProps {
  item: KnowledgeItemRead;
  onClick: (item: KnowledgeItemRead) => void;
}

export function KnowledgeCard({ item, onClick }: KnowledgeCardProps) {
  const verifiedEvidenceCount = item.evidences?.filter((e) => e.verified).length || 0;
  const totalEvidenceCount = item.evidences?.length || 0;
  const isAiInference = item.origin === "ai_inference";

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onClick(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(item);
        }
      }}
      className="group relative cursor-pointer border-border/80 bg-card p-0 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none text-left"
    >
      <CardHeader className="p-4 sm:p-5 pb-3 space-y-2.5">
        {/* Top Badges Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant={getCategoryBadgeVariant(item.category)}
              className="text-[10px] uppercase font-mono tracking-wider font-semibold"
            >
              {getCategoryLabel(item.category)}
            </Badge>

            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono border ${
                isAiInference
                  ? "border-violet/30 bg-violet/10 text-violet"
                  : "border-primary/30 bg-primary/10 text-primary"
              }`}
            >
              {isAiInference ? (
                <Sparkles className="h-2.5 w-2.5" />
              ) : (
                <Zap className="h-2.5 w-2.5" />
              )}
              {getOriginLabel(item.origin)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={getReviewStatusBadgeVariant(item.review_status)}
              className="text-[10px] font-mono uppercase tracking-wider"
            >
              {getReviewStatusLabel(item.review_status)}
            </Badge>

            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-medium border ${getConfidenceBadgeColor(
                item.confidence
              )}`}
              title={`Confidence: ${(item.confidence * 100).toFixed(1)}%`}
            >
              {formatConfidence(item.confidence)}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
          {item.title}
        </h3>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 pt-0 space-y-3.5">
        {/* Description Excerpt */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {item.description}
        </p>

        {/* Footer Metrics & Evidence Link info */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border/60 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px]">
            <LinkIcon className="h-3.5 w-3.5 text-primary shrink-0" />
            {totalEvidenceCount > 0 ? (
              <span>
                {totalEvidenceCount} excerpt{totalEvidenceCount === 1 ? "" : "s"}
                {verifiedEvidenceCount > 0 && (
                  <span className="text-primary font-medium ml-1">
                    ({verifiedEvidenceCount} verified)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground/70 italic">No direct excerpts</span>
            )}
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            Inspect <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
