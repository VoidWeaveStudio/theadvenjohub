// src/core/api/client.ts
import { getCsrfToken } from "@/core/lib/clientUtils";

export interface FetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  skipAuthRetry?: boolean;
}

function buildHeaders(customHeaders?: Record<string, string>): Headers {
  const headers = new Headers(customHeaders || {});
  headers.set("Content-Type", "application/json");
  
  const csrf = getCsrfToken();
  if (csrf) {
    headers.set("x-csrf-token", csrf);
  }
  
  return headers;
}

async function fetchWithAuth(url: string, options: FetchOptions = {}): Promise<Response> {
  const defaultOptions: RequestInit = {
    credentials: "include",
    ...options,
    headers: buildHeaders(options.headers),
  };
  return fetch(url, defaultOptions);
}

export interface ApiErrorResponse {
  error: string;
  details?: Record<string, string[]>;
  code?: string;
}

async function parseJsonResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[api] Unexpected content-type: ${contentType}`);
    }
    throw new Error("api.unexpectedContentType");
  }

  try {
    return await res.json();
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.warn("[api] Failed to parse JSON response");
    }
    throw new Error("api.invalidJsonResponse");
  }
}


function sanitizeError(raw: unknown): ApiErrorResponse {
  const safe: ApiErrorResponse = { error: "api.requestFailed" };

  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;

    if (typeof obj.error === "string" && obj.error.length > 0 && obj.error.length < 500) {
      safe.error = obj.error;
    }
    if (typeof obj.code === "string" && /^[a-z_][a-z0-9_]*$/.test(obj.code)) {
      safe.code = obj.code;
    }
    if (
      typeof obj.details === "object" &&
      obj.details !== null &&
      !Array.isArray(obj.details)
    ) {
      const sanitized: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(obj.details)) {
        if (
          typeof key === "string" &&
          key.length > 0 && key.length < 100 &&
          Array.isArray(value) &&
          value.every(v => typeof v === "string" && v.length > 0 && v.length < 500)
        ) {
          sanitized[key] = value as string[];
        }
      }
      if (Object.keys(sanitized).length > 0) {
        safe.details = sanitized;
      }
    }
  }

  return safe;
}

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

async function attemptTokenRefresh(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      if (process.env.NODE_ENV === "development") {
        console.warn('[api] Refresh endpoint returned:', res.status);
      }
      return false;
    }

    const data = await res.json().catch(() => null);
    return data?.success === true;
    
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.warn('[api] Token refresh failed');
    }
    return false;
  }
}

export async function apiGet<T = unknown>(
  url: string,
  options?: FetchOptions,
  t?: TranslateFn
): Promise<T> {
  const _t = t || ((k: string) => k);

  const res = await fetchWithAuth(url, { method: "GET", ...options });

  if (res.status === 401 && !options?.skipAuthRetry) {
    const refreshed = await attemptTokenRefresh();
    
    if (refreshed) {
      const retryRes = await fetchWithAuth(url, { 
        method: "GET", 
        ...options, 
        skipAuthRetry: true 
      });
      
      if (!retryRes.ok) {
        const raw = await parseJsonResponse(retryRes).catch(() => ({}));
        const errorData = sanitizeError(raw);
        const errorMessage = errorData.code
          ? _t(`api.error.${errorData.code}`, { status: retryRes.status })
          : _t("api.requestFailed", { status: retryRes.status });
        throw new Error(errorMessage);
      }
      
      return await parseJsonResponse(retryRes) as T;
    }
  }

  if (!res.ok) {
    const raw = await parseJsonResponse(res).catch(() => ({}));
    const errorData = sanitizeError(raw);

    const errorMessage = errorData.code
      ? _t(`api.error.${errorData.code}`, { status: res.status })
      : _t("api.requestFailed", { status: res.status });

    throw new Error(errorMessage);
  }

  return await parseJsonResponse(res) as T;
}

export async function apiPost<T = unknown>(
  url: string,
  body?: Record<string, unknown>,
  options?: FetchOptions,
  t?: TranslateFn
): Promise<T> {
  const _t = t || ((k: string) => k);

  const res = await fetchWithAuth(url, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });

  if (res.status === 401 && !options?.skipAuthRetry) {
    const refreshed = await attemptTokenRefresh();
    
    if (refreshed) {
      const retryRes = await fetchWithAuth(url, { 
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
        ...options, 
        skipAuthRetry: true 
      });
      
      if (!retryRes.ok) {
        const raw = await parseJsonResponse(retryRes).catch(() => ({}));
        const errorData = sanitizeError(raw);
        const errorMessage = errorData.code
          ? _t(`api.error.${errorData.code}`, { status: retryRes.status })
          : _t("api.requestFailed", { status: retryRes.status });
        throw new Error(errorMessage);
      }
      
      return await parseJsonResponse(retryRes) as T;
    }
  }

  if (!res.ok) {
    const raw = await parseJsonResponse(res).catch(() => ({}));
    const errorData = sanitizeError(raw);

    const errorMessage = errorData.code
      ? _t(`api.error.${errorData.code}`, { status: res.status })
      : _t("api.requestFailed", { status: res.status });

    throw new Error(errorMessage);
  }

  return await parseJsonResponse(res) as T;
}

export async function apiGetTyped<T>(
  url: string,
  options?: FetchOptions,
  t?: TranslateFn
): Promise<{ data: T }> {
  const result = await apiGet<
    { data: T; error?: never } | { error: string; data?: never; code?: string }
  >(url, options, t);

  if ("error" in result && result.error) {
    throw new Error(result.error);
  }

  if (!("data" in result)) {
    throw new Error("api.invalidResponseFormat");
  }

  return { data: result.data as T };
}

export async function apiPostTyped<T>(
  url: string,
  body?: Record<string, unknown>,
  options?: FetchOptions,
  t?: TranslateFn
): Promise<{ data: T }> {
  const result = await apiPost<
    { data: T; error?: never } | { error: string; data?: never; code?: string }
  >(url, body, options, t);

  if ("error" in result && result.error) {
    throw new Error(result.error);
  }

  if (!("data" in result)) {
    throw new Error("api.invalidResponseFormat");
  }

  return { data: result.data as T };
}