import { useTranslation } from "react-i18next";
import { Folder, MoreVertical, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  const formattedDate = new Date(collection.createdAt).toLocaleDateString(
    "vi-VN",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );

  return (
    <article className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface p-5 hover:border-border-strong hover:bg-surface-muted/30 transition-all duration-200 shadow-xs">
      <div>
        {/* Top Header: Icon, Name, and Menu */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent border border-accent/20">
              <Folder className="size-4" aria-hidden="true" />
            </div>
            <h3 className="font-medium text-base text-fg tracking-tight truncate">
              {collection.name}
            </h3>
          </div>

          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-fg-muted hover:text-fg shrink-0"
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

        {/* Description */}
        <p className="mt-3 text-sm text-fg-muted line-clamp-2 min-h-10">
          {collection.description || (
            <span className="italic text-fg-muted/60">
              {t("collections.descriptionPlaceholder")}
            </span>
          )}
        </p>
      </div>

      {/* Footer: Date and Open Action Button */}
      <div className="mt-5 pt-3 border-t border-border flex items-center justify-between text-xs text-fg-muted">
        <span
          title={new Date(collection.createdAt).toLocaleString("vi-VN")}
          className="tabular-nums"
        >
          {formattedDate}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelect(collection)}
          className="h-7 text-xs font-medium text-accent hover:text-accent hover:bg-accent-soft px-2 -mr-1"
        >
          <span>{t("collections.openCollection")}</span>
          <ArrowRight className="size-3.5 ml-1" aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}
