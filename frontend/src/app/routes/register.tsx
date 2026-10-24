import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth, AuthSplitLayout, RegisterForm } from "@/features/auth";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  return (
    <AuthSplitLayout
      title={t("auth.registerTitle")}
      subtitle={t("auth.registerSubtitle")}
    >
      <RegisterForm />
    </AuthSplitLayout>
  );
}
