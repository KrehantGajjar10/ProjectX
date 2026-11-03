import { getApiBaseUrl, getAuthTokenFromCookies } from "@/lib/server-auth";
import type { ActivityFilterOptions, ProjectActivityResponse } from "../types/activity";

export async function serverGetProjectActivity(
  projectId: string,
  options?: ActivityFilterOptions
): Promise<ProjectActivityResponse | null> {
  const token = await getAuthTokenFromCookies();
  if (!token) {
    return null;
  }

  try {
    const apiBase = getApiBaseUrl();
    const url = new URL(`${apiBase}/projects/${projectId}/activity`);

    if (options?.action && options.action !== "all") {
      url.searchParams.set("action", options.action);
    }
    if (options?.entity_type && options.entity_type !== "all") {
      url.searchParams.set("entity_type", options.entity_type);
    }
    if (typeof options?.skip === "number") {
      url.searchParams.set("skip", String(options.skip));
    }
    if (typeof options?.limit === "number") {
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
        `[serverGetProjectActivity] Backend responded with HTTP ${res.status}`
      );
      return null;
    }

    const data: ProjectActivityResponse = await res.json();
    return data;
  } catch (err) {
    console.error("[serverGetProjectActivity] Network failure:", err);
    return null;
  }
}
