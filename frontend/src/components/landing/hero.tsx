import { Container } from "@/components/landing/container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle2,
  FileCode,
  FileText,
  GitBranch,
  Layers,
  ShieldCheck,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b border-border/40">
      {/* Subtle radial ambient background glow (restrained, non-distracting) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-96 w-160 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl opacity-70 dark:opacity-40"
      />

      <Container className="space-y-12">
        {/* Hero Narrative Block */}
        <div className="mx-auto max-w-3xl text-center space-y-6">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-2xs">
            <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-foreground font-semibold">ProjectX</span>
            <span className="text-border">|</span>
            <span>Capture. Understand. Handover.</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.12]">
            Never lose the context behind your project.
          </h1>

          {/* Subtitle / Supporting copy */}
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Scattered PRs, architectural notes, and departed engineers cause critical project context to vanish. ProjectX reconstructs engineering activity into <span className="text-foreground font-medium">evidence-linked knowledge items</span> and generates <span className="text-foreground font-medium">verifiable, sign-off ready handover reports</span>.
          </p>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="#workflow"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "gap-2 font-medium shadow-xs"
              )}
            >
              Explore the workflow
              <ArrowRight className="h-4 w-4" />
            </a>

            <a
              href="#capabilities"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "gap-2 font-medium"
              )}
            >
              Discover the platform
            </a>
          </div>

          {/* Concise Trust / Value Badges */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              Verbatim source excerpts
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Programmatically verified
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Audited human sign-off
            </span>
          </div>
        </div>

        {/* CSS-Built Product Interface Preview */}
        <div className="relative w-full rounded-xl border border-border bg-card/80 p-2 sm:p-3 shadow-xl backdrop-blur-xs">
          {/* Mock Window Titlebar */}
          <div className="flex items-center justify-between border-b border-border/80 px-3 py-2.5 bg-surface/50 rounded-t-lg">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-border" />
                <span className="h-2.5 w-2.5 rounded-full bg-border" />
                <span className="h-2.5 w-2.5 rounded-full bg-border" />
              </div>
              <span className="text-xs font-mono text-muted-foreground ml-2">
                projectx // chronos-workflow-engine // knowledge-graph
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="emerald" className="text-[11px] py-0 px-2">
                Tenant: project_id #2408a2
              </Badge>
            </div>
          </div>

          {/* Mock Workspace Content Grid */}
          <div className="p-4 sm:p-6 grid gap-4 lg:grid-cols-12 bg-background/50 rounded-b-lg">
            {/* Left: Active Extracted Knowledge Item */}
            <div className="lg:col-span-7 space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="emerald" className="gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified Decision
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    ID: a5c9affe
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-primary">
                  <Sparkles className="h-3 w-3" />
                  Confidence: 98%
                </div>
              </div>

              <div>
                <h2 className="text-base font-semibold text-foreground tracking-tight">
                  PostgreSQL 17 for Relational System of Record & DAG Traversal
                </h2>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Selected PostgreSQL 17 with asyncpg as the primary relational system of record, utilizing recursive Common Table Expressions (CTEs) for deterministic graph traversal.
                </p>
              </div>

              {/* First-Class Evidence Trace Block */}
              <div className="rounded-md border border-border bg-surface p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <FileCode className="h-3.5 w-3.5 text-copper" />
                    docs/ARCHITECTURE.md#chunk-0
                  </span>
                  <span className="font-mono text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    SHA-256 Verified
                  </span>
                </div>
                <p className="font-mono text-xs text-foreground/90 bg-background/80 p-2 rounded border border-border/70 leading-normal">
                  &ldquo;We selected PostgreSQL 17 with asyncpg as the primary relational system of record. Recursive CTEs provide deterministic DAG traversal.&rdquo;
                </p>
              </div>

              {/* Metadata tags */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="copper" className="text-[11px]">
                  Owner: Dave Miller (Departing)
                </Badge>
                <Badge variant="violet" className="text-[11px]">
                  Impact: Core Persistence
                </Badge>
                <span className="text-xs text-muted-foreground font-mono ml-auto">
                  Reviewed: 2026-11-02 by Tech Lead
                </span>
              </div>
            </div>

            {/* Right: Handover Status & Actionable Plan Overview */}
            <div className="lg:col-span-5 space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Handover Report v2
                    </span>
                  </div>
                  <Badge variant="default" className="text-[11px]">
                    Status: Approved
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Claims Verified:</span>
                    <span className="font-mono font-medium text-foreground">
                      24 / 24 (100%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-full rounded-full" />
                  </div>
                </div>

                <div className="space-y-2 text-xs pt-1">
                  <div className="rounded border border-border/70 bg-surface/80 p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        Single Points of Knowledge (SPOK)
                      </span>
                      <span className="text-[11px] text-copper font-medium">
                        1 High Risk
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Legacy compiler parsing pipeline was authored solely by Dave Miller. Transition sessions required.
                    </p>
                  </div>

                  <div className="rounded border border-border/70 bg-surface/80 p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        Continuation Plan (Week 1)
                      </span>
                      <span className="text-[11px] text-primary font-medium">
                        3 Actions
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Merge asyncpg connection pool tuning PR; verify graph migration script.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom export bar */}
              <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <GitBranch className="h-3 w-3" />
                  branch: main (rev #4f8a1)
                </span>
                <span className="text-primary font-medium flex items-center gap-1 text-[11px]">
                  Immutable Sign-Off
                  <ExternalLink className="h-3 w-3" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
