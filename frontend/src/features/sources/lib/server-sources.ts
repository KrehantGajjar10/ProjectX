import { getApiBaseUrl, getAuthTokenFromCookies } from "@/lib/server-auth";
import type { SourceRead } from "@/features/sources/types/source";

export async function serverGetSources(
  projectId: string
): Promise<SourceRead[]> {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return [];
  }

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/projects/${projectId}/sources`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `[serverGetSources] Failed to fetch sources for project ${projectId}. HTTP status: ${res.status}`
      );
      return [];
    }

    const data = await res.json();
    return (Array.isArray(data) ? data : []) as SourceRead[];
  } catch (error) {
    console.error(
      `[serverGetSources] Error fetching sources for project ${projectId}:`,
      error
    );
    return [];
  }
}
