import { cookies } from "next/headers";
import type { UserRead, BackendErrorEnvelope } from "@/types/auth";
import { sanitizeRedirectUrl } from "@/lib/auth-helpers";

export { sanitizeRedirectUrl };

export const AUTH_COOKIE_NAME = "projectx_access_token";
export const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours

export function getApiBaseUrl(): string {
  const url = process.env.PROJECTX_API_BASE_URL || "http://localhost:8000/api/v1";
  return url.replace(/\/+$/, "");
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: TOKEN_MAX_AGE_SECONDS,
  };
}

export async function getAuthTokenFromCookies(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value;
}

export async function getCurrentUser(): Promise<UserRead | null> {
  const token = await getAuthTokenFromCookies();
  if (!token) {
    return null;
  }

  try {
    const apiBase = getApiBaseUrl();
    const response = await fetch(`${apiBase}/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const user: UserRead = await response.json();
    if (!user.is_active) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("[server-auth] Failed to verify current user:", error);
    return null;
  }
}


export function parseBackendError(
  status: number,
  data: unknown,
  fallbackMessage: string
): { code: string; message: string; details?: unknown } {
  if (data && typeof data === "object") {
    const envelope = data as BackendErrorEnvelope;

    if (envelope.error && typeof envelope.error === "object") {
      return {
        code: envelope.error.code || "API_ERROR",
        message: envelope.error.message || fallbackMessage,
        details: envelope.error.details,
      };
    }

    if (envelope.detail) {
      if (typeof envelope.detail === "string") {
        return {
          code: status === 401 ? "AUTHENTICATION_FAILED" : "VALIDATION_ERROR",
          message: envelope.detail,
        };
      }
      if (Array.isArray(envelope.detail) && envelope.detail.length > 0) {
        const first = envelope.detail[0];
        const field = first.loc ? first.loc[first.loc.length - 1] : "field";
        return {
          code: "VALIDATION_ERROR",
          message: `${field}: ${first.msg}`,
          details: envelope.detail,
        };
      }
    }
  }

  return {
    code: "SERVER_ERROR",
    message: fallbackMessage,
  };
}
