import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, AlertCircle, Search, Table, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SpreadsheetViewerProps {
  blob: Blob;
  filename: string;
}

interface ParsedSheet {
  name: string;
  data: (string | number | boolean | null)[][];
}

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

  // Compute maximum number of columns in the current sheet
  const maxCols = useMemo(() => {
    if (!currentSheet?.data) return 0;
    return currentSheet.data.reduce((max, row) => Math.max(max, row.length), 0);
  }, [currentSheet]);

  // Filter rows by search
  const filteredRows = useMemo(() => {
    if (!currentSheet?.data) return [];
    if (!searchQuery.trim()) return currentSheet.data;
    const query = searchQuery.toLowerCase();
    return currentSheet.data.filter((row) =>
      row.some((cell) => cell !== null && String(cell).toLowerCase().includes(query))
    );
  }, [currentSheet, searchQuery]);

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
        <p className="text-[11px] text-fg-muted">{error || "No sheets found"}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface">
      {/* Top Controls: Search & Sheet Stats */}
      <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <FileSpreadsheet className="size-4 text-success" aria-hidden="true" />
          <span className="font-medium text-fg truncate max-w-[200px]" title={filename}>
            {filename}
          </span>
          <span className="text-border">|</span>
          <span className="font-mono text-[11px]">
            {filteredRows.length} hàng × {maxCols} cột
          </span>
        </div>

        <div className="relative w-64 max-w-[50%]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-fg-muted pointer-events-none" />
          <Input
            type="search"
            placeholder="Tìm kiếm ô..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-8 text-xs bg-surface-muted/50"
          />
        </div>
      </div>

      {/* Main Spreadsheet Grid */}
      <div className="flex-1 overflow-auto relative">
        <table className="border-collapse text-xs w-full min-w-max select-text font-mono">
          <thead className="sticky top-0 z-10 bg-surface-muted border-b border-border">
            <tr>
              {/* Top-left corner cell */}
              <th className="sticky left-0 z-20 w-12 px-2 py-1.5 bg-surface-muted border-r border-border text-center text-[10px] text-fg-muted font-normal select-none">
                #
              </th>
              {/* Column header letters (A, B, C...) */}
              {Array.from({ length: maxCols }).map((_, colIdx) => (
                <th
                  key={colIdx}
                  className="px-3 py-1.5 border-r border-border text-center text-[11px] font-semibold text-fg-muted select-none min-w-[100px]"
                >
                  {getColumnLetter(colIdx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-surface-muted/50 transition-colors">
                {/* Row number cell (1, 2, 3...) */}
                <td className="sticky left-0 z-10 px-2 py-1 bg-surface-muted border-r border-border text-center text-[10px] text-fg-muted font-normal select-none">
                  {rowIdx + 1}
                </td>
                {/* Cell values */}
                {Array.from({ length: maxCols }).map((_, colIdx) => {
                  const cellValue = row[colIdx];
                  const displayValue =
                    cellValue !== undefined && cellValue !== null
                      ? String(cellValue)
                      : "";

                  return (
                    <td
                      key={colIdx}
                      className="px-3 py-1 border-r border-border/60 text-fg whitespace-nowrap truncate max-w-xs font-sans text-xs"
                      title={displayValue}
                    >
                      {displayValue}
                    </td>
                  );
                })}
              </tr>
            ))}
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
                onClick={() => setActiveSheetIndex(index)}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-surface text-accent shadow-2xs border border-border"
                    : "text-fg-muted hover:text-fg hover:bg-surface/50"
                }`}
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
