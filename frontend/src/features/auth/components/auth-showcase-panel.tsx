import { useTranslation } from "react-i18next";
import { FileText, Sparkles, ShieldCheck, CheckCircle2 } from "lucide-react";

export function AuthShowcasePanel() {
  const { t } = useTranslation();

  return (
    <div className="hidden lg:flex flex-col justify-between p-8 xl:p-12 bg-surface-muted border-l border-border relative overflow-hidden select-none h-full">
      {/* Subtle grid background decorative lines */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--fg) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Top Editorial Quote */}
      <div className="relative z-10 max-w-md space-y-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent-soft text-accent text-xs font-medium">
          <Sparkles className="size-3.5" aria-hidden="true" />
          <span>Doanh nghiệp thông minh</span>
        </div>
        <h2 className="font-heading text-xl xl:text-2xl font-semibold tracking-tight text-fg leading-snug">
          &ldquo;{t("auth.showcaseQuote")}&rdquo;
        </h2>
        <p className="text-xs xl:text-sm text-fg-muted leading-relaxed">
          {t("auth.showcaseSubtitle")}
        </p>
      </div>

      {/* Centerpiece: Signature DocMind Citation Card */}
      <div className="relative z-10 my-auto py-4 max-w-lg w-full space-y-3">
        {/* Sample Question */}
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <span className="font-semibold text-fg">Câu hỏi:</span>
          <span className="italic truncate">&ldquo;{t("auth.showcaseSampleQuestion")}&rdquo;</span>
        </div>

        {/* AI Answer with Citation */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex size-5.5 items-center justify-center rounded-md bg-accent text-accent-fg">
                <Sparkles className="size-3" aria-hidden="true" />
              </div>
              <span className="text-xs font-semibold text-fg">Câu trả lời AI</span>
            </div>
            <span className="text-2xs text-fg-muted font-medium">Đã xác minh</span>
          </div>

          <p className="text-xs xl:text-sm text-fg leading-relaxed">
            {t("auth.showcaseSampleAnswer")}
            {/* Citation Chip [1] */}
            <span className="inline-flex items-center justify-center ml-1 px-1.5 py-0.2 rounded bg-accent-soft text-accent font-mono text-xs font-semibold align-baseline">
              [1]
            </span>
          </p>

          {/* Expanded Source Inspector */}
          <div className="rounded-lg border border-border bg-surface-muted p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-fg min-w-0">
                <FileText className="size-3.5 text-accent shrink-0" aria-hidden="true" />
                <span className="font-mono text-xs truncate">
                  {t("auth.showcaseDocName")}
                </span>
                <span className="text-fg-muted shrink-0">•</span>
                <span className="text-fg-muted shrink-0 text-xs">
                  {t("auth.showcaseDocPage")}
                </span>
              </div>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium bg-success-soft text-success shrink-0">
                {t("auth.showcaseRelevance")}
              </span>
            </div>

            <p className="text-2xs text-fg-muted leading-relaxed font-mono bg-surface p-2 rounded border border-border/60">
              &ldquo;{t("auth.showcaseDocSnippet")}&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Feature Badges */}
      <div className="relative z-10 pt-3 border-t border-border flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-fg-muted">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-accent" aria-hidden="true" />
          <span>{t("auth.showcasePillSecurity")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-accent" aria-hidden="true" />
          <span>{t("auth.showcasePillCitation")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText className="size-3.5 text-accent" aria-hidden="true" />
          <span>{t("auth.showcasePillFormats")}</span>
        </div>
      </div>
    </div>
  );
}
