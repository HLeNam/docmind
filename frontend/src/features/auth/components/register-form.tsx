import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "../hooks/use-auth";
import { registerSchema, type RegisterFormData } from "../schemas/auth-schemas";
import { getErrorMessage } from "@/lib/error-util";
import { SocialAuthButtons } from "./social-auth-buttons";
import { PasswordStrengthIndicator } from "./password-strength-indicator";

export function RegisterForm() {
  const { t } = useTranslation();
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<unknown>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      tenantName: "",
      email: "",
      password: "",
    },
  });

  const watchedPassword = useWatch({ control, name: "password" });

  async function onSubmit(data: RegisterFormData) {
    setApiError(null);
    try {
      await registerUser({
        tenantName: data.tenantName.trim(),
        email: data.email.trim(),
        password: data.password,
      });

      await navigate({ to: "/" });
    } catch (err) {
      setApiError(err);
    }
  }

  function handleGoogleLogin() {
    alert("Tính năng Google OAuth đang được liên kết với Google Client ID trong backend.");
  }

  return (
    <div className="space-y-3.5">
      {/* Google OAuth Option */}
      <SocialAuthButtons
        onGoogleClick={handleGoogleLogin}
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

        {/* Workspace / Tenant Name */}
        <div className="space-y-1">
          <Label htmlFor="register-tenant-name" className="text-xs">{t("auth.tenantNameLabel")}</Label>
          <Input
            id="register-tenant-name"
            type="text"
            placeholder={t("auth.tenantNamePlaceholder")}
            aria-invalid={!!errors.tenantName}
            aria-describedby={errors.tenantName ? "register-tenant-name-error" : undefined}
            disabled={isSubmitting}
            className="h-9"
            {...register("tenantName")}
          />
          {errors.tenantName && (
            <p id="register-tenant-name-error" className="text-xs text-destructive font-medium" role="alert">
              {errors.tenantName.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1">
          <Label htmlFor="register-email" className="text-xs">{t("auth.emailLabel")}</Label>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder={t("auth.emailPlaceholder")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "register-email-error" : undefined}
            disabled={isSubmitting}
            className="h-9"
            {...register("email")}
          />
          {errors.email && (
            <p id="register-email-error" className="text-xs text-destructive font-medium" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <Label htmlFor="register-password" className="text-xs">{t("auth.passwordLabel")}</Label>
          <div className="relative">
            <Input
              id="register-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={t("auth.passwordPlaceholder")}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "register-password-error" : undefined}
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

          {/* Live Password Strength Feedback */}
          <PasswordStrengthIndicator password={watchedPassword} />

          {errors.password && (
            <p id="register-password-error" className="text-xs text-destructive font-medium" role="alert">
              {errors.password.message}
            </p>
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
              t("auth.submitRegister")
            )}
          </Button>
        </div>

        {/* Switch to Login */}
        <div className="pt-1.5 text-center text-xs text-fg-muted">
          <span>{t("auth.alreadyHaveAccount")} </span>
          <Link
            to="/login"
            className="font-medium text-accent hover:underline outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
          >
            {t("auth.loginLink")}
          </Link>
        </div>
      </form>
    </div>
  );
}
