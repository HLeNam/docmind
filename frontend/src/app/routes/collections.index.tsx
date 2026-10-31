import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Plus, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";
import { useUIStore } from "@/lib/ui-store";
import {
  CollectionList,
  CreateCollectionDialog,
  type CollectionResponse,
} from "@/features/collections";

export const Route = createFileRoute("/collections/")({
  component: CollectionsIndexPage,
});

function CollectionsIndexPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  if (!user) {
    return null;
  }

  const canManage =
    user.membership.role === "OWNER" || user.membership.role === "ADMIN";

  const handleSelectCollection = (collection: CollectionResponse) => {
    navigate({
      to: "/collections/$collectionId",
      params: { collectionId: collection.id },
    });
  };

  const handleCreatedCollection = (collection: CollectionResponse) => {
    navigate({
      to: "/collections/$collectionId",
      params: { collectionId: collection.id },
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-bg text-fg">
      {/* Top Header Bar */}
      <header className="h-12 px-4 border-b border-border flex items-center justify-between shrink-0 bg-surface/40 backdrop-blur-xs sticky top-0 z-10">
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
          <span className="text-xs font-semibold text-fg">
            {t("collections.title")}
          </span>
        </div>

        {canManage && (
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>{t("collections.createButton")}</span>
          </Button>
        )}
      </header>

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Title & Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-fg tracking-tight text-balance">
              {t("collections.title")}
            </h1>
            <p className="text-sm text-fg-muted max-w-xl text-pretty">
              {t("collections.subtitle")}
            </p>
          </div>
        </div>

        {/* Collection Grid */}
        <CollectionList
          canManage={canManage}
          onCreateClick={() => setIsCreateOpen(true)}
          onSelectCollection={handleSelectCollection}
        />
      </main>

      {/* Create Collection Dialog */}
      <CreateCollectionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={handleCreatedCollection}
      />
    </div>
  );
}
