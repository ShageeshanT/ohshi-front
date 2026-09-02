import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `npm run build` writes frontend/dist. In production Caddy serves it (see
// Dockerfile + Caddyfile); for a single-service setup the backend can serve it
// too. In development the API runs on :8000 and Vite proxies the API paths to
// it, so the browser sees one origin and the session cookie just works.
// OHSHI_API_URL points the proxy elsewhere (a second backend on another port).
const api = process.env.OHSHI_API_URL || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Stable vendor chunks = long-lived browser cache across app releases;
        // the markdown renderer is already split off by React.lazy. Clerk gets
        // its own: it is needed at boot to know whether anyone is signed in, so
        // it cannot be lazy, but it changes on its own release cycle and should
        // not invalidate the app chunk.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          clerk: ["@clerk/react"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: api, changeOrigin: true, ws: true },
      "/v1": { target: api, changeOrigin: true },
      "/health": { target: api, changeOrigin: true },
    },
  },
});
