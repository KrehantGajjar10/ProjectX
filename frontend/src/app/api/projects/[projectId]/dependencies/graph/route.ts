import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { DependencyGraphResponse } from "@/features/graph/types/graph";

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
          message: "You must be signed in to view project dependency graph.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;
  const { searchParams } = new URL(request.url);

  const category = searchParams.get("category");
  const reviewStatus = searchParams.get("review_status");

  try {
    const apiBase = getApiBaseUrl();
    const targetUrl = new URL(`${apiBase}/projects/${projectId}/dependencies/graph`);

    if (category && category !== "all") {
      targetUrl.searchParams.set("category", category);
    }
    if (reviewStatus && reviewStatus !== "all") {
      targetUrl.searchParams.set("review_status", reviewStatus);
    }

    const res = await fetch(targetUrl.toString(), {
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
        "Failed to fetch project dependency graph."
      );
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json({
      success: true,
      data: data as DependencyGraphResponse,
    });
  } catch (error) {
    console.error(`[api/projects/${projectId}/dependencies/graph GET] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect to graph service.",
        },
      },
      { status: 500 }
    );
  }
}
