import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-bg text-fg flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">{t("common.appName")}</h1>
        <p className="text-fg-muted text-base">
          SaaS RAG đa tenant cho tài liệu doanh nghiệp
        </p>
        <div className="pt-2">
          <Button>{t("documents.upload")}</Button>
        </div>
      </div>
    </main>
  );
}
