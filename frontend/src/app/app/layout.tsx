import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server-auth";
import { serverGetProjects } from "@/lib/server-projects";
import { AppShell } from "@/components/layout/app-shell";

export const instant = false;

export const metadata = {
  title: {
    template: "%s | ProjectX",
    default: "Workspace | ProjectX",
  },
  description: "Evidence-grounded project knowledge and handover platform.",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?returnUrl=/app");
  }

  const projects = await serverGetProjects();

  return (
    <AppShell user={user} projects={projects}>
      {children}
    </AppShell>
  );
}
