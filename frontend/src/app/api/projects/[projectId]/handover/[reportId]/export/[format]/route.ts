import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";

export async function GET(
  _request: Request,
  props: {
    params: Promise<{
      projectId: string;
      reportId: string;
      format: string;
    }>;
  }
) {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "You must be signed in to export handover reports.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId, reportId, format } = await props.params;
  const validFormats = ["markdown", "pdf", "docx"];

  if (!validFormats.includes(format.toLowerCase())) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid export format '${format}'. Supported: markdown, pdf, docx.`,
        },
      },
      { status: 400 }
    );
  }

  try {
    const apiBase = getApiBaseUrl();
    const targetUrl = new URL(
      `${apiBase}/projects/${projectId}/handover/${reportId}/export/${format.toLowerCase()}`
    );

    const res = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      const errorEnvelope = parseBackendError(
        res.status,
        errorBody,
        `Failed to export handover document as ${format.toUpperCase()}.`
      );
      return NextResponse.json(
        {
          success: false,
          error: errorEnvelope,
        },
        { status: res.status }
      );
    }

    const contentType =
      res.headers.get("Content-Type") || "application/octet-stream";
    const contentDisposition =
      res.headers.get("Content-Disposition") ||
      `attachment; filename="handover_${reportId}.${format === "markdown" ? "md" : format}"`;

    const bodyBuffer = await res.arrayBuffer();

    return new Response(bodyBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
      },
    });
  } catch (err) {
    console.error("[BFF GET /handover/:id/export/:format] Internal error:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to export handover document.",
        },
      },
      { status: 500 }
    );
  }
}
