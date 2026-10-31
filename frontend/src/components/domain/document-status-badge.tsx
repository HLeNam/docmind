import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, Clock, AlertCircle } from "lucide-react";
import { cn } from "cn";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { DocumentStatus } from "@/features/documents";
import { formatFailReason } from "./document-status-badge.utils";

export interface DocumentStatusBadgeProps {
  status: DocumentStatus;
  failReason?: string | null;
  className?: string;
  size?: "sm" | "default";
}

export function DocumentStatusBadge({
  status,
  failReason,
  className,
  size = "default",
}: DocumentStatusBadgeProps) {
  const { t } = useTranslation();

  const config = {
    INDEXED: {
      label: t("documents.status.indexed", { defaultValue: "Sẵn sàng" }),
      tooltip: t("documents.status.indexedTooltip", {
        defaultValue: "Tài liệu đã được lập chỉ mục, sẵn sàng cho hỏi đáp AI.",
      }),
      icon: CheckCircle2,
      style: "bg-success-soft text-success border border-success/25 shadow-2xs",
      iconStyle: "text-success",
    },
    PROCESSING: {
      label: t("documents.status.processing", { defaultValue: "Đang xử lý" }),
      tooltip: t("documents.status.processingTooltip", {
        defaultValue: "Đang trích xuất văn bản và tạo vector nhúng...",
      }),
      icon: Loader2,
      style: "bg-warning-soft text-warning border border-warning/30 shadow-2xs",
      iconStyle: "animate-spin text-warning",
    },
    PENDING: {
      label: t("documents.status.pending", { defaultValue: "Chờ xử lý" }),
      tooltip: t("documents.status.pendingTooltip", {
        defaultValue: "Đang trong hàng đợi chuẩn bị xử lý.",
      }),
      icon: Clock,
      style: "bg-surface-muted text-fg-muted border border-border/80 shadow-2xs",
      iconStyle: "text-fg-muted",
    },
    FAILED: {
      label: t("documents.status.failed", { defaultValue: "Thất bại" }),
      tooltip: t("documents.status.failedTooltip", {
        defaultValue: "Xử lý thất bại. Rê chuột hoặc bấm để xem chi tiết lỗi.",
      }),
      icon: AlertCircle,
      style: "bg-danger-soft text-danger border border-danger/25 shadow-2xs",
      iconStyle: "text-danger",
    },
  }[status];

  const Icon = config.icon;

  const sizeClasses =
    size === "sm"
      ? "h-5.5 px-2 text-2xs min-w-20 gap-1"
      : "h-6 px-2.5 text-xs min-w-22 gap-1.5";

  const iconSizeClass = size === "sm" ? "size-3 shrink-0" : "size-3.5 shrink-0";

  const baseBadgeClasses = cn(
    "inline-flex items-center justify-center rounded-full font-medium transition-colors select-none shrink-0 whitespace-nowrap",
    sizeClasses,
    config.style,
    className
  );

  if (status === "FAILED") {
    const errorInfo = formatFailReason(failReason, t);

    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              role="status"
              className={cn(
                baseBadgeClasses,
                "cursor-help outline-none focus-visible:ring-1 focus-visible:ring-ring"
              )}
              aria-label={`Trạng thái tài liệu: ${config.label}. Rê chuột để xem lý do lỗi: ${errorInfo.title}`}
            />
          }
        >
          <Icon className={cn(iconSizeClass, config.iconStyle)} aria-hidden="true" />
          <span>{config.label}</span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="flex flex-col items-start gap-1.5 text-left w-72 max-w-xs p-3 text-xs shadow-md z-50"
        >
          <div className="flex items-center gap-1.5 font-semibold text-danger-fg">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{errorInfo.title}</span>
          </div>
          <p className="text-2xs opacity-90 leading-relaxed">
            {errorInfo.detail}
          </p>
          {errorInfo.hint && (
            <p className="text-2xs opacity-75 border-t border-background/20 pt-1.5 font-medium w-full">
              {errorInfo.hint}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={baseBadgeClasses}
            aria-label={`Trạng thái tài liệu: ${config.label}`}
          />
        }
      >
        <Icon className={cn(iconSizeClass, config.iconStyle)} aria-hidden="true" />
        <span>{config.label}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs px-2.5 py-1.5 text-2xs shadow-md z-50">
        <span className="leading-snug">{config.tooltip}</span>
      </TooltipContent>
    </Tooltip>
  );
}
