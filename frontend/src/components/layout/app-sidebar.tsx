"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectRead } from "@/types/project";
import {
  Activity,
  BarChart3,
  Calendar,
  CheckSquare,
  FileCheck2,
  FolderGit2,
  GitBranch,
  Layers,
  Network,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

interface AppSidebarProps {
  currentProjectId?: string;
  projects?: ProjectRead[];
  onNavigate?: () => void;
  className?: string;
}

export function AppSidebar({
  currentProjectId,
  onNavigate,
  className,
}: AppSidebarProps) {
  const pathname = usePathname();

  // Active project ID either from prop or parsed from pathname
  const activeProjectId =
    currentProjectId ||
    (pathname.startsWith("/app/projects/")
      ? pathname.split("/")[3]
      : undefined);

  const navItems = [
    {
      group: "Workspace",
      items: [
        {
          label: "Overview",
          icon: BarChart3,
          href: activeProjectId ? `/app/projects/${activeProjectId}` : "/app",
          isActive:
            pathname === "/app" ||
            (activeProjectId && pathname === `/app/projects/${activeProjectId}`),
          isAvailable: true,
        },
        {
          label: "Projects",
          icon: FolderGit2,
          href: "/app/projects",
          isActive: pathname === "/app/projects",
          isAvailable: true,
        },
      ],
    },
    {
      group: "Knowledge & Understanding",
      items: [
        {
          label: "Sources",
          icon: GitBranch,
          href: "#",
          isActive: false,
          isAvailable: false,
        },
        {
          label: "Knowledge",
          icon: Layers,
          href: "#",
          isActive: false,
          isAvailable: false,
        },
        {
          label: "Graph",
          icon: Network,
          href: "#",
          isActive: false,
          isAvailable: false,
        },
        {
          label: "Search & Q&A",
          icon: Search,
          href: "#",
          isActive: false,
          isAvailable: false,
        },
        {
          label: "Risks",
          icon: ShieldAlert,
          href: "#",
          isActive: false,
          isAvailable: false,
        },
        {
          label: "Timeline",
          icon: Calendar,
          href: "#",
          isActive: false,
          isAvailable: false,
        },
        {
          label: "Tasks",
          icon: CheckSquare,
          href: "#",
          isActive: false,
          isAvailable: false,
        },
      ],
    },
    {
      group: "Handover & Governance",
      items: [
        {
          label: "Handover",
          icon: FileCheck2,
          href: "#",
          isActive: false,
          isAvailable: false,
        },
        {
          label: "Activity",
          icon: Activity,
          href: "#",
          isActive: false,
          isAvailable: false,
        },
        {
          label: "Settings",
          icon: Settings,
          href: "#",
          isActive: false,
          isAvailable: false,
        },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card/60 backdrop-blur-md w-64 h-full shrink-0 select-none",
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center px-4 border-b border-border/80">
        <Link
          href="/app"
          onClick={onNavigate}
          className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs tracking-tight shadow-xs transition-transform group-hover:scale-105">
            PX
          </div>
          <div className="flex flex-col">
            <span className="font-semibold tracking-tight text-sm text-foreground flex items-center gap-1.5">
              ProjectX
              <span className="rounded bg-primary/10 px-1 py-0.2 text-[9px] font-mono text-primary font-medium">
                v1.0
              </span>
            </span>
          </div>
        </Link>
      </div>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navItems.map((group) => (
          <div key={group.group} className="space-y-1.5">
            <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 font-mono">
              {group.group}
            </div>

            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;

                if (!item.isAvailable) {
                  return (
                    <div
                      key={item.label}
                      title="Available in future chapters"
                      className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-muted-foreground/50 cursor-not-allowed group transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0 opacity-40" />
                        <span>{item.label}</span>
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground/40 bg-surface px-1.5 py-0.2 rounded border border-border/50">
                        Soon
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      item.isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-surface hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          item.isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span>{item.label}</span>
                    </span>

                    {item.isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer Banner */}
      <div className="p-3 border-t border-border/80 text-[11px] text-muted-foreground font-mono flex items-center justify-between bg-surface/30">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-primary" />
          Evidence-Grounded
        </span>
        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
          FastAPI
        </Badge>
      </div>
    </aside>
  );
}
