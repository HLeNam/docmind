import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookOpen, LogOut, Building2, Shield, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg text-fg flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs animate-pulse">
            <BookOpen className="size-6" />
          </div>
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <Loader2 className="size-4 animate-spin text-accent" />
            <span>{t("common.loading")}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* Top Navbar */}
      <header className="border-b border-border bg-surface sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpen className="size-4" aria-hidden="true" />
            </div>
            <span className="font-heading font-semibold text-lg text-fg tracking-tight">
              {t("common.appName")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-surface-muted border border-border text-xs text-fg-muted">
              <Building2 className="size-3.5" aria-hidden="true" />
              <span className="font-medium text-fg">{user.tenant.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="text-fg-muted hover:text-fg"
            >
              <LogOut className="size-4 mr-1.5" aria-hidden="true" />
              <span>{t("auth.logout")}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="space-y-6">
          {/* Welcome Card */}
          <div className="bg-surface border border-border rounded-xl p-6 shadow-xs">
            <h1 className="text-xl font-semibold text-fg">
              {t("common.appName")} Workspace
            </h1>
            <p className="mt-1 text-sm text-fg-muted">
              Hệ thống RAG đa tenant cho tài liệu doanh nghiệp.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
              {/* User Identity */}
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted border border-border text-fg-muted">
                  <User className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-fg-muted">Tài khoản</p>
                  <p className="text-sm font-medium text-fg truncate">
                    {user.identity.email}
                  </p>
                </div>
              </div>

              {/* Workspace */}
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted border border-border text-fg-muted">
                  <Building2 className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-fg-muted">Workspace</p>
                  <p className="text-sm font-medium text-fg truncate">
                    {user.tenant.name}
                  </p>
                  <p className="text-xs text-fg-muted font-mono">
                    {user.tenant.slug}
                  </p>
                </div>
              </div>

              {/* Role & Plan */}
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted border border-border text-fg-muted">
                  <Shield className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-fg-muted">Vai trò & Gói</p>
                  <p className="text-sm font-medium text-fg">
                    {user.membership.role}
                  </p>
                  <p className="text-xs text-fg-muted uppercase">
                    {user.tenant.plan}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
