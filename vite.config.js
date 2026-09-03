var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
var isAppsScript = process.env.BUILD_TARGET === "appsscript";
export default defineConfig({
    plugins: __spreadArray([
        react(),
        tailwindcss()
    ], (isAppsScript ? [viteSingleFile()] : []), true),
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
