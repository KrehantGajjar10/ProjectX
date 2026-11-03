import type {
  AuthSuccessResponse,
  AuthErrorResponse,
  SessionResponse,
} from "@/types/auth";

export class AuthClientError extends Error {
  code: string;
  details?: unknown;
  statusCode: number;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AuthClientError";
    this.code = code;
    this.details = details;
    this.statusCode = 0;
  }
}

export async function loginClient(payload: {
  email: string;
  password: string;
}): Promise<AuthSuccessResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    const errorData = data as AuthErrorResponse;
    throw new AuthClientError(
      errorData?.error?.code || "LOGIN_FAILED",
      errorData?.error?.message || "Failed to log in.",
      errorData?.error?.details
    );
  }

  return data as AuthSuccessResponse;
}

export async function registerClient(payload: {
  email: string;
  password: string;
  full_name?: string;
}): Promise<AuthSuccessResponse> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    const errorData = data as AuthErrorResponse;
    throw new AuthClientError(
      errorData?.error?.code || "REGISTRATION_FAILED",
      errorData?.error?.message || "Failed to register.",
      errorData?.error?.details
    );
  }

  return data as AuthSuccessResponse;
}

export async function logoutClient(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getSessionClient(): Promise<SessionResponse> {
  try {
    const res = await fetch("/api/auth/session", {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) {
      return { authenticated: false, user: null };
    }
    return await res.json();
  } catch {
    return { authenticated: false, user: null };
  }
}
