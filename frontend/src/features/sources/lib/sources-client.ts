import { AuthClientError } from "@/lib/auth-client";
import type {
  SourceRead,
  UploadSourceResponse,
} from "@/features/sources/types/source";

export async function fetchSourcesClient(
  projectId: string
): Promise<SourceRead[]> {
  const res = await fetch(`/api/projects/${projectId}/sources`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    const errorMsg =
      data?.error?.message || "Failed to retrieve project sources.";
    throw new AuthClientError(errorMsg, data?.error?.code, res.status);
  }

  return (data.sources || []) as SourceRead[];
}

export async function uploadSourcesClient(
  projectId: string,
  files: File[]
): Promise<UploadSourceResponse> {
  if (files.length === 0) {
    throw new AuthClientError("Please select at least one file to upload.", "NO_FILES", 400);
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  // Do NOT set Content-Type header so browser automatically sets multipart/form-data boundary
  const res = await fetch(`/api/projects/${projectId}/sources/upload`, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    body: formData,
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    const errorMsg =
      data?.error?.message || "Failed to upload document(s).";
    throw new AuthClientError(errorMsg, data?.error?.code, res.status);
  }

  return data.upload as UploadSourceResponse;
}

export async function deleteSourceClient(
  projectId: string,
  sourceId: string
): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/sources/${sourceId}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    const errorMsg =
      data?.error?.message || "Failed to delete knowledge source.";
    throw new AuthClientError(errorMsg, data?.error?.code, res.status);
  }
}
