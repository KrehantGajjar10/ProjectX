import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { RiskSummaryRead } from "@/features/risks/types/risk";

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
          message: "You must be signed in to view project risks.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;
  const { searchParams } = new URL(request.url);

  const severity = searchParams.get("severity");
  const category = searchParams.get("category");
  const sourceType = searchParams.get("source_type");

  try {
    const apiBase = getApiBaseUrl();
    const targetUrl = new URL(`${apiBase}/projects/${projectId}/risks`);

    if (severity && severity !== "all") {
      targetUrl.searchParams.set("severity", severity);
    }
    if (category && category !== "all") {
      targetUrl.searchParams.set("category", category);
    }
    if (sourceType && sourceType !== "all") {
      targetUrl.searchParams.set("source_type", sourceType);
    }

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
        "Failed to fetch project risks."
      );
      return NextResponse.json(errorEnvelope, { status: res.status });
    }

    return NextResponse.json(
      {
        success: true,
        data: body as RiskSummaryRead,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[BFF /api/projects/[id]/risks] Network error:", err);
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
