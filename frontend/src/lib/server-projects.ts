import { getApiBaseUrl, getAuthTokenFromCookies } from "@/lib/server-auth";
import type {
  ProjectRead,
  ProjectDetailRead,
  ProjectDashboardSummary,
} from "@/types/project";

export async function serverGetProjects(): Promise<ProjectRead[]> {
  const token = await getAuthTokenFromCookies();
  if (!token) {
    return [];
  }

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/projects/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[server-projects] Failed to fetch projects:", res.status);
      return [];
    }

    return await res.json();
  } catch (error) {
    console.error("[server-projects] Error fetching projects:", error);
    return [];
  }
}

export async function serverGetProject(
  projectId: string
): Promise<ProjectDetailRead | null> {
  const token = await getAuthTokenFromCookies();
  if (!token) {
    return null;
  }

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/projects/${projectId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error(`[server-projects] Error fetching project ${projectId}:`, error);
    return null;
  }
}

export async function serverGetProjectDashboard(
  projectId: string
): Promise<ProjectDashboardSummary | null> {
  const token = await getAuthTokenFromCookies();
  if (!token) {
    return null;
  }

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/projects/${projectId}/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error(`[server-projects] Error fetching dashboard ${projectId}:`, error);
    return null;
  }
}
