import { NextResponse } from "next/server";
import {
  getApiBaseUrl,
  getAuthTokenFromCookies,
  parseBackendError,
} from "@/lib/server-auth";
import type { UploadSourceResponse } from "@/features/sources/types/source";

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
          message: "You must be signed in to upload project documents.",
        },
      },
      { status: 401 }
    );
  }

  const { projectId } = await props.params;

  let incomingFormData: FormData;
  try {
    incomingFormData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Invalid multipart form data.",
        },
      },
      { status: 400 }
    );
  }

  const fileEntries = incomingFormData.getAll("files");
  const filesToUpload: File[] = [];

  for (const entry of fileEntries) {
    if (typeof entry === "object" && "name" in entry && "size" in entry) {
      filesToUpload.push(entry as File);
    }
  }

  if (filesToUpload.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "No files provided for upload.",
        },
      },
      { status: 400 }
    );
  }

  try {
    const apiBase = getApiBaseUrl();
    const forwardFormData = new FormData();

    for (const file of filesToUpload) {
      forwardFormData.append("files", file, file.name);
    }

    // Notice: Do NOT manually set Content-Type header so the runtime generates the multipart boundary.
    const res = await fetch(`${apiBase}/projects/${projectId}/sources/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body: forwardFormData,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const error = parseBackendError(
        res.status,
        data,
        "Failed to upload documents."
      );
      return NextResponse.json({ success: false, error }, { status: res.status });
    }

    return NextResponse.json(
      { success: true, upload: data as UploadSourceResponse },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      `[api/projects/${projectId}/sources/upload] Upload error:`,
      error
    );
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upload files due to a server error.",
        },
      },
      { status: 500 }
    );
  }
}
