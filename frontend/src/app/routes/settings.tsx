import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  Users,
  KeyRound,
  Hash,
  BarChart3,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";
import { useUIStore } from "@/lib/ui-store";
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
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  const activeTab: SettingsTab = (search.tab as SettingsTab) || "members";

  const handleTabChange = (tab: SettingsTab) => {
    navigate({
      to: "/settings",
      search: { tab },
      replace: true,
    });
  };

  if (!user) {
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
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-bg text-fg">
      {/* Top Bar with Mobile Toggle */}
      <header className="h-12 px-4 border-b border-border flex items-center justify-between shrink-0 bg-surface/40 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          {!isSidebarOpen && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setSidebarOpen(true)}
              className="text-fg-muted hover:text-fg"
              title={t("common.openSidebar")}
              aria-label={t("common.openSidebar")}
            >
              <PanelLeft className="size-4" />
            </Button>
          )}
          <span className="text-xs font-medium text-fg-muted">DocMind</span>
          <span className="text-fg-muted/40 text-xs">/</span>
          <span className="text-xs font-semibold text-fg">{t("settings.title")}</span>
        </div>
      </header>

      {/* Main Settings Content */}
      <main id="main-content" className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg text-balance">
            {t("settings.title")}
          </h1>
          <p className="text-xs sm:text-sm text-fg-muted mt-1 text-pretty">
            {t("settings.subtitle")}
          </p>
        </div>

        {/* Settings Tabs Bar */}
        <div
          role="tablist"
          aria-label={t("settings.title")}
          className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-muted/60 border border-border overflow-x-auto shadow-2xs"
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
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer ${
                  isSelected
                    ? "bg-surface text-fg shadow-2xs border border-border font-semibold"
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
      </main>
    </div>
  );
}
