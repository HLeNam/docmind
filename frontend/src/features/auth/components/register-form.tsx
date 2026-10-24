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
import { registerSchema, type RegisterFormData } from "../schemas/auth-schemas";
import { getErrorMessage } from "@/lib/error-util";

export function RegisterForm() {
  const { t } = useTranslation();
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<unknown>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      tenantName: "",
      email: "",
      password: "",
    },
  });

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {apiError != null && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {getErrorMessage(apiError)}
          </AlertDescription>
        </Alert>
      )}

      {/* Workspace / Tenant Name */}
      <div className="space-y-1.5">
        <Label htmlFor="register-tenant-name">{t("auth.tenantNameLabel")}</Label>
        <Input
          id="register-tenant-name"
          type="text"
          placeholder={t("auth.tenantNamePlaceholder")}
          aria-invalid={!!errors.tenantName}
          aria-describedby={errors.tenantName ? "register-tenant-name-error" : "register-tenant-name-help"}
          disabled={isSubmitting}
          {...register("tenantName")}
        />
        {errors.tenantName ? (
          <p id="register-tenant-name-error" className="text-xs text-destructive font-medium" role="alert">
            {errors.tenantName.message}
          </p>
        ) : (
          <p id="register-tenant-name-help" className="text-xs text-fg-muted">
            {t("auth.tenantNameHelp")}
          </p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="register-email">{t("auth.emailLabel")}</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder={t("auth.emailPlaceholder")}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "register-email-error" : undefined}
          disabled={isSubmitting}
          {...register("email")}
        />
        {errors.email && (
          <p id="register-email-error" className="text-xs text-destructive font-medium" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label htmlFor="register-password">{t("auth.passwordLabel")}</Label>
        <div className="relative">
          <Input
            id="register-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder={t("auth.passwordPlaceholder")}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "register-password-error" : "register-password-help"}
            disabled={isSubmitting}
            className="pr-10"
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
        {errors.password ? (
          <p id="register-password-error" className="text-xs text-destructive font-medium" role="alert">
            {errors.password.message}
          </p>
        ) : (
          <p id="register-password-help" className="text-xs text-fg-muted">
            {t("auth.passwordRequirements")}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <Button
          type="submit"
          className="w-full"
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
      <div className="pt-2 text-center text-xs text-fg-muted">
        <span>{t("auth.alreadyHaveAccount")} </span>
        <Link
          to="/login"
          className="font-medium text-accent hover:underline outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
        >
          {t("auth.loginLink")}
        </Link>
      </div>
    </form>
  );
}
