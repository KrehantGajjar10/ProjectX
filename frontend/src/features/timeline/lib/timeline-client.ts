import type { TimelineFilterOptions, TimelineResponse } from "../types/timeline";

export class TimelineClientError extends Error {
  code: string;
  status?: number;
  details?: unknown;

  constructor(
    message: string,
    code = "TIMELINE_ERROR",
    status?: number,
    details?: unknown
  ) {
    super(message);
    this.name = "TimelineClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function clientGetProjectTimeline(
  projectId: string,
  options?: TimelineFilterOptions
): Promise<TimelineResponse> {
  const url = new URL(
    `/api/projects/${projectId}/timeline`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  );

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
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new TimelineClientError(
      body?.error?.message || "Failed to load project timeline.",
      body?.error?.code || "TIMELINE_LOAD_FAILED",
      res.status,
      body?.error?.details
    );
  }

  return body.data as TimelineResponse;
}
