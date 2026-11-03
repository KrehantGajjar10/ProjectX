import { getApiBaseUrl, getAuthTokenFromCookies } from "@/lib/server-auth";
import type {
  DependencyGraphResponse,
  GraphFilterOptions,
} from "../types/graph";

export async function serverGetProjectGraph(
  projectId: string,
  options?: GraphFilterOptions
): Promise<DependencyGraphResponse | null> {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return null;
  }

  try {
    const apiBase = getApiBaseUrl();
    const targetUrl = new URL(
      `${apiBase}/projects/${projectId}/dependencies/graph`
    );

    if (options?.category && options.category !== "all") {
      targetUrl.searchParams.set("category", options.category);
    }
    if (options?.review_status && options.review_status !== "all") {
      targetUrl.searchParams.set("review_status", options.review_status);
    }

    const res = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `[serverGetProjectGraph] HTTP ${res.status} for project ${projectId}`
      );
      return null;
    }

    const data = await res.json();
    return data as DependencyGraphResponse;
  } catch (error) {
    console.error(`[serverGetProjectGraph] Error for ${projectId}:`, error);
    return null;
  }
}
