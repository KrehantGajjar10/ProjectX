import { getApiBaseUrl, getAuthTokenFromCookies } from "@/lib/server-auth";
import type { TimelineFilterOptions, TimelineResponse } from "../types/timeline";

export async function serverGetProjectTimeline(
  projectId: string,
  options?: TimelineFilterOptions
): Promise<TimelineResponse | null> {
  const token = await getAuthTokenFromCookies();
  if (!token) {
    return null;
  }

  try {
    const apiBase = getApiBaseUrl();
    const url = new URL(`${apiBase}/projects/${projectId}/timeline`);

    if (options?.event_types && options.event_types.length > 0) {
      options.event_types.forEach((et) => {
        if (et !== "all") {
          url.searchParams.append("event_type", et);
        }
      });
    }
    if (options?.start_date) {
      url.searchParams.set("start_date", options.start_date);
    }
    if (options?.end_date) {
      url.searchParams.set("end_date", options.end_date);
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
        `[serverGetProjectTimeline] Backend responded with HTTP ${res.status}`
      );
      return null;
    }

    const data: TimelineResponse = await res.json();
    return data;
  } catch (err) {
    console.error("[serverGetProjectTimeline] Network failure:", err);
    return null;
  }
}
