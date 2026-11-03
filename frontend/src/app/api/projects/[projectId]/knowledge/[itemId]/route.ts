import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { KnowledgeItemDetailRead } from "@/features/knowledge/types/knowledge";

export async function GET(
  _request: Request,
  props: { params: Promise<{ projectId: string; itemId: string }> }
) {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "You must be signed in to view knowledge details.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId, itemId } = await props.params;

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(
      `${apiBase}/projects/${projectId}/knowledge/${itemId}`,
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
        "Failed to retrieve knowledge item details."
      );
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json(
      {
        success: true,
        item: data as KnowledgeItemDetailRead,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      `[api/projects/${projectId}/knowledge/${itemId}] Error:`,
      error
    );
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect to knowledge service.",
        },
      },
      { status: 500 }
    );
  }
}
