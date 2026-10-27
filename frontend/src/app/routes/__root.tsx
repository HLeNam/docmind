import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/app/shell/app-shell";

export const Route = createRootRoute({
  component: RootLayout,
});

const AUTH_PATHS = ["/login", "/register", "/accept-invite"];

function RootLayout() {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const isAuthPage =
    AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/")) ||
    pathname.startsWith("/invitations");

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-accent-fg focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Chuyển đến nội dung chính (Skip to content)
      </a>

      {isAuthPage ? (
        <Outlet />
      ) : (
        <AppShell>
          <Outlet />
        </AppShell>
      )}
    </>
  );
}
