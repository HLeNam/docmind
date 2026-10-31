import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  AlertCircle,
  Search,
  Table,
  FileSpreadsheet,
  WrapText,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

interface SpreadsheetViewerProps {
  blob: Blob;
  filename: string;
}

interface ParsedSheet {
  name: string;
  data: (string | number | boolean | null)[][];
}

interface SelectedCell {
  row: number;
  col: number;
}

const DEFAULT_COLUMN_WIDTH = 150;
const MIN_COLUMN_WIDTH = 60;
const MAX_COLUMN_WIDTH = 800;

function getColumnLetter(colIndex: number): string {
  let letter = "";
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function SpreadsheetViewer({ blob, filename }: SpreadsheetViewerProps) {
  const { t } = useTranslation();
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Interactive controls state
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [isWrapText, setIsWrapText] = useState(false);
  const [isInspectorExpanded, setIsInspectorExpanded] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  // Column widths per sheet: { [sheetIndex]: { [colIndex]: widthInPx } }
  const [columnWidthsBySheet, setColumnWidthsBySheet] = useState<
    Record<number, Record<number, number>>
  >({});

  const gridContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function parseWorkbook() {
      try {
        const XLSX = await import("xlsx");
        const arrayBuffer = await blob.arrayBuffer();
        if (cancelled) return;

        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const parsed: ParsedSheet[] = workbook.SheetNames.map((name) => {
          const ws = workbook.Sheets[name];
          const rawData = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
            ws,
            { header: 1, defval: "" }
          );
          return { name, data: rawData };
        });

        if (!cancelled) {
          setSheets(parsed);
          setActiveSheetIndex(0);
          setSelectedCell(parsed[0]?.data?.length > 0 ? { row: 0, col: 0 } : null);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to parse spreadsheet");
          setIsLoading(false);
        }
      }
    }

    parseWorkbook();

    return () => {
      cancelled = true;
    };
  }, [blob]);

  const currentSheet = sheets[activeSheetIndex] || null;

  // Maximum number of columns in the current sheet
  const maxCols = useMemo(() => {
    if (!currentSheet?.data) return 0;
    return currentSheet.data.reduce((max, row) => Math.max(max, row.length), 0);
  }, [currentSheet]);

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!currentSheet?.data) return [];
    if (!searchQuery.trim()) return currentSheet.data;
    const query = searchQuery.toLowerCase();
    return currentSheet.data.filter((row) =>
      row.some((cell) => cell !== null && String(cell).toLowerCase().includes(query))
    );
  }, [currentSheet, searchQuery]);

  // Derived effective selected cell (handles filtered rows or empty sheets without an effect)
  const effectiveSelectedCell = useMemo(() => {
    if (!selectedCell || filteredRows.length === 0) return null;
    const row = Math.min(selectedCell.row, filteredRows.length - 1);
    const col = Math.min(selectedCell.col, Math.max(0, maxCols - 1));
    return { row, col };
  }, [selectedCell, filteredRows.length, maxCols]);

  // Get current width for a specific column in the active sheet
  const getColWidth = useCallback(
    (colIdx: number) => {
      return (
        columnWidthsBySheet[activeSheetIndex]?.[colIdx] ?? DEFAULT_COLUMN_WIDTH
      );
    },
    [columnWidthsBySheet, activeSheetIndex]
  );

  // Column resize drag handler
  const handleResizeStart = useCallback(
    (colIdx: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startWidth = getColWidth(colIdx);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const newWidth = Math.max(
          MIN_COLUMN_WIDTH,
          Math.min(MAX_COLUMN_WIDTH, startWidth + deltaX)
        );

        setColumnWidthsBySheet((prev) => ({
          ...prev,
          [activeSheetIndex]: {
            ...(prev[activeSheetIndex] || {}),
            [colIdx]: newWidth,
          },
        }));
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [activeSheetIndex, getColWidth]
  );

  // Double click on column separator auto-fits width to content
  const handleAutoFitColumn = useCallback(
    (colIdx: number) => {
      if (!currentSheet?.data) return;
      let maxLen = getColumnLetter(colIdx).length;
      for (const row of currentSheet.data) {
        const val = row[colIdx];
        if (val !== undefined && val !== null) {
          const len = String(val).length;
          if (len > maxLen) maxLen = len;
        }
      }
      // Estimate ~8.5px per character + 32px padding, clamped
      const fitWidth = Math.min(550, Math.max(80, Math.round(maxLen * 8.5 + 32)));

      setColumnWidthsBySheet((prev) => ({
        ...prev,
        [activeSheetIndex]: {
          ...(prev[activeSheetIndex] || {}),
          [colIdx]: fitWidth,
        },
      }));
    },
    [currentSheet, activeSheetIndex]
  );

  // Selected cell content string
  const selectedCellContent = useMemo(() => {
    if (!effectiveSelectedCell || !filteredRows[effectiveSelectedCell.row]) return "";
    const raw = filteredRows[effectiveSelectedCell.row][effectiveSelectedCell.col];
    return raw !== undefined && raw !== null ? String(raw) : "";
  }, [effectiveSelectedCell, filteredRows]);

  // Copy selected cell content
  const handleCopyCell = useCallback(async () => {
    if (!selectedCellContent) return;
    try {
      await navigator.clipboard.writeText(selectedCellContent);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, [selectedCellContent]);

  // Keyboard navigation for spreadsheet grid
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!effectiveSelectedCell || filteredRows.length === 0) return;

      const { row, col } = effectiveSelectedCell;
      let newRow = row;
      let newCol = col;
      let handled = false;

      // Shortcut: Ctrl+Shift+F (or Cmd+Shift+F) to toggle formula bar expand/collapse
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "F" || e.key === "f")) {
        e.preventDefault();
        setIsInspectorExpanded((prev) => !prev);
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          newRow = Math.max(0, row - 1);
          handled = true;
          break;
        case "ArrowDown":
          newRow = Math.min(filteredRows.length - 1, row + 1);
          handled = true;
          break;
        case "ArrowLeft":
          newCol = Math.max(0, col - 1);
          handled = true;
          break;
        case "ArrowRight":
          newCol = Math.min(maxCols - 1, col + 1);
          handled = true;
          break;
        case "Home":
          newCol = 0;
          handled = true;
          break;
        case "End":
          newCol = maxCols - 1;
          handled = true;
          break;
        default:
          break;
      }

      if (handled) {
        e.preventDefault();
        setSelectedCell({ row: newRow, col: newCol });
      }
    },
    [effectiveSelectedCell, filteredRows.length, maxCols]
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-3">
        <Loader2 className="size-8 text-accent animate-spin" aria-hidden="true" />
        <p className="text-xs text-fg-muted">{t("documents.viewer.loading")}</p>
      </div>
    );
  }

  if (error || sheets.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3 max-w-md mx-auto">
        <AlertCircle className="size-8 text-danger" aria-hidden="true" />
        <p className="text-xs text-fg font-medium">{t("documents.viewer.loadError")}</p>
        <p className="text-2xs text-fg-muted">{error || "No sheets found"}</p>
      </div>
    );
  }

  const selectedCoordinate = effectiveSelectedCell
    ? `${getColumnLetter(effectiveSelectedCell.col)}${effectiveSelectedCell.row + 1}`
    : "—";

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface">
      {/* Top Controls: Search, Wrap Toggle, & Sheet Stats */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2 text-xs text-fg-muted min-w-0">
          <FileSpreadsheet className="size-4 text-success shrink-0" aria-hidden="true" />
          <span className="font-medium text-fg truncate max-w-44" title={filename}>
            {filename}
          </span>
          <span className="text-border">|</span>
          <span className="font-mono text-2xs whitespace-nowrap">
            {t("documents.viewer.rowsAndCols", {
              rows: filteredRows.length,
              cols: maxCols,
            })}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Wrap Text Toggle Button */}
          <Button
            type="button"
            variant={isWrapText ? "default" : "outline"}
            size="xs"
            onClick={() => setIsWrapText((prev) => !prev)}
            title={
              isWrapText
                ? t("documents.viewer.unwrapText")
                : t("documents.viewer.wrapText")
            }
            className="h-7 text-xs gap-1.5"
          >
            <WrapText className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">
              {isWrapText
                ? t("documents.viewer.unwrapText")
                : t("documents.viewer.wrapText")}
            </span>
          </Button>

          {/* Search Input */}
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-fg-muted pointer-events-none" />
            <Input
              type="search"
              placeholder={t("documents.viewer.searchSheet")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-8 text-xs bg-surface-muted/50"
            />
          </div>
        </div>
      </div>

      {/* Formula / Cell Content Inspector Bar */}
      <div className="flex items-start gap-2 px-3 py-1.5 border-b border-border bg-surface-muted/40 shrink-0 text-xs">
        {/* Cell Coordinate Chip */}
        <div
          className="flex items-center justify-center w-14 min-w-14 h-7 px-2 bg-surface border border-border rounded font-mono font-semibold text-2xs text-accent select-none shrink-0 shadow-2xs"
          title={`Ô ${selectedCoordinate}`}
        >
          {selectedCoordinate}
        </div>

        {/* fx symbol */}
        <span
          onDoubleClick={() => setIsInspectorExpanded((prev) => !prev)}
          className="font-serif italic font-bold text-fg-muted text-xs select-none shrink-0 self-center px-1 cursor-pointer hover:text-accent transition-colors"
          title={
            isInspectorExpanded
              ? t("documents.viewer.collapseInspector")
              : t("documents.viewer.expandInspector")
          }
          aria-hidden="true"
        >
          fx
        </span>

        {/* Cell Content Textarea (Selectable & Highlightable) */}
        <div className="flex-1 relative flex items-center min-w-0">
          <textarea
            readOnly
            rows={isInspectorExpanded ? 4 : 1}
            value={selectedCellContent}
            placeholder={
              effectiveSelectedCell
                ? t("documents.viewer.emptyCell")
                : t("documents.viewer.selectCellPrompt")
            }
            aria-label="Nội dung ô"
            className={cn(
              "w-full px-2.5 py-1 text-xs font-sans text-fg bg-surface border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent resize-none select-text shadow-2xs transition-all leading-relaxed",
              isInspectorExpanded
                ? "h-24 overflow-y-auto whitespace-pre-wrap"
                : "h-7 overflow-x-auto whitespace-nowrap overflow-y-hidden"
            )}
          />
        </div>

        {/* Toggle Expand Bar (if content is long or multiline) */}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setIsInspectorExpanded((prev) => !prev)}
          className="size-7 shrink-0 text-fg-muted hover:text-fg"
          title={
            isInspectorExpanded
              ? t("documents.viewer.collapseInspector")
              : t("documents.viewer.expandInspector")
          }
          aria-label={
            isInspectorExpanded
              ? t("documents.viewer.collapseInspector")
              : t("documents.viewer.expandInspector")
          }
        >
          {isInspectorExpanded ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </Button>

        {/* 1-Click Copy Cell Content Button */}
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={!effectiveSelectedCell || !selectedCellContent}
          onClick={handleCopyCell}
          className="h-7 px-2 text-xs shrink-0 gap-1.5"
          title={
            hasCopied
              ? t("documents.viewer.cellCopied")
              : t("documents.viewer.copyCell")
          }
        >
          {hasCopied ? (
            <>
              <Check className="size-3.5 text-success" />
              <span className="text-success font-medium hidden sm:inline">
                {t("documents.viewer.cellCopied")}
              </span>
            </>
          ) : (
            <>
              <Copy className="size-3.5 text-fg-muted" />
              <span className="hidden sm:inline">
                {t("documents.viewer.copyCell")}
              </span>
            </>
          )}
        </Button>
      </div>

      {/* Main Spreadsheet Grid Container */}
      <div
        ref={gridContainerRef}
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
        className="flex-1 overflow-auto relative focus:outline-none"
        aria-label="Bảng tính"
      >
        <table className="border-collapse text-xs select-text font-mono table-fixed min-w-full">
          <colgroup>
            {/* Sticky Row Index Column */}
            <col style={{ width: 48 }} />
            {/* Dynamic Sized Columns */}
            {Array.from({ length: maxCols }).map((_, colIdx) => (
              <col key={colIdx} style={{ width: getColWidth(colIdx) }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-surface-muted border-b border-border">
            <tr>
              {/* Top-left corner cell */}
              <th className="sticky left-0 z-20 w-12 px-2 py-1.5 bg-surface-muted border-r border-border text-center text-2xs text-fg-muted font-normal select-none">
                #
              </th>
              {/* Column header letters (A, B, C...) */}
              {Array.from({ length: maxCols }).map((_, colIdx) => (
                <th
                  key={colIdx}
                  style={{ width: getColWidth(colIdx) }}
                  className="relative px-3 py-1.5 border-r border-border text-center text-2xs font-semibold text-fg-muted select-none group"
                >
                  <div className="truncate px-1 select-none">
                    {getColumnLetter(colIdx)}
                  </div>
                  {/* Interactive Column Resize Handle Divider */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    tabIndex={-1}
                    title={t("documents.viewer.autoFitColumn")}
                    onMouseDown={(e) => handleResizeStart(colIdx, e)}
                    onDoubleClick={() => handleAutoFitColumn(colIdx)}
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-accent active:bg-accent group-hover:bg-border-strong/60 transition-colors z-20 select-none"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={maxCols + 1}
                  className="p-8 text-center text-xs text-fg-muted font-sans"
                >
                  {t("documents.noFilteredResults")}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="hover:bg-surface-muted/40 transition-colors"
                >
                  {/* Row number cell (1, 2, 3...) */}
                  <td className="sticky left-0 z-10 px-2 py-1 bg-surface-muted border-r border-border text-center text-2xs text-fg-muted font-normal select-none">
                    {rowIdx + 1}
                  </td>
                  {/* Cells */}
                  {Array.from({ length: maxCols }).map((_, colIdx) => {
                    const cellValue = row[colIdx];
                    const displayValue =
                      cellValue !== undefined && cellValue !== null
                        ? String(cellValue)
                        : "";
                    const isSelected =
                      effectiveSelectedCell?.row === rowIdx &&
                      effectiveSelectedCell?.col === colIdx;

                    return (
                      <td
                        key={colIdx}
                        onClick={() => setSelectedCell({ row: rowIdx, col: colIdx })}
                        style={{ width: getColWidth(colIdx) }}
                        className={cn(
                          "px-3 py-1.5 border-r border-border/60 text-fg font-sans text-xs select-text cursor-cell transition-colors",
                          isWrapText
                            ? "whitespace-pre-wrap break-words align-top"
                            : "whitespace-nowrap truncate align-middle",
                          isSelected &&
                            "ring-2 ring-accent ring-inset bg-accent-soft/40 font-medium z-10"
                        )}
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Sheet Switcher Tabs */}
      {sheets.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border bg-surface-muted/60 overflow-x-auto shrink-0">
          <Table className="size-3.5 text-fg-muted mr-1 shrink-0" aria-hidden="true" />
          {sheets.map((sheet, index) => {
            const isActive = index === activeSheetIndex;
            return (
              <button
                key={sheet.name}
                type="button"
                onClick={() => {
                  setActiveSheetIndex(index);
                  setSelectedCell({ row: 0, col: 0 });
                }}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-surface text-accent shadow-2xs border border-border"
                    : "text-fg-muted hover:text-fg hover:bg-surface/50"
                )}
              >
                {sheet.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
