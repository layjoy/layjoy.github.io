import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

function contentPacks(): Plugin {
  const root = resolve(__dirname, "src/content/packs");
  return {
    name: "content-packs",
    configureServer(server) {
      server.middlewares.use("/content/packs", (req, res, next) => {
        const url = decodeURIComponent((req.url ?? "/").split("?")[0] || "/");
        if (url === "/") {
          next();
          return;
        }
        const file = resolve(root, `.${url}`);
        if (!file.startsWith(`${root}${sep}`)) {
          next();
          return;
        }
        try {
          if (!statSync(file).isFile()) {
            next();
            return;
          }
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(readFileSync(file));
        } catch {
          next();
        }
      });
    },
    generateBundle() {
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const abs = join(dir, name);
          if (statSync(abs).isDirectory()) {
            walk(abs);
          } else if (name.endsWith(".json")) {
            const rel = relative(root, abs).split(sep).join("/");
            this.emitFile({
              type: "asset",
              fileName: `content/packs/${rel}`,
              source: readFileSync(abs),
            });
          }
        }
      };
      walk(root);
    },
  };
}

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    contentPacks(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "年年学",
        short_name: "年年学",
        description: "给孩子的离线学习与陪伴",
        lang: "zh-CN",
        dir: "ltr",
        display: "standalone",
        start_url: "/",
        scope: "/",
        background_color: "#f6f3ea",
        theme_color: "#3d7a6a",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json,webmanifest}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/content\//, /\/ping\.txt$/],
        globIgnores: ["**/ping.txt"],
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
});
