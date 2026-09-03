import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const isAppsScript = process.env.BUILD_TARGET === "appsscript";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(isAppsScript ? [viteSingleFile()] : []),
  ],
  build: {
    assetsInlineLimit: isAppsScript ? 100000000 : 0,
    cssCodeSplit: !isAppsScript,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.spec.ts"],
  },
});
