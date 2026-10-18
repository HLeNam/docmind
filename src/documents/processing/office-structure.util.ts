// Lấy CẤU TRÚC (slide / sheet+hàng) của PPTX và XLSX từ AST của officeparser 8.1.1 — để citation trỏ đúng vị trí
// như pageNumber của PDF và headingContext của DOCX:
//   - PPTX: mỗi slide -> 1 PdfPageSegment { pageNumber: SỐ SLIDE THẬT, text }. Dùng lại chunkPagedText(), nên cột
//     `page_number` của chunk chính là số slide (FE biết là slide nhờ mimeType của tài liệu).
//   - XLSX: mỗi sheet -> danh sách hàng; chunkSpreadsheet() (chunk-text.util.ts) gom theo cụm hàng, lặp lại hàng tiêu đề
//     ở mỗi chunk, và gắn headingContext kiểu `Sheet "Doanh thu" · hàng 2–8`.
// Không cần đổi schema/migration: tái dùng 2 cột có sẵn page_number và heading_context.
//
// Hình dạng AST đã kiểm chứng bằng cách parse file thật với officeparser@8.1.1 (không đoán):
//   slide: { type:'slide', metadata:{slideNumber}, children:[heading|paragraph|table...], notes:[{type:'note',children}] }
//          slide TRỐNG (không có text) bị bỏ khỏi `content` -> PHẢI lấy số từ metadata.slideNumber, không đếm theo chỉ số mảng.
//   sheet: { type:'sheet', metadata:{sheetName}, children:[{type:'row', children:[{type:'cell', text, metadata:{row,col}}]}] }
//          ô trống và hàng trống KHÔNG xuất hiện -> dùng metadata.row/col (0-based) để đặt đúng vị trí.
import officeParser from 'officeparser';
import type { PdfPageSegment } from './extract-text.util.js';

// Kiểu tối thiểu của node AST — chỉ khai những trường ta đọc, để test dựng fixture dễ và không phụ thuộc type nội bộ của lib.
export interface OfficeNode {
  type: string;
  text?: string;
  metadata?: Record<string, unknown>;
  children?: OfficeNode[];
  notes?: OfficeNode[];
}

export interface SheetRow {
  /** Số hàng như hiển thị trong Excel (1-based). */
  rowNumber: number;
  cells: string[];
}

export interface SpreadsheetSheet {
  name: string;
  rows: SheetRow[];
}

const cellText = (n: OfficeNode): string =>
  typeof n.text === 'string' ? n.text.trim() : '';

/** Một bảng -> mỗi hàng 1 dòng, các ô cách nhau bằng " | " (giống cách officeparser in bảng). */
function tableLines(table: OfficeNode): string[] {
  const lines: string[] = [];
  for (const row of table.children ?? []) {
    const cells = (row.children ?? [])
      .map(cellText)
      .filter((c) => c.length > 0);
    if (cells.length > 0) lines.push(cells.join(' | '));
  }
  return lines;
}

/** Gom text của 1 node: node có `text` thì lấy luôn (không đệ quy xuống, tránh lặp), bảng thì xử lý riêng, còn lại đệ quy. */
function collectLines(node: OfficeNode, out: string[]): void {
  if (node.type === 'table') {
    out.push(...tableLines(node));
    return;
  }
  if (typeof node.text === 'string') {
    const t = node.text.trim();
    if (t) out.push(t);
    return;
  }
  for (const child of node.children ?? []) collectLines(child, out);
}

export function slidesFromAst(content: OfficeNode[]): PdfPageSegment[] {
  const segments: PdfPageSegment[] = [];
  for (const node of content) {
    if (node.type !== 'slide') continue;
    const slideNumber = Number(node.metadata?.slideNumber);
    if (!Number.isInteger(slideNumber) || slideNumber < 1) continue;

    const lines: string[] = [];
    for (const child of node.children ?? []) collectLines(child, lines);

    // Ghi chú của diễn giả thường chứa lời giải thích quan trọng không có trên slide.
    const noteLines: string[] = [];
    for (const note of node.notes ?? []) collectLines(note, noteLines);
    if (noteLines.length > 0) lines.push(`Ghi chú: ${noteLines.join(' ')}`);

    const text = lines.join('\n').trim();
    if (text) segments.push({ pageNumber: slideNumber, text });
  }
  return segments;
}

export function sheetsFromAst(content: OfficeNode[]): SpreadsheetSheet[] {
  const sheets: SpreadsheetSheet[] = [];
  for (const node of content) {
    if (node.type !== 'sheet') continue;
    const name =
      typeof node.metadata?.sheetName === 'string'
        ? node.metadata.sheetName
        : `Sheet ${sheets.length + 1}`;

    const rows: SheetRow[] = [];
    for (const rowNode of node.children ?? []) {
      if (rowNode.type !== 'row') continue;
      const cells: string[] = [];
      let rowIndex: number | null = null;
      for (const cell of rowNode.children ?? []) {
        if (cell.type !== 'cell') continue;
        const r = Number(cell.metadata?.row);
        const c = Number(cell.metadata?.col);
        if (!Number.isInteger(r) || !Number.isInteger(c) || c < 0) continue;
        rowIndex ??= r;
        while (cells.length <= c) cells.push(''); // ô trống giữa hàng: giữ đúng vị trí cột
        cells[c] = cellText(cell);
      }
      if (rowIndex === null || cells.every((c) => c === '')) continue;
      rows.push({ rowNumber: rowIndex + 1, cells });
    }
    if (rows.length > 0) sheets.push({ name, rows });
  }
  return sheets;
}

export async function extractPptxSlides(
  buffer: Buffer,
): Promise<PdfPageSegment[]> {
  const ast = await officeParser.parseOffice(buffer, { fileType: 'pptx' });
  return slidesFromAst(ast.content as unknown as OfficeNode[]);
}

export async function extractXlsxSheets(
  buffer: Buffer,
): Promise<SpreadsheetSheet[]> {
  const ast = await officeParser.parseOffice(buffer, { fileType: 'xlsx' });
  return sheetsFromAst(ast.content as unknown as OfficeNode[]);
}
