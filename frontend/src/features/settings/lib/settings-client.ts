import type {
  ProjectMemberAddInput,
  ProjectMemberUpdateInput,
  ProjectUpdateInput,
} from "../types/settings";
import type { ProjectMemberRead, ProjectRead } from "@/types/project";

export class SettingsClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "SettingsClientError";
  }
}

export async function clientUpdateProject(
  projectId: string,
  data: ProjectUpdateInput
): Promise<ProjectRead> {
  const res = await fetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    let msg = "Failed to update project settings";
    try {
      const errData = await res.json();
      msg = errData?.error?.message || errData?.message || msg;
    } catch {
      // ignore
    }
    throw new SettingsClientError(msg, res.status);
  }

  const json = await res.json();
  return json.project || json;
}

export async function clientDeleteProject(projectId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    let msg = "Failed to delete project";
    try {
      const errData = await res.json();
      msg = errData?.error?.message || errData?.message || msg;
    } catch {
      // ignore
    }
    throw new SettingsClientError(msg, res.status);
  }
}

export async function clientListMembers(
  projectId: string
): Promise<ProjectMemberRead[]> {
  const res = await fetch(`/api/projects/${projectId}/members`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    let msg = "Failed to load project members";
    try {
      const errData = await res.json();
      msg = errData?.error?.message || errData?.message || msg;
    } catch {
      // ignore
    }
    throw new SettingsClientError(msg, res.status);
  }

  const json = await res.json();
  return json.members || json;
}

export async function clientAddMember(
  projectId: string,
  data: ProjectMemberAddInput
): Promise<ProjectMemberRead> {
  const res = await fetch(`/api/projects/${projectId}/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    let msg = "Failed to add project member";
    try {
      const errData = await res.json();
      msg = errData?.error?.message || errData?.message || msg;
    } catch {
      // ignore
    }
    throw new SettingsClientError(msg, res.status);
  }

  return res.json();
}

export async function clientUpdateMemberRole(
  projectId: string,
  memberId: string,
  data: ProjectMemberUpdateInput
): Promise<ProjectMemberRead> {
  const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    let msg = "Failed to update member role";
    try {
      const errData = await res.json();
      msg = errData?.error?.message || errData?.message || msg;
    } catch {
      // ignore
    }
    throw new SettingsClientError(msg, res.status);
  }

  return res.json();
}

export async function clientRemoveMember(
  projectId: string,
  memberId: string
): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    let msg = "Failed to remove project member";
    try {
      const errData = await res.json();
      msg = errData?.error?.message || errData?.message || msg;
    } catch {
      // ignore
    }
    throw new SettingsClientError(msg, res.status);
  }
}
