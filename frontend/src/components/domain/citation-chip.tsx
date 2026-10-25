import { FileText } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChatCitation } from "@/features/chat/schemas/chat-schemas";

interface CitationChipProps {
  citation: ChatCitation;
  onClick?: (citation: ChatCitation) => void;
  isActive?: boolean;
}

export function CitationChip({
  citation,
  onClick,
  isActive = false,
}: CitationChipProps) {
  const pageLabel = citation.pageNumber ? `trang ${citation.pageNumber}` : null;
  const headingLabel = citation.headingContext || null;
  const matchPercent = Math.round(citation.score * 100);

  const ariaLabel = `Nguồn ${citation.index}: ${citation.filename}${
    pageLabel ? `, ${pageLabel}` : ""
  }`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => onClick?.(citation)}
            aria-label={ariaLabel}
            className={`inline-flex items-center justify-center font-mono text-[11px] font-bold text-accent bg-accent-soft hover:bg-accent hover:text-accent-fg border border-accent/25 px-1.5 py-0.5 rounded-md transition-all cursor-pointer select-none mx-0.5 align-baseline shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent ${
              isActive ? "ring-2 ring-accent bg-accent text-accent-fg" : ""
            }`}
          />
        }
      >
        <span>[{citation.index}]</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs space-y-1 p-2 text-xs">
        <div className="flex items-center gap-1.5 font-medium truncate">
          <FileText className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
          <span className="truncate">{citation.filename}</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-fg-muted pt-1 border-t border-border">
          <span>
            {pageLabel || headingLabel || "Tài liệu đính kèm"}
          </span>
          <span className="tabular-nums font-mono text-accent">
            {matchPercent}% khớp
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
