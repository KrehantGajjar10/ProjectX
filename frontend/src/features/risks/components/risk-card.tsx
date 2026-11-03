"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { RiskItemRead } from "../types/risk";
import {
  AlertOctagon,
  AlertTriangle,
  Cpu,
  FileText,
  Info,
  Sparkles,
} from "lucide-react";

interface RiskCardProps {
  risk: RiskItemRead;
  isSelected?: boolean;
  onSelect: (risk: RiskItemRead) => void;
}

export function RiskCard({ risk, isSelected, onSelect }: RiskCardProps) {
  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return (
          <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] uppercase font-semibold gap-1">
            <AlertOctagon className="h-3 w-3" />
            Critical
          </Badge>
        );
      case "high":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] uppercase font-semibold gap-1">
            <AlertTriangle className="h-3 w-3" />
            High
          </Badge>
        );
      case "medium":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] uppercase font-semibold gap-1">
            <Info className="h-3 w-3" />
            Medium
          </Badge>
        );
      case "low":
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px] uppercase font-semibold">
            Low
          </Badge>
        );
    }
  };

  const formatCategory = (cat: string) => {
    return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const isComputed = risk.source_type === "computed_signal";

  return (
    <div
      onClick={() => onSelect(risk)}
      className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 cursor-pointer text-left ${
        isSelected
          ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/40"
          : "border-border/80 bg-card hover:border-primary/50 hover:bg-muted/30 shadow-xs"
      }`}
    >
      <div className="space-y-2.5">
        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {getSeverityBadge(risk.severity)}
            <Badge variant="secondary" className="text-[10px] font-medium">
              {formatCategory(risk.category)}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px]">
            {isComputed ? (
              <span className="inline-flex items-center gap-1 text-primary font-medium">
                <Cpu className="h-3 w-3" />
                Signal
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                <Sparkles className="h-3 w-3 text-purple-500" />
                Extracted
              </span>
            )}
            <span className="font-mono">{Math.round(risk.confidence * 100)}%</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {risk.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
          {risk.description}
        </p>
      </div>

      {/* Footer info: evidence count and rationale snippet */}
      <div className="mt-3.5 flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
        <span className="truncate max-w-50 italic">
          {risk.rationale || "Automated risk analysis"}
        </span>

        {risk.evidence && risk.evidence.length > 0 && (
          <div className="flex items-center gap-1 text-primary shrink-0 font-medium">
            <FileText className="h-3 w-3" />
            <span>{risk.evidence.length} evidence</span>
          </div>
        )}
      </div>
    </div>
  );
}
