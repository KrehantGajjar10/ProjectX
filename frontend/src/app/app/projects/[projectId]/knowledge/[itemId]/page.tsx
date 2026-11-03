import Link from "next/link";
import { serverGetProject } from "@/lib/server-projects";
import { serverGetKnowledgeDetail } from "@/features/knowledge/lib/server-knowledge";
import { KnowledgeDetailView } from "@/features/knowledge/components/knowledge-detail-view";
import { Container } from "@/components/landing/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, FileQuestion, FolderX } from "lucide-react";

export const instant = false;

interface KnowledgeItemPageProps {
  params: Promise<{
    projectId: string;
    itemId: string;
  }>;
}

export async function generateMetadata(props: KnowledgeItemPageProps) {
  const { projectId, itemId } = await props.params;
  const [project, item] = await Promise.all([
    serverGetProject(projectId),
    serverGetKnowledgeDetail(projectId, itemId),
  ]);

  if (!project || !item) {
    return {
      title: "Knowledge Item | ProjectX",
      description: "Inspect project knowledge item, verified excerpts, and review verification.",
    };
  }

  return {
    title: `${item.title} | ${project.name} Knowledge`,
    description: item.description.slice(0, 160),
  };
}

export default async function KnowledgeItemPage(props: KnowledgeItemPageProps) {
  const { projectId, itemId } = await props.params;

  const [project, item] = await Promise.all([
    serverGetProject(projectId),
    serverGetKnowledgeDetail(projectId, itemId),
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

  if (!item) {
    return (
      <div className="py-12 sm:py-16">
        <Container className="max-w-xl text-center">
          <div className="rounded-2xl border border-border/80 bg-card p-8 sm:p-10 shadow-lg space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <FileQuestion className="h-7 w-7" />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Knowledge Item Not Found
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              The requested knowledge item does not exist or may have been deleted.
            </p>

            <div className="pt-2">
              <Link
                href={`/app/projects/${projectId}/knowledge`}
                className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Knowledge Explorer
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
        <KnowledgeDetailView
          projectId={projectId}
          project={project}
          initialItem={item}
          showBackToExplorerButton={true}
        />
      </Container>
    </div>
  );
}
