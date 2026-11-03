"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import type { UserRead } from "@/types/auth";
import type { ProjectRead } from "@/types/project";
import { X } from "lucide-react";

interface AppShellProps {
  user: UserRead;
  projects: ProjectRead[];
  currentProjectId?: string;
  children: React.ReactNode;
}

export function AppShell({
  user,
  projects,
  currentProjectId,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [createModalOpen, setCreateModalOpen] = React.useState(false);

  // Extract projectId from URL pathname if viewing a specific project: /app/projects/:projectId/...
  const segments = pathname.split("/").filter(Boolean);
  const pathProjectId =
    segments[0] === "app" &&
    segments[1] === "projects" &&
    segments[2] &&
    segments[2] !== "sources" &&
    segments[2] !== "knowledge"
      ? segments[2]
      : undefined;

  // Derive activeProjectId cleanly without triggering cascading renders:
  // 1. Authoritative project from URL if on a project-specific route
  // 2. Explicitly passed project ID (if provided)
  // 3. First project in workspace list if available
  const activeProjectId =
    pathProjectId ||
    currentProjectId ||
    (projects.length > 0 ? projects[0].id : undefined);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground antialiased selection:bg-primary/25 selection:text-foreground">
      {/* Desktop Persistent Sidebar */}
      <AppSidebar
        activeProjectId={activeProjectId}
        projects={projects}
        onOpenCreateProjectModal={() => setCreateModalOpen(true)}
        className="hidden lg:flex"
      />

      {/* Mobile Drawer Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in-50"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="relative flex w-72 flex-col bg-card shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="absolute right-2.5 top-3.5">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <AppSidebar
              activeProjectId={activeProjectId}
              projects={projects}
              onNavigate={() => setMobileMenuOpen(false)}
              onOpenCreateProjectModal={() => {
                setMobileMenuOpen(false);
                setCreateModalOpen(true);
              }}
              className="w-full border-r-0"
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader
          user={user}
          projects={projects}
          currentProjectId={activeProjectId}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenCreateProjectModal={() => setCreateModalOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Global Create Project Modal */}
      <CreateProjectModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
