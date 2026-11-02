"use client";

import * as React from "react";
import { Container } from "@/components/landing/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowRight, ShieldCheck } from "lucide-react";

const emptySubscribe = () => () => {};

export function Footer() {
  const currentYear = React.useSyncExternalStore(
    emptySubscribe,
    () => new Date().getFullYear(),
    () => 2026
  );

  return (
    <footer className="border-t border-border bg-card/60">
      {/* Pre-Footer Action Block */}
      <section className="py-16 md:py-20 border-b border-border/70">
        <Container>
          <div className="relative mx-auto max-w-4xl rounded-2xl border border-primary/30 bg-surface/80 p-6 sm:p-10 lg:p-12 text-center space-y-6 shadow-sm overflow-hidden">
            {/* Ambient subtle glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-64 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-2xl opacity-60"
            />

            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verifiable Engineering Continuity
            </div>

            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
              Turn scattered project context into verifiable handovers today.
            </h2>

            <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Eliminate tribal knowledge silos, prevent painful onboarding ramps, and guarantee that architectural decisions survive team transitions.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href="#workflow"
                className={cn(
                  buttonVariants({ variant: "default", size: "lg" }),
                  "gap-2 font-medium shadow-xs"
                )}
              >
                Explore the 5-stage pipeline
                <ArrowRight className="h-4 w-4" />
              </a>

              <a
                href="#capabilities"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "gap-2 font-medium"
                )}
              >
                Review platform architecture
              </a>
            </div>
          </div>
        </Container>
      </section>

      {/* Main Footer Links & Copyright */}
      <div className="py-10">
        <Container className="space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-border/60 pb-8">
            {/* Brand column */}
            <div className="space-y-2 max-w-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-xs">
                  PX
                </div>
                <span className="font-semibold tracking-tight text-foreground text-sm">
                  ProjectX
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Evidence-grounded project knowledge and handover platform. Capture, understand, and transition software projects with zero loss of context.
              </p>
            </div>

            {/* Quick In-Page Anchors */}
            <nav
              aria-label="Footer Navigation"
              className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground"
            >
              <a
                href="#capabilities"
                className="hover:text-foreground transition-colors"
              >
                Capabilities
              </a>
              <a
                href="#workflow"
                className="hover:text-foreground transition-colors"
              >
                Workflow
              </a>
              <a
                href="#trust"
                className="hover:text-foreground transition-colors"
              >
                Evidence & Trust
              </a>
              <a
                href="#about"
                className="hover:text-foreground transition-colors"
              >
                Knowledge Breakdown
              </a>
              <a
                href="#"
                className="hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                Back to top
                <ArrowUp className="h-3 w-3" />
              </a>
            </nav>
          </div>

          {/* Legal / Copyright Line */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>
              &copy; {currentYear} ProjectX. All rights reserved. Capture. Understand. Handover.
            </p>
            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span>Tenant Partitioned</span>
              <span>•</span>
              <span>SHA-256 Verified</span>
              <span>•</span>
              <span>FastAPI & Next.js</span>
            </div>
          </div>
        </Container>
      </div>
    </footer>
  );
}
