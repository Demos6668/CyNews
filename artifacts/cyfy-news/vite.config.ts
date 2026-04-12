import { config } from "dotenv";
import { resolve } from "path";

// Load .env from cyfy-news dir (for local dev without Replit env)
config({ path: resolve(import.meta.dirname, ".env") });

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.VITE_PORT ?? process.env.FRONTEND_PORT ?? "5173";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8080";
const wsProxyTarget = process.env.VITE_WS_PROXY_TARGET ?? "ws://localhost:8080";

export default defineConfig({
  base: basePath,
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(
      `v${process.env.npm_package_version ?? "1.0.0"}`
    ),
  },
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "charts": ["recharts"],
          "ui": ["framer-motion", "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port,
    host: "0.0.0.0",
    proxy: {
      "/api": { target: apiProxyTarget, changeOrigin: true },
      "/ws": { target: wsProxyTarget, ws: true },
    },
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
