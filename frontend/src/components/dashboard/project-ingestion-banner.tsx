import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Info, RefreshCw, Zap } from "lucide-react";

interface ProjectIngestionBannerProps {
  ingestionStatus: Record<string, unknown> | null;
}

export function ProjectIngestionBanner({
  ingestionStatus,
}: ProjectIngestionBannerProps) {
  if (!ingestionStatus) {
    return (
      <div className="rounded-xl border border-border/70 bg-surface/40 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Zap className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-foreground">
                Knowledge Pipeline Status
              </span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                Standby
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              No sources ingested yet. Knowledge ingestion connectors (GitHub PRs, Slack discussions, architecture RFCs) will be configured in subsequent chapters.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 text-xs font-mono text-muted-foreground bg-card px-3 py-1.5 rounded-lg border border-border/60">
          <GitBranch className="h-3.5 w-3.5 text-primary" />
          <span>Zero external syncs</span>
        </div>
      </div>
    );
  }

  const statusStr = String(ingestionStatus.status || "completed");
  const providerStr = String(ingestionStatus.provider || "automated-pipeline");
  const itemsCount = ingestionStatus.items_processed ?? 0;

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <RefreshCw className="h-4 w-4" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-semibold text-foreground">
              Last Ingestion: {providerStr}
            </span>
            <Badge
              variant={statusStr === "completed" ? "emerald" : "copper"}
              className="text-[10px] uppercase font-mono py-0 px-1.5"
            >
              {statusStr}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Processed {String(itemsCount)} knowledge items into evidence-grounded store.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 text-primary" />
        <span>Grounded claims linked</span>
      </div>
    </div>
  );
}
