import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "年年学习乐园",
        short_name: "年年",
        description: "为年年准备的学习与陪伴。",
        lang: "zh-CN",
        dir: "ltr",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#8fd4ff",
        theme_color: "#79c7ff",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,json,mp3}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/tts\//],
      },
    }),
  ],
  build: {
    outDir: path.resolve(__dirname, "../niannian"),
    emptyOutDir: false,
    sourcemap: false,
  },
});
