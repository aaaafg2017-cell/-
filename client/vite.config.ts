import type { ServerResponse } from "node:http";
import type { ProxyOptions } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const API_TARGET = process.env.VITE_API_TARGET ?? "http://127.0.0.1:3001";

function sendProxyUnavailable(res: unknown) {
  if (!res || typeof res !== "object" || !("writeHead" in res)) {
    return;
  }
  const response = res as ServerResponse;
  if (response.headersSent) {
    return;
  }
  response.writeHead(502, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: "api unreachable" }));
}

const apiProxy: ProxyOptions = {
  target: API_TARGET,
  changeOrigin: true,
  configure(proxy) {
    proxy.on("error", (_err, _req, res) => {
      sendProxyUnavailable(res);
    });
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": apiProxy,
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    proxy: {
      "/api": apiProxy,
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
