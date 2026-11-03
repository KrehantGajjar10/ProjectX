import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { SourceRead } from "@/features/sources/types/source";

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
          message: "You must be signed in to connect a GitHub repository.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Invalid JSON request body.",
        },
      },
      { status: 400 }
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("repo_url" in body) ||
    typeof (body as { repo_url: unknown }).repo_url !== "string" ||
    !(body as { repo_url: string }).repo_url.trim()
  ) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Repository URL is required.",
        },
      },
      { status: 400 }
    );
  }

  const typedBody = body as {
    repo_url: string;
    branch?: string | null;
    name?: string | null;
  };

  try {
    const apiBase = getApiBaseUrl();

    // Security: explicitly forward only safe fields without token or credentials
    const payload = {
      repo_url: typedBody.repo_url.trim(),
      branch: typedBody.branch && typedBody.branch.trim() ? typedBody.branch.trim() : null,
      name: typedBody.name && typedBody.name.trim() ? typedBody.name.trim() : null,
    };

    const res = await fetch(`${apiBase}/projects/${projectId}/sources/github`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const error = parseBackendError(
        res.status,
        data,
        "Failed to connect GitHub repository."
      );
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json(
      { success: true, source: data as SourceRead },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      `[api/projects/${projectId}/sources/github] Error connecting GitHub repository:`,
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
