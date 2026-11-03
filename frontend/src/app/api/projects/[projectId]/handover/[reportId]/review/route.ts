import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { HandoverReportDetailRead } from "@/features/handover/types/handover";

export async function POST(
  request: Request,
  props: { params: Promise<{ projectId: string; reportId: string }> }
) {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "You must be signed in to review a handover report.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId, reportId } = await props.params;

  try {
    const body = await request.json().catch(() => ({}));
    const apiBase = getApiBaseUrl();
    const targetUrl = new URL(
      `${apiBase}/projects/${projectId}/handover/${reportId}/review`
    );

    const res = await fetch(targetUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      const errorEnvelope = parseBackendError(
        res.status,
        errorBody,
        "Failed to review handover report."
      );
      return NextResponse.json(
        {
          success: false,
          error: errorEnvelope,
        },
        { status: res.status }
      );
    }

    const data: HandoverReportDetailRead = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[BFF POST /handover/:id/review] Internal error:", err);
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
