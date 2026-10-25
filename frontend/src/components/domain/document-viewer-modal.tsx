import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  Layers,
  Copy,
  Check,
  Search,
  AlertCircle,
  Loader2,
  RefreshCw,
  Presentation,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDocumentFile,
  useDocumentChunks,
} from "@/features/documents/hooks/use-documents";
import type { DocumentChunk } from "@/features/documents/schemas/document-schemas";
import { DocxViewer } from "./viewers/docx-viewer";
import { SpreadsheetViewer } from "./viewers/spreadsheet-viewer";
import { PresentationViewer } from "./viewers/presentation-viewer";
import { MarkdownViewer } from "./viewers/markdown-viewer";

interface DocumentViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  filename: string;
  initialPage?: number | null;
  initialChunkIndex?: number | null;
}

function getFileType(
  filename: string
):
  | "pdf"
  | "image"
  | "docx"
  | "spreadsheet"
  | "pptx"
  | "markdown"
  | "text"
  | "unknown" {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext || ""))
    return "image";
  if (ext === "docx" || ext === "doc") return "docx";
  if (["xlsx", "xls", "csv"].includes(ext || "")) return "spreadsheet";
  if (ext === "pptx" || ext === "ppt") return "pptx";
  if (ext === "md") return "markdown";
  if (["txt", "json"].includes(ext || "")) return "text";
  return "unknown";
}

function getFileBadge(filename: string) {
  const fileType = getFileType(filename);
  switch (fileType) {
    case "pdf":
      return (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger border border-danger/25">
          <FileText className="size-3.5" aria-hidden="true" />
        </div>
      );
    case "docx":
      return (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent border border-accent/25">
          <FileText className="size-3.5" aria-hidden="true" />
        </div>
      );
    case "spreadsheet":
      return (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success border border-success/25">
          <FileSpreadsheet className="size-3.5" aria-hidden="true" />
        </div>
      );
    case "pptx":
      return (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning border border-warning/25">
          <Presentation className="size-3.5" aria-hidden="true" />
        </div>
      );
    case "markdown":
    case "text":
      return (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted border border-border">
          <FileCode className="size-3.5" aria-hidden="true" />
        </div>
      );
    default:
      return (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent border border-accent/25">
          <File className="size-3.5" aria-hidden="true" />
        </div>
      );
  }
}

interface DocumentViewerContentProps {
  documentId: string;
  filename: string;
  initialPage?: number | null;
  initialChunkIndex?: number | null;
  onClose: () => void;
}

