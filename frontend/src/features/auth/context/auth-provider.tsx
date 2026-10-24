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

  // 1. Khi app khởi động: gọi refresh token trước để xem có phiên đăng nhập hợp lệ không
  useEffect(() => {
    async function initAuth() {
      try {
        await refreshAccessTokenSingleFlight();
      } catch {
        clearAccessToken();
      } finally {
        setIsInitializing(false);
      }
    }
    initAuth();
  }, []);

  const hasToken = !!getAccessToken();

  // 2. Lấy profile 'me' khi đã có accessToken
  const { data: user, isLoading: isUserLoading } = useQuery<GetMeResponse>({
    queryKey: ["auth", "me"],
    queryFn: () => authApi.getMe(),
    enabled: hasToken && !isInitializing,
    staleTime: 1000 * 60 * 5, // 5 phút
    retry: false,
  });

  const login = useCallback(
    async (dto: LoginFormData): Promise<LoginResult> => {
      const result = await authApi.login(dto);
      if ("accessToken" in result && result.accessToken) {
        await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      }
      return result;
    },
    [queryClient]
  );

  const register = useCallback(
    async (dto: RegisterFormData): Promise<void> => {
      await authApi.register(dto);
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
    [queryClient]
  );

  const loginWithGoogle = useCallback(
    async (idToken: string, tenantSlug?: string): Promise<LoginResult> => {
      const result = await authApi.loginWithGoogle(idToken, tenantSlug);
      if ("accessToken" in result && result.accessToken) {
        await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
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
      queryClient.clear();
      disconnectRealtimeSocket();
    }
  }, [queryClient]);

  const value: AuthContextValue = {
    user: user ?? null,
    isLoading: isInitializing || (hasToken && isUserLoading),
    isAuthenticated: !!user,
    login,
    register,
    loginWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
