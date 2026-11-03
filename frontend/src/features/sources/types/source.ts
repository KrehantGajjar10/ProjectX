export interface UploadFileDetail {
  filename: string;
  storage_path: string;
  mime_type: string;
  size: number;
}

export interface SourceConfig {
  files?: UploadFileDetail[];
  repo_url?: string;
  owner?: string;
  repo?: string;
  branch?: string | null;
  [key: string]: unknown;
}

export interface SourceRead {
  id: string;
  project_id: string;
  name: string;
  type: "upload" | "github" | string;
  config: SourceConfig;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadSourceResponse {
  source: SourceRead;
  files: UploadFileDetail[];
}

export interface GitHubSourceCreateInput {
  repo_url: string;
  branch?: string | null;
  name?: string | null;
}

export function canConnectGitHub(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase();
  return normalized === "owner" || normalized === "admin";
}

export const ALLOWED_UPLOAD_EXTENSIONS = [
  ".pdf",
  ".md",
  ".markdown",
  ".docx",
  ".pptx",
  ".txt",
  ".py",
  ".ts",
  ".js",
  ".json",
  ".yaml",
  ".yml",
] as const;

export type AllowedUploadExtension = typeof ALLOWED_UPLOAD_EXTENSIONS[number];

export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function isAllowedExtension(filename: string): boolean {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return (ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
