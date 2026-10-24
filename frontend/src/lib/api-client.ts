import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  getLastRefreshedAt,
} from "./auth-token";

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, status: HttpStatusNumber, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number, message = "Too many requests") {
    super("RATE_LIMITED", message, 429);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

type HttpStatusNumber = number;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
  skip401Retry?: boolean;
}

const API_BASE_URL = "/api";

// Single-flight refresh token promise dùng chung trong 1 tab
let activeRefreshPromise: Promise<string | null> | null = null;

// Hàm thực hiện refresh token an toàn theo chuẩn Web Locks (multi-tab)
export async function refreshAccessTokenSingleFlight(): Promise<string | null> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  const startedAt = Date.now();

  const executeRefresh = async (): Promise<string | null> => {
    // 1. Kiểm tra xem tab khác đã refresh xong trong lúc chờ không
    if (getLastRefreshedAt() > startedAt) {
      const currentToken = getAccessToken();
      if (currentToken) return currentToken;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        credentials: "include",
      });

      if (!res.ok) {
        clearAccessToken();
        return null;
      }

      const json = await res.json();
      if (json.success && json.data?.accessToken) {
        setAccessToken(json.data.accessToken);
        return json.data.accessToken;
      }

      clearAccessToken();
      return null;
    } catch {
      clearAccessToken();
      return null;
    }
  };

  activeRefreshPromise = (async () => {
    try {
      if (typeof navigator !== "undefined" && "locks" in navigator) {
        return await navigator.locks.request("docmind-refresh", executeRefresh);
      }
      return await executeRefresh();
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    body,
    params,
    headers: customHeaders = {},
    skipAuth = false,
    skip401Retry = false,
    ...restOptions
  } = options;

  let url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const headers = new Headers(customHeaders);

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (!skipAuth && token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = {
    ...restOptions,
    headers,
    credentials: "include",
    body: isFormData
      ? (body as FormData)
      : body !== undefined
        ? JSON.stringify(body)
        : undefined,
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (networkError) {
    throw new AppError(
      "NETWORK_ERROR",
      networkError instanceof Error ? networkError.message : "Network error",
      0
    );
  }

  // 1. Xử lý Rate limit 429
  if (response.status === 429) {
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
    throw new RateLimitError(
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : 60
    );
  }

  // 2. Xử lý 401: Thử refresh token 1 lần (Single-flight)
  if (response.status === 401 && !skip401Retry && !endpoint.includes("/auth/")) {
    const newToken = await refreshAccessTokenSingleFlight();
    if (newToken) {
      // Thử lại request gốc đúng 1 lần với token mới
      return apiClient<T>(endpoint, {
        ...options,
        skip401Retry: true,
      });
    }

    // Refresh thất bại -> Xoá token và ném lỗi 401
    clearAccessToken();
    throw new AppError("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn", 401);
  }

  // 3. Xử lý response 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  // 4. Bóc tách JSON envelope: { success, data, error, meta }
  let json: { success?: boolean; data?: unknown; error?: ApiErrorPayload };
  try {
    json = (await response.json()) as {
      success?: boolean;
      data?: unknown;
      error?: ApiErrorPayload;
    };
  } catch {
    if (!response.ok) {
      throw new AppError(
        "HTTP_ERROR",
        `HTTP Error ${response.status}`,
        response.status
      );
    }
    return null as T;
  }

  if (!response.ok || !json.success) {
    const error = json?.error as ApiErrorPayload | undefined;
    throw new AppError(
      error?.code || (response.status === 403 ? "FORBIDDEN" : "API_ERROR"),
      error?.message || "Đã xảy ra lỗi khi gọi API",
      response.status,
      error?.details
    );
  }

  return json.data as T;
}
