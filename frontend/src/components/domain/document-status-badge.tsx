import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, Clock, AlertCircle } from "lucide-react";
import { cn } from "cn";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { DocumentStatus } from "@/features/documents";

interface DocumentStatusBadgeProps {
  status: DocumentStatus;
  failReason?: string | null;
  className?: string;
}

export function DocumentStatusBadge({
  status,
  failReason,
  className,
}: DocumentStatusBadgeProps) {
  const { t } = useTranslation();

  const config = {
    INDEXED: {
      label: t("documents.status.indexed"),
      icon: CheckCircle2,
      style: "bg-success-soft text-success",
      iconStyle: "text-success",
    },
    PROCESSING: {
      label: t("documents.status.processing"),
      icon: Loader2,
      style: "bg-warning-soft text-warning",
      iconStyle: "animate-spin text-warning",
    },
    PENDING: {
      label: t("documents.status.pending"),
      icon: Clock,
      style: "bg-surface-muted text-fg-muted",
      iconStyle: "text-fg-muted",
    },
    FAILED: {
      label: t("documents.status.failed"),
      icon: AlertCircle,
      style: "bg-danger-soft text-danger",
      iconStyle: "text-danger",
    },
  }[status];

  const Icon = config.icon;

  const badgeElement = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors select-none",
        config.style,
        className
      )}
      aria-label={`Trạng thái tài liệu: ${config.label}`}
    >
      <Icon className={cn("size-3.5 shrink-0", config.iconStyle)} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );

  if (status === "FAILED") {
    return (
      <Tooltip>
        <TooltipTrigger className="cursor-help outline-none rounded-full focus-visible:ring-1 focus-visible:ring-ring">
          {badgeElement}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <p className="font-semibold text-danger">
            {t("documents.status.failed")}
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {failReason || t("documents.status.failedTooltip")}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badgeElement;
}
