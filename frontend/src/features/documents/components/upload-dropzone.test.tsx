import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import { UploadDropzone } from "./upload-dropzone";

const mockMutateAsync = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "documents.dropzoneText") return "Kéo thả tài liệu vào đây hoặc";
      if (key === "documents.dropzoneBrowse") return "chọn từ máy tính";
      if (key === "documents.uploadButton") return "Tải lên tài liệu";
      if (key === "documents.uploadDescription")
        return "Hỗ trợ PDF, Word, PowerPoint, Excel, CSV, ảnh và văn bản";
      if (key === "documents.fileInvalidType")
        return `Định dạng file không được hỗ trợ: ${opts?.name}`;
      if (key === "documents.fileTooLarge")
        return `Dung lượng vượt quá giới hạn: ${opts?.name}`;
      if (opts?.defaultValue) return opts.defaultValue;
      return key;
    },
  }),
}));

vi.mock("../hooks/use-documents", () => ({
  useUploadDocument: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

describe("UploadDropzone Component", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
  });

  it("renders dropzone instructions and format badges", () => {
    render(<UploadDropzone collectionId="col-123" />);

    expect(screen.getByText(/Kéo thả tài liệu vào đây hoặc/i)).toBeInTheDocument();
    expect(screen.getByText("chọn từ máy tính")).toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("XLSX")).toBeInTheDocument();
  });

  it("shows validation error when file extension is not supported", () => {
    render(<UploadDropzone collectionId="col-123" />);

    const fileInput = document.querySelector("#document-file-input") as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const invalidFile = new File(["dummy content"], "malicious-script.exe", {
      type: "application/x-msdownload",
    });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(
      screen.getByText("Định dạng file không được hỗ trợ: malicious-script.exe")
    ).toBeInTheDocument();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("triggers upload mutation when a valid PDF file is selected", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      id: "doc-new",
      collectionId: "col-123",
      filename: "financial_report.pdf",
    });

    const onUploaded = vi.fn();
    render(<UploadDropzone collectionId="col-123" onUploaded={onUploaded} />);

    const fileInput = document.querySelector("#document-file-input") as HTMLInputElement;
    const validFile = new File(["pdf data"], "financial_report.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [validFile] } });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(validFile);
  });

  it("has zero accessibility violations according to axe", async () => {
    const { container } = render(<UploadDropzone collectionId="col-123" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
