import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, KeyRound, Hash, BarChart3, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MembersSettingsTab } from "./members-settings-tab";
import { ApiKeysSettingsTab } from "./api-keys-settings-tab";
import { SlackSettingsTab } from "./slack-settings-tab";
import { UsageSettingsTab } from "./usage-settings-tab";

export type SettingsTab = "members" | "apiKeys" | "slack" | "usage";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: SettingsTab;
}

export function SettingsDialog({
  open,
  onOpenChange,
  initialTab = "members",
}: SettingsDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[88vh] flex flex-col p-0 overflow-hidden bg-surface border border-border rounded-2xl shadow-xl">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent border border-accent/20">
              <Settings className="size-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-fg">
                {t("settings.title")}
              </DialogTitle>
              <DialogDescription className="text-xs text-fg-muted mt-0.5">
                {t("settings.subtitle")}
              </DialogDescription>
            </div>
          </div>

          {/* Tab selector bar */}
          <div
            role="tablist"
            aria-label={t("settings.title")}
            className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-muted/60 border border-border mt-4 overflow-x-auto"
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
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer ${
                    isSelected
                      ? "bg-surface text-fg shadow-xs border border-border font-semibold"
                      : "text-fg-muted hover:text-fg hover:bg-surface/50"
                  }`}
                >
                  <Icon
                    className={`size-3.5 ${isSelected ? "text-accent" : "text-fg-muted"}`}
                    aria-hidden="true"
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Tab content scrollable area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "members" && <MembersSettingsTab />}
          {activeTab === "apiKeys" && <ApiKeysSettingsTab />}
          {activeTab === "slack" && <SlackSettingsTab />}
          {activeTab === "usage" && <UsageSettingsTab />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
