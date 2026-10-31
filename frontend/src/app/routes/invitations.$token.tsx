import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
  User,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  acceptInvitationSchema,
  type AcceptInvitationFormData,
} from "@/features/settings/schemas/invitation-schemas";
import {
  useInvitationInfo,
  useAcceptInvitation,
} from "@/features/settings/hooks/use-invitations";
import { AppError } from "@/lib/api-client";

export const Route = createFileRoute("/invitations/$token")({
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { token } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: info, isLoading, isError, error } = useInvitationInfo(token);
  const acceptMutation = useAcceptInvitation(token);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInvitationFormData>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: {
      password: "",
    },
  });

  const onSubmit = async (data: AcceptInvitationFormData) => {
    try {
      const payload: AcceptInvitationFormData = data.password?.trim()
        ? { password: data.password.trim() }
        : {};
      await acceptMutation.mutateAsync(payload);
      setSuccess(true);
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      setTimeout(() => {
        navigate({ to: "/" });
      }, 1200);
    } catch {
      // Handled by acceptMutation.error
    }
  };

  const getRoleLabel = (role: string) => {
    if (role === "ADMIN") return t("auth.roleAdmin");
    if (role === "OWNER") return t("auth.roleOwner");
    return t("auth.roleMember");
  };

  const getErrorMessage = () => {
    if (!acceptMutation.error) return null;
    if (acceptMutation.error instanceof AppError) {
      return t(`errors.${acceptMutation.error.code}`, {
        defaultValue: acceptMutation.error.message,
      });
    }
    return t("common.error");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="w-full max-w-md p-8 rounded-2xl border border-border bg-surface shadow-sm text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Loader2 className="size-6 animate-spin" aria-hidden="true" />
            </div>
          </div>
          <p className="text-sm text-fg-muted">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (isError || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="w-full max-w-md p-8 rounded-2xl border border-border bg-surface shadow-sm text-center space-y-5">
          <div className="flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-danger-soft text-danger">
              <ShieldAlert className="size-6" aria-hidden="true" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-fg">
              {t("invitation.invalid")}
            </h1>
            <p className="text-xs text-fg-muted mt-1.5 leading-relaxed">
              {error instanceof AppError
                ? t(`errors.${error.code}`, { defaultValue: error.message })
                : t("invitation.expired")}
            </p>
          </div>
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate({ to: "/login" })}
            >
              {t("auth.login")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="w-full max-w-md p-8 rounded-2xl border border-border bg-surface shadow-sm text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-success-soft text-success">
              <CheckCircle2 className="size-6" aria-hidden="true" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-fg">
              {t("invitation.acceptSuccess")}
            </h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-sm p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 pb-2 border-b border-border">
          <div className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-fg font-semibold">
            <FileText className="size-5" aria-hidden="true" />
          </div>
          <span className="font-semibold text-fg tracking-tight">DocMind</span>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-fg tracking-tight">
            {t("invitation.title")}
          </h1>
          <p className="text-xs text-fg-muted leading-relaxed">
            {t("invitation.subtitle", { tenantName: info.tenantName })}
          </p>
        </div>

        {/* Workspace and Role Info card */}
        <div className="p-4 rounded-xl border border-border bg-surface-muted/50 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-fg-muted flex items-center gap-1.5">
              <Building2 className="size-3.5 text-accent" aria-hidden="true" />
              <span>{t("settings.workspaceName")}</span>
            </span>
            <span className="font-semibold text-fg">{info.tenantName}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-fg-muted flex items-center gap-1.5">
              <Mail className="size-3.5 text-fg-muted" aria-hidden="true" />
              <span>{t("invitation.invitedEmail")}</span>
            </span>
            <span className="font-mono text-fg">{info.email}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-fg-muted flex items-center gap-1.5">
              <User className="size-3.5 text-fg-muted" aria-hidden="true" />
              <span>{t("invitation.assignedRole")}</span>
            </span>
            <Badge variant="secondary" className="gap-1 font-medium text-2xs">
              <ShieldCheck className="size-3 text-accent" aria-hidden="true" />
              <span>{getRoleLabel(info.role)}</span>
            </Badge>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {acceptMutation.error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-danger-soft text-danger text-xs border border-danger/20 flex items-start gap-2"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{getErrorMessage()}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="invitation-password" className="text-xs font-medium text-fg flex items-center gap-1.5">
              <Lock className="size-3.5 text-fg-muted" aria-hidden="true" />
              <span>{t("invitation.passwordLabel")}</span>
            </Label>
            <Input
              id="invitation-password"
              type="password"
              {...register("password")}
              placeholder={t("invitation.passwordPlaceholder")}
              disabled={acceptMutation.isPending}
            />
            {errors.password && (
              <p role="alert" className="text-xs text-danger">
                {errors.password.message}
              </p>
            )}
            <p className="text-2xs text-fg-muted leading-tight">
              {t("invitation.passwordHelp")}
            </p>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="default"
              className="w-full gap-2"
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>{t("invitation.accepting")}</span>
                </>
              ) : (
                <span>{t("invitation.acceptButton")}</span>
              )}
            </Button>
          </div>
        </form>

        <div className="text-center text-xs text-fg-muted pt-2 border-t border-border">
          <Link to="/login" className="hover:text-fg underline underline-offset-4">
            {t("auth.alreadyHaveAccount")} {t("auth.loginLink")}
          </Link>
        </div>
      </div>
    </div>
  );
}