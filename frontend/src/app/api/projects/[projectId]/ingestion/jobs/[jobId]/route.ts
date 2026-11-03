import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { IngestionJobRead } from "@/features/sources/types/ingestion";

export async function GET(
  _request: Request,
  props: { params: Promise<{ projectId: string; jobId: string }> }
) {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "You must be signed in to view ingestion job status.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId, jobId } = await props.params;

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(
      `${apiBase}/projects/${projectId}/ingestion/jobs/${jobId}`,
      {
        method: "GET",
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
        "Failed to retrieve ingestion job status."
      );
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json(
      { success: true, job: data as IngestionJobRead },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      `[api/projects/${projectId}/ingestion/jobs/${jobId}] Error:`,
      error
    );
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect to ingestion service.",
        },
      },
      { status: 500 }
    );
  }
}
