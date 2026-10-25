import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  RotateCw,
  Trash2,
  RefreshCw,
  AlertCircle,
  FilePlus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentStatusBadge } from "@/components/domain/document-status-badge";
import { EmptyState } from "@/components/domain/empty-state";
import type {
  DocumentProgressEvent,
  DocumentResponse,
} from "../schemas/document-schemas";
import { useReindexDocument } from "../hooks/use-documents";

interface DocumentTableProps {
  documents: DocumentResponse[] | undefined;
  collectionId: string;
  canManage: boolean;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  progressMap: Record<string, DocumentProgressEvent>;
  onDeleteRequest: (doc: DocumentResponse) => void;
  onUploadClick?: () => void;
}

function getFileBadge(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger border border-danger/25 shadow-2xs">
          <FileText className="size-4" aria-hidden="true" />
        </div>
      );
    case "xlsx":
    case "csv":
      return (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success border border-success/25 shadow-2xs">
          <FileSpreadsheet className="size-4" aria-hidden="true" />
        </div>
      );
    case "docx":
    case "doc":
      return (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent border border-accent/25 shadow-2xs">
          <FileText className="size-4" aria-hidden="true" />
        </div>
      );
    case "txt":
    case "md":
      return (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning border border-warning/25 shadow-2xs">
          <FileCode className="size-4" aria-hidden="true" />
        </div>
      );
    default:
      return (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted border border-border/80 shadow-2xs">
          <File className="size-4" aria-hidden="true" />
        </div>
      );
  }
}

export function DocumentTable({
  documents,
  collectionId,
  canManage,
  isLoading,
  error,
  onRetry,
  progressMap,
  onDeleteRequest,
  onUploadClick,
}: DocumentTableProps) {
  const { t } = useTranslation();
  const reindexMutation = useReindexDocument(collectionId);
  const [reindexingId, setReindexingId] = useState<string | null>(null);

  const handleReindex = async (doc: DocumentResponse) => {
    try {
      setReindexingId(doc.id);
      await reindexMutation.mutateAsync(doc.id);
    } finally {
      setReindexingId(null);
    }
  };

  // 1. Loading Skeleton
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="size-8 rounded-lg" />
                <Skeleton className="h-4 w-1/3 rounded-md" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="rounded-xl border border-danger/20 bg-danger-soft p-6 text-center max-w-lg mx-auto my-8">
        <AlertCircle className="size-8 mx-auto text-danger mb-3" aria-hidden="true" />
        <h3 className="text-base font-semibold text-danger">
          {t("common.error")}
        </h3>
        <p className="mt-1 text-sm text-fg-muted">
          {error.message || t("errors.NETWORK_ERROR")}
        </p>
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3.5 mr-2" aria-hidden="true" />
            <span>{t("common.retry")}</span>
          </Button>
        </div>
      </div>
    );
  }

  // 3. Empty State
  if (!documents || documents.length === 0) {
    return (
      <EmptyState
        icon={FilePlus}
        title={t("documents.emptyTitle")}
        description={
          canManage
            ? t("documents.emptyDescription")
            : t("documents.emptyMemberDescription")
        }
        action={
          canManage && onUploadClick
            ? {
                label: t("documents.upload"),
                onClick: onUploadClick,
              }
            : undefined
        }
      />
    );
  }

  // 4. Document Table
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-muted/40 text-xs font-semibold uppercase tracking-wider text-fg-muted">
              <th scope="col" className="py-3 px-4 font-medium">
                {t("documents.tableHeader.filename")}
              </th>
              <th scope="col" className="py-3 px-4 font-medium">
                {t("documents.tableHeader.status")}
              </th>
              <th scope="col" className="py-3 px-4 font-medium">
                {t("documents.tableHeader.createdAt")}
              </th>
              {canManage && (
                <th scope="col" className="py-3 px-4 text-right font-medium">
                  {t("documents.tableHeader.actions")}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {documents.map((doc) => {
              const liveProgress = progressMap[doc.id];
              const isCurrentlyReindexing = reindexingId === doc.id;
              const formattedDate = new Date(doc.createdAt).toLocaleDateString(
                "vi-VN",
                {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }
              );

              return (
                <tr
                  key={doc.id}
                  className="hover:bg-surface-muted/40 transition-colors group"
                >
                  {/* Filename & Icon */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3 max-w-sm sm:max-w-md">
                      {getFileBadge(doc.filename)}
                      <div className="min-w-0">
                        <p
                          className="font-medium text-fg truncate text-sm"
                          title={doc.filename}
                        >
                          {doc.filename}
                        </p>
                        {liveProgress &&
                          liveProgress.phase !== "completed" &&
                          liveProgress.phase !== "failed" && (
                            <div className="flex items-center gap-1.5 text-xs text-accent mt-0.5">
                              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                              <span>
                                {t(`documents.phases.${liveProgress.phase}`, {
                                  defaultValue: liveProgress.message || liveProgress.phase,
                                })}
                              </span>
                              <span className="font-mono tabular-nums text-fg-muted">
                                ({liveProgress.percent}%)
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <DocumentStatusBadge
                      status={doc.status}
                      failReason={doc.failReason}
                    />
                  </td>

                  {/* Created Date */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-xs text-fg-muted tabular-nums">
                    <span title={new Date(doc.createdAt).toLocaleString("vi-VN")}>
                      {formattedDate}
                    </span>
                  </td>

                  {/* Actions */}
                  {canManage && (
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Re-index button */}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleReindex(doc)}
                          disabled={
                            isCurrentlyReindexing ||
                            doc.status === "PROCESSING" ||
                            doc.status === "PENDING"
                          }
                          title={t("documents.reindex")}
                          aria-label={t("documents.reindex")}
                          className="text-fg-muted hover:text-accent hover:bg-accent-soft/60"
                        >
                          <RotateCw
                            className={`size-3.5 ${
                              isCurrentlyReindexing ? "animate-spin" : ""
                            }`}
                            aria-hidden="true"
                          />
                        </Button>

                        {/* Delete button */}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => onDeleteRequest(doc)}
                          title={t("common.delete")}
                          aria-label={t("common.delete")}
                          className="text-fg-muted hover:text-danger hover:bg-danger-soft/60"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
