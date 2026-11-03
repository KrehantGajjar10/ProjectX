"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  KnowledgeItemDetailRead,
  KnowledgeItemRead,
  KnowledgeReviewStatus,
} from "../types/knowledge";
import type { ProjectRole } from "@/types/project";
import {
  canReviewKnowledge,
  getReviewStatusBadgeVariant,
  getReviewStatusLabel,
} from "../lib/knowledge-utils";
import { reviewKnowledgeItemClient } from "../lib/knowledge-client";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";

interface ReviewControlsProps {
  projectId: string;
  item: KnowledgeItemRead | KnowledgeItemDetailRead;
  userRole?: ProjectRole | null;
  onReviewSuccess: (updatedItem: KnowledgeItemDetailRead) => void;
  className?: string;
}

export function ReviewControls({
  projectId,
  item,
  userRole,
  onReviewSuccess,
  className,
}: ReviewControlsProps) {
  const isAuthorized = canReviewKnowledge(userRole);
  const [reviewNote, setReviewNote] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = React.useState<string | null>(
    null
  );

  const handleReviewAction = async (status: KnowledgeReviewStatus) => {
    if (!isAuthorized) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessFeedback(null);

    try {
      const updated = await reviewKnowledgeItemClient(projectId, item.id, {
        review_status: status,
        review_note: reviewNote.trim() ? reviewNote.trim() : null,
      });

      setSuccessFeedback(
        `Knowledge item successfully ${status === "approved" ? "approved" : status === "rejected" ? "rejected" : "updated"}.`
      );
      setReviewNote("");
      onReviewSuccess(updated);

      // Clear success banner after 4 seconds
      setTimeout(() => {
        setSuccessFeedback(null);
      }, 4000);
    } catch (err) {
      console.error("Review error:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to submit review verification."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedReviewedDate = item.reviewed_at
    ? new Date(item.reviewed_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      className={`rounded-xl border border-border/80 bg-card p-4 sm:p-5 space-y-4 shadow-2xs ${
        className || ""
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              Verification & Governance
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-foreground font-medium">Status:</span>
              <Badge
                variant={getReviewStatusBadgeVariant(item.review_status)}
                className="text-[10px] uppercase font-mono tracking-wider"
              >
                {getReviewStatusLabel(item.review_status)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Role Privileges Indicator */}
        <div className="text-right">
          {isAuthorized ? (
            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary font-medium">
              Reviewer active ({userRole})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
              Role: {userRole || "viewer"} (Read-only)
            </span>
          )}
        </div>
      </div>

      {/* Existing Review Note / Audit History */}
      {item.review_note && (
        <div className="rounded-lg border border-border/70 bg-surface/50 p-3 space-y-1 text-xs">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider">
              Auditor Note History
            </span>
            {formattedReviewedDate && <span>Reviewed on {formattedReviewedDate}</span>}
          </div>
          <p className="text-foreground leading-relaxed whitespace-pre-wrap font-mono text-[11px]">
            {item.review_note}
          </p>
        </div>
      )}

      {/* Success Banner */}
      {successFeedback && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-primary animate-in fade-in-50"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{successFeedback}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Reviewer Action Form (Only visible to Reviewer, Admin, Owner) */}
      {isAuthorized ? (
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <label
              htmlFor="review-note-input"
              className="text-[11px] font-mono text-muted-foreground block font-medium"
            >
              Reviewer Note / Verification Rationale (optional):
            </label>
            <textarea
              id="review-note-input"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. Verified with architecture lead; ground truth confirmed from RFC Section 3..."
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 resize-y"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="text-[11px] text-muted-foreground">
              Verification changes will be recorded in the project audit log.
            </div>

            <div className="flex items-center gap-2">
              {item.review_status !== "pending" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleReviewAction("pending")}
                  disabled={isSubmitting}
                  className="gap-1 text-xs"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Reset to Pending
                </Button>
              )}

              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => handleReviewAction("rejected")}
                disabled={isSubmitting}
                className="gap-1.5 text-xs font-medium"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Reject Item
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => handleReviewAction("approved")}
                disabled={isSubmitting}
                className="gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Approve Item
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border/70 bg-surface/40 p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
          <ShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <span>
            You have read-only access to knowledge verification. Approving or rejecting knowledge items requires <strong>Reviewer</strong>, <strong>Admin</strong>, or <strong>Owner</strong> role in this project.
          </span>
        </div>
      )}
    </div>
  );
}
