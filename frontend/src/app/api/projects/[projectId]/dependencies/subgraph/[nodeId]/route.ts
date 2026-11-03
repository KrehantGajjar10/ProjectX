import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { SubgraphResponse } from "@/features/graph/types/graph";

export async function GET(
  request: Request,
  props: { params: Promise<{ projectId: string; nodeId: string }> }
) {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "You must be signed in to view node subgraph.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId, nodeId } = await props.params;
  const { searchParams } = new URL(request.url);
  const depth = searchParams.get("depth") || "2";

  try {
    const apiBase = getApiBaseUrl();
    const targetUrl = new URL(
      `${apiBase}/projects/${projectId}/dependencies/subgraph/${nodeId}`
    );
    targetUrl.searchParams.set("depth", depth);

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
        "Failed to fetch node subgraph."
      );
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json({
      success: true,
      data: data as SubgraphResponse,
    });
  } catch (error) {
    console.error(
      `[api/projects/${projectId}/dependencies/subgraph/${nodeId} GET] Error:`,
      error
    );
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect to subgraph service.",
        },
      },
      { status: 500 }
    );
  }
}
