import { useTranslation } from "react-i18next";
import { Folder, MoreVertical, Trash2, ArrowRight, Calendar, Pin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUIStore } from "@/lib/ui-store";
import type { CollectionResponse } from "../schemas/collection-schemas";

interface CollectionCardProps {
  collection: CollectionResponse;
  canManage: boolean;
  onSelect: (collection: CollectionResponse) => void;
  onDelete: (collection: CollectionResponse) => void;
}

export function CollectionCard({
  collection,
  canManage,
  onSelect,
  onDelete,
}: CollectionCardProps) {
  const { t } = useTranslation();
  const pinnedCollectionIds = useUIStore((s) => s.pinnedCollectionIds);
  const togglePinCollection = useUIStore((s) => s.togglePinCollection);
  const isPinned = pinnedCollectionIds.includes(collection.id);

  const formattedDate = new Date(collection.createdAt).toLocaleDateString(
    "vi-VN",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );

  const docCount = collection._count?.documents ?? 0;

  return (
    <article
      onClick={() => onSelect(collection)}
      className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-surface p-5 hover:border-accent/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer shadow-2xs select-none"
    >
      <div>
        {/* Top Header: Icon, Name, Pin, and Menu */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent border border-accent/25 group-hover:scale-105 transition-transform duration-200">
              <Folder className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(collection);
                }}
                className="font-semibold text-sm sm:text-base text-fg tracking-tight truncate group-hover:text-accent transition-colors text-left focus:outline-hidden focus-visible:underline block w-full cursor-pointer"
              >
                {collection.name}
              </button>
              <div className="flex items-center gap-2 mt-0.5 text-2xs text-fg-muted font-mono">
                <span className="flex items-center gap-1">
                  <FileText className="size-3 text-fg-muted/70" aria-hidden="true" />
                  <span>{docCount} {t("documents.title").toLowerCase()}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {/* Pin action button */}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => togglePinCollection(collection.id)}
              aria-label={isPinned ? t("collections.unpin") : t("collections.pin")}
              title={isPinned ? t("collections.unpin") : t("collections.pin")}
              className={`size-7 transition-colors ${
                isPinned
                  ? "text-accent fill-accent"
                  : "text-fg-muted/50 hover:text-fg opacity-0 group-hover:opacity-100"
              }`}
            >
              <Pin className={`size-3.5 ${isPinned ? "fill-accent" : ""}`} />
            </Button>

            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="text-fg-muted hover:text-fg shrink-0 size-7"
                      aria-label={t("collections.actions")}
                    />
                  }
                >
                  <MoreVertical className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDelete(collection)}
                  >
                    <Trash2 className="size-4 mr-2" aria-hidden="true" />
                    <span>{t("common.delete")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="mt-3.5 text-xs text-fg-muted leading-relaxed line-clamp-2 min-h-8">
          {collection.description || (
            <span className="italic text-fg-muted/60">
              {t("collections.descriptionPlaceholder")}
            </span>
          )}
        </p>
      </div>

      {/* Footer: Date and Open Action Button */}
      <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-fg-muted">
        <span
          title={new Date(collection.createdAt).toLocaleString("vi-VN")}
          className="inline-flex items-center gap-1.5 tabular-nums text-2xs"
        >
          <Calendar className="size-3 text-fg-muted/70" aria-hidden="true" />
          <span>{formattedDate}</span>
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(collection);
          }}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline underline-offset-4 focus:outline-hidden focus-visible:ring-1 focus-visible:ring-accent rounded-sm cursor-pointer"
        >
          <span>{t("collections.openCollection")}</span>
          <ArrowRight className="size-3 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
