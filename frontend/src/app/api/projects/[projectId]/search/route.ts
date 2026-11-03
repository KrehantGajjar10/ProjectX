import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type {
  QARequest,
  QAResponse,
  SearchResultsResponse,
} from "@/features/search/types/search";

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
          message: "You must be signed in to search project knowledge.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q") || "";
  const category = searchParams.get("category");
  const verifiedOnly = searchParams.get("verified_only");
  const limit = searchParams.get("limit") || "10";

  if (!q.trim()) {
    return NextResponse.json(
      {
        success: true,
        data: {
          query: "",
          total_results: 0,
          retrieval_mode: "hybrid",
          results: [],
        } as SearchResultsResponse,
      },
      { status: 200 }
    );
  }

  try {
    const apiBase = getApiBaseUrl();
    const targetUrl = new URL(`${apiBase}/projects/${projectId}/search`);
    targetUrl.searchParams.set("q", q.trim());
    targetUrl.searchParams.set("limit", limit);

    if (category && category !== "all") {
      targetUrl.searchParams.set("category", category);
    }
    if (verifiedOnly === "true") {
      targetUrl.searchParams.set("verified_only", "true");
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
        "Failed to execute search."
      );
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json({ success: true, data: data as SearchResultsResponse });
  } catch (error) {
    console.error(`[api/projects/${projectId}/search GET] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect to search service.",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(
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
          message: "You must be signed in to ask project questions.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;

  let body: QARequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Malformed request payload.",
        },
      },
      { status: 400 }
    );
  }

  if (!body.question || body.question.trim().length < 2) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Question must be at least 2 characters long.",
        },
      },
      { status: 422 }
    );
  }

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/projects/${projectId}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const error = parseBackendError(
        res.status,
        data,
        "Failed to generate answer."
      );
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json({
      success: true,
      data: data as QAResponse | SearchResultsResponse,
    });
  } catch (error) {
    console.error(`[api/projects/${projectId}/search POST] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect to AI Q&A service.",
        },
      },
      { status: 500 }
    );
  }
}
