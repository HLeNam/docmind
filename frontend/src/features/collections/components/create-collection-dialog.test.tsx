import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { CreateCollectionDialog } from "./create-collection-dialog";

const mockMutateAsync = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "collections.createTitle") return "Tạo bộ sưu tập mới";
      if (key === "collections.createDescription") return "Bộ sưu tập giúp gom nhóm các tài liệu liên quan";
      if (key === "collections.nameLabel") return "Tên bộ sưu tập";
      if (key === "collections.namePlaceholder") return "Ví dụ: Kế toán & Tài chính";
      if (key === "collections.descriptionLabel") return "Mô tả";
      if (key === "collections.descriptionPlaceholder") return "Mô tả ngắn về bộ sưu tập...";
      if (key === "collections.instructionsLabel") return "Hướng dẫn AI (System prompt)";
      if (key === "collections.instructionsPlaceholder") return "Nhập chỉ dẫn cho AI...";
      if (key === "collections.createButton") return "Tạo bộ sưu tập";
      if (key === "common.cancel") return "Hủy";
      if (key === "common.loading") return "Đang xử lý...";
      if (opts?.defaultValue) return opts.defaultValue;
      return key;
    },
  }),
}));

vi.mock("../hooks/use-collections", () => ({
  useCreateCollection: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
}));

describe("CreateCollectionDialog Component", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
  });

  it("renders form elements when dialog is open", () => {
    render(<CreateCollectionDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Tạo bộ sưu tập mới")).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên bộ sưu tập/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mô tả/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo bộ sưu tập" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when cancel button is clicked", () => {
    const handleOpenChange = vi.fn();
    render(<CreateCollectionDialog open={true} onOpenChange={handleOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits form data successfully when valid data is entered", async () => {
    const mockCreated = {
      id: "col-new",
      tenantId: "tenant-1",
      name: "Tài liệu kỹ thuật",
      description: "Chứa spec và tài liệu kiến trúc",
      instructions: "Trả lời bằng Markdown",
      createdAt: "2026-10-31T00:00:00Z",
    };
    mockMutateAsync.mockResolvedValueOnce(mockCreated);

    const handleCreated = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <CreateCollectionDialog
        open={true}
        onOpenChange={handleOpenChange}
        onCreated={handleCreated}
      />
    );

    fireEvent.change(screen.getByLabelText(/Tên bộ sưu tập/i), {
      target: { value: "Tài liệu kỹ thuật" },
    });
    fireEvent.change(screen.getByLabelText(/Mô tả/i), {
      target: { value: "Chứa spec và tài liệu kiến trúc" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Tạo bộ sưu tập" }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: "Tài liệu kỹ thuật",
        description: "Chứa spec và tài liệu kiến trúc",
        instructions: undefined,
      });
      expect(handleOpenChange).toHaveBeenCalledWith(false);
      expect(handleCreated).toHaveBeenCalledWith(mockCreated);
    });
  });

  it("has zero accessibility violations", async () => {
    const { container } = render(
      <CreateCollectionDialog open={true} onOpenChange={vi.fn()} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
