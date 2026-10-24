import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TenantSelectionOption } from "../api/auth-api";

interface TenantSelectionListProps {
  tenants: TenantSelectionOption[];
  onSelectTenant: (tenantId: string) => Promise<void>;
  onBack: () => void;
}

export function TenantSelectionList({
  tenants,
  onSelectTenant,
  onBack,
}: TenantSelectionListProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSelect(id: string) {
    setSelectedId(id);
    setIsSubmitting(true);
    try {
      await onSelectTenant(id);
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatRole(role: string): string {
    const key = `auth.role${role.charAt(0).toUpperCase()}${role.slice(1).toLowerCase()}`;
    return t(key, { defaultValue: role });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-medium text-fg">
          {t("auth.selectWorkspace")}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          {t("auth.selectWorkspaceSubtitle")}
        </p>
      </div>

      <div className="space-y-2 pt-2" role="list">
        {tenants.map((tenant) => {
          const isSelected = selectedId === tenant.tenantId;
          const isLoading = isSubmitting && isSelected;

          return (
            <button
              key={tenant.tenantId}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelect(tenant.tenantId)}
              className="w-full flex items-center justify-between p-3.5 rounded-lg border border-border bg-surface hover:bg-surface-muted transition-colors text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <Building2 className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 truncate">
                  <p className="text-sm font-medium text-fg truncate font-mono">
                    {tenant.tenantId}
                  </p>
                  <p className="text-xs text-fg-muted">
                    {formatRole(tenant.role)}
                  </p>
                </div>
              </div>

              <div className="shrink-0 pl-2">
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin text-accent" />
                ) : (
                  <ArrowRight className="size-4 text-fg-muted" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-2">
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={onBack}
          disabled={isSubmitting}
        >
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
