import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { DocumentStatusBadge } from "./document-status-badge";
import { formatFailReason } from "./document-status-badge.utils";

// Mock i18next translation
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        "documents.status.indexed": "Sẵn sàng",
        "documents.status.processing": "Đang xử lý",
        "documents.status.pending": "Chờ xử lý",
        "documents.status.failed": "Thất bại",
        "documents.status.indexedTooltip": "Tài liệu đã được lập chỉ mục đầy đủ, sẵn sàng cho AI đối soát.",
        "documents.status.processingTooltip": "Đang trích xuất văn bản và tạo vector nhúng...",
        "documents.status.pendingTooltip": "Đang trong hàng đợi chuẩn bị xử lý.",
        "documents.status.failedTooltip": "Xử lý thất bại. Rê chuột hoặc bấm để xem chi tiết lỗi.",
        "documents.errorReasons.rateLimitTitle": "Quá tải hạn mức AI",
        "documents.errorReasons.rateLimitDesc": "Lượt gọi mô hình AI tạm thời vượt giới hạn tần suất (Rate limit). Vui lòng thử tái chỉ mục sau ít phút.",
        "documents.errorReasons.rateLimitHint": "Gợi ý: Đợi 1-2 phút rồi bấm nút Tái chỉ mục trong bảng tài liệu.",
        "documents.errorReasons.networkTitle": "Lỗi kết nối dịch vụ",
        "documents.errorReasons.networkDesc": "Mất kết nối hoặc quá thời gian xử lý khi trích xuất tài liệu. Vui lòng thử lại.",
        "documents.errorReasons.fileInvalidTitle": "Tệp tin lỗi hoặc có mật khẩu",
        "documents.errorReasons.fileInvalidDesc": "Tệp tin bị hỏng hoặc có mật khẩu bảo vệ không thể giải mã nội dung.",
        "documents.errorReasons.emptyContentTitle": "Không tìm thấy nội dung",
        "documents.errorReasons.emptyContentDesc": "Tài liệu trống hoặc không chứa văn bản có thể trích xuất phục vụ tìm kiếm.",
        "documents.errorReasons.generalTitle": "Xử lý thất bại",
        "documents.errorReasons.generalDesc": "Không thể xử lý tài liệu. Vui lòng kiểm tra lại tệp tin hoặc thử tái chỉ mục.",
        "documents.errorReasons.retryHint": "Gợi ý: Nhấn vào tài liệu để mở danh sách và chọn Tái chỉ mục.",
      };
      return translations[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

describe("formatFailReason helper", () => {
  const dummyT = (key: string, options?: Record<string, unknown>) => {
    return (options?.defaultValue as string) ?? key;
  };

  it("formats Jina 429 rate-limit error into a friendly message without JSON dumps or URLs", () => {
    const rawError =
      'Jina embedding request failed (429): {"detail":"Token rate limit exceeded: 100,329/100,000 tokens per minute. Reduce batch sizes or upgrade your plan at https://jina.ai/api-dashboard/key-manager.","request_id":"ff8000fa319b491275c52dee577e0e19","code":"RATE_TOKEN_LIMIT_EXCEEDED"}';

    const result = formatFailReason(rawError, dummyT);

    expect(result.title).toBe("Quá tải hạn mức AI");
    expect(result.detail).toContain("giới hạn tần suất");
    expect(result.detail).not.toContain("https://");
    expect(result.detail).not.toContain("ff8000fa319b491275c52dee577e0e19");
    expect(result.detail).not.toContain("RATE_TOKEN_LIMIT_EXCEEDED");
    expect(result.hint).toBeDefined();
  });

  it("formats network / timeout errors cleanly", () => {
    const result = formatFailReason("request to https://api.jina.ai/ failed, reason: connect ETIMEDOUT", dummyT);
    expect(result.title).toBe("Lỗi kết nối dịch vụ");
    expect(result.detail).toContain("Mất kết nối hoặc quá thời gian xử lý");
  });

  it("formats password protected / corrupted file errors", () => {
    const result = formatFailReason("Document is password encrypted and cannot be parsed", dummyT);
    expect(result.title).toBe("Tệp tin lỗi hoặc có mật khẩu");
  });

  it("formats empty document content", () => {
    const result = formatFailReason("Empty text content found in uploaded document", dummyT);
    expect(result.title).toBe("Không có nội dung văn bản");
  });

  it("handles null or undefined reason gracefully with fallback", () => {
    const result = formatFailReason(null, dummyT);
    expect(result.title).toBe("Xử lý thất bại");
    expect(result.detail).toBe("Không thể xử lý tài liệu. Vui lòng kiểm tra lại tệp tin hoặc thử tái chỉ mục.");
  });

  it("extracts detail cleanly if generic JSON error is present and strips urls", () => {
    const result = formatFailReason('Error: {"detail":"Service temporarily unavailable at https://api.docmind.ai/check"}', dummyT);
    expect(result.detail).not.toContain("https://");
  });
});

describe("DocumentStatusBadge Component", () => {
  it("renders INDEXED status correctly", () => {
    render(<DocumentStatusBadge status="INDEXED" />);
    expect(screen.getByText("Sẵn sàng")).toBeInTheDocument();
  });

  it("renders PROCESSING status correctly", () => {
    render(<DocumentStatusBadge status="PROCESSING" />);
    expect(screen.getByText("Đang xử lý")).toBeInTheDocument();
  });

  it("renders PENDING status correctly", () => {
    render(<DocumentStatusBadge status="PENDING" />);
    expect(screen.getByText("Chờ xử lý")).toBeInTheDocument();
  });

  it("renders FAILED status with accessible role and formatted error info", () => {
    const rawError =
      'Jina embedding request failed (429): {"detail":"Token rate limit exceeded","code":"RATE_TOKEN_LIMIT_EXCEEDED"}';

    render(<DocumentStatusBadge status="FAILED" failReason={rawError} />);
    expect(screen.getByText("Thất bại")).toBeInTheDocument();
    const badge = screen.getByRole("status");
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute("aria-label")).toContain("Quá tải hạn mức AI");
  });

  it("applies small size styling when size='sm' is provided", () => {
    const { container } = render(<DocumentStatusBadge status="INDEXED" size="sm" />);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("h-5.5");
    expect(badge?.className).toContain("text-2xs");
    expect(badge?.className).toContain("min-w-20");
  });

  it("applies default size styling when size='default' is provided", () => {
    const { container } = render(<DocumentStatusBadge status="INDEXED" size="default" />);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("h-6");
    expect(badge?.className).toContain("text-xs");
    expect(badge?.className).toContain("min-w-22");
  });

  it("passes accessibility check with 0 axe violations for all statuses", async () => {
    const { container } = render(
      <div>
        <DocumentStatusBadge status="INDEXED" />
        <DocumentStatusBadge status="PROCESSING" />
        <DocumentStatusBadge status="PENDING" />
        <DocumentStatusBadge status="FAILED" failReason="Jina 429 Rate limit exceeded" />
      </div>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
