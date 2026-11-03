import { getApiBaseUrl, getAuthTokenFromCookies } from "@/lib/server-auth";
import type { RiskFilterOptions, RiskSummaryRead } from "../types/risk";

export async function serverGetProjectRisks(
  projectId: string,
  options?: RiskFilterOptions
): Promise<RiskSummaryRead | null> {
  const token = await getAuthTokenFromCookies();
  if (!token) {
    return null;
  }

  try {
    const apiBase = getApiBaseUrl();
    const url = new URL(`${apiBase}/projects/${projectId}/risks`);

    if (options?.severity && options.severity !== "all") {
      url.searchParams.set("severity", options.severity);
    }
    if (options?.category && options.category !== "all") {
      url.searchParams.set("category", options.category);
    }
    if (options?.source_type && options.source_type !== "all") {
      url.searchParams.set("source_type", options.source_type);
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
        `[serverGetProjectRisks] Backend responded with HTTP ${res.status}`
      );
      return null;
    }

    const data: RiskSummaryRead = await res.json();
    return data;
  } catch (err) {
    console.error("[serverGetProjectRisks] Network failure:", err);
    return null;
  }
}
