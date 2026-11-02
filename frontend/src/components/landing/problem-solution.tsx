import { Container } from "@/components/landing/container";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Link2,
  MessageSquare,
  ShieldCheck,
  UserX,
  Workflow,
} from "lucide-react";

export function ProblemSolution() {
  return (
    <section id="about" className="py-16 md:py-24 border-b border-border/40 bg-surface/30">
      <Container className="space-y-12">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center space-y-3">
          <Badge variant="copper" className="text-xs">
            The Knowledge Breakdown
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
            Scattered engineering knowledge slows teams down.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            When projects evolve and engineers transition, architectural rationale and ownership get lost in chats, pull requests, and undocumented meetings.
          </p>
        </div>

        {/* Side-by-Side Comparison Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left: The Problem Card (Scattered & Unverified) */}
          <div className="rounded-xl border border-border/80 bg-card p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-foreground text-base">
                  The Status Quo: Scattered & Ephemeral
                </h3>
              </div>
              <span className="text-xs text-destructive font-medium">Fragile Context</span>
            </div>

            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive text-xs">
                  <MessageSquare className="h-3 w-3" />
                </div>
                <div>
                  <span className="font-medium text-foreground">Lost Rationale:</span>
                  <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                    Decisions are buried in Slack threads, unrecorded Zoom calls, and ephemeral PR comments with zero long-term traceability.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive text-xs">
                  <UserX className="h-3 w-3" />
                </div>
                <div>
                  <span className="font-medium text-foreground">Undetected Knowledge Silos (SPOK):</span>
                  <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                    Key components are understood by only one departing engineer, leaving the incoming team blind to critical failure modes.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive text-xs">
                  <HelpCircle className="h-3 w-3" />
                </div>
                <div>
                  <span className="font-medium text-foreground">Uncertain Handover Reports:</span>
                  <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                    Standard AI summarizers hallucinate claims or present deductions as facts without any traceable source evidence.
                  </p>
                </div>
              </li>
            </ul>

            <div className="rounded-md border border-border/70 bg-surface/80 p-3 text-xs text-muted-foreground font-mono">
              Outcome: Weeks spent reverse-engineering code and repeating resolved mistakes.
            </div>
          </div>

          {/* Right: The Solution Card (ProjectX Evidence-Grounded Context) */}
          <div className="rounded-xl border border-primary/30 bg-card p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-foreground text-base">
                  ProjectX: Evidence-Linked & Verifiable
                </h3>
              </div>
              <span className="text-xs text-primary font-medium">Traceable Provenance</span>
            </div>

            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">
                  <Link2 className="h-3 w-3" />
                </div>
                <div>
                  <span className="font-medium text-foreground">Exact Source Excerpts:</span>
                  <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                    Every architectural decision and task is linked directly to a verifiable line range and document hash in the repository.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">
                  <Workflow className="h-3 w-3" />
                </div>
                <div>
                  <span className="font-medium text-foreground">Deterministic Signals & Gaps:</span>
                  <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                    Automatically surfaces blocked task chains, circular dependencies, unassigned items, and conflicting engineering stances.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">
                  <CheckCircle2 className="h-3 w-3" />
                </div>
                <div>
                  <span className="font-medium text-foreground">Immutable Sign-Off & Actionable Plan:</span>
                  <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                    Produces a structured 10-section continuation plan that reviewers audit and approve into a permanent, version-locked archive.
                  </p>
                </div>
              </li>
            </ul>

            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-primary font-mono flex items-center justify-between">
              <span>Result: Immediate continuity from Day 1 for arriving engineers.</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
