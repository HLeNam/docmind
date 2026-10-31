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
      label: t("documents.status.indexed"),
      tooltip: t("documents.status.indexedTooltip"),
      icon: CheckCircle2,
      style: "bg-success-soft text-success border border-success/25 shadow-2xs",
      iconStyle: "text-success",
    },
    PROCESSING: {
      label: t("documents.status.processing"),
      tooltip: t("documents.status.processingTooltip"),
      icon: Loader2,
      style: "bg-warning-soft text-warning border border-warning/30 shadow-2xs",
      iconStyle: "animate-spin text-warning",
    },
    PENDING: {
      label: t("documents.status.pending"),
      tooltip: t("documents.status.pendingTooltip"),
      icon: Clock,
      style: "bg-surface-muted text-fg-muted border border-border/80 shadow-2xs",
      iconStyle: "text-fg-muted",
    },
    FAILED: {
      label: t("documents.status.failed"),
      tooltip: t("documents.status.failedTooltip"),
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
        <TooltipContent side="top" className="max-w-xs p-3 space-y-1.5 text-xs shadow-md z-50">
          <div className="flex items-center gap-1.5 font-semibold text-danger">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{errorInfo.title}</span>
          </div>
          <p className="text-fg-muted leading-relaxed text-2xs">
            {errorInfo.detail}
          </p>
          {errorInfo.hint && (
            <p className="text-fg-subtle text-2xs border-t border-border/60 pt-1.5 font-medium">
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
        <p className="text-fg">{config.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
