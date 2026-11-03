import type {
  TaskFilterOptions,
  TaskProgressSummary,
  TaskRead,
  TaskUpdateInput,
} from "../types/task";

export class TaskClientError extends Error {
  code: string;
  status?: number;
  details?: unknown;

  constructor(
    message: string,
    code = "TASK_ERROR",
    status?: number,
    details?: unknown
  ) {
    super(message);
    this.name = "TaskClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function clientGetProjectTasks(
  projectId: string,
  options?: TaskFilterOptions
): Promise<TaskRead[]> {
  const url = new URL(
    `/api/projects/${projectId}/tasks`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  );

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
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new TaskClientError(
      body?.error?.message || "Failed to load project tasks.",
      body?.error?.code || "TASK_LOAD_FAILED",
      res.status,
      body?.error?.details
    );
  }

  return body.data as TaskRead[];
}

export async function clientGetTaskProgress(
  projectId: string
): Promise<TaskProgressSummary> {
  const res = await fetch(`/api/projects/${projectId}/tasks/progress`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new TaskClientError(
      body?.error?.message || "Failed to load task progress metrics.",
      body?.error?.code || "TASK_PROGRESS_FAILED",
      res.status,
      body?.error?.details
    );
  }

  return body.data as TaskProgressSummary;
}

export async function clientUpdateTask(
  projectId: string,
  taskId: string,
  input: TaskUpdateInput
): Promise<TaskRead> {
  const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new TaskClientError(
      body?.error?.message || "Failed to update task.",
      body?.error?.code || "TASK_UPDATE_FAILED",
      res.status,
      body?.error?.details
    );
  }

  return body.data as TaskRead;
}
