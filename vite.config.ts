// Lovable's wrapper currently supplies the app's shared TanStack, React,
// Tailwind, path-alias and development plugins. Override only the deployment
// target here; keep the Lovable sandbox target unchanged during its preview.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isLovableSandbox =
  process.env.LOVABLE_SANDBOX === "1" || !!process.env.DEV_SERVER__PROJECT_PATH;

export default defineConfig({
  tanstackStart: {
    // Keep the custom SSR wrapper, including the Cloudy region-access gate.
    server: { entry: "server" },
  },
  ...(!isLovableSandbox
    ? {
        nitro: {
          preset: "vercel",
          output: {
            dir: ".vercel/output",
            serverDir: ".vercel/output/functions/__server.func",
            publicDir: ".vercel/output/static",
          },
        },
      }
    : {}),
});
