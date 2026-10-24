import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "../hooks/use-auth";
import { loginSchema, type LoginFormData } from "../schemas/auth-schemas";
import { getErrorMessage } from "@/lib/error-util";
import type { TenantSelectionOption } from "../api/auth-api";
import { TenantSelectionList } from "./tenant-selection-list";
import { SocialAuthButtons } from "./social-auth-buttons";

interface LoginFormProps {
  redirectTo?: string;
}

export function LoginForm({ redirectTo = "/" }: LoginFormProps) {
  const { t } = useTranslation();
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showTenantField, setShowTenantField] = useState(false);
  const [apiError, setApiError] = useState<unknown>(null);
  const [tenantsToSelect, setTenantsToSelect] = useState<TenantSelectionOption[] | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      tenantSlug: "",
    },
  });

  async function onSubmit(data: LoginFormData) {
    setApiError(null);
    try {
      const result = await login({
        email: data.email,
        password: data.password,
        tenantSlug: data.tenantSlug ? data.tenantSlug.trim() : undefined,
      });

      if ("requiresTenantSelection" in result && result.requiresTenantSelection) {
        setTenantsToSelect(result.tenants);
        return;
      }

      await navigate({ to: redirectTo });
    } catch (err) {
      setApiError(err);
    }
  }

  async function handleTenantSelected(tenantId: string) {
    setApiError(null);
    const { email, password } = getValues();
    try {
      await login({
        email,
        password,
        tenantSlug: tenantId,
      });
      await navigate({ to: redirectTo });
    } catch (err) {
      setApiError(err);
    }
  }

  async function handleGoogleSuccess(credential: string) {
    setApiError(null);
    try {
      const result = await loginWithGoogle(credential);
      if ("requiresTenantSelection" in result && result.requiresTenantSelection) {
        setTenantsToSelect(result.tenants);
        return;
      }
      await navigate({ to: redirectTo });
    } catch (err) {
      setApiError(err);
    }
  }

  if (tenantsToSelect && tenantsToSelect.length > 0) {
    return (
      <TenantSelectionList
        tenants={tenantsToSelect}
        onSelectTenant={handleTenantSelected}
        onBack={() => setTenantsToSelect(null)}
      />
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Google OAuth Button */}
      <SocialAuthButtons
        onGoogleSuccess={handleGoogleSuccess}
        onError={(err) => setApiError(err)}
        disabled={isSubmitting}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        {apiError != null && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              {getErrorMessage(apiError)}
            </AlertDescription>
          </Alert>
        )}

        {/* Email */}
        <div className="space-y-1">
          <Label htmlFor="login-email" className="text-xs">{t("auth.emailLabel")}</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder={t("auth.emailPlaceholder")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            disabled={isSubmitting}
            className="h-9"
            {...register("email")}
          />
          {errors.email && (
            <p id="login-email-error" className="text-xs text-destructive font-medium" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <Label htmlFor="login-password" className="text-xs">{t("auth.passwordLabel")}</Label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder={t("auth.passwordPlaceholder")}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              disabled={isSubmitting}
              className="h-9 pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg p-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.password && (
            <p id="login-password-error" className="text-xs text-destructive font-medium" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Optional Tenant Slug toggle */}
        <div className="pt-0.5">
          {!showTenantField ? (
            <button
              type="button"
              onClick={() => setShowTenantField(true)}
              className="text-xs text-accent hover:underline outline-none focus-visible:ring-1 focus-visible:ring-ring rounded font-medium"
            >
              {t("auth.showSpecificTenant")}
            </button>
          ) : (
            <div className="space-y-1 pt-1">
              <Label htmlFor="login-tenant-slug" className="text-xs">{t("auth.tenantSlugLabel")}</Label>
              <Input
                id="login-tenant-slug"
                type="text"
                placeholder={t("auth.tenantSlugPlaceholder")}
                disabled={isSubmitting}
                className="h-9"
                {...register("tenantSlug")}
              />
              <p className="text-[11px] text-fg-muted">
                {t("auth.tenantSlugHelp")}
              </p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-1.5">
          <Button
            type="submit"
            className="w-full h-9 font-medium"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" aria-hidden="true" />
                <span>{t("auth.submitting")}</span>
              </>
            ) : (
              t("auth.submitLogin")
            )}
          </Button>
        </div>

        {/* Switch to Register */}
        <div className="pt-1.5 text-center text-xs text-fg-muted">
          <span>{t("auth.dontHaveAccount")} </span>
          <Link
            to="/register"
            className="font-medium text-accent hover:underline outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
          >
            {t("auth.registerLink")}
          </Link>
        </div>
      </form>
    </div>
  );
}
