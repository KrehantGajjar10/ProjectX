import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { TimelineResponse } from "@/features/timeline/types/timeline";

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
          message: "You must be signed in to view the project timeline.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;
  const { searchParams } = new URL(request.url);

  const eventTypes = searchParams.getAll("event_type");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const skip = searchParams.get("skip") || "0";
  const limit = searchParams.get("limit") || "50";

  try {
    const apiBase = getApiBaseUrl();
    const targetUrl = new URL(`${apiBase}/projects/${projectId}/timeline`);

    eventTypes.forEach((et) => {
      if (et && et !== "all") {
        targetUrl.searchParams.append("event_type", et);
      }
    });

    if (startDate) {
      targetUrl.searchParams.set("start_date", startDate);
    }
    if (endDate) {
      targetUrl.searchParams.set("end_date", endDate);
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
        "Failed to fetch project timeline."
      );
      return NextResponse.json(errorEnvelope, { status: res.status });
    }

    return NextResponse.json(
      {
        success: true,
        data: body as TimelineResponse,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[BFF /api/projects/[id]/timeline] Network error:", err);
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
