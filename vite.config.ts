// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Make Cloudflare invoke the Worker before serving static assets. Without this,
// files in public/ can be served directly and skip src/server.ts region checks.
const regionGateNitroConfig = {
  nitro: {
    cloudflare: {
      wrangler: {
        assets: { run_worker_first: true },
      },
    },
  },
};

export default defineConfig({
  ...regionGateNitroConfig,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
