/*import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },

      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});*/


import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    // 1. Isolate Vite's internal HMR from your backend proxy
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },

      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
        changeOrigin: true,
        // 2. Add an error handler to prevent Node from crashing when a socket closes
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Backend WebSocket proxy error:', err.message);
          });
        },
      },
    },
  },
});
