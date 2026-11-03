"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { HandoverReviewRequest } from "../types/handover";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";

interface ReviewHandoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportVersion: number;
  onReview: (data: HandoverReviewRequest) => Promise<void>;
  isSubmitting: boolean;
}

export function ReviewHandoverDialog({
  open,
  onOpenChange,
  reportVersion,
  onReview,
  isSubmitting,
}: ReviewHandoverDialogProps) {
  const [action, setAction] = React.useState<"approve" | "reject">("approve");
  const [comment, setComment] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onReview({
      action,
      comment: comment.trim() || null,
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
        aria-labelledby="review-handover-dialog-title"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in-50 zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-border/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="review-handover-dialog-title"
                className="text-base sm:text-lg font-bold text-foreground"
              >
                Review Report v{reportVersion}
              </h2>
              <p className="text-xs text-muted-foreground">
                Approve as official record or return with requested changes.
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
          {/* Action Choice */}
          <div className="space-y-2">
            <label className="font-semibold text-foreground">
              Review Decision <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAction("approve")}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition-all ${
                  action === "approve"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                    : "border-border bg-surface/50 text-muted-foreground hover:bg-surface"
                }`}
              >
                <ThumbsUp className="h-5 w-5 text-emerald-500" />
                <span>Approve Report</span>
                <span className="text-[10px] opacity-75">
                  Permanently seals this version
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAction("reject")}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition-all ${
                  action === "reject"
                    ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold"
                    : "border-border bg-surface/50 text-muted-foreground hover:bg-surface"
                }`}
              >
                <ThumbsDown className="h-5 w-5 text-rose-500" />
                <span>Request Changes</span>
                <span className="text-[10px] opacity-75">
                  Reverts status to Draft
                </span>
              </button>
            </div>
          </div>

          {/* Warning Banner */}
          {action === "approve" ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-2.5 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
              <p className="text-[11px] leading-relaxed">
                <strong>Permanent Approval:</strong> Once approved, this handover report becomes immutable and cannot be edited or resubmitted.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2.5 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
              <p className="text-[11px] leading-relaxed">
                <strong>Reverting to Draft:</strong> This will unlock the report and allow the team to regenerate or modify project sources.
              </p>
            </div>
          )}

          {/* Comment */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">
              Audited Feedback / Note (Optional)
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                action === "approve"
                  ? "e.g. Verified architecture and critical risk mitigations."
                  : "e.g. Please clarify single point of knowledge in auth service."
              }
              disabled={isSubmitting}
              className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
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
              className={
                action === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  : "bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Recording Review...
                </>
              ) : action === "approve" ? (
                <>
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Confirm Approval
                </>
              ) : (
                <>
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Confirm Rejection
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
