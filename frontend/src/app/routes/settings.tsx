import { useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  LogOut,
  Building2,
  User,
  Loader2,
  Folder,
  MessageSquare,
  Settings,
  Users,
  KeyRound,
  Hash,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocMindLogo } from "@/components/ui/docmind-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/features/auth";
import {
  MembersSettingsTab,
  ApiKeysSettingsTab,
  SlackSettingsTab,
  UsageSettingsTab,
} from "@/features/settings";

const settingsSearchSchema = z.object({
  tab: z.enum(["members", "apiKeys", "slack", "usage"]).optional(),
});

type SettingsTab = "members" | "apiKeys" | "slack" | "usage";

export const Route = createFileRoute("/settings")({
  validateSearch: (search) => settingsSearchSchema.parse(search),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const activeTab: SettingsTab = (search.tab as SettingsTab) || "members";

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  const handleTabChange = (tab: SettingsTab) => {
    navigate({
      to: "/settings",
      search: { tab },
      replace: true,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg text-fg flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface border border-border text-fg shadow-xs animate-pulse">
            <DocMindLogo size={28} className="text-fg" />
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

  const tabs: Array<{
    id: SettingsTab;
    label: string;
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  }> = [
    {
      id: "members",
      label: t("settings.tabs.members"),
      icon: Users,
    },
    {
      id: "apiKeys",
      label: t("settings.tabs.apiKeys"),
      icon: KeyRound,
    },
    {
      id: "slack",
      label: t("settings.tabs.slack"),
      icon: Hash,
    },
    {
      id: "usage",
      label: t("settings.tabs.usage"),
      icon: BarChart3,
    },
  ];

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-border bg-surface sticky top-0 z-20 shadow-xs h-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-surface border border-border text-fg shadow-xs">
                <DocMindLogo size={20} className="text-fg" />
              </div>
              <span className="font-heading font-semibold text-lg text-fg tracking-tight">
                {t("common.appName")}
              </span>
            </div>

            {/* Navigation Tabs */}
            <nav aria-label="Main" className="flex items-center gap-1">
              <Link
                to="/"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-fg-muted hover:text-fg hover:bg-surface-muted transition-colors"
              >
                <Folder className="size-3.5" aria-hidden="true" />
                <span>{t("collections.title")}</span>
              </Link>

              <Link
                to="/chat"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-fg-muted hover:text-fg hover:bg-surface-muted transition-colors"
              >
                <MessageSquare className="size-3.5" aria-hidden="true" />
                <span>{t("chat.title")}</span>
              </Link>

              <Link
                to="/settings"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-soft text-accent transition-colors"
              >
                <Settings className="size-3.5" aria-hidden="true" />
                <span>{t("settings.title")}</span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-surface-muted border border-border text-xs text-fg-muted">
              <Building2 className="size-3.5" aria-hidden="true" />
              <span className="font-medium text-fg">{user.tenant.name}</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs text-fg-muted pr-2 border-r border-border">
              <div className="flex size-6 items-center justify-center rounded-full bg-surface-muted text-fg">
                <User className="size-3.5" aria-hidden="true" />
              </div>
              <span className="truncate max-w-32 font-medium text-fg">
                {user.identity.email}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-accent-soft text-accent">
                {user.membership.role}
              </span>
            </div>

            <ThemeToggle />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="text-fg-muted hover:text-fg text-xs h-8 px-2.5"
            >
              <LogOut className="size-3.5 mr-1.5" aria-hidden="true" />
              <span>{t("auth.logout")}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Settings Content */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="space-y-6">
          {/* Page Title */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-fg">
              {t("settings.title")}
            </h1>
            <p className="text-xs sm:text-sm text-fg-muted mt-1">
              {t("settings.subtitle")}
            </p>
          </div>

          {/* Settings Tabs Bar */}
          <div
            role="tablist"
            aria-label={t("settings.title")}
            className="flex items-center gap-1 p-1 rounded-xl bg-surface-muted/60 border border-border overflow-x-auto"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isSelected
                      ? "bg-surface text-fg shadow-xs border border-border"
                      : "text-fg-muted hover:text-fg hover:bg-surface/50"
                  }`}
                >
                  <Icon
                    className={`size-3.5 ${
                      isSelected ? "text-accent" : "text-fg-muted"
                    }`}
                    aria-hidden="true"
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Panels */}
          <div className="pt-2">
            {activeTab === "members" && <MembersSettingsTab />}
            {activeTab === "apiKeys" && <ApiKeysSettingsTab />}
            {activeTab === "slack" && <SlackSettingsTab />}
            {activeTab === "usage" && <UsageSettingsTab />}
          </div>
        </div>
      </main>
    </div>
  );
}