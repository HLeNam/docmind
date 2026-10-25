import { useTranslation } from "react-i18next";
import { X, FileText, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatCitation } from "@/features/chat/schemas/chat-schemas";

interface SourcePanelProps {
  citations: ChatCitation[];
  activeCitationIndex?: number | null;
  onSelectCitation?: (citation: ChatCitation) => void;
  onClose?: () => void;
}

export function SourcePanel({
  citations,
  activeCitationIndex,
  onSelectCitation,
  onClose,
}: SourcePanelProps) {
  const { t } = useTranslation();

  if (citations.length === 0) {
    return (
      <aside
        aria-label={t("chat.citations")}
        className="flex flex-col h-full bg-surface border-l border-border p-4 w-full"
      >
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className="font-medium text-sm text-fg">
            {t("chat.citations")}
          </h3>
          {onClose && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              aria-label={t("common.cancel")}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-fg-muted text-xs">
          <Bookmark className="size-8 text-fg-muted/40 mb-2" aria-hidden="true" />
          <p>Câu trả lời này không có trích dẫn nguồn đính kèm.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label={t("chat.citations")}
      className="flex flex-col h-full bg-surface border-l border-border w-full shadow-xs"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h3 className="font-semibold text-sm text-fg tracking-tight">
            {t("chat.citations")}
          </h3>
          <p className="text-xs text-fg-muted">
            {citations.length} tài liệu tham khảo
          </p>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="text-fg-muted hover:text-fg"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {citations.map((citation) => {
          const isActive = activeCitationIndex === citation.index;
          const matchPercent = Math.round(citation.score * 100);

          return (
            <div
              key={citation.index}
              onClick={() => onSelectCitation?.(citation)}
              className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                isActive
                  ? "border-accent bg-accent-soft/30 ring-1 ring-accent"
                  : "border-border bg-surface hover:border-border-strong hover:bg-surface-muted/30"
              }`}
            >
              {/* Header row: Index & Match score */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-accent-soft text-accent">
                  [{citation.index}]
                </span>

                <span className="text-[11px] font-medium text-accent tabular-nums">
                  Độ khớp {matchPercent}%
                </span>
              </div>

              {/* Document name */}
              <div className="flex items-start gap-2">
                <FileText
                  className="size-4 shrink-0 text-fg-muted mt-0.5"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <h4
                    className="font-medium text-xs text-fg truncate"
                    title={citation.filename}
                  >
                    {citation.filename}
                  </h4>

                  {/* Location metadata (page or heading) */}
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-fg-muted">
                    {citation.pageNumber && (
                      <span className="px-1.5 py-0.5 rounded bg-surface-muted border border-border">
                        Trang {citation.pageNumber}
                      </span>
                    )}
                    {citation.headingContext && (
                      <span className="truncate max-w-48" title={citation.headingContext}>
                        {citation.headingContext}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
