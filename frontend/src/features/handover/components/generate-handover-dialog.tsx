"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { HandoverGenerateRequest } from "../types/handover";
import {
  FileText,
  Loader2,
  Sparkles,
  User,
  X,
  Target,
  CheckCircle,
} from "lucide-react";

interface GenerateHandoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (data: HandoverGenerateRequest) => Promise<void>;
  isSubmitting: boolean;
}

export function GenerateHandoverDialog({
  open,
  onOpenChange,
  onGenerate,
  isSubmitting,
}: GenerateHandoverDialogProps) {
  const [departingName, setDepartingName] = React.useState("");
  const [focusArea, setFocusArea] = React.useState("");
  const [approvedOnly, setApprovedOnly] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onGenerate({
      departing_member_name: departingName.trim() || null,
      focus_area: focusArea.trim() || null,
      approved_only: approvedOnly,
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onOpenChange(false);
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-handover-dialog-title"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in-50 zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-border/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="generate-handover-dialog-title"
                className="text-base sm:text-lg font-bold text-foreground"
              >
                Generate Handover Report
              </h2>
              <p className="text-xs text-muted-foreground">
                Synthesize project knowledge into an evidence-backed handover.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-50 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Departing Member Name */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 font-semibold text-foreground">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Departing Team Member (Optional)
            </label>
            <input
              type="text"
              value={departingName}
              onChange={(e) => setDepartingName(e.target.value)}
              placeholder="e.g. Alex Mercer, Sarah Connor"
              disabled={isSubmitting}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <p className="text-[11px] text-muted-foreground leading-normal">
              Used to detect single points of knowledge and sole-author commits.
            </p>
          </div>

          {/* Focus Area */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 font-semibold text-foreground">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              Focus Area or Component (Optional)
            </label>
            <input
              type="text"
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              placeholder="e.g. Auth Service, Core Database, Payment Gateway"
              disabled={isSubmitting}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <p className="text-[11px] text-muted-foreground leading-normal">
              Prioritizes this architectural domain in the continuation plan.
            </p>
          </div>

          {/* Approved Knowledge Only */}
          <div className="rounded-xl border border-border/80 bg-surface/50 p-3.5 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={approvedOnly}
                onChange={(e) => setApprovedOnly(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary disabled:opacity-50"
              />
              <div className="space-y-0.5">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  Include Approved Knowledge Only
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  When unchecked, approved claims are prioritized first, and unverified or pending knowledge items are explicitly labelled.
                </p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/70">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Starting Job...
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" />
                  Start Generation
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
