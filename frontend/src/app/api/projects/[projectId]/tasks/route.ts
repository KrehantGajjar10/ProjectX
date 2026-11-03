import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { TaskRead } from "@/features/tasks/types/task";

export async function GET(
  request: Request,
  props: { params: Promise<{ projectId: string }> }
) {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "You must be signed in to view project tasks.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const ownerId = searchParams.get("owner_id");
  const isCompleted = searchParams.get("is_completed");
  const isBlocked = searchParams.get("is_blocked");
  const dueBefore = searchParams.get("due_before");
  const dueAfter = searchParams.get("due_after");
  const skip = searchParams.get("skip") || "0";
  const limit = searchParams.get("limit") || "50";

  try {
    const apiBase = getApiBaseUrl();
    const targetUrl = new URL(`${apiBase}/projects/${projectId}/tasks`);

    if (status && status !== "all") {
      targetUrl.searchParams.set("status", status);
    }
    if (priority && priority !== "all") {
      targetUrl.searchParams.set("priority", priority);
    }
    if (ownerId && ownerId !== "all" && ownerId !== "unassigned") {
      targetUrl.searchParams.set("owner_id", ownerId);
    }
    if (isCompleted !== null) {
      targetUrl.searchParams.set("is_completed", isCompleted);
    }
    if (isBlocked !== null) {
      targetUrl.searchParams.set("is_blocked", isBlocked);
    }
    if (dueBefore) {
      targetUrl.searchParams.set("due_before", dueBefore);
    }
    if (dueAfter) {
      targetUrl.searchParams.set("due_after", dueAfter);
    }
    targetUrl.searchParams.set("skip", skip);
    targetUrl.searchParams.set("limit", limit);

    const res = await fetch(targetUrl.toString(), {
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
        "Failed to fetch project tasks."
      );
      return NextResponse.json(errorEnvelope, { status: res.status });
    }

    return NextResponse.json(
      {
        success: true,
        data: body as TaskRead[],
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[BFF /api/projects/[id]/tasks] Network error:", err);
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
