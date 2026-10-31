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
            className={`inline-flex items-center justify-center font-mono text-2xs font-bold text-accent bg-accent-soft hover:bg-accent hover:text-accent-fg border border-accent/25 px-1.5 py-0.5 rounded-md transition-all cursor-pointer select-none mx-0.5 align-baseline shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent ${
              isActive ? "ring-2 ring-accent bg-accent text-accent-fg" : ""
            }`}
          />
        }
      >
        <span>[{citation.index}]</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="flex flex-col items-start gap-1.5 text-left w-72 max-w-xs p-3 text-xs shadow-md z-50"
      >
        {/* Document Header */}
        <div className="flex items-center gap-1.5 font-medium truncate w-full">
          <FileText className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
          <span className="truncate text-background" title={citation.filename}>
            {citation.filename}
          </span>
        </div>

        {/* Location & Score */}
        <div className="flex items-center justify-between w-full text-2xs opacity-85 pt-1.5 border-t border-background/20">
          <span className="truncate max-w-[170px]" title={pageLabel || headingLabel || "Tài liệu đính kèm"}>
            {pageLabel || headingLabel || "Tài liệu đính kèm"}
          </span>
          <span className="tabular-nums font-mono text-accent shrink-0 font-medium">
            {matchPercent}% khớp
          </span>
        </div>

        {/* Snippet / Content Excerpt if available */}
        {citation.snippet && (
          <div className="mt-1 p-2 rounded-md bg-background/10 border border-background/15 text-2xs leading-relaxed opacity-90 w-full line-clamp-3 italic">
            "{citation.snippet}"
          </div>
        )}

        <div className="text-2xs opacity-60 pt-0.5 w-full text-right italic">
          Bấm để mở nguồn đối soát
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
