import Link from "next/link";
import { serverGetProject } from "@/lib/server-projects";
import { serverGetKnowledgeList } from "@/features/knowledge/lib/server-knowledge";
import { KnowledgeExplorer } from "@/features/knowledge/components/knowledge-explorer";
import { Container } from "@/components/landing/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, FolderX } from "lucide-react";

export const instant = false;

interface KnowledgePageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export async function generateMetadata(props: KnowledgePageProps) {
  const { projectId } = await props.params;
  const project = await serverGetProject(projectId);

  return {
    title: project ? `${project.name} | Knowledge & Verification` : "Knowledge & Verification",
    description: "Explore grounded project knowledge, inspect verified source excerpts, and manage reviewer approvals.",
  };
}

export default async function KnowledgePage(props: KnowledgePageProps) {
  const { projectId } = await props.params;

  const [project, items] = await Promise.all([
    serverGetProject(projectId),
    serverGetKnowledgeList(projectId),
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
        <KnowledgeExplorer
          key={project.id}
          project={project}
          initialItems={items}
        />
      </Container>
    </div>
  );
}
