import { Container } from "@/components/landing/container";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  FileCheck,
  FileCode2,
  Lock,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
} from "lucide-react";

export function TrustEvidence() {
  return (
    <section id="trust" className="py-16 md:py-24 border-b border-border/40 scroll-mt-14">
      <Container className="space-y-12">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center space-y-3">
          <Badge variant="emerald" className="text-xs">
            The Trust Standard
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
            No hallucinations. Every claim cites verbatim proof.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Standard AI models summarize without accountability. ProjectX enforces a strict provenance chain: claims exist only if backed by an exact, verifiable substring in your code or documentation.
          </p>
        </div>

        {/* Visual Provenance Diagram (Source -> Programmatic Match -> Knowledge Item) */}
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-foreground">
                How Programmatic Evidence Linking Works
              </h3>
              <p className="text-xs text-muted-foreground">
                Illustrative example of ProjectX verification architecture.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-md">
                <ShieldCheck className="h-3.5 w-3.5" />
                Substring Match: 100%
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12 items-center">
            {/* Step 1: Raw Document Chunk */}
            <div className="lg:col-span-5 rounded-lg border border-border bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground flex items-center gap-1.5">
                  <FileCode2 className="h-3.5 w-3.5 text-copper" />
                  docs/DECISIONS.md#L82-L96
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Raw Chunk #3
                </span>
              </div>

              <div className="font-mono text-xs text-muted-foreground bg-background p-3 rounded border border-border/80 leading-relaxed space-y-1">
                <p className="text-muted-foreground/60">{"// Architecture meeting note - 2026"}</p>
                <p>
                  To eliminate message queue bottlenecks,{" "}
                  <mark className="bg-primary/20 text-foreground font-semibold px-1 rounded">
                    we chose an in-memory sliding window rate limiter backed by token bucket state
                  </mark>
                  , capping requests at 60/min.
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>SHA-256: e82f...a9c1</span>
                <span className="text-primary font-medium">Chunk Verified</span>
              </div>
            </div>

            {/* Step 2: Verification Engine Bridge */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center text-center py-2 space-y-2">
              <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center border border-primary/30">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="text-[11px] font-mono font-medium text-foreground">
                Programmatic Verify
              </div>
              <p className="text-[10px] text-muted-foreground max-w-[120px]">
                Validates substring existence in chunk before persisting
              </p>
            </div>

            {/* Step 3: Structured Knowledge Entity */}
            <div className="lg:col-span-5 rounded-lg border border-border bg-card p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <Badge variant="emerald" className="text-xs">
                  decision: approved
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  Confidence: 0.99
                </span>
              </div>

              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                  In-Memory Sliding Window Rate Limiting (60 req/min)
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  System limits request spikes using a sliding window algorithm with token bucket guarantees.
                </p>
              </div>

              <div className="rounded border border-border/70 bg-surface/60 p-2.5 text-[11px] font-mono text-foreground space-y-1">
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
                  Attached Evidence
                </div>
                <div className="truncate text-primary">
                  &ldquo;we chose an in-memory sliding window rate limiter...&rdquo;
                </div>
              </div>
            </div>
          </div>

          {/* 4 Pillars of ProjectX Trust */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-4 border-t border-border/70">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <FileCheck className="h-4 w-4 text-primary" />
                First-Class Provenance
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Evidence is an independent database entity, not a loose text blob. It retains source locator, chunk ID, and exact string.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-copper" />
                Surfacing Gaps & Conflicts
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Contradictory decisions and unstated rationales are flagged explicitly as gaps rather than smoothed over with invented answers.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <UserCheck className="h-4 w-4 text-violet" />
                Human-in-the-Loop Review
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tech leads and reviewers audit extracted insights. Approved items are stamped with reviewer ID, notes, and timestamps.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Lock className="h-4 w-4 text-foreground" />
                Immutable Handover Sign-Off
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Once approved, a handover report becomes permanently locked. Future edits create incremented versions with section diffs.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
