import {
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, type GetMeResponse, type LoginResult } from "../api/auth-api";
import {
  getAccessToken,
  clearAccessToken,
} from "@/lib/auth-token";
import { disconnectRealtimeSocket } from "@/lib/socket";
import { refreshAccessTokenSingleFlight } from "@/lib/api-client";
import type { LoginFormData, RegisterFormData } from "../schemas/auth-schemas";
import { AuthContext, type AuthContextValue } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isInitializing, setIsInitializing] = useState(true);
  const [token, setToken] = useState<string | null>(getAccessToken());

  // 1. Khi app khởi động: gọi refresh token trước để xem có phiên đăng nhập hợp lệ không
  useEffect(() => {
    async function initAuth() {
      try {
        const refreshedToken = await refreshAccessTokenSingleFlight();
        if (refreshedToken) {
          setToken(refreshedToken);
        } else {
          clearAccessToken();
          setToken(null);
        }
      } catch {
        clearAccessToken();
        setToken(null);
      } finally {
        setIsInitializing(false);
      }
    }
    initAuth();
  }, []);

  // 2. Lấy profile 'me' khi đã có accessToken
  const { data: user, isLoading: isUserLoading } = useQuery<GetMeResponse>({
    queryKey: ["auth", "me"],
    queryFn: () => authApi.getMe(),
    enabled: !!token && !isInitializing,
    staleTime: 1000 * 60 * 5, // 5 phút
    retry: false,
  });

  const login = useCallback(
    async (dto: LoginFormData): Promise<LoginResult> => {
      const result = await authApi.login(dto);
      if ("accessToken" in result && result.accessToken) {
        setToken(result.accessToken);
        await queryClient.fetchQuery({
          queryKey: ["auth", "me"],
          queryFn: () => authApi.getMe(),
        });
      }
      return result;
    },
    [queryClient]
  );

  const register = useCallback(
    async (dto: RegisterFormData): Promise<void> => {
      const result = await authApi.register(dto);
      if (result?.accessToken) {
        setToken(result.accessToken);
        await queryClient.fetchQuery({
          queryKey: ["auth", "me"],
          queryFn: () => authApi.getMe(),
        });
      }
    },
    [queryClient]
  );

  const loginWithGoogle = useCallback(
    async (idToken: string, tenantSlug?: string): Promise<LoginResult> => {
      const result = await authApi.loginWithGoogle(idToken, tenantSlug);
      if ("accessToken" in result && result.accessToken) {
        setToken(result.accessToken);
        await queryClient.fetchQuery({
          queryKey: ["auth", "me"],
          queryFn: () => authApi.getMe(),
        });
      }
      return result;
    },
    [queryClient]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      clearAccessToken();
      setToken(null);
      queryClient.clear();
      disconnectRealtimeSocket();
    }
  }, [queryClient]);

  const value: AuthContextValue = {
    user: user ?? null,
    isLoading: isInitializing || (!!token && isUserLoading),
    isAuthenticated: !!user,
    login,
    register,
    loginWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
