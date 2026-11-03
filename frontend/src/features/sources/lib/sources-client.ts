import { AuthClientError } from "@/lib/auth-client";
import type {
  GitHubSourceCreateInput,
  SourceRead,
  UploadSourceResponse,
} from "@/features/sources/types/source";
import type { IngestionJobRead } from "@/features/sources/types/ingestion";

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

export async function connectGitHubSourceClient(
  projectId: string,
  input: GitHubSourceCreateInput
): Promise<SourceRead> {
  if (!input.repo_url || !input.repo_url.trim()) {
    throw new AuthClientError("Repository URL is required.", "VALIDATION_ERROR", 400);
  }

  const res = await fetch(`/api/projects/${projectId}/sources/github`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      repo_url: input.repo_url.trim(),
      branch: input.branch && input.branch.trim() ? input.branch.trim() : null,
      name: input.name && input.name.trim() ? input.name.trim() : null,
    }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    const errorMsg =
      data?.error?.message || "Failed to connect GitHub repository.";
    throw new AuthClientError(errorMsg, data?.error?.code, res.status);
  }

  return data.source as SourceRead;
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

export async function startIngestionJobClient(
  projectId: string,
  sourceIds?: string[]
): Promise<IngestionJobRead> {
  const res = await fetch(`/api/projects/${projectId}/ingestion/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      source_ids: sourceIds && sourceIds.length > 0 ? sourceIds : null,
    }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    const errorMsg =
      data?.error?.message || "Failed to start ingestion job.";
    throw new AuthClientError(errorMsg, data?.error?.code, res.status);
  }

  return data.job as IngestionJobRead;
}

export async function getIngestionJobStatusClient(
  projectId: string,
  jobId: string
): Promise<IngestionJobRead> {
  const res = await fetch(
    `/api/projects/${projectId}/ingestion/jobs/${jobId}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    const errorMsg =
      data?.error?.message || "Failed to retrieve ingestion job status.";
    throw new AuthClientError(errorMsg, data?.error?.code, res.status);
  }

  return data.job as IngestionJobRead;
}

export async function listIngestionJobsClient(
  projectId: string
): Promise<IngestionJobRead[]> {
  const res = await fetch(`/api/projects/${projectId}/ingestion/jobs`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    const errorMsg =
      data?.error?.message || "Failed to retrieve project ingestion jobs.";
    throw new AuthClientError(errorMsg, data?.error?.code, res.status);
  }

  return (data.jobs || []) as IngestionJobRead[];
}
