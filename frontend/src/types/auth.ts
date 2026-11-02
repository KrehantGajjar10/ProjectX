export interface UserRead {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string;
}

export interface BackendToken {
  access_token: string;
  token_type: string;
}

export interface BackendErrorEnvelope {
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  detail?: string | Array<{ msg: string; loc?: (string | number)[] }>;
}

export interface AuthSuccessResponse {
  success: boolean;
  user: UserRead;
  message?: string;
}

export interface AuthErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface SessionResponse {
  authenticated: boolean;
  user: UserRead | null;
}