function DocumentViewerContent({
  documentId,
  filename,
  initialPage,
  initialChunkIndex,
  onClose,
}: DocumentViewerContentProps) {
  const { t } = useTranslation();
  const fileType = useMemo(() => getFileType(filename), [filename]);

  // Tab: 'original' vs 'chunks' - defaults to 'original' for all supported formats!
  const [activeTab, setActiveTab] = useState<"original" | "chunks">("original");

  // Image zoom and rotation
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Plain text decoding for text/markdown
  const [textContent, setTextContent] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Chunks search
  const [chunkSearch, setChunkSearch] = useState("");
  const chunkRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Fetch file & chunks
  const {
    data: fileData,
    isLoading: isFileLoading,
    isError: isFileError,
    refetch: refetchFile,
  } = useDocumentFile(documentId);

  const {
    data: chunksData,
    isLoading: isChunksLoading,
    isError: isChunksError,
    refetch: refetchChunks,
  } = useDocumentChunks(documentId);

  const blob = fileData?.blob;

  // Object URL for blob
  const objectUrl = useMemo(() => {
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }, [blob]);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  useEffect(() => {
    let cancelled = false;
    if (blob && (fileType === "text" || fileType === "markdown")) {
      blob
        .text()
        .then((text) => {
          if (!cancelled) setTextContent(text);
        })
        .catch(() => {
          if (!cancelled) setTextContent(null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [blob, fileType]);

  // Auto scroll to target chunk or page when chunks tab opens
  useEffect(() => {
    if (activeTab === "chunks" && chunksData && chunksData.length > 0) {
      let targetIndex: number | null = null;
      if (initialChunkIndex !== undefined && initialChunkIndex !== null) {
        targetIndex = initialChunkIndex;
      } else if (initialPage !== undefined && initialPage !== null) {
        const found = chunksData.find((c) => c.pageNumber === initialPage);
        if (found) targetIndex = found.chunkIndex;
      }

      if (targetIndex !== null && chunkRefs.current[targetIndex]) {
        setTimeout(() => {
          chunkRefs.current[targetIndex]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 150);
      }
    }
  }, [activeTab, chunksData, initialChunkIndex, initialPage]);

  // Filter chunks by search
  const filteredChunks = useMemo(() => {
    if (!chunksData) return [];
    if (!chunkSearch.trim()) return chunksData;
    const query = chunkSearch.toLowerCase();
    return chunksData.filter(
      (c) =>
        c.content.toLowerCase().includes(query) ||
        (c.headingContext && c.headingContext.toLowerCase().includes(query)) ||
        (c.pageNumber && c.pageNumber.toString().includes(query))
    );
  }, [chunksData, chunkSearch]);

  const handleDownload = () => {
    if (!objectUrl) return;
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleOpenNewTab = () => {
    if (!objectUrl) return;
    window.open(objectUrl, "_blank", "noopener,noreferrer");
  };

  // PDF iframe source with target page anchor
  const pdfSrc = useMemo(() => {
    if (!objectUrl) return "";
    const pageAnchor = initialPage ? `#page=${initialPage}` : "";
    return `${objectUrl}${pageAnchor}`;
  }, [objectUrl, initialPage]);

  return (
    <>
      <DialogTitle className="sr-only">
        {t("documents.viewer.title")}: {filename}
      </DialogTitle>
      <DialogDescription className="sr-only">
        {t("documents.viewer.title")} - {filename}
      </DialogDescription>

      {/* Modal Header */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {getFileBadge(filename)}
          <div className="min-w-0">
            <h2
              className="text-sm font-semibold text-fg truncate max-w-[200px] sm:max-w-md md:max-w-lg"
              title={filename}
            >
              {filename}
            </h2>
            <div className="flex items-center gap-2 text-xs text-fg-muted mt-0.5">
              {initialPage && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-accent-soft text-accent border border-accent/20">
                  {t("documents.viewer.page")} {initialPage}
                </span>
              )}
              {chunksData && (
                <span className="text-[11px]">
                  {t("documents.viewer.chunksCount", {
                    count: chunksData.length,
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center Tabs: Original vs Chunks */}
        <div className="hidden md:flex items-center bg-surface-muted p-0.5 rounded-lg border border-border/80">
          <button
            type="button"
            onClick={() => setActiveTab("original")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === "original"
                ? "bg-surface text-fg shadow-2xs"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FileText className="size-3.5" aria-hidden="true" />
              <span>{t("documents.viewer.tabOriginal")}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("chunks")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === "chunks"
                ? "bg-surface text-fg shadow-2xs"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Layers className="size-3.5" aria-hidden="true" />
              <span>{t("documents.viewer.tabChunks")}</span>
              {chunksData && (
                <span className="font-mono text-[10px] px-1 rounded bg-accent-soft text-accent">
                  {chunksData.length}
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {objectUrl && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleDownload}
                title={t("documents.viewer.download")}
                aria-label={t("documents.viewer.download")}
                className="text-fg-muted hover:text-fg"
              >
                <Download className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleOpenNewTab}
                title={t("documents.viewer.openInNewTab")}
                aria-label={t("documents.viewer.openInNewTab")}
                className="text-fg-muted hover:text-fg"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
              </Button>
            </>
          )}

          <div className="h-4 w-px bg-border mx-1" aria-hidden="true" />

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            aria-label={t("documents.viewer.close")}
            className="text-fg-muted hover:text-fg"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="flex md:hidden items-center justify-around border-b border-border bg-surface-muted/50 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("original")}
          className={`flex-1 py-1.5 text-xs font-medium text-center rounded-md transition-colors ${
            activeTab === "original"
              ? "bg-surface text-fg shadow-2xs"
              : "text-fg-muted"
          }`}
        >
          {t("documents.viewer.tabOriginal")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("chunks")}
          className={`flex-1 py-1.5 text-xs font-medium text-center rounded-md transition-colors ${
            activeTab === "chunks"
              ? "bg-surface text-fg shadow-2xs"
              : "text-fg-muted"
          }`}
        >
          {t("documents.viewer.tabChunks")} ({chunksData?.length || 0})
        </button>
      </div>

      {/* Modal Body */}
      <div className="flex-1 min-h-0 bg-surface-muted/30 relative overflow-hidden flex flex-col">
        {activeTab === "original" ? (
          /* TAB 1: ORIGINAL FILE VIEW */
          <div className="flex-1 flex flex-col min-h-0 relative">
            {/* 1. PPTX Presentation Viewer (Uses structured slide chunks) */}
            {fileType === "pptx" ? (
              <PresentationViewer
                chunks={chunksData || []}
                filename={filename}
                initialSlideNumber={initialPage}
              />
            ) : isFileLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
                <Loader2
                  className="size-8 text-accent animate-spin"
                  aria-hidden="true"
                />
                <p className="text-sm text-fg-muted">
                  {t("documents.viewer.loading")}
                </p>
                <div className="w-64 max-w-full space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ) : isFileError || !blob ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger border border-danger/20">
                  <AlertCircle className="size-6" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-sm text-fg">
                  {t("documents.viewer.loadError")}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => refetchFile()}
                  className="gap-2"
                >
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  <span>{t("common.retry")}</span>
                </Button>
              </div>
            ) : fileType === "pdf" ? (
              /* PDF VIEWER: Native browser reader via iframe with #page=N */
              <iframe
                src={pdfSrc}
                className="w-full h-full border-0 bg-surface"
                title={filename}
              />
            ) : fileType === "docx" ? (
              /* WORD (.DOCX) VIEWER: High-fidelity DOM renderer via docx-preview */
              <DocxViewer blob={blob} filename={filename} />
            ) : fileType === "spreadsheet" ? (
              /* EXCEL / CSV (.XLSX / .CSV) VIEWER: Interactive multi-sheet grid */
              <SpreadsheetViewer blob={blob} filename={filename} />
            ) : fileType === "markdown" && textContent !== null ? (
              /* MARKDOWN (.MD) VIEWER: Formatted preview + raw toggle */
              <MarkdownViewer content={textContent} filename={filename} />
            ) : fileType === "image" ? (
              /* IMAGE VIEWER: with interactive Zoom & Rotate controls */
              <div className="flex-1 flex flex-col min-h-0">
                {/* Image Toolbar */}
                <div className="flex items-center justify-center gap-2 p-2 bg-surface border-b border-border shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                    title={t("documents.viewer.zoomOut")}
                    aria-label={t("documents.viewer.zoomOut")}
                  >
                    <ZoomOut className="size-3.5" aria-hidden="true" />
                  </Button>
                  <span className="font-mono text-xs tabular-nums w-12 text-center text-fg-muted">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                    title={t("documents.viewer.zoomIn")}
                    aria-label={t("documents.viewer.zoomIn")}
                  >
                    <ZoomIn className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setZoom(1);
                      setRotation(0);
                    }}
                    className="text-xs text-fg-muted"
                  >
                    {t("documents.viewer.resetZoom")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    title={t("documents.viewer.rotate")}
                    aria-label={t("documents.viewer.rotate")}
                  >
                    <RotateCw className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>

                {/* Image Canvas */}
                <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-surface-muted/60">
                  <img
                    src={objectUrl || ""}
                    alt={filename}
                    className="max-w-none transition-transform duration-150 rounded-lg shadow-md"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    }}
                  />
                </div>
              </div>
            ) : fileType === "text" ? (
              /* TEXT VIEWER: Syntax reader with line numbers & copy */
              <div className="flex-1 flex flex-col min-h-0 bg-surface">
                <div className="flex items-center justify-between px-4 py-2 bg-surface-muted/40 border-b border-border shrink-0">
                  <span className="text-xs text-fg-muted font-mono">
                    {textContent
                      ? `${textContent.split("\n").length} dòng`
                      : ""}
                  </span>
                  {textContent && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => handleCopyText(textContent)}
                      className="gap-1.5 text-xs text-fg-muted hover:text-fg"
                    >
                      {copiedText ? (
                        <>
                          <Check
                            className="size-3.5 text-accent"
                            aria-hidden="true"
                          />
                          <span>{t("documents.viewer.copied")}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" aria-hidden="true" />
                          <span>{t("documents.viewer.copyText")}</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <pre className="flex-1 overflow-auto p-6 font-mono text-xs text-fg leading-relaxed whitespace-pre-wrap select-text">
                  {textContent || t("documents.viewer.loading")}
                </pre>
              </div>
            ) : (
              /* FALLBACK RAW TEXT */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-lg mx-auto">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-surface-muted text-accent border border-border">
                  <File className="size-7" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-sm text-fg">{filename}</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="gap-2"
                >
                  <Download className="size-4" aria-hidden="true" />
                  <span>{t("documents.viewer.download")}</span>
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* TAB 2: EXTRACTED RAG CHUNKS VIEW */
          <div className="flex-1 flex flex-col min-h-0 bg-surface">
            {/* Search & Stats Header */}
            <div className="flex items-center gap-3 p-3 sm:px-6 border-b border-border bg-surface shrink-0">
              <div className="relative flex-1">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-fg-muted pointer-events-none"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  placeholder={t("documents.viewer.searchInChunks")}
                  value={chunkSearch}
                  onChange={(e) => setChunkSearch(e.target.value)}
                  className="h-8 pl-8 text-xs bg-surface-muted/50"
                />
              </div>
              <span className="text-xs text-fg-muted shrink-0 font-mono">
                {filteredChunks.length} / {chunksData?.length || 0}
              </span>
            </div>

            {/* Chunks List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {isChunksLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              ) : isChunksError ? (
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 text-fg-muted">
                  <AlertCircle
                    className="size-6 text-danger"
                    aria-hidden="true"
                  />
                  <p className="text-xs">{t("documents.viewer.loadError")}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => refetchChunks()}
                  >
                    {t("common.retry")}
                  </Button>
                </div>
              ) : filteredChunks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-fg-muted space-y-2">
                  <Layers
                    className="size-6 text-fg-muted/60"
                    aria-hidden="true"
                  />
                  <p className="text-xs">{t("documents.viewer.noChunks")}</p>
                </div>
              ) : (
                filteredChunks.map((chunk: DocumentChunk) => {
                  const isTargetPage =
                    initialPage !== undefined &&
                    initialPage !== null &&
                    chunk.pageNumber === initialPage;
                  const isTargetChunk =
                    initialChunkIndex !== undefined &&
                    initialChunkIndex !== null &&
                    chunk.chunkIndex === initialChunkIndex;
                  const isHighlighted = isTargetPage || isTargetChunk;

                  return (
                    <div
                      key={chunk.id}
                      ref={(el) => {
                        chunkRefs.current[chunk.chunkIndex] = el;
                      }}
                      className={`p-4 rounded-xl border transition-all duration-200 ${
                        isHighlighted
                          ? "border-accent bg-accent-soft/20 ring-1 ring-accent shadow-xs"
                          : "border-border bg-surface hover:border-border-strong hover:bg-surface-muted/30 shadow-2xs"
                      }`}
                    >
                      {/* Chunk Meta Header */}
                      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border/60">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-accent-soft text-accent border border-accent/20">
                            {t("documents.viewer.chunkIndex", {
                              index: chunk.chunkIndex,
                            })}
                          </span>

                          {chunk.pageNumber && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-muted border border-border text-fg-muted">
                              {t("documents.viewer.page")} {chunk.pageNumber}
                            </span>
                          )}

                          {chunk.headingContext && (
                            <span
                              className="text-xs font-medium text-fg-muted truncate max-w-[240px] italic"
                              title={chunk.headingContext}
                            >
                              {chunk.headingContext}
                            </span>
                          )}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleCopyText(chunk.content)}
                          title={t("documents.viewer.copyText")}
                          aria-label={t("documents.viewer.copyText")}
                          className="text-fg-muted hover:text-fg"
                        >
                          <Copy className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>

                      {/* Chunk Content */}
                      <p className="text-xs text-fg leading-relaxed select-text whitespace-pre-wrap font-sans">
                        {chunk.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function DocumentViewerModal({
  open,
  onOpenChange,
  documentId,
  filename,
  initialPage,
  initialChunkIndex,
}: DocumentViewerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full h-full sm:h-[90vh] sm:w-[94vw] sm:max-w-6xl p-0 flex flex-col overflow-hidden rounded-none sm:rounded-2xl bg-surface border border-border shadow-2xl"
      >
        {documentId ? (
          <DocumentViewerContent
            key={documentId}
            documentId={documentId}
            filename={filename}
            initialPage={initialPage}
            initialChunkIndex={initialChunkIndex}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
