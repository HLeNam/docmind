import { useTranslation } from "react-i18next";
import { X, FileText, Bookmark, CheckCircle2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatCitation } from "@/features/chat/schemas/chat-schemas";

interface SourcePanelProps {
  citations: ChatCitation[];
  activeCitationIndex?: number | null;
  onSelectCitation?: (citation: ChatCitation) => void;
  onViewDocument?: (citation: ChatCitation) => void;
  onClose?: () => void;
}

export function SourcePanel({
  citations,
  activeCitationIndex,
  onSelectCitation,
  onViewDocument,
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
          <h3 className="font-semibold text-sm text-fg tracking-tight">
            {t("chat.citations")}
          </h3>
          {onClose && (
            <Button
              type="button"
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
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-fg-muted text-xs space-y-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-surface-muted text-fg-muted/60">
            <Bookmark className="size-5" aria-hidden="true" />
          </div>
          <p className="max-w-[200px] leading-relaxed">
            {t("chat.noCitations")}
          </p>
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
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-fg tracking-tight">
              {t("chat.citations")}
            </h3>
            <span className="font-mono text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-accent-soft text-accent">
              {citations.length}
            </span>
          </div>
          <p className="text-xs text-fg-muted mt-0.5">
            Bằng chứng đối soát từ tài liệu
          </p>
        </div>
        {onClose && (
          <Button
            type="button"
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
            <button
              key={citation.index}
              type="button"
              onClick={() => onSelectCitation?.(citation)}
              className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 group/card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isActive
                  ? "border-accent bg-accent-soft/30 ring-1 ring-accent shadow-xs"
                  : "border-border bg-surface hover:border-border-strong hover:bg-surface-muted/40 shadow-2xs"
              }`}
            >
              {/* Header row: Index & Match score badge */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-accent-soft text-accent border border-accent/20">
                  [{citation.index}]
                </span>

                <span className="inline-flex items-center gap-1 text-2xs font-medium text-accent tabular-nums bg-accent-soft/50 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="size-3 text-accent" aria-hidden="true" />
                  <span>{matchPercent}% khớp</span>
                </span>
              </div>

              {/* Document name */}
              <div className="flex items-start gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-accent mt-0.5 border border-border/60">
                  <FileText className="size-3.5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4
                    className="font-medium text-xs text-fg truncate group-hover/card:text-accent transition-colors"
                    title={citation.filename}
                  >
                    {citation.filename}
                  </h4>

                  {/* Location metadata (page or heading) */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-2xs text-fg-muted">
                    {citation.pageNumber && (
                      <span className="px-1.5 py-0.5 rounded-md bg-surface-muted border border-border/80 font-mono text-2xs">
                        Trang {citation.pageNumber}
                      </span>
                    )}
                    {citation.headingContext && (
                      <span
                        className="truncate max-w-[180px] italic text-2xs text-fg-muted"
                        title={citation.headingContext}
                      >
                        {citation.headingContext}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* View in document button */}
              {onViewDocument && (
                <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDocument(citation);
                    }}
                    className="text-2xs h-6 px-2 text-accent hover:text-accent hover:bg-accent-soft gap-1"
                  >
                    <Eye className="size-3" aria-hidden="true" />
                    <span>{t("documents.viewer.viewOriginalFromCitation")}</span>
                  </Button>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}