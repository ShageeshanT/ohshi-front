import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `npm run build` writes frontend/dist. In production Caddy serves it (see
// Dockerfile + Caddyfile); for a single-service setup the backend can serve it
// too. In development the API runs on :8000 and Vite proxies the API paths to
// it, so the browser sees one origin and the session cookie just works.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Stable vendor chunk = long-lived browser cache across app releases;
        // the markdown renderer is already split off by React.lazy.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/v1": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
});
