import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { TaskRead, TaskUpdateInput } from "@/features/tasks/types/task";

export async function PATCH(
  request: Request,
  props: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "You must be signed in to update a project task.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId, taskId } = await props.params;

  let bodyData: TaskUpdateInput;
  try {
    bodyData = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 }
    );
  }

  try {
    const apiBase = getApiBaseUrl();
    const targetUrl = `${apiBase}/projects/${projectId}/tasks/${taskId}`;

    const res = await fetch(targetUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(bodyData),
      cache: "no-store",
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const errorEnvelope = parseBackendError(
        body,
        res.status,
        "Failed to update task."
      );
      return NextResponse.json(errorEnvelope, { status: res.status });
    }

    return NextResponse.json(
      {
        success: true,
        data: body as TaskRead,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[BFF /api/projects/[id]/tasks/[taskId]] Network error:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Unable to contact the ProjectX backend service.",
          details: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 502 }
    );
  }
}
