"use client";

import * as React from "react";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import type { Neo4jSyncResponse } from "../types/graph";
import { clientSyncNeo4j, GraphClientError } from "../lib/graph-client";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  Server,
  Share2,
} from "lucide-react";

const DialogContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
} | null>(null);

function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

function DialogContent({
  className = "",
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  const dialog = React.useContext(DialogContext);
  if (!dialog?.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dialog.onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full rounded-lg border bg-background p-6 shadow-lg ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4">{children}</div>;
}

function DialogTitle({
  className = "",
  children,
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={className}>{children}</h2>;
}

function DialogDescription({
  className = "",
  children,
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={className}>{children}</p>;
}

function DialogFooter({
  className = "",
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`mt-4 flex justify-end ${className}`}>{children}</div>;
}

interface Neo4jSyncModalProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncCompleted?: () => void;
}

export function Neo4jSyncModal({
  projectId,
  projectName,
  open,
  onOpenChange,
  onSyncCompleted,
}: Neo4jSyncModalProps) {
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [result, setResult] = React.useState<Neo4jSyncResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Reset state when opening
  React.useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
    }
  }, [open]);

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setResult(null);

    try {
      const res = await clientSyncNeo4j(projectId);
      setResult(res);
      if (onSyncCompleted) {
        onSyncCompleted();
      }
    } catch (err) {
      if (err instanceof GraphClientError) {
        setError(err.message);
      } else {
        setError("Failed to execute Neo4j synchronization. Please check your network or user permissions.");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Sync with Neo4j Graph DB
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Project: {projectName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <p className="text-muted-foreground leading-relaxed">
            Synchronizes extracted knowledge entities and verified dependency relationships into the dedicated Neo4j graph database for advanced property-graph queries and enterprise topology analysis.
          </p>

          <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between font-medium">
              <span className="text-foreground">Required Role</span>
              <Badge variant="outline" className="text-[10px]">
                ADMIN / OWNER
              </Badge>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Target DB Type</span>
              <span className="font-mono text-[11px]">Neo4j Community / Aura</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Sync Direction</span>
              <span>PostgreSQL &rarr; Neo4j (Write-through)</span>
            </div>
          </div>

          {/* Sync Result State */}
          {result && (
            <div
              className={`rounded-xl border p-3.5 space-y-2 ${
                result.enabled
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {result.enabled ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                )}
                <span>
                  {result.enabled ? "Sync Successful" : "Neo4j Not Enabled"}
                </span>
              </div>

              <p className="text-[11px] leading-relaxed">
                {result.message || (result.enabled
                  ? `Successfully synchronized ${result.synced_nodes} nodes and ${result.synced_edges} edges.`
                  : "Neo4j integration is disabled in backend configuration.")}
              </p>

              {result.enabled && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-lg bg-background/60 p-2 text-center">
                    <span className="block text-xs font-bold text-foreground">
                      {result.synced_nodes}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Nodes Synced
                    </span>
                  </div>
                  <div className="rounded-lg bg-background/60 p-2 text-center">
                    <span className="block text-xs font-bold text-foreground">
                      {result.synced_edges}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Edges Synced
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4" />
                <span>Synchronization Failed</span>
              </div>
              <p className="text-[11px] leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSyncing}
          >
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2"
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Synchronizing...
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Sync Now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
