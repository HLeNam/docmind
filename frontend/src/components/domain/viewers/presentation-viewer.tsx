import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Presentation,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DocumentChunk } from "@/features/documents/schemas/document-schemas";

interface PresentationViewerProps {
  chunks: DocumentChunk[];
  filename: string;
  initialSlideNumber?: number | null;
}

interface SlideData {
  slideNumber: number;
  title: string;
  content: string[];
  notes?: string;
}

export function PresentationViewer({
  chunks,
  filename,
  initialSlideNumber,
}: PresentationViewerProps) {
  const { t } = useTranslation();

  // Group chunks by pageNumber (which represents the slide number in PPTX)
  const slides: SlideData[] = useMemo(() => {
    if (!chunks || chunks.length === 0) return [];

    const map = new Map<number, SlideData>();

    chunks.forEach((chunk) => {
      const slideNum = chunk.pageNumber ?? 1;
      let existing = map.get(slideNum);
      if (!existing) {
        existing = {
          slideNumber: slideNum,
          title: chunk.headingContext || `Slide ${slideNum}`,
          content: [],
        };
        map.set(slideNum, existing);
      }

      // Check if chunk text contains speaker notes
      const lines = chunk.content.split("\n");
      const cleanLines: string[] = [];
      lines.forEach((line) => {
        if (line.startsWith("Ghi chú:") || line.startsWith("Notes:")) {
          existing!.notes = line;
        } else if (line.trim()) {
          cleanLines.push(line.trim());
        }
      });

      if (cleanLines.length > 0) {
        existing.content.push(cleanLines.join("\n"));
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => a.slideNumber - b.slideNumber
    );
  }, [chunks]);

  // Initial slide index
  const initialIndex = useMemo(() => {
    if (!initialSlideNumber || slides.length === 0) return 0;
    const foundIndex = slides.findIndex(
      (s) => s.slideNumber === initialSlideNumber
    );
    return foundIndex >= 0 ? foundIndex : 0;
  }, [initialSlideNumber, slides]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const currentSlide = slides[currentIndex] || null;

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(slides.length - 1, prev + 1));
  }, [slides.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight" || e.key === " ") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handlePrev, handleNext]);

  if (slides.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-fg-muted space-y-2">
        <Presentation className="size-8 text-fg-muted/60" aria-hidden="true" />
        <p className="text-xs">{t("documents.viewer.noChunks")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-surface-muted/40 overflow-hidden">
      {/* Left Sidebar: Slide Thumbnails */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-surface shrink-0 flex flex-col max-h-48 md:max-h-full">
        <div className="px-4 py-2.5 border-b border-border bg-surface-muted/30 flex items-center justify-between">
          <span className="text-xs font-semibold text-fg flex items-center gap-1.5">
            <Presentation className="size-3.5 text-accent" />
            <span>Danh sách Slide</span>
          </span>
          <span className="text-[11px] font-mono text-fg-muted">
            {slides.length} slides
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {slides.map((slide, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={slide.slideNumber}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs flex items-start gap-2.5 ${
                  isActive
                    ? "border-accent bg-accent-soft/30 ring-1 ring-accent text-fg"
                    : "border-border bg-surface hover:bg-surface-muted/60 text-fg-muted hover:text-fg"
                }`}
              >
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-muted text-accent border border-border shrink-0 mt-0.5">
                  {slide.slideNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-xs truncate">
                    {slide.title}
                  </h4>
                  <p className="text-[10px] text-fg-muted truncate mt-0.5">
                    {slide.content[0]?.slice(0, 45) || "Nội dung slide..."}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Slide Presentation Canvas (16:9 Aspect Ratio Card) */}
      <div className="flex-1 flex flex-col min-h-0 relative p-4 sm:p-6 lg:p-8 overflow-y-auto items-center justify-center">
        {currentSlide && (
          <div className="w-full max-w-4xl flex flex-col space-y-4">
            {/* 16:9 Slide Canvas */}
            <div className="relative w-full aspect-16/9 bg-surface rounded-2xl border border-border shadow-xl p-6 sm:p-10 flex flex-col justify-between overflow-hidden">
              {/* Slide Header */}
              <div className="flex items-start justify-between gap-4 border-b border-border/80 pb-4">
                <div className="min-w-0">
                  <span className="text-[11px] font-mono font-semibold text-accent uppercase tracking-wider block mb-1">
                    {filename}
                  </span>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-fg tracking-tight">
                    {currentSlide.title}
                  </h2>
                </div>
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-accent-soft text-accent border border-accent/20 shrink-0">
                  Slide {currentSlide.slideNumber}
                </span>
              </div>

              {/* Slide Body Content */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {currentSlide.content.map((paragraph, pIdx) => (
                  <div
                    key={pIdx}
                    className="text-xs sm:text-sm text-fg leading-relaxed select-text whitespace-pre-wrap font-sans"
                  >
                    {paragraph}
                  </div>
                ))}
              </div>

              {/* Speaker Notes Callout if present */}
              {currentSlide.notes && (
                <div className="mt-3 p-3 rounded-xl bg-surface-muted border border-border text-xs text-fg-muted flex items-start gap-2">
                  <Volume2 className="size-4 text-accent shrink-0 mt-0.5" />
                  <span className="text-xs italic leading-relaxed">
                    {currentSlide.notes}
                  </span>
                </div>
              )}
            </div>

            {/* Slide Navigation Stepper */}
            <div className="flex items-center justify-between px-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="gap-1.5"
              >
                <ChevronLeft className="size-4" />
                <span className="hidden sm:inline">Slide trước</span>
              </Button>

              <span className="text-xs font-mono font-medium text-fg-muted">
                {currentIndex + 1} / {slides.length}
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentIndex === slides.length - 1}
                className="gap-1.5"
              >
                <span className="hidden sm:inline">Slide tiếp</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
