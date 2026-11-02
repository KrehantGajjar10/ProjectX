import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ projectId: string; sourceId: string }> }
) {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "You must be signed in to delete a knowledge source.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId, sourceId } = await props.params;

  if (!projectId || !sourceId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_PARAMETERS",
          message: "Project ID and Source ID are required.",
        },
      },
      { status: 400 }
    );
  }

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(
      `${apiBase}/projects/${projectId}/sources/${sourceId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (res.status === 204) {
      return NextResponse.json(
        {
          success: true,
          message: "Source deleted successfully.",
        },
        { status: 200 }
      );
    }

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const error = parseBackendError(
        res.status,
        data,
        "Failed to delete knowledge source."
      );
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Source deleted successfully.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      `[api/projects/${projectId}/sources/${sourceId}] Error deleting source:`,
      error
    );
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
