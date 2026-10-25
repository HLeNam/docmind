import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, AlertCircle, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocxViewerProps {
  blob: Blob;
  filename: string;
}

export function DocxViewer({ blob, filename }: DocxViewerProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function renderDocx() {
      try {
        const { renderAsync } = await import("docx-preview");
        if (cancelled || !containerRef.current) return;

        // Clear previous render
        containerRef.current.innerHTML = "";

        await renderAsync(blob, containerRef.current, undefined, {
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          useBase64URL: true,
        });

        if (!cancelled) {
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render DOCX");
          setIsLoading(false);
        }
      }
    }

    renderDocx();

    return () => {
      cancelled = true;
    };
  }, [blob]);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative bg-surface-muted/60">
      {/* Zoom Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border shrink-0">
        <span className="text-xs text-fg-muted font-medium truncate max-w-xs" title={filename}>
          {filename}
        </span>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))}
            aria-label="Thu nhỏ"
            className="text-fg-muted hover:text-fg"
          >
            <ZoomOut className="size-3.5" aria-hidden="true" />
          </Button>
          <span className="font-mono text-xs tabular-nums text-fg-muted w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setZoom((z) => Math.min(1.8, Math.round((z + 0.1) * 10) / 10))}
            aria-label="Phóng to"
            className="text-fg-muted hover:text-fg"
          >
            <ZoomIn className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setZoom(1)}
            aria-label="Đặt lại thu phóng"
            className="text-fg-muted hover:text-fg"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-12 space-y-3">
            <Loader2 className="size-8 text-accent animate-spin" aria-hidden="true" />
            <p className="text-xs text-fg-muted">{t("documents.viewer.loading")}</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-3 max-w-md">
            <AlertCircle className="size-8 text-danger" aria-hidden="true" />
            <p className="text-xs text-fg font-medium">{t("documents.viewer.loadError")}</p>
            <p className="text-[11px] text-fg-muted">{error}</p>
          </div>
        )}

        <div
          ref={containerRef}
          className={`transition-transform origin-top duration-150 docx-preview-container ${
            isLoading || error ? "hidden" : "block"
          }`}
          style={{ transform: `scale(${zoom})` }}
        />
      </div>
    </div>
  );
}
