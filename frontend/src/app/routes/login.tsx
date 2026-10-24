import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useAuth, AuthSplitLayout, LoginForm } from "@/features/auth";

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: search.redirect || "/" });
    }
  }, [isLoading, isAuthenticated, search.redirect, navigate]);

  return (
    <AuthSplitLayout
      title={t("auth.loginTitle")}
      subtitle={t("auth.loginSubtitle")}
    >
      <LoginForm redirectTo={search.redirect || "/"} />
    </AuthSplitLayout>
  );
}
