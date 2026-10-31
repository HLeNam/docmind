import path from "path";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const target = env.API_PROXY_TARGET || "http://localhost:3000";

    return {
        plugins: [
            TanStackRouterVite({
                routesDirectory: "./src/app/routes",
                generatedRouteTree: "./src/app/routeTree.gen.ts",
                autoCodeSplitting: true,
            }),
            react(),
            tailwindcss(),
            babel({ presets: [reactCompilerPreset()] }),
        ],
        resolve: {
            alias: {
                "@": path.resolve(import.meta.dirname, "./src"),
            },
        },
        build: {
            chunkSizeWarningLimit: 600,
            rollupOptions: {
                output: {
                    manualChunks(id: string) {
                        if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
                            return "vendor-react";
                        }
                        if (id.includes("node_modules/@tanstack/")) {
                            return "vendor-tanstack";
                        }
                        if (id.includes("node_modules/@base-ui/")) {
                            return "vendor-base-ui";
                        }
                    },
                },
            },
        },
        server: {
            port: 5173,
            strictPort: true,
            proxy: {
                "/api": {
                    target,
                    changeOrigin: false, // giữ Host/Origin gốc để backend kiểm tra Origin đúng
                    rewrite: (path) => path.replace(/^\/api/, ""),
                },
                "/socket.io": { target, ws: true },
            },
        },
    };
});
