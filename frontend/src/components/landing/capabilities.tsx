import { Container } from "@/components/landing/container";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  GitBranch,
  Network,
  ShieldCheck,
  CheckCircle,
  FileCheck,
  Milestone,
} from "lucide-react";

const CAPABILITIES = [
  {
    icon: GitBranch,
    badge: "Ingestion",
    badgeVariant: "secondary" as const,
    title: "1. Connected Sources",
    description:
      "Ingest codebases via GitHub and upload technical specs, architectural decisions, and slide decks (PDF, DOCX, Markdown, PPTX, Python, TypeScript) up to 25 MB.",
    detail: "Preserves file provenance and cryptographic SHA-256 hashes.",
  },
  {
    icon: Milestone,
    badge: "Extraction",
    badgeVariant: "secondary" as const,
    title: "2. Knowledge Reconstruction",
    description:
      "Deconstructs documents and commits into five first-class domain categories: decisions, tasks, risks, milestones, and insights.",
    detail: "Distinguishes explicit facts from AI inferences automatically.",
  },
  {
    icon: FileText,
    badge: "Provenance",
    badgeVariant: "emerald" as const,
    title: "3. Evidence-Linked Claims",
    description:
      "Every single claim, decision, and handover statement links directly to an exact verbatim source excerpt and deep file locator.",
    detail: "No floating summaries. Click any claim to inspect the original text.",
  },
  {
    icon: ShieldCheck,
    badge: "Verification",
    badgeVariant: "emerald" as const,
    title: "4. Verification & Review",
    description:
      "Programmatic verification cross-checks verbatim excerpt strings against the underlying raw chunk. Unverified claims are flagged for mandatory human review.",
    detail: "Reviewers approve, reject, or annotate findings with full audit logs.",
  },
  {
    icon: Network,
    badge: "Analytics",
    badgeVariant: "violet" as const,
    title: "5. Project Understanding",
    description:
      "Explore hybrid keyword + vector Q&A with inline citations, interactive dependency DAGs, cycle detection, risk matrices, and chronologies.",
    detail: "Query project context with citations pointing to original sources.",
  },
  {
    icon: FileCheck,
    badge: "Delivery",
    badgeVariant: "copper" as const,
    title: "6. Actionable Handover",
    description:
      "Generates a 10-section structured continuation report detailing completed work, blocked tasks, SPOKs, and prioritized week-one action plans.",
    detail: "Versioned, auditable, and exportable to Markdown, PDF, and DOCX.",
  },
];

export function Capabilities() {
  return (
    <section id="capabilities" className="py-16 md:py-24 border-b border-border/40 scroll-mt-14">
      <Container className="space-y-12">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center space-y-3">
          <Badge variant="violet" className="text-xs">
            Platform Architecture
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
            Engineered for evidence, clarity, and continuity.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Six interconnected capabilities turn raw code repositories and documentation into a reliable, verifiable single source of truth.
          </p>
        </div>

        {/* 6-Card Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.title}
                className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 sm:p-6 shadow-2xs transition-all duration-200 hover:border-primary/40 hover:shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-primary transition-colors group-hover:bg-primary/10">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant={cap.badgeVariant} className="text-[11px]">
                      {cap.badge}
                    </Badge>
                  </div>

                  <h3 className="text-base font-semibold text-foreground tracking-tight">
                    {cap.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {cap.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-border/60 text-[11px] text-muted-foreground font-mono flex items-center gap-1.5">
                  <CheckCircle className="h-3 w-3 text-primary shrink-0" />
                  {cap.detail}
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
