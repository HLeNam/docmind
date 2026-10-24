import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderPlus, AlertCircle, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/domain/empty-state";
import { CollectionCard } from "./collection-card";
import { DeleteCollectionDialog } from "./delete-collection-dialog";
import { useCollections } from "../hooks/use-collections";
import type { CollectionResponse } from "../schemas/collection-schemas";
import { AppError } from "@/lib/api-client";

interface CollectionListProps {
  canManage: boolean;
  onSelectCollection: (collection: CollectionResponse) => void;
  onCreateClick: () => void;
}

export function CollectionList({
  canManage,
  onSelectCollection,
  onCreateClick,
}: CollectionListProps) {
  const { t } = useTranslation();
  const { data: collections, isLoading, error, refetch, isFetching } = useCollections();

  const [collectionToDelete, setCollectionToDelete] =
    useState<CollectionResponse | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDeleteRequest = (collection: CollectionResponse) => {
    setCollectionToDelete(collection);
    setIsDeleteDialogOpen(true);
  };

  // 1. Loading State (Skeleton Grid)
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 h-44 shadow-xs"
          >
            <div>
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-lg" />
                <Skeleton className="h-5 w-3/5 rounded-md" />
              </div>
              <Skeleton className="mt-4 h-4 w-full rounded-md" />
              <Skeleton className="mt-2 h-4 w-4/5 rounded-md" />
            </div>
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 2. Error State
  if (error) {
    const errorMessage =
      error instanceof AppError
        ? t(`errors.${error.code}`, { defaultValue: error.message })
        : t("errors.NETWORK_ERROR");

    return (
      <div className="rounded-xl border border-danger/20 bg-danger-soft p-6 text-center max-w-lg mx-auto my-8">
        <AlertCircle className="size-8 mx-auto text-danger mb-3" aria-hidden="true" />
        <h3 className="text-base font-semibold text-danger">
          {t("common.error")}
        </h3>
        <p className="mt-1 text-sm text-fg-muted">{errorMessage}</p>
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`size-3.5 mr-2 ${isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>{t("common.retry")}</span>
          </Button>
        </div>
      </div>
    );
  }

  // 3. Empty State
  if (!collections || collections.length === 0) {
    return (
      <EmptyState
        icon={FolderPlus}
        title={t("collections.emptyTitle")}
        description={
          canManage
            ? t("collections.emptyDescription")
            : t("collections.emptyMemberDescription")
        }
        action={
          canManage
            ? {
                label: t("collections.emptyAction"),
                onClick: onCreateClick,
              }
            : undefined
        }
      />
    );
  }

  // 4. Data State
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {collections.map((collection) => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            canManage={canManage}
            onSelect={onSelectCollection}
            onDelete={handleDeleteRequest}
          />
        ))}
      </div>

      <DeleteCollectionDialog
        collection={collectionToDelete}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={() => setCollectionToDelete(null)}
      />
    </>
  );
}
