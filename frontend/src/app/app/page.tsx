import { redirect } from "next/navigation";
import { serverGetProjects } from "@/lib/server-projects";

export const instant = false;

export default async function AppPage() {
  const projects = await serverGetProjects();

  if (projects && projects.length > 0) {
    redirect(`/app/projects/${projects[0].id}`);
  }

  redirect("/app/projects");
}
