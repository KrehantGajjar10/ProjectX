import { getApiBaseUrl, getAuthTokenFromCookies } from "@/lib/server-auth";
import type {
  TaskFilterOptions,
  TaskProgressSummary,
  TaskRead,
} from "../types/task";

export async function serverGetProjectTasks(
  projectId: string,
  options?: TaskFilterOptions
): Promise<TaskRead[] | null> {
  const token = await getAuthTokenFromCookies();
  if (!token) {
    return null;
  }

  try {
    const apiBase = getApiBaseUrl();
    const url = new URL(`${apiBase}/projects/${projectId}/tasks`);

    if (options?.status && options.status !== "all") {
      url.searchParams.set("status", options.status);
    }
    if (options?.priority && options.priority !== "all") {
      url.searchParams.set("priority", options.priority);
    }
    if (options?.owner_id && options.owner_id !== "all" && options.owner_id !== "unassigned") {
      url.searchParams.set("owner_id", options.owner_id);
    }
    if (options?.is_completed !== undefined) {
      url.searchParams.set("is_completed", String(options.is_completed));
    }
    if (options?.is_blocked !== undefined) {
      url.searchParams.set("is_blocked", String(options.is_blocked));
    }
    if (options?.skip !== undefined) {
      url.searchParams.set("skip", String(options.skip));
    }
    if (options?.limit !== undefined) {
      url.searchParams.set("limit", String(options.limit));
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `[serverGetProjectTasks] Backend responded with HTTP ${res.status}`
      );
      return null;
    }

    const data: TaskRead[] = await res.json();
    return data;
  } catch (err) {
    console.error("[serverGetProjectTasks] Network failure:", err);
    return null;
  }
}

export async function serverGetTaskProgress(
  projectId: string
): Promise<TaskProgressSummary | null> {
  const token = await getAuthTokenFromCookies();
  if (!token) {
    return null;
  }

  try {
    const apiBase = getApiBaseUrl();
    const url = `${apiBase}/projects/${projectId}/tasks/progress`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `[serverGetTaskProgress] Backend responded with HTTP ${res.status}`
      );
      return null;
    }

    const data: TaskProgressSummary = await res.json();
    return data;
  } catch (err) {
    console.error("[serverGetTaskProgress] Network failure:", err);
    return null;
  }
}
