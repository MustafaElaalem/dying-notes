import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/dying-notes/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Noted.",
        short_name: "Noted.",
        description: "Voice-first quick notes with a lifespan. Mortal by default, immortal by choice.",
        theme_color: "#2B59E0",
        background_color: "#F7F3EA",
        display: "standalone",
        start_url: "/dying-notes/",
        scope: "/dying-notes/",
        icons: [
          { src: "/dying-notes/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/dying-notes/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/dying-notes/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        navigateFallback: "/dying-notes/index.html",
        navigateFallbackDenylist: [/^\/dying-notes\/sw\.js$/, /^\/dying-notes\/workbox-/]
      }
    })
  ]
});
