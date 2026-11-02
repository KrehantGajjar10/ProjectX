"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import type { ProjectRead } from "@/types/project";
import {
  ArrowRight,
  Calendar,
  FolderGit2,
  FolderPlus,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";

interface ProjectsViewProps {
  projects: ProjectRead[];
}

function getRoleBadgeVariant(role?: string): "emerald" | "violet" | "copper" | "outline" | "secondary" {
  switch (role?.toLowerCase()) {
    case "owner":
      return "emerald";
    case "admin":
      return "violet";
    case "reviewer":
      return "copper";
    case "member":
      return "outline";
    default:
      return "secondary";
  }
}

export function ProjectsView({ projects }: ProjectsViewProps) {
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredProjects = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [projects, searchQuery]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Projects
            </h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-mono font-medium text-primary">
              {projects.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage project workspaces, evidence-linked knowledge, and team handovers.
          </p>
        </div>

        <Button
          onClick={() => setCreateModalOpen(true)}
          className="gap-2 shrink-0 self-start sm:self-auto font-medium"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-surface/40 p-8 sm:p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 shadow-2xs">
            <FolderPlus className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            No projects yet
          </h2>
          <p className="mt-1.5 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Create your first project workspace to start capturing decisions, tracking risks, and synthesizing verifiable handover reports.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="gap-2 font-medium"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="rounded-lg border border-border/60 bg-card p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Decisions & Evidence
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ground every architectural choice in real pull requests and chat threads.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-card p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-violet" />
                Risk & Blocker Radar
              </div>
              <p className="text-[11px] text-muted-foreground">
                Surface unseen dependencies and blocked tasks before engineers step away.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-card p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-copper" />
                Live Handover Diffs
              </div>
              <p className="text-[11px] text-muted-foreground">
                Auto-generate verifiable transfer documents with confidence scores.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Projects List */
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-xs sm:text-sm text-foreground shadow-2xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No projects matched &ldquo;{searchQuery}&rdquo;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => {
                const formattedDate = new Date(project.created_at).toLocaleDateString(
                  "en-US",
                  {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  }
                );

                return (
                  <Link
                    key={project.id}
                    href={`/app/projects/${project.id}`}
                    className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                  >
                    <Card className="h-full border-border/80 bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-md flex flex-col justify-between">
                      <CardHeader className="space-y-3 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                            <FolderGit2 className="h-5 w-5" />
                          </div>

                          {project.my_role && (
                            <Badge
                              variant={getRoleBadgeVariant(project.my_role)}
                              className="text-[10px] uppercase font-mono tracking-wider"
                            >
                              {project.my_role}
                            </Badge>
                          )}
                        </div>

                        <div>
                          <CardTitle className="text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {project.name}
                          </CardTitle>
                          <CardDescription className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-8">
                            {project.description || (
                              <span className="italic text-muted-foreground/60">
                                No description provided.
                              </span>
                            )}
                          </CardDescription>
                        </div>
                      </CardHeader>

                      <CardContent className="pt-2 border-t border-border/60 mt-auto">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5 text-[11px]">
                            <Calendar className="h-3 w-3" />
                            {formattedDate}
                          </span>

                          <span className="flex items-center gap-1 font-medium text-primary text-[11px] group-hover:translate-x-0.5 transition-transform">
                            Workspace
                            <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal instance for this page */}
      <CreateProjectModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
