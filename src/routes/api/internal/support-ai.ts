import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/support-ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleSupportAi, loadEnabledGroqProvider } = await import("@/lib/support-ai/relay.server");
        return handleSupportAi(request, {
          getSecret: () => process.env["CLOUDY_SUPPORT_BRIDGE_SECRET"],
          loadProvider: loadEnabledGroqProvider,
          fetchImpl: fetch,
        });
      },
    },
  },
});
