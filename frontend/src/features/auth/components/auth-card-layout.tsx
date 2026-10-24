import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DocMindLogo } from "@/components/ui/docmind-logo";

interface AuthCardLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCardLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthCardLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 outline-none rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 group"
        >
          <div className="flex size-10 items-center justify-center rounded-lg bg-surface border border-border text-fg shadow-xs group-hover:border-border-strong transition-colors">
            <DocMindLogo size={24} className="text-fg" />
          </div>
          <span className="font-heading text-2xl font-semibold tracking-tight text-fg">
            {t("common.appName")}
          </span>
        </Link>
        <h1 className="mt-6 text-xl sm:text-2xl font-semibold tracking-tight text-fg">
          {title}
        </h1>
        <p className="mt-2 text-sm text-fg-muted max-w-sm mx-auto">
          {subtitle}
        </p>
      </div>

      {/* Main Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 shadow-xs">
          {children}
        </div>

        {/* Footer info or link */}
        {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
      </div>
    </div>
  );
}
