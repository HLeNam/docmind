import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const target = env.API_PROXY_TARGET || "http://localhost:3000";

    return {
        plugins: [react(), tailwindcss(), babel({ presets: [reactCompilerPreset()] })],
        resolve: {
            alias: {
                "@": path.resolve(import.meta.dirname, "./src"),
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
