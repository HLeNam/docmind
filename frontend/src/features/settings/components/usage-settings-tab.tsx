import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Coins,
  Cpu,
  Database,
  Layers,
  Loader2,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useUsageSummary } from "../hooks/use-usage";
import type { UsageSummaryQuery } from "../schemas/usage-schemas";

export function UsageSettingsTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rangeDays, setRangeDays] = useState<30 | 7>(30);

  const query: UsageSummaryQuery = useMemo(() => {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - (rangeDays - 1));

    const to = toDate.toISOString().slice(0, 10);
    const from = fromDate.toISOString().slice(0, 10);
    return { from, to };
  }, [rangeDays]);

  const { data: usage, isLoading } = useUsageSummary(query);

  if (!user) return null;

  const userRole = user.membership.role;
  const canManage = userRole === "OWNER" || userRole === "ADMIN";

  if (!canManage) {
    return (
      <div
        role="note"
        className="p-6 rounded-2xl border border-border bg-surface text-center space-y-3"
      >
        <div className="flex justify-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-surface-muted text-fg-muted">
            <BarChart3 className="size-5" aria-hidden="true" />
          </div>
        </div>
        <p className="text-sm text-fg-muted">{t("settings.memberOnlyNotice")}</p>
      </div>
    );
  }

  const totals = usage?.totals;
  const maxDailyTokens =
    usage?.daily && usage.daily.length > 0
      ? Math.max(...usage.daily.map((d) => d.tokens), 1)
      : 1;

  return (
    <div className="space-y-6">
      {/* Header & Range Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-fg tracking-tight">
            {t("settings.usageTitle")}
          </h2>
          <p className="text-sm text-fg-muted mt-0.5">
            {t("settings.usageSubtitle")}
          </p>
        </div>

        {/* Range Toggle */}
        <div className="inline-flex items-center rounded-xl border border-border bg-surface-muted/50 p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setRangeDays(7)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              rangeDays === 7
                ? "bg-surface text-fg shadow-xs"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            {t("settings.last7Days")}
          </button>
          <button
            type="button"
            onClick={() => setRangeDays(30)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              rangeDays === 30
                ? "bg-surface text-fg shadow-xs"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            {t("settings.last30Days")}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 rounded-2xl border border-border bg-surface flex flex-col items-center justify-center gap-3">
          <Loader2 className="size-6 text-accent animate-spin" aria-hidden="true" />
          <p className="text-xs text-fg-muted">{t("common.loading")}</p>
        </div>
      ) : !totals ? (
        <div className="p-8 rounded-2xl border border-dashed border-border bg-surface text-center space-y-2">
          <p className="text-sm font-medium text-fg">{t("settings.noUsageData")}</p>
        </div>
      ) : (
        <>
          {/* Key Metric Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Tokens */}
            <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-2">
              <div className="flex items-center justify-between text-fg-muted">
                <span className="text-xs font-medium">{t("settings.totalTokens")}</span>
                <div className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Coins className="size-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="text-2xl font-bold tracking-tight text-fg font-mono">
                {totals.tokens.toLocaleString()}
              </div>
              <div className="text-2xs text-fg-muted">
                {t("settings.recordsCount", { count: totals.records.toLocaleString() })}
              </div>
            </div>

            {/* Generation Tokens */}
            <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-2">
              <div className="flex items-center justify-between text-fg-muted">
                <span className="text-xs font-medium">{t("settings.generationTokens")}</span>
                <div className="flex size-7 items-center justify-center rounded-lg bg-surface-muted text-accent">
                  <Cpu className="size-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="text-2xl font-bold tracking-tight text-fg font-mono">
                {totals.byType.GENERATION.tokens.toLocaleString()}
              </div>
              <div className="text-2xs text-fg-muted">
                ${totals.byType.GENERATION.costUsd.toFixed(4)} USD
              </div>
            </div>

            {/* Embedding Tokens */}
            <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-2">
              <div className="flex items-center justify-between text-fg-muted">
                <span className="text-xs font-medium">{t("settings.embeddingTokens")}</span>
                <div className="flex size-7 items-center justify-center rounded-lg bg-surface-muted text-fg-muted">
                  <Database className="size-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="text-2xl font-bold tracking-tight text-fg font-mono">
                {totals.byType.EMBEDDING.tokens.toLocaleString()}
              </div>
              <div className="text-2xs text-fg-muted">
                ${totals.byType.EMBEDDING.costUsd.toFixed(4)} USD
              </div>
            </div>

            {/* Total Cost */}
            <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-2">
              <div className="flex items-center justify-between text-fg-muted">
                <span className="text-xs font-medium">{t("settings.estimatedCost")}</span>
                <div className="flex size-7 items-center justify-center rounded-lg bg-success-soft text-success">
                  <Layers className="size-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="text-2xl font-bold tracking-tight text-fg font-mono">
                ${totals.costUsd.toFixed(4)}
              </div>
              <div className="text-2xs text-fg-muted">
                UTC {usage.from} → {usage.to}
              </div>
            </div>
          </div>

          {/* Daily Trend Chart & Breakdown */}
          <div className="p-5 rounded-2xl border border-border bg-surface shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
              <BarChart3 className="size-4 text-accent" aria-hidden="true" />
              <span>{t("settings.dailyBreakdown")}</span>
            </h3>

            {usage.daily.length === 0 ? (
              <p className="text-xs text-fg-muted py-4 text-center">
                {t("settings.noUsageData")}
              </p>
            ) : (
              <div className="space-y-4">
                {/* Visual Bar Chart */}
                <div
                  className="flex items-end gap-1.5 h-36 pt-4 pb-2 px-2 border-b border-border overflow-x-auto"
                  role="img"
                  aria-label={t("settings.dailyBreakdown")}
                >
                  {usage.daily.map((item) => {
                    const heightPercent = Math.max(
                      Math.round((item.tokens / maxDailyTokens) * 100),
                      item.tokens > 0 ? 6 : 2
                    );
                    const dateFormatted = item.date.slice(5); // MM-DD

                    return (
                      <div
                        key={item.date}
                        className="flex-1 min-w-[20px] flex flex-col items-center gap-1.5 group relative"
                      >
                        {/* Tooltip on hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-1 left-1/2 -translate-x-1/2 pointer-events-none z-10 p-2 rounded-xl bg-surface border border-border text-fg text-xs whitespace-nowrap shadow-md space-y-0.5">
                          <p className="font-semibold text-fg">{item.date}</p>
                          <p className="text-fg-muted font-mono">{item.tokens.toLocaleString()} tokens</p>
                          <p className="text-accent font-mono font-medium">${item.costUsd.toFixed(4)} USD</p>
                        </div>

                        {/* Bar */}
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-[28px] rounded-t-md transition-all duration-150 ${
                            item.tokens > 0
                              ? "bg-accent group-hover:bg-accent/80 shadow-2xs"
                              : "bg-surface-muted"
                          }`}
                        />
                        <span className="text-2xs text-fg-muted font-mono whitespace-nowrap">
                          {dateFormatted}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Daily Table Details */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-muted/60 text-fg-muted border-b border-border">
                      <tr>
                        <th scope="col" className="py-2.5 px-3 font-medium">
                          Ngày
                        </th>
                        <th scope="col" className="py-2.5 px-3 font-medium text-right">
                          LLM Tokens
                        </th>
                        <th scope="col" className="py-2.5 px-3 font-medium text-right">
                          Embedding Tokens
                        </th>
                        <th scope="col" className="py-2.5 px-3 font-medium text-right">
                          Tổng Tokens
                        </th>
                        <th scope="col" className="py-2.5 px-3 font-medium text-right">
                          Chi phí (USD)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {usage.daily.slice().reverse().map((d) => (
                        <tr
                          key={d.date}
                          className="hover:bg-surface-muted/30 transition-colors"
                        >
                          <td className="py-2.5 px-3 font-medium text-fg whitespace-nowrap font-mono flex items-center gap-1.5">
                            <Calendar className="size-3 text-fg-muted" aria-hidden="true" />
                            <span>{d.date}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-fg-muted">
                            {d.generationTokens.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-fg-muted">
                            {d.embeddingTokens.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-fg">
                            {d.tokens.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-fg-muted">
                            ${d.costUsd.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}