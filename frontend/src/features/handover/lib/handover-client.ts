import type {
  ExportFormat,
  HandoverDiffResponse,
  HandoverGenerateRequest,
  HandoverReportDetailRead,
  HandoverReportVersionSummary,
  HandoverReviewRequest,
  LatestHandoverResponse,
} from "../types/handover";

export class HandoverClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "HandoverClientError";
  }
}

export async function clientGetLatestHandover(
  projectId: string
): Promise<LatestHandoverResponse> {
  const res = await fetch(`/api/projects/${projectId}/handover`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    let msg = "Failed to fetch latest handover report";
    try {
      const errData = await res.json();
      msg = errData?.error?.message || errData?.message || msg;
    } catch {
      // ignore
    }
    throw new HandoverClientError(msg, res.status);
  }

  return res.json();
}

export async function clientStartGeneration(
  projectId: string,
  input: HandoverGenerateRequest
): Promise<{ id: string; status: string; progress: number }> {
  const res = await fetch(`/api/projects/${projectId}/handover`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    let msg = "Failed to start handover generation";
    try {
      const errData = await res.json();
      msg = errData?.error?.message || errData?.message || msg;
    } catch {
      // ignore
    }
    throw new HandoverClientError(msg, res.status);
  }

  return res.json();
}

export async function clientListVersions(
  projectId: string
): Promise<HandoverReportVersionSummary[]> {
  const res = await fetch(`/api/projects/${projectId}/handover/versions`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    let msg = "Failed to load handover versions";
    try {
      const errData = await res.json();
      msg = errData?.error?.message || errData?.message || msg;
    } catch {
      // ignore
    }
    throw new HandoverClientError(msg, res.status);
  }

  return res.json();
}

export async function clientGetVersion(
  projectId: string,
  versionOrId: string
): Promise<HandoverReportDetailRead> {
  const res = await fetch(
    `/api/projects/${projectId}/handover/versions/${versionOrId}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!res.ok) {
    let msg = `Failed to load handover version ${versionOrId}`;
    try {
      const errData = await res.json();
      msg = errData?.error?.message || errData?.message || msg;
    } catch {
      // ignore
    }
    throw new HandoverClientError(msg, res.status);
  }

  return res.json();
}

export async function clientGetDiff(
  projectId: string,
  v1: number,
  v2: number
): Promise<HandoverDiffResponse> {
  const res = await fetch(
    `/api/projects/${projectId}/handover/diff?v1=${v1}&v2=${v2}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!res.ok) {
    let msg = `Failed to compare version ${v1} and ${v2}`;
    try {
      const errData = await res.json();
      msg = errData?.error?.message || errData?.message || msg;
    } catch {
      // ignore
    }
    throw new HandoverClientError(msg, res.status);
  }

  return res.json();
}

export async function clientSubmitForReview(
  projectId: string,
  reportId: string
): Promise<HandoverReportDetailRead> {
  const res = await fetch(
    `/api/projects/${projectId}/handover/${reportId}/submit`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!res.ok) {
    let msg = "Failed to submit report for review";
    try {
      const errData = await res.json();
      msg = errData?.error?.message || errData?.message || msg;
    } catch {
      // ignore
    }
    throw new HandoverClientError(msg, res.status);
  }

  return res.json();
}

export async function clientReviewReport(
  projectId: string,
  reportId: string,
  input: HandoverReviewRequest
): Promise<HandoverReportDetailRead> {
  const res = await fetch(
    `/api/projects/${projectId}/handover/${reportId}/review`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
    }
  );

  if (!res.ok) {
    let msg = `Failed to ${input.action} handover report`;
    try {
      const errData = await res.json();
      msg = errData?.error?.message || errData?.message || msg;
    } catch {
      // ignore
    }
    throw new HandoverClientError(msg, res.status);
  }

  return res.json();
}

export async function clientDownloadExport(
  projectId: string,
  reportId: string,
  format: ExportFormat,
  suggestedFilename?: string
): Promise<void> {
  const res = await fetch(
    `/api/projects/${projectId}/handover/${reportId}/export/${format}`,
    {
      method: "GET",
    }
  );

  if (!res.ok) {
    let msg = `Failed to export handover report as ${format.toUpperCase()}`;
    try {
      const errData = await res.json();
      msg = errData?.error?.message || errData?.message || msg;
    } catch {
      // ignore
    }
    throw new HandoverClientError(msg, res.status);
  }

  // Extract filename from Content-Disposition if present
  let filename = suggestedFilename;
  const disposition = res.headers.get("Content-Disposition");
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  if (!filename) {
    const ext = format === "markdown" ? "md" : format;
    filename = `handover_report.${ext}`;
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function clientGetIngestionJob(
  projectId: string,
  jobId: string
): Promise<{ id: string; status: string; progress: number; error?: string | null }> {
  const res = await fetch(`/api/projects/${projectId}/ingestion/jobs/${jobId}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new HandoverClientError("Failed to check generation progress", res.status);
  }

  return res.json();
}
