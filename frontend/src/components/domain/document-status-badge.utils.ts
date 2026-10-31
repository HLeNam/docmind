export interface FormattedFailReason {
  title: string;
  detail: string;
  hint?: string;
}

export function formatFailReason(
  rawReason: string | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string
): FormattedFailReason {
  if (!rawReason || !rawReason.trim()) {
    return {
      title: t("documents.errorReasons.generalTitle", { defaultValue: "Xử lý thất bại" }),
      detail: t("documents.errorReasons.generalDesc", {
        defaultValue: "Không thể xử lý tài liệu. Vui lòng kiểm tra lại tệp tin hoặc thử tái chỉ mục.",
      }),
      hint: t("documents.errorReasons.retryHint", {
        defaultValue: "Gợi ý: Nhấn vào tài liệu để mở danh sách và chọn Tái chỉ mục.",
      }),
    };
  }

  const lower = rawReason.toLowerCase();

  // 1. Rate Limit / Quota Exceeded (429, RATE_TOKEN_LIMIT_EXCEEDED, rate limit)
  if (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("rate_token_limit_exceeded") ||
    lower.includes("quota exceeded")
  ) {
    return {
      title: t("documents.errorReasons.rateLimitTitle", { defaultValue: "Quá tải hạn mức AI" }),
      detail: t("documents.errorReasons.rateLimitDesc", {
        defaultValue:
          "Lượt gọi mô hình AI tạm thời vượt giới hạn tần suất (Rate limit). Vui lòng thử tái chỉ mục sau ít phút.",
      }),
      hint: t("documents.errorReasons.rateLimitHint", {
        defaultValue: "Gợi ý: Đợi 1-2 phút rồi bấm nút Tái chỉ mục trong bảng tài liệu.",
      }),
    };
  }

  // 2. Network / Timeout
  if (
    lower.includes("etimedout") ||
    lower.includes("econnrefused") ||
    lower.includes("timeout") ||
    lower.includes("fetch failed") ||
    lower.includes("network")
  ) {
    return {
      title: t("documents.errorReasons.networkTitle", { defaultValue: "Lỗi kết nối dịch vụ" }),
      detail: t("documents.errorReasons.networkDesc", {
        defaultValue: "Mất kết nối hoặc quá thời gian xử lý khi trích xuất tài liệu. Vui lòng thử lại.",
      }),
      hint: t("documents.errorReasons.retryHint", {
        defaultValue: "Gợi ý: Nhấn vào tài liệu để mở danh sách và chọn Tái chỉ mục.",
      }),
    };
  }

  // 3. Password / Protected / Corrupt
  if (
    lower.includes("password") ||
    lower.includes("encrypted") ||
    lower.includes("corrupt") ||
    lower.includes("malformed")
  ) {
    return {
      title: t("documents.errorReasons.fileInvalidTitle", { defaultValue: "Tệp tin lỗi hoặc có mật khẩu" }),
      detail: t("documents.errorReasons.fileInvalidDesc", {
        defaultValue: "Tệp tin bị hỏng hoặc có mật khẩu bảo vệ không thể giải mã nội dung.",
      }),
      hint: t("documents.errorReasons.fileInvalidHint", {
        defaultValue: "Gợi ý: Mở khóa tệp tin hoặc lưu lại thành file tiêu chuẩn rồi tải lại.",
      }),
    };
  }

  // 4. Empty text / unreadable
  if (lower.includes("empty") || lower.includes("no text") || lower.includes("không có nội dung")) {
    return {
      title: t("documents.errorReasons.emptyContentTitle", { defaultValue: "Không có nội dung văn bản" }),
      detail: t("documents.errorReasons.emptyContentDesc", {
        defaultValue: "Tài liệu trống hoặc không chứa văn bản có thể trích xuất phục vụ tìm kiếm.",
      }),
      hint: t("documents.errorReasons.emptyContentHint", {
        defaultValue: "Gợi ý: Kiểm tra tệp tin có chứa văn bản thay vì chỉ là ảnh scan chất lượng thấp.",
      }),
    };
  }

  // 5. Try extracting detail from JSON if present (e.g. {"detail": "..."})
  let extractedDetail: string | null = null;
  try {
    const jsonMatch = rawReason.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.detail === "string") {
          extractedDetail = parsed.detail;
        } else if (typeof parsed.message === "string") {
          extractedDetail = parsed.message;
        }
      }
    }
  } catch {
    // Non-JSON string, ignore
  }

  if (extractedDetail) {
    // Strip URLs or API keys if present
    const cleanDetail = extractedDetail.replace(/https?:\/\/[^\s]+/g, "").trim();
    return {
      title: t("documents.errorReasons.generalTitle", { defaultValue: "Xử lý thất bại" }),
      detail: cleanDetail || t("documents.errorReasons.generalDesc", { defaultValue: "Không thể hoàn thành xử lý tài liệu." }),
      hint: t("documents.errorReasons.retryHint", {
        defaultValue: "Gợi ý: Nhấn vào tài liệu để mở danh sách và chọn Tái chỉ mục.",
      }),
    };
  }

  const cleanReason = rawReason.length > 120 ? rawReason.slice(0, 120) + "..." : rawReason;
  return {
    title: t("documents.errorReasons.generalTitle", { defaultValue: "Xử lý thất bại" }),
    detail: cleanReason,
    hint: t("documents.errorReasons.retryHint", {
      defaultValue: "Gợi ý: Nhấn vào tài liệu để mở danh sách và chọn Tái chỉ mục.",
    }),
  };
}
