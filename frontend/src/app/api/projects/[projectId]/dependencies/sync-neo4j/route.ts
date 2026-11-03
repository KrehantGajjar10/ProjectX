import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { Neo4jSyncResponse } from "@/features/graph/types/graph";

export async function POST(
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
          message: "You must be signed in to synchronize with Neo4j.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(
      `${apiBase}/projects/${projectId}/dependencies/sync-neo4j`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const error = parseBackendError(
        res.status,
        data,
        "Failed to synchronize graph to Neo4j."
      );
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json({
      success: true,
      data: data as Neo4jSyncResponse,
    });
  } catch (error) {
    console.error(
      `[api/projects/${projectId}/dependencies/sync-neo4j POST] Error:`,
      error
    );
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect to Neo4j synchronization service.",
        },
      },
      { status: 500 }
    );
  }
}
