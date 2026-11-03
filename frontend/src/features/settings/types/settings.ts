import type { ProjectRole } from "@/types/project";

export interface ProjectUpdateInput {
  name?: string;
  description?: string | null;
}

export interface ProjectMemberAddInput {
  email: string;
  role: ProjectRole;
}

export interface ProjectMemberUpdateInput {
  role: ProjectRole;
}
