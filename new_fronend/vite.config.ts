import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
    // Proxy /auth/* and /api/* to Django backend (avoids CORS in dev)
    proxy: {
      "/auth": {
        target: process.env.VITE_WMS_API_BASE_URL || "http://localhost:8000",
        changeOrigin: true,
      },
      "/api": {
        target: process.env.VITE_WMS_API_BASE_URL || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
