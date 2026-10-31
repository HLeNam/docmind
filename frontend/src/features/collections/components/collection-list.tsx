import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FolderPlus, AlertCircle, RefreshCw, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/domain/empty-state";
import { useUIStore } from "@/lib/ui-store";
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
  const pinnedCollectionIds = useUIStore((s) => s.pinnedCollectionIds);

  const [collectionToDelete, setCollectionToDelete] =
    useState<CollectionResponse | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCollections = useMemo(() => {
    if (!collections) return [];
    if (!searchQuery.trim()) return collections;
    const q = searchQuery.toLowerCase();
    return collections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [collections, searchQuery]);

  const sortedCollections = useMemo(() => {
    return [...filteredCollections].sort((a, b) => {
      const aPinned = pinnedCollectionIds.includes(a.id);
      const bPinned = pinnedCollectionIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredCollections, pinnedCollectionIds]);

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
            className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 h-44 shadow-2xs"
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
      <div className="space-y-6">
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

        {/* 3-Step Value Orientation Flow */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto pt-2">
          <div className="p-4 rounded-2xl border border-border/80 bg-surface shadow-2xs space-y-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent text-xs font-bold font-mono">
              1
            </div>
            <h4 className="font-semibold text-sm text-fg tracking-tight">Tạo bộ sưu tập</h4>
            <p className="text-xs text-fg-muted leading-relaxed">
              Phân nhóm tài liệu theo dự án, phòng ban hoặc đề tài cần tra cứu.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border/80 bg-surface shadow-2xs space-y-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent text-xs font-bold font-mono">
              2
            </div>
            <h4 className="font-semibold text-sm text-fg tracking-tight">Tải tài liệu lên</h4>
            <p className="text-xs text-fg-muted leading-relaxed">
              Hỗ trợ PDF, Word, Excel, Slide và hình ảnh với OCR trích xuất thông minh.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border/80 bg-surface shadow-2xs space-y-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent text-xs font-bold font-mono">
              3
            </div>
            <h4 className="font-semibold text-sm text-fg tracking-tight">Hỏi đáp AI có trích dẫn</h4>
            <p className="text-xs text-fg-muted leading-relaxed">
              Truy vấn thông tin chính xác, câu trả lời luôn đi kèm trang nguồn đối chứng.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 4. Data State
  return (
    <div className="space-y-4">
      {/* Search filter if there are multiple collections */}
      {collections.length > 2 && (
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search
              className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none"
              aria-hidden="true"
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("collections.searchPlaceholder")}
              className="pl-8.5 h-8.5 text-xs rounded-xl"
            />
          </div>
          <span className="text-xs font-mono text-fg-muted shrink-0">
            {filteredCollections.length} / {collections.length} {t("collections.title").toLowerCase()}
          </span>
        </div>
      )}

      {sortedCollections.length === 0 ? (
        <div className="p-8 text-center text-xs text-fg-muted border border-dashed border-border rounded-2xl bg-surface/50">
          {t("collections.noSearchResults", { query: searchQuery })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCollections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              canManage={canManage}
              onSelect={onSelectCollection}
              onDelete={handleDeleteRequest}
            />
          ))}
        </div>
      )}

      <DeleteCollectionDialog
        collection={collectionToDelete}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={() => setCollectionToDelete(null)}
      />
    </div>
  );
}
