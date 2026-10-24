import { apiClient } from "@/lib/api-client";
import { setAccessToken, clearAccessToken } from "@/lib/auth-token";
import type { LoginFormData, RegisterFormData } from "../schemas/auth-schemas";

export interface TokensResponse {
  accessToken: string;
}

export interface TenantSelectionOption {
  tenantId: string;
  role: string;
}

export interface TenantSelectionResponse {
  requiresTenantSelection: true;
  tenants: TenantSelectionOption[];
}

export type LoginResult = TokensResponse | TenantSelectionResponse;

export interface GetMeResponse {
  identity: {
    id: string;
    email: string;
    emailVerifiedAt: string | null;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
  membership: {
    id: string;
    role: string;
    status: string;
  };
}

export const authApi = {
  async register(dto: RegisterFormData): Promise<TokensResponse> {
    const data = await apiClient<TokensResponse>("/auth/register", {
      method: "POST",
      body: dto,
      skipAuth: true,
    });
    if (data?.accessToken) {
      setAccessToken(data.accessToken);
    }
    return data;
  },

  async login(dto: LoginFormData): Promise<LoginResult> {
    const data = await apiClient<LoginResult>("/auth/login", {
      method: "POST",
      body: dto,
      skipAuth: true,
    });
    if ("accessToken" in data && data.accessToken) {
      setAccessToken(data.accessToken);
    }
    return data;
  },

  async loginWithGoogle(idToken: string, tenantSlug?: string): Promise<LoginResult> {
    const data = await apiClient<LoginResult>("/auth/google", {
      method: "POST",
      body: { idToken, tenantSlug },
      skipAuth: true,
    });
    if ("accessToken" in data && data.accessToken) {
      setAccessToken(data.accessToken);
    }
    return data;
  },

  async getMe(): Promise<GetMeResponse> {
    return apiClient<GetMeResponse>("/auth/me");
  },

  async logout(): Promise<null> {
    try {
      await apiClient<null>("/auth/logout", {
        method: "POST",
        body: {},
      });
    } finally {
      clearAccessToken();
    }
    return null;
  },
};
