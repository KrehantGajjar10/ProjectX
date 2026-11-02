import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { ProjectDetailRead } from "@/types/project";
import {
  Calendar,
  FolderGit2,
  Layers,
  Sparkles,
  Users,
} from "lucide-react";

interface ProjectHeaderProps {
  project: ProjectDetailRead;
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

export function ProjectHeader({ project }: ProjectHeaderProps) {
  const formattedDate = new Date(project.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const memberCount = project.members?.length || 1;

  return (
    <div className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-2xs">
            <FolderGit2 className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {project.name}
              </h1>
              {project.my_role && (
                <Badge
                  variant={getRoleBadgeVariant(project.my_role)}
                  className="text-[11px] font-mono uppercase tracking-wider"
                >
                  {project.my_role}
                </Badge>
              )}
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
              {project.description || (
                <span className="italic text-muted-foreground/60">
                  No project description provided.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start shrink-0">
          <Link
            href="/app/projects"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            All Projects
          </Link>
        </div>
      </div>

      {/* Meta Bar */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-t border-border/60 pt-3.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Created on {formattedDate}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{memberCount} {memberCount === 1 ? "team member" : "team members"}</span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[11px] text-primary">
          <Sparkles className="h-3 w-3" />
          <span>UUID: {project.id.slice(0, 8)}...</span>
        </div>
      </div>
    </div>
  );
}
