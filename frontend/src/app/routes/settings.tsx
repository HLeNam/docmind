import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  Loader2,
  Users,
  KeyRound,
  Hash,
  BarChart3,
} from "lucide-react";
import { DocMindLogo } from "@/components/ui/docmind-logo";
import { AppHeader } from "@/app/shell/app-header";
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
  const { user, isAuthenticated, isLoading } = useAuth();
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
      <AppHeader activeTab="settings" />

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
            className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-surface-muted/60 border border-border overflow-x-auto shadow-2xs"
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer ${
                    isSelected
                      ? "bg-surface text-fg shadow-xs border border-border font-semibold"
                      : "text-fg-muted hover:text-fg hover:bg-surface/50"
                  }`}
                >
                  <Icon
                    className={`size-4 ${isSelected ? "text-accent" : "text-fg-muted"}`}
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