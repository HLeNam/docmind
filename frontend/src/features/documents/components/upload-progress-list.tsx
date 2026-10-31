import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2, AlertCircle, FileText, X } from "lucide-react";
import type { DocumentProgressEvent } from "../schemas/document-schemas";

interface UploadProgressListProps {
  progressMap: Record<string, DocumentProgressEvent>;
  filenamesMap?: Record<string, string>;
  onDismiss?: (documentId: string) => void;
}

export function UploadProgressList({
  progressMap,
  filenamesMap = {},
  onDismiss,
}: UploadProgressListProps) {
  const { t } = useTranslation();
  const items = Object.values(progressMap);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
          Tiến độ xử lý thời gian thực
        </h4>
        <span className="text-xs font-mono text-fg-muted">
          {items.length} tác vụ
        </span>
      </div>
      <div className="space-y-2.5">
        {items.map((item) => {
          const filename = filenamesMap[item.documentId] || item.documentId;
          const isCompleted = item.phase === "completed";
          const isFailed = item.phase === "failed";
          const percent = Math.min(Math.max(item.percent, 0), 100);

          return (
            <div
              key={item.documentId}
              className="flex flex-col gap-2 p-3 rounded-xl bg-surface-muted/50 border border-border/80 text-sm shadow-2xs"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-surface border border-border text-accent shrink-0 shadow-2xs">
                    <FileText className="size-3.5" aria-hidden="true" />
                  </div>
                  <span className="font-medium text-fg truncate text-xs sm:text-sm">
                    {filename}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isCompleted ? (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-success-soft text-success border border-success/20">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      <span>{t("documents.phases.completed")}</span>
                    </div>
                  ) : isFailed ? (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-danger-soft text-danger border border-danger/20">
                      <AlertCircle className="size-3.5" aria-hidden="true" />
                      <span>{t("documents.phases.failed")}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-soft text-accent border border-accent/20">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      <span>
                        {t(`documents.phases.${item.phase}`, {
                          defaultValue: item.message || item.phase,
                        })}
                      </span>
                      <span className="font-mono tabular-nums text-accent-fg/80 ml-1">
                        {percent}%
                      </span>
                    </div>
                  )}

                  {onDismiss && (isCompleted || isFailed) && (
                    <button
                      type="button"
                      onClick={() => onDismiss(item.documentId)}
                      aria-label="Đóng thông báo"
                      className="p-1 rounded-md text-fg-muted hover:text-fg hover:bg-surface transition-colors cursor-pointer"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-border/80 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ease-out ${
                    isFailed
                      ? "bg-danger"
                      : isCompleted
                        ? "bg-success"
                        : "bg-accent"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
