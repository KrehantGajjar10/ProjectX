import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { ProjectDetailRead } from "@/types/project";

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
          message: "You must be signed in to view project details.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/projects/${projectId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const error = parseBackendError(res.status, data, "Project not found or inaccessible.");
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json(
      { success: true, project: data as ProjectDetailRead },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[api/projects/${projectId}] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch project details.",
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
          message: "You must be signed in to update project settings.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;

  try {
    const body = await request.json().catch(() => ({}));
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/projects/${projectId}`, {
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
      const error = parseBackendError(res.status, data, "Failed to update project settings.");
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json({ success: true, project: data }, { status: 200 });
  } catch (error) {
    console.error(`[PATCH api/projects/${projectId}] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update project settings.",
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
          message: "You must be signed in to delete a project.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/projects/${projectId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const error = parseBackendError(res.status, data, "Failed to delete project.");
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(`[DELETE api/projects/${projectId}] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete project.",
        },
      },
      { status: 500 }
    );
  }
}
