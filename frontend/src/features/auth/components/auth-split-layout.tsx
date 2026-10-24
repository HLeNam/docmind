import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DocMindLogo } from "@/components/ui/docmind-logo";
import { AuthShowcasePanel } from "./auth-showcase-panel";

interface AuthSplitLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthSplitLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthSplitLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-bg text-fg grid grid-cols-1 lg:grid-cols-2">
      {/* Left Column: Focused Auth Form */}
      <div className="flex flex-col justify-between px-6 py-6 sm:px-10 sm:py-8 lg:px-12 xl:px-16 h-full overflow-y-auto">
        {/* Brand Lockup */}
        <div className="shrink-0">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 outline-none rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 group"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-surface border border-border text-fg shadow-xs group-hover:border-border-strong transition-colors">
              <DocMindLogo size={20} className="text-fg" />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight text-fg">
              {t("common.appName")}
            </span>
          </Link>
        </div>

        {/* Center Form Area */}
        <div className="w-full max-w-sm mx-auto my-auto py-4 space-y-4">
          <div className="space-y-1">
            <h1 className="font-heading text-xl sm:text-2xl font-semibold tracking-tight text-fg">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-fg-muted">
              {subtitle}
            </p>
          </div>

          {/* Form Content */}
          <div>{children}</div>
        </div>

        {/* Bottom Area */}
        <div className="shrink-0 w-full max-w-sm mx-auto text-center text-xs text-fg-muted pt-2">
          {footer || (
            <p>
              &copy; {new Date().getFullYear()} {t("common.appName")}. Nền tảng RAG doanh nghiệp.
            </p>
          )}
        </div>
      </div>

      {/* Right Column: Editorial Product Showcase */}
      <AuthShowcasePanel />
    </div>
  );
}
