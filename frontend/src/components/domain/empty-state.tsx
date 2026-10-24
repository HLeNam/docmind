import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  children,
  className,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-xl border border-dashed border-border bg-surface/50",
        className
      )}
    >
      {/* Icon Wrapper */}
      <div className="flex size-12 items-center justify-center rounded-xl bg-surface-muted border border-border text-fg-muted shadow-2xs mb-4">
        <Icon className="size-6 text-fg-muted" aria-hidden="true" />
      </div>

      {/* Content */}
      <h3 className="font-heading text-base sm:text-lg font-semibold text-fg tracking-tight">
        {title}
      </h3>
      <p className="mt-1 text-sm text-fg-muted max-w-sm text-balance">
        {description}
      </p>

      {/* Custom children if any */}
      {children && <div className="mt-4">{children}</div>}

      {/* Action Buttons */}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {secondaryAction && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}

          {action && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
              className="gap-2"
            >
              {ActionIcon && <ActionIcon className="size-4" aria-hidden="true" />}
              <span>{action.label}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
