import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@/lib/i18n";
import { SpreadsheetViewer } from "./spreadsheet-viewer";

vi.mock("xlsx", () => ({
  read: () => ({
    SheetNames: ["Bảng lương"],
    Sheets: {
      "Bảng lương": {},
    },
  }),
  utils: {
    sheet_to_json: () => [
      ["Họ và tên", "Chức vụ", "Mức lương"],
      ["Nguyễn Văn A", "Kỹ sư phần mềm cao cấp", "35,000,000 VNĐ"],
      ["Trần Thị B", "Quản lý dự án", "45,000,000 VNĐ"],
    ],
  },
}));

describe("SpreadsheetViewer", () => {
  const dummyBlob = new Blob(["dummy content"], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  it("renders sheets, headers and cell data correctly", async () => {
    render(<SpreadsheetViewer blob={dummyBlob} filename="bang_luong.xlsx" />);

    // Wait for workbook parsing
    await waitFor(() => {
      expect(screen.getByText("bang_luong.xlsx")).toBeInTheDocument();
    });

    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText("Kỹ sư phần mềm cao cấp")).toBeInTheDocument();
    expect(screen.getByText("35,000,000 VNĐ")).toBeInTheDocument();
  });

  it("updates inspector bar when a cell is clicked", async () => {
    render(<SpreadsheetViewer blob={dummyBlob} filename="bang_luong.xlsx" />);

    await waitFor(() => {
      expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    });

    // Initial selected cell is A1 ("Họ và tên")
    const formulaTextarea = screen.getByLabelText("Nội dung ô") as HTMLTextAreaElement;
    expect(formulaTextarea.value).toBe("Họ và tên");
    expect(screen.getByTitle("Ô A1")).toBeInTheDocument();

    // Click on "Kỹ sư phần mềm cao cấp" (Cell B2)
    const cell = screen.getByText("Kỹ sư phần mềm cao cấp");
    fireEvent.click(cell);

    // Inspector bar should update to B2 and show cell content
    expect(screen.getByTitle("Ô B2")).toBeInTheDocument();
    expect(formulaTextarea.value).toBe("Kỹ sư phần mềm cao cấp");
  });

  it("toggles wrap text mode when clicking WrapText button", async () => {
    render(<SpreadsheetViewer blob={dummyBlob} filename="bang_luong.xlsx" />);

    await waitFor(() => {
      expect(screen.getByText("Kỹ sư phần mềm cao cấp")).toBeInTheDocument();
    });

    const wrapButton = screen.getByRole("button", { name: /xuống dòng/i });
    expect(wrapButton).toBeInTheDocument();

    // Initial state: not wrapped (truncate)
    const cell = screen.getByText("Kỹ sư phần mềm cao cấp");
    expect(cell.className).toContain("whitespace-nowrap");
    expect(cell.className).toContain("truncate");

    // Click to wrap text
    fireEvent.click(wrapButton);

    // Now cell should have whitespace-pre-wrap break-words
    expect(cell.className).toContain("whitespace-pre-wrap");
    expect(cell.className).toContain("break-words");
  });

  it("copies cell content when clicking copy button", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<SpreadsheetViewer blob={dummyBlob} filename="bang_luong.xlsx" />);

    await waitFor(() => {
      expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    });

    const copyBtn = screen.getByTitle(/Sao chép ô/i);
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("Họ và tên");
    });
  });

  it("renders resize separators on column headers", async () => {
    render(<SpreadsheetViewer blob={dummyBlob} filename="bang_luong.xlsx" />);

    await waitFor(() => {
      expect(screen.getByText("bang_luong.xlsx")).toBeInTheDocument();
    });

    const separators = screen.getAllByRole("separator");
    expect(separators.length).toBeGreaterThan(0);
  });
});
