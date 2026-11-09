// Lovable's wrapper supplies the shared TanStack, React, Tailwind, path-alias,
// development and Nitro plugins. Keep its sandbox defaults intact while
// selecting Vercel's Nitro preset for non-sandbox builds.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isLovableSandbox =
  process.env['LOVABLE_SANDBOX'] === "1" || !!process.env['DEV_SERVER__PROJECT_PATH'];

export default defineConfig({
  tanstackStart: {
    // Preserve the custom SSR wrapper, including the Cloudy region-access gate.
    server: { entry: "server" },
  },
  ...(!isLovableSandbox ? { nitro: { preset: "vercel" } } : {}),
});
