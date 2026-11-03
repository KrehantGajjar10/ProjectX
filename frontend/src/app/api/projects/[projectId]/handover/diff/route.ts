import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { HandoverDiffResponse } from "@/features/handover/types/handover";

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
          message: "You must be signed in to compare handover reports.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;
  const { searchParams } = new URL(request.url);
  const v1 = searchParams.get("v1");
  const v2 = searchParams.get("v2");

  if (!v1 || !v2) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Both 'v1' and 'v2' query parameters are required for diff comparison.",
        },
      },
      { status: 400 }
    );
  }

  try {
    const apiBase = getApiBaseUrl();
    const targetUrl = new URL(`${apiBase}/projects/${projectId}/handover/diff`);
    targetUrl.searchParams.set("v1", v1);
    targetUrl.searchParams.set("v2", v2);

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
        "Failed to compare handover versions."
      );
      return NextResponse.json(
        {
          success: false,
          error: errorEnvelope,
        },
        { status: res.status }
      );
    }

    const data: HandoverDiffResponse = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[BFF GET /handover/diff] Internal error:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to communicate with project service.",
        },
      },
      { status: 500 }
    );
  }
}
