import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-accent-fg focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Chuyển đến nội dung chính (Skip to content)
      </a>
      <Outlet />
    </>
  );
}