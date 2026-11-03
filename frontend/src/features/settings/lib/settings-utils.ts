import type { ProjectRole } from "@/types/project";

export function canEditProjectSettings(role?: ProjectRole | null): boolean {
  if (!role) return false;
  return role === "owner" || role === "admin";
}

export function canManageMembers(role?: ProjectRole | null): boolean {
  if (!role) return false;
  return role === "owner" || role === "admin";
}

export function canAssignOwnerRole(role?: ProjectRole | null): boolean {
  if (!role) return false;
  return role === "owner";
}

export function canDeleteProject(role?: ProjectRole | null): boolean {
  if (!role) return false;
  return role === "owner";
}

export function getRoleBadgeClass(role?: ProjectRole | null): string {
  switch (role) {
    case "owner":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "admin":
      return "border-violet/30 bg-violet/10 text-violet";
    case "reviewer":
      return "border-copper/30 bg-copper/10 text-copper";
    case "member":
      return "border-border bg-surface text-foreground";
    case "viewer":
    default:
      return "border-border bg-surface/60 text-muted-foreground";
  }
}
