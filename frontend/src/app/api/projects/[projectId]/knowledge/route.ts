import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { KnowledgeItemRead } from "@/features/knowledge/types/knowledge";

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
          message: "You must be signed in to view project knowledge.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;

  try {
    const apiBase = getApiBaseUrl();
    const reqUrl = new URL(request.url);
    const backendUrl = new URL(`${apiBase}/projects/${projectId}/knowledge`);

    // Forward allowed query parameters
    const forwardParams = [
      "category",
      "review_status",
      "origin",
      "min_confidence",
      "max_confidence",
      "verified",
      "q",
      "skip",
      "limit",
    ];

    for (const param of forwardParams) {
      const val = reqUrl.searchParams.get(param);
      if (val !== null && val !== "") {
        backendUrl.searchParams.set(param, val);
      }
    }

    const res = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const error = parseBackendError(
        res.status,
        data,
        "Failed to list project knowledge."
      );
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json(
      {
        success: true,
        items: (Array.isArray(data) ? data : []) as KnowledgeItemRead[],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      `[api/projects/${projectId}/knowledge] Error listing knowledge:`,
      error
    );
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect to knowledge service.",
        },
      },
      { status: 500 }
    );
  }
}
