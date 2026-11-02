import Link from "next/link";
import { serverGetProject, serverGetProjectDashboard } from "@/lib/server-projects";
import { ProjectHeader } from "@/components/dashboard/project-header";
import { ProjectMetricsGrid } from "@/components/dashboard/project-metrics-grid";
import { ProjectHighlights } from "@/components/dashboard/project-highlights";
import { ProjectIngestionBanner } from "@/components/dashboard/project-ingestion-banner";
import { Container } from "@/components/landing/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, FolderX } from "lucide-react";

export const instant = false;

interface ProjectDashboardPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export async function generateMetadata(props: ProjectDashboardPageProps) {
  const { projectId } = await props.params;
  const project = await serverGetProject(projectId);

  return {
    title: project ? `${project.name} | Overview` : "Project Overview",
    description: project?.description || "Evidence-grounded project overview dashboard.",
  };
}

export default async function ProjectDashboardPage(props: ProjectDashboardPageProps) {
  const { projectId } = await props.params;

  const [project, summary] = await Promise.all([
    serverGetProject(projectId),
    serverGetProjectDashboard(projectId),
  ]);

  if (!project || !summary) {
    return (
      <div className="py-12 sm:py-16">
        <Container className="max-w-xl text-center">
          <div className="rounded-2xl border border-border/80 bg-card p-8 sm:p-10 shadow-lg space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <FolderX className="h-7 w-7" />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Project Not Found
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              The project you requested either does not exist, has been removed, or your account does not have authorization to view it.
            </p>

            <div className="pt-2">
              <Link
                href="/app/projects"
                className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
              >
                <ArrowLeft className="h-4 w-4" />
                Return to Projects
              </Link>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="py-6 sm:py-8">
      <Container className="space-y-6 sm:space-y-8">
        {/* Project Header */}
        <ProjectHeader project={project} />

        {/* Pipeline & Ingestion Status */}
        <ProjectIngestionBanner ingestionStatus={summary.last_ingestion_status} />

        {/* Core KPI Metrics Grid */}
        <ProjectMetricsGrid summary={summary} />

        {/* Evidence Highlights (Blocked Tasks, Critical Risks, Recent Decisions) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Active Project Highlights
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              Evidence-Linked Radar
            </span>
          </div>

          <ProjectHighlights highlights={summary.highlights} />
        </div>
      </Container>
    </div>
  );
}
