import { getApiBaseUrl, getAuthTokenFromCookies } from "@/lib/server-auth";
import type {
  KnowledgeItemDetailRead,
  KnowledgeItemRead,
  KnowledgeFilterOptions,
} from "../types/knowledge";

export async function serverGetKnowledgeList(
  projectId: string,
  filters?: Partial<KnowledgeFilterOptions>
): Promise<KnowledgeItemRead[]> {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return [];
  }

  try {
    const apiBase = getApiBaseUrl();
    const url = new URL(`${apiBase}/projects/${projectId}/knowledge`);

    if (filters?.category && filters.category !== "all") {
      url.searchParams.set("category", filters.category);
    }
    if (filters?.review_status && filters.review_status !== "all") {
      url.searchParams.set("review_status", filters.review_status);
    }
    if (filters?.origin && filters.origin !== "all") {
      url.searchParams.set("origin", filters.origin);
    }
    if (typeof filters?.verified === "boolean") {
      url.searchParams.set("verified", String(filters.verified));
    }
    if (filters?.q && filters.q.trim()) {
      url.searchParams.set("q", filters.q.trim());
    }
    if (typeof filters?.min_confidence === "number") {
      url.searchParams.set("min_confidence", String(filters.min_confidence));
    }
    if (typeof filters?.skip === "number") {
      url.searchParams.set("skip", String(filters.skip));
    }
    if (typeof filters?.limit === "number") {
      url.searchParams.set("limit", String(filters.limit));
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
        `[serverGetKnowledgeList] Failed to fetch knowledge for project ${projectId}. HTTP status: ${res.status}`
      );
      return [];
    }

    const data = await res.json();
    return (Array.isArray(data) ? data : []) as KnowledgeItemRead[];
  } catch (error) {
    console.error(
      `[serverGetKnowledgeList] Error fetching knowledge for project ${projectId}:`,
      error
    );
    return [];
  }
}

export async function serverGetKnowledgeDetail(
  projectId: string,
  itemId: string
): Promise<KnowledgeItemDetailRead | null> {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return null;
  }

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(
      `${apiBase}/projects/${projectId}/knowledge/${itemId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      console.error(
        `[serverGetKnowledgeDetail] Failed to fetch item ${itemId} for project ${projectId}. HTTP status: ${res.status}`
      );
      return null;
    }

    const data = await res.json();
    return data as KnowledgeItemDetailRead;
  } catch (error) {
    console.error(
      `[serverGetKnowledgeDetail] Error fetching item ${itemId} for project ${projectId}:`,
      error
    );
    return null;
  }
}
