import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";
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
    <div className="min-h-screen bg-bg text-fg grid grid-cols-1 lg:grid-cols-2">
      {/* Left Column: Focused Auth Form */}
      <div className="flex flex-col justify-between px-6 py-8 sm:px-12 sm:py-12 lg:px-16 xl:px-20 min-h-screen">
        {/* Brand Lockup */}
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 outline-none rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <BookOpen className="size-4.5" aria-hidden="true" />
            </div>
            <span className="font-heading text-xl font-bold tracking-tight text-fg">
              {t("common.appName")}
            </span>
          </Link>
        </div>

        {/* Center Form Area */}
        <div className="w-full max-w-sm mx-auto my-8 space-y-6">
          <div className="space-y-1.5">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-fg">
              {title}
            </h1>
            <p className="text-sm text-fg-muted">
              {subtitle}
            </p>
          </div>

          {/* Form Content */}
          <div>{children}</div>
        </div>

        {/* Bottom Area */}
        <div className="w-full max-w-sm mx-auto text-center text-xs text-fg-muted">
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
