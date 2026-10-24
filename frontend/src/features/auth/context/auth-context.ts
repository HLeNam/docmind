import { createContext } from "react";
import type { GetMeResponse, LoginResult } from "../api/auth-api";
import type { LoginFormData, RegisterFormData } from "../schemas/auth-schemas";

export interface AuthContextValue {
  user: GetMeResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (dto: LoginFormData) => Promise<LoginResult>;
  register: (dto: RegisterFormData) => Promise<void>;
  loginWithGoogle: (idToken: string, tenantSlug?: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
