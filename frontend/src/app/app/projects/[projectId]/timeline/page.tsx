import Link from "next/link";
import { serverGetProject } from "@/lib/server-projects";
import { serverGetProjectTimeline } from "@/features/timeline/lib/server-timeline";
import { TimelineView } from "@/features/timeline/components/timeline-view";
import { Container } from "@/components/landing/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, FolderX } from "lucide-react";

export const instant = false;

interface TimelinePageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export async function generateMetadata(props: TimelinePageProps) {
  const { projectId } = await props.params;
  const project = await serverGetProject(projectId);

  return {
    title: project ? `${project.name} | Timeline` : "Timeline",
    description: "Chronological narrative of milestones, key decisions, tasks, and commit provenance.",
  };
}

export default async function TimelinePage(props: TimelinePageProps) {
  const { projectId } = await props.params;

  const [project, initialTimeline] = await Promise.all([
    serverGetProject(projectId),
    serverGetProjectTimeline(projectId, { limit: 100 }),
  ]);

  if (!project) {
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
      <Container>
        <TimelineView
          key={project.id}
          project={project}
          initialTimeline={initialTimeline || undefined}
        />
      </Container>
    </div>
  );
}
