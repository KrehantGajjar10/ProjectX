import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { ProjectMemberRead } from "@/types/project";

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
          message: "You must be signed in to view project members.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/projects/${projectId}/members`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const error = parseBackendError(res.status, data, "Failed to load project members.");
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json({ success: true, members: data as ProjectMemberRead[] }, { status: 200 });
  } catch (error) {
    console.error(`[GET api/projects/${projectId}/members] Error:`, error);
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
          message: "You must be signed in to add project members.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;

  try {
    const body = await request.json().catch(() => ({}));
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/projects/${projectId}/members`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const error = parseBackendError(res.status, data, "Failed to add project member.");
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error(`[POST api/projects/${projectId}/members] Error:`, error);
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
