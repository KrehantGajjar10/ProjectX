import { Container } from "@/components/landing/container";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Database,
  FileCheck2,
  FolderInput,
  Network,
  ShieldAlert,
} from "lucide-react";

const STAGES = [
  {
    step: "01",
    name: "Connect",
    category: "Source Ingestion",
    description:
      "Connect your GitHub repository and upload technical documentation. ProjectX extracts text, generates SHA-256 hashes, and indexes content into chunk boundaries.",
    icon: FolderInput,
    badgeText: "GitHub & Files",
  },
  {
    step: "02",
    name: "Reconstruct",
    category: "Structured Parsing",
    description:
      "Processes documents into fine-grained chunks. Structured extraction isolates decisions, tasks, risks, and milestones alongside exact character offsets.",
    icon: Database,
    badgeText: "Domain Extraction",
  },
  {
    step: "03",
    name: "Verify",
    category: "Programmatic Provenance",
    description:
      "Programmatic verification cross-checks verbatim excerpt strings against the underlying raw chunk. Unverified claims are marked for human scrutiny.",
    icon: ShieldAlert,
    badgeText: "Zero Hallucination",
  },
  {
    step: "04",
    name: "Understand",
    category: "Graph & Retrieval",
    description:
      "Builds a hybrid vector and keyword index in Qdrant and PostgreSQL. Traverses recursive dependency DAGs, identifies cycles, and answers questions with inline citations.",
    icon: Network,
    badgeText: "Hybrid Q&A & DAG",
  },
  {
    step: "05",
    name: "Handover",
    category: "Report & Sign-off",
    description:
      "Synthesizes a 10-section continuation plan highlighting SPOKs, incomplete tasks, and architecture. Once approved by reviewers, reports become permanently immutable.",
    icon: FileCheck2,
    badgeText: "Immutable Archive",
  },
];

export function Workflow() {
  return (
    <section id="workflow" className="py-16 md:py-24 border-b border-border/40 bg-surface/20 scroll-mt-14">
      <Container className="space-y-12">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center space-y-3">
          <Badge variant="emerald" className="text-xs">
            5-Stage Pipeline
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
            From scattered repositories to verified handovers.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            A deterministic, step-by-step pipeline ensuring no architectural decision or pending task is lost during team handoffs.
          </p>
        </div>

        {/* 5-Stage Stepper Grid */}
        <div className="relative">
          {/* Desktop connecting progress bar line */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-12 left-8 right-8 h-0.5 bg-border z-0"
          />

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5 relative z-10">
            {STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              return (
                <div
                  key={stage.step}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-2xs transition-all duration-150 hover:border-primary/50"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface border border-border font-mono text-xs font-bold text-foreground">
                        {stage.step}
                      </div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-mono text-primary font-medium">
                        {stage.category}
                      </div>
                      <h3 className="text-base font-semibold text-foreground tracking-tight mt-0.5">
                        {stage.name}
                      </h3>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {stage.description}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                    <span>{stage.badgeText}</span>
                    {idx < STAGES.length - 1 && (
                      <ArrowRight className="h-3 w-3 opacity-40 hidden lg:block" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pipeline Summary Bar */}
        <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card/60 p-4 text-center text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Guaranteed Evidence Pipeline:</span> Every stage in ProjectX is partitioned strictly by tenant project ID, ensuring zero data bleeding and verifiable provenance.
        </div>
      </Container>
    </section>
  );
}
