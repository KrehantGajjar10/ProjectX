import { serverGetProjects } from "@/lib/server-projects";
import { ProjectsView } from "@/components/projects/projects-view";
import { Container } from "@/components/landing/container";

export const instant = false;

export const metadata = {
  title: "Projects",
  description: "Manage project workspaces and team handovers.",
};

export default async function ProjectsPage() {
  const projects = await serverGetProjects();

  return (
    <div className="py-6 sm:py-8">
      <Container>
        <ProjectsView projects={projects} />
      </Container>
    </div>
  );
}
