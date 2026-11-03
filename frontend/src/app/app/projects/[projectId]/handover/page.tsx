import Link from "next/link";
import { serverGetProject } from "@/lib/server-projects";
import {
  serverGetLatestHandover,
  serverListHandoverVersions,
} from "@/features/handover/lib/server-handover";
import { HandoverView } from "@/features/handover/components/handover-view";
import { Container } from "@/components/landing/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, FolderX } from "lucide-react";

export const instant = false;

interface HandoverPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export async function generateMetadata(props: HandoverPageProps) {
  const { projectId } = await props.params;
  const project = await serverGetProject(projectId);

  return {
    title: project ? `${project.name} | Handover Studio` : "Handover Studio",
    description:
      "Synthesize, review, compare, and export verifiable, evidence-linked project handover reports.",
  };
}

export default async function HandoverPage(props: HandoverPageProps) {
  const { projectId } = await props.params;

  const [project, initialLatest, initialVersions] = await Promise.all([
    serverGetProject(projectId),
    serverGetLatestHandover(projectId),
    serverListHandoverVersions(projectId),
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
        <HandoverView
          project={project}
          initialLatest={initialLatest}
          initialVersions={initialVersions}
        />
      </Container>
    </div>
  );
}
