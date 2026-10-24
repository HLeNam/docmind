import { useTranslation } from "react-i18next";
import { Check, Dot } from "lucide-react";
import { cn } from "cn";

interface PasswordStrengthIndicatorProps {
  password?: string;
}

export function PasswordStrengthIndicator({
  password = "",
}: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation();

  const rules = [
    {
      id: "length",
      label: t("auth.ruleMinLength"),
      valid: password.length >= 8,
    },
    {
      id: "uppercase",
      label: t("auth.ruleUppercase"),
      valid: /[A-Z]/.test(password),
    },
    {
      id: "number",
      label: t("auth.ruleNumber"),
      valid: /[0-9]/.test(password),
    },
  ];

  if (!password) {
    return (
      <p className="text-xs text-fg-muted">
        {t("auth.passwordRequirements")}
      </p>
    );
  }

  return (
    <div className="space-y-1.5 pt-1" aria-label="Độ mạnh mật khẩu">
      <div className="flex flex-wrap gap-2 text-xs">
        {rules.map((rule) => (
          <span
            key={rule.id}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 transition-colors font-medium",
              rule.valid
                ? "bg-success-soft text-success"
                : "bg-surface-muted text-fg-muted"
            )}
          >
            {rule.valid ? (
              <Check className="size-3 shrink-0 stroke-[2.5]" aria-hidden="true" />
            ) : (
              <Dot className="size-3 shrink-0" aria-hidden="true" />
            )}
            <span>{rule.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
