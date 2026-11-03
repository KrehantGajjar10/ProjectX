import type { ActivityFilterOptions, ProjectActivityResponse } from "../types/activity";

export class ActivityClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "ActivityClientError";
  }
}

export async function clientGetProjectActivity(
  projectId: string,
  options?: ActivityFilterOptions
): Promise<ProjectActivityResponse> {
  const url = new URL(`/api/projects/${projectId}/activity`, window.location.origin);

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
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    let msg = "Failed to fetch project activity";
    try {
      const errData = await res.json();
      msg = errData?.error?.message || errData?.message || msg;
    } catch {
      // ignore
    }
    throw new ActivityClientError(msg, res.status);
  }

  return res.json();
}
