import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocMindLogo } from "@/components/ui/docmind-logo";
import { AppHeader } from "@/app/shell/app-header";
import { useAuth } from "@/features/auth";
import {
  CollectionList,
  CreateCollectionDialog,
  type CollectionResponse,
} from "@/features/collections";
import { CollectionDocumentsView } from "@/features/documents";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] =
    useState<CollectionResponse | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

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

  const canManage =
    user.membership.role === "OWNER" || user.membership.role === "ADMIN";

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col">
      <AppHeader activeTab="collections" />

      {/* Main Container */}
      <main id="main-content" className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedCollection ? (
          <CollectionDocumentsView
            collection={selectedCollection}
            canManage={canManage}
            onBack={() => setSelectedCollection(null)}
          />
        ) : (
          /* Collections Overview */
          <div className="space-y-8">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-fg tracking-tight text-balance">
                  {t("collections.title")}
                </h1>
                <p className="text-sm text-fg-muted max-w-xl text-pretty">
                  {t("collections.subtitle")}
                </p>
              </div>

              {canManage && (
                <Button
                  variant="default"
                  onClick={() => setIsCreateOpen(true)}
                  className="sm:self-center shrink-0"
                >
                  <Plus className="size-4 mr-1.5" aria-hidden="true" />
                  <span>{t("collections.createButton")}</span>
                </Button>
              )}
            </div>

            {/* Collection Grid / List */}
            <CollectionList
              canManage={canManage}
              onCreateClick={() => setIsCreateOpen(true)}
              onSelectCollection={(col) => setSelectedCollection(col)}
            />
          </div>
        )}
      </main>

      {/* Create Collection Dialog */}
      <CreateCollectionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  );
}
