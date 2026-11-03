import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { ProjectActivityResponse } from "@/features/activity/types/activity";

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
          message: "You must be signed in to view project activity.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;
  const { searchParams } = new URL(request.url);

  const action = searchParams.get("action");
  const entityType = searchParams.get("entity_type");
  const skip = searchParams.get("skip") || "0";
  const limit = searchParams.get("limit") || "50";

  try {
    const apiBase = getApiBaseUrl();
    const targetUrl = new URL(`${apiBase}/projects/${projectId}/activity`);

    if (action && action !== "all") {
      targetUrl.searchParams.set("action", action);
    }
    if (entityType && entityType !== "all") {
      targetUrl.searchParams.set("entity_type", entityType);
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

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      const errorEnvelope = parseBackendError(
        res.status,
        errorBody,
        "Failed to fetch project activity log."
      );
      return NextResponse.json(
        {
          success: false,
          error: errorEnvelope,
        },
        { status: res.status }
      );
    }

    const data: ProjectActivityResponse = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[BFF GET /activity] Internal error:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to communicate with activity service.",
        },
      },
      { status: 500 }
    );
  }
}
