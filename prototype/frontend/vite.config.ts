import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: { outDir: "dist" },
  base: "/ui/",
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/alerts": "http://127.0.0.1:8787",
      "/simulator": "http://127.0.0.1:8787",
      "/replies": "http://127.0.0.1:8787",
      "/inbound": "http://127.0.0.1:8787",
      "/audit.csv": "http://127.0.0.1:8787",
    },
  },
});
