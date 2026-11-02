import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { ProjectRead } from "@/types/project";

export async function GET() {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "You must be signed in to list projects.",
        },
      },
      { status: 401 }
    );
  }

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/projects/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const error = parseBackendError(res.status, data, "Failed to list projects.");
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json({ success: true, projects: data as ProjectRead[] }, { status: 200 });
  } catch (error) {
    console.error("[api/projects] Error listing projects:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect to projects service.",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "You must be signed in to create a project.",
        },
      },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "Invalid request payload.",
          },
        },
        { status: 400 }
      );
    }

    const { name, description } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Project name is required.",
          },
        },
        { status: 422 }
      );
    }

    if (name.trim().length > 255) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Project name cannot exceed 255 characters.",
          },
        },
        { status: 422 }
      );
    }

    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/projects/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        description: typeof description === "string" && description.trim() ? description.trim() : null,
      }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const error = parseBackendError(res.status, data, "Failed to create project.");
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json(
      { success: true, project: data as ProjectRead },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/projects] Error creating project:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create project due to a server error.",
        },
      },
      { status: 500 }
    );
  }
}
