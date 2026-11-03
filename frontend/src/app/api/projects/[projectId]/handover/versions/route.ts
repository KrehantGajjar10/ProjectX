import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { HandoverReportVersionSummary } from "@/features/handover/types/handover";

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
          message: "You must be signed in to view handover versions.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;

  try {
    const apiBase = getApiBaseUrl();
    const targetUrl = new URL(`${apiBase}/projects/${projectId}/handover/versions`);

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
        "Failed to fetch handover versions."
      );
      return NextResponse.json(
        {
          success: false,
          error: errorEnvelope,
        },
        { status: res.status }
      );
    }

    const data: HandoverReportVersionSummary[] = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[BFF GET /handover/versions] Internal error:", err);
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
