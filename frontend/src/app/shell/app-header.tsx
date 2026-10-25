import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Folder,
  MessageSquare,
  Settings,
  Building2,
  User,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocMindLogo } from "@/components/ui/docmind-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/features/auth";
import { cn } from "cn";

interface AppHeaderProps {
  activeTab?: "collections" | "chat" | "settings";
}

export function AppHeader({ activeTab }: AppHeaderProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const resolvedTab =
    activeTab ||
    (currentPath.startsWith("/chat")
      ? "chat"
      : currentPath.startsWith("/settings")
        ? "settings"
        : "collections");

  if (!user) return null;

  const isElevatedRole =
    user.membership.role === "OWNER" || user.membership.role === "ADMIN";

  return (
    <header className="border-b border-border bg-surface/95 backdrop-blur-md sticky top-0 z-20 shadow-2xs h-14">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-full flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-6 min-w-0">
          {/* Logo & Brand */}
          <Link
            to="/"
            className="flex items-center gap-2 sm:gap-2.5 outline-hidden group focus-visible:ring-2 focus-visible:ring-ring rounded-lg shrink-0"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-surface border border-border text-fg shadow-2xs group-hover:border-accent/40 transition-colors">
              <DocMindLogo size={20} className="text-fg" />
            </div>
            <span className="font-heading font-semibold text-base sm:text-lg text-fg tracking-tight">
              {t("common.appName")}
            </span>
          </Link>

          {/* Navigation Tabs */}
          <nav aria-label="Main" className="flex items-center gap-0.5 sm:gap-1">
            <Link
              to="/"
              title={t("collections.title")}
              aria-label={t("collections.title")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0",
                resolvedTab === "collections"
                  ? "bg-accent-soft text-accent font-semibold shadow-2xs border border-accent/20"
                  : "text-fg-muted hover:text-fg hover:bg-surface-muted/60"
              )}
            >
              <Folder className="size-4 sm:size-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{t("collections.title")}</span>
            </Link>

            <Link
              to="/chat"
              title={t("chat.title")}
              aria-label={t("chat.title")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0",
                resolvedTab === "chat"
                  ? "bg-accent-soft text-accent font-semibold shadow-2xs border border-accent/20"
                  : "text-fg-muted hover:text-fg hover:bg-surface-muted/60"
              )}
            >
              <MessageSquare className="size-4 sm:size-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{t("chat.title")}</span>
            </Link>

            <Link
              to="/settings"
              title={t("settings.title")}
              aria-label={t("settings.title")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0",
                resolvedTab === "settings"
                  ? "bg-accent-soft text-accent font-semibold shadow-2xs border border-accent/20"
                  : "text-fg-muted hover:text-fg hover:bg-surface-muted/60"
              )}
            >
              <Settings className="size-4 sm:size-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{t("settings.title")}</span>
            </Link>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Tenant Name */}
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface-muted/60 border border-border text-xs text-fg-muted">
            <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="font-medium text-fg truncate max-w-36">
              {user.tenant.name}
            </span>
          </div>

          {/* User Email & Role */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-fg-muted pr-2 border-r border-border">
            <div className="flex size-6 items-center justify-center rounded-full bg-surface-muted text-fg border border-border/60">
              <User className="size-3.5" aria-hidden="true" />
            </div>
            <span className="truncate max-w-32 font-medium text-fg">
              {user.identity.email}
            </span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-md text-2xs font-mono uppercase font-semibold",
                isElevatedRole
                  ? "bg-accent-soft text-accent border border-accent/25"
                  : "bg-surface-muted text-fg-muted border border-border"
              )}
            >
              {user.membership.role}
            </span>
          </div>

          <ThemeToggle />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            className="text-fg-muted hover:text-fg text-xs h-8 px-2 sm:px-2.5"
            aria-label={t("auth.logout")}
            title={t("auth.logout")}
          >
            <LogOut className="size-3.5 sm:mr-1.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t("auth.logout")}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
