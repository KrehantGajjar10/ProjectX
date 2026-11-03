import Link from "next/link";
import { serverGetProject } from "@/lib/server-projects";
import { serverGetProjectGraph } from "@/features/graph/lib/server-graph";
import { DependencyGraphView } from "@/features/graph/components/dependency-graph-view";
import { Container } from "@/components/landing/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, FolderX } from "lucide-react";

export const instant = false;

interface GraphPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export async function generateMetadata(props: GraphPageProps) {
  const { projectId } = await props.params;
  const project = await serverGetProject(projectId);

  return {
    title: project ? `${project.name} | Dependency Graph` : "Dependency Graph",
    description: "Interactive project dependency graph, cycle detection, and topological relationship analysis.",
  };
}

export default async function GraphPage(props: GraphPageProps) {
  const { projectId } = await props.params;

  const [project, initialGraph] = await Promise.all([
    serverGetProject(projectId),
    serverGetProjectGraph(projectId),
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
        <DependencyGraphView
          key={project.id}
          project={project}
          initialGraph={initialGraph || undefined}
        />
      </Container>
    </div>
  );
}
