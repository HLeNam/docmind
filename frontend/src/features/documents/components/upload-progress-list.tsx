import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react";
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
    <div className="space-y-2 rounded-xl border border-border bg-surface p-4 shadow-xs">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-3">
        Tiến độ xử lý thời gian thực
      </h4>
      <div className="space-y-3">
        {items.map((item) => {
          const filename = filenamesMap[item.documentId] || item.documentId;
          const isCompleted = item.phase === "completed";
          const isFailed = item.phase === "failed";
          const percent = Math.min(Math.max(item.percent, 0), 100);

          return (
            <div
              key={item.documentId}
              className="flex flex-col gap-1.5 p-3 rounded-lg bg-surface-muted/60 border border-border/80 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="size-4 shrink-0 text-accent" aria-hidden="true" />
                  <span className="font-medium text-fg truncate text-xs sm:text-sm">
                    {filename}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isCompleted ? (
                    <div className="flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      <span>{t("documents.phases.completed")}</span>
                    </div>
                  ) : isFailed ? (
                    <div className="flex items-center gap-1 text-xs text-danger">
                      <AlertCircle className="size-3.5" aria-hidden="true" />
                      <span>{t("documents.phases.failed")}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-accent">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      <span>
                        {t(`documents.phases.${item.phase}`, {
                          defaultValue: item.message || item.phase,
                        })}
                      </span>
                      <span className="font-mono tabular-nums text-fg-muted ml-1">
                        {percent}%
                      </span>
                    </div>
                  )}

                  {onDismiss && (isCompleted || isFailed) && (
                    <button
                      type="button"
                      onClick={() => onDismiss(item.documentId)}
                      className="text-xs text-fg-muted hover:text-fg ml-1 cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
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
