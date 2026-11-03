import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { ProjectMemberRead } from "@/types/project";

export async function PATCH(
  request: Request,
  props: { params: Promise<{ projectId: string; memberId: string }> }
) {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "You must be signed in to update member roles.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId, memberId } = await props.params;

  try {
    const body = await request.json().catch(() => ({}));
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/projects/${projectId}/members/${memberId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const error = parseBackendError(res.status, data, "Failed to update member role.");
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json(data as ProjectMemberRead, { status: 200 });
  } catch (error) {
    console.error(`[PATCH api/projects/${projectId}/members/${memberId}] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to communicate with project service.",
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ projectId: string; memberId: string }> }
) {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "You must be signed in to remove project members.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId, memberId } = await props.params;

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/projects/${projectId}/members/${memberId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const error = parseBackendError(res.status, data, "Failed to remove member.");
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(`[DELETE api/projects/${projectId}/members/${memberId}] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to communicate with project service.",
        },
      },
      { status: 500 }
    );
  }
}
