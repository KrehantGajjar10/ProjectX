import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { TaskProgressSummary } from "@/features/tasks/types/task";

export async function GET(
  _request: Request,
  props: { params: Promise<{ projectId: string }> }
) {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "You must be signed in to view task progress.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;

  try {
    const apiBase = getApiBaseUrl();
    const targetUrl = `${apiBase}/projects/${projectId}/tasks/progress`;

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const errorEnvelope = parseBackendError(
        body,
        res.status,
        "Failed to fetch task progress metrics."
      );
      return NextResponse.json(errorEnvelope, { status: res.status });
    }

    return NextResponse.json(
      {
        success: true,
        data: body as TaskProgressSummary,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[BFF /api/projects/[id]/tasks/progress] Network error:", err);
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
