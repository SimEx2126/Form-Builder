import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies /api and /local to the Express backend on :4000,
// so the frontend can call them as same-origin paths.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on the local network so phones/other devices can connect
    proxy: {
      "/api": "http://localhost:4000",
      "/local": "http://localhost:4000",
    },
  },
});
