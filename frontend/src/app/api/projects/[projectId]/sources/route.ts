import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { SourceRead } from "@/features/sources/types/source";

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
          message: "You must be signed in to view project sources.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/projects/${projectId}/sources`, {
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
        "Failed to list project sources."
      );
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json(
      { success: true, sources: (Array.isArray(data) ? data : []) as SourceRead[] },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[api/projects/${projectId}/sources] Error listing sources:`, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect to source management service.",
        },
      },
      { status: 500 }
    );
  }
}
