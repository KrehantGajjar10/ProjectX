import { getApiBaseUrl, getAuthTokenFromCookies } from "@/lib/server-auth";
import type {
  SearchFilterOptions,
  SearchResultsResponse,
} from "../types/search";

export async function serverProjectSearch(
  projectId: string,
  options?: Partial<SearchFilterOptions>
): Promise<SearchResultsResponse> {
  const token = await getAuthTokenFromCookies();

  if (!token || !options?.q?.trim()) {
    return {
      query: options?.q || "",
      total_results: 0,
      retrieval_mode: "hybrid",
      results: [],
    };
  }

  try {
    const apiBase = getApiBaseUrl();
    const targetUrl = new URL(`${apiBase}/projects/${projectId}/search`);
    targetUrl.searchParams.set("q", options.q.trim());

    if (options.limit) {
      targetUrl.searchParams.set("limit", String(options.limit));
    }
    if (options.category && options.category !== "all") {
      targetUrl.searchParams.set("category", options.category);
    }
    if (options.verified_only) {
      targetUrl.searchParams.set("verified_only", "true");
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
        `[serverProjectSearch] HTTP ${res.status} for project ${projectId}`
      );
      return {
        query: options.q || "",
        total_results: 0,
        retrieval_mode: "hybrid",
        results: [],
      };
    }

    const data = await res.json();
    return data as SearchResultsResponse;
  } catch (error) {
    console.error(`[serverProjectSearch] Error fetching for ${projectId}:`, error);
    return {
      query: options.q || "",
      total_results: 0,
      retrieval_mode: "hybrid",
      results: [],
    };
  }
}
