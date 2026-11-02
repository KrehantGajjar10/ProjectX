"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import type { UserRead } from "@/types/auth";
import type { ProjectRead } from "@/types/project";
import {
  ChevronDown,
  FolderPlus,
  Layers,
  Menu,
  Shield,
  User as UserIcon,
} from "lucide-react";

interface AppHeaderProps {
  user: UserRead;
  projects: ProjectRead[];
  currentProjectId?: string;
  onOpenMobileMenu: () => void;
  onOpenCreateProjectModal: () => void;
}

export function AppHeader({
  user,
  projects,
  currentProjectId,
  onOpenMobileMenu,
  onOpenCreateProjectModal,
}: AppHeaderProps) {
  const router = useRouter();
  const [switcherOpen, setSwitcherOpen] = React.useState(false);
  const switcherRef = React.useRef<HTMLDivElement>(null);

  const activeProject = projects.find((p) => p.id === currentProjectId);

  // Close switcher on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        switcherRef.current &&
        !switcherRef.current.contains(event.target as Node)
      ) {
        setSwitcherOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectProject = (projectId: string) => {
    setSwitcherOpen(false);
    router.push(`/app/projects/${projectId}`);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border/80 bg-background/85 px-3 sm:px-4 lg:px-5 backdrop-blur-md transition-colors">
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation sidebar"
          className="inline-flex lg:hidden h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Project Switcher Dropdown */}
        <div className="relative" ref={switcherRef}>
          <button
            type="button"
            onClick={() => setSwitcherOpen((prev) => !prev)}
            aria-expanded={switcherOpen}
            aria-haspopup="listbox"
            className="flex items-center gap-2 rounded-lg border border-border/80 bg-card/80 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors shadow-2xs"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/15 text-primary text-[10px] font-bold">
              {activeProject ? activeProject.name.slice(0, 2).toUpperCase() : "PX"}
            </div>
            <span className="max-w-[130px] sm:max-w-[180px] truncate font-semibold">
              {activeProject ? activeProject.name : "Select Project"}
            </span>
            {activeProject?.my_role && (
              <Badge variant="outline" className="hidden sm:inline-flex text-[10px] py-0 px-1 font-mono">
                {activeProject.my_role}
              </Badge>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
          </button>

          {/* Switcher Menu Panel */}
          {switcherOpen && (
            <div
              role="listbox"
              className="absolute left-0 mt-1.5 w-64 rounded-xl border border-border bg-card p-1.5 shadow-xl animate-in fade-in-50 slide-in-from-top-1 duration-150 z-50 space-y-1"
            >
              <div className="px-2 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                Your Projects ({projects.length})
              </div>

              <div className="max-h-56 overflow-y-auto space-y-0.5 py-1">
                {projects.length === 0 ? (
                  <div className="px-2.5 py-3 text-center text-xs text-muted-foreground">
                    No projects found.
                  </div>
                ) : (
                  projects.map((proj) => {
                    const isSelected = proj.id === currentProjectId;
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => handleSelectProject(proj.id)}
                        className={`w-full flex items-center justify-between rounded-md px-2.5 py-2 text-xs text-left transition-colors ${
                          isSelected
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-foreground hover:bg-surface"
                        }`}
                      >
                        <div className="truncate mr-2">
                          <div className="truncate font-medium">{proj.name}</div>
                          {proj.description && (
                            <div className="truncate text-[10px] text-muted-foreground">
                              {proj.description}
                            </div>
                          )}
                        </div>
                        {proj.my_role && (
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0 uppercase">
                            {proj.my_role}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="pt-1 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => {
                    setSwitcherOpen(false);
                    onOpenCreateProjectModal();
                  }}
                  className="w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Create New Project
                </button>
                <Link
                  href="/app/projects"
                  onClick={() => setSwitcherOpen(false)}
                  className="w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
                >
                  <Layers className="h-3.5 w-3.5" />
                  View All Projects
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right side controls: ThemeToggle, User Identity, Logout */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        <ThemeToggle />

        {/* User Identity Pill */}
        <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border/80 bg-surface/80 px-2.5 py-1 text-xs">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary">
            <UserIcon className="h-3 w-3" />
          </div>
          <span className="font-medium text-foreground max-w-[120px] truncate">
            {user.full_name || user.email.split("@")[0]}
          </span>
          {user.is_superuser && (
            <span title="Superuser Account">
              <Shield className="h-3 w-3 text-violet" />
            </span>
          )}
        </div>

        <LogoutButton />
      </div>
    </header>
  );
}
