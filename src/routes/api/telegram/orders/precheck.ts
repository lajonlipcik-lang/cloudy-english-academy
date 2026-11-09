import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/telegram/orders/precheck")({
  staticData: { sitemap: false },
  server: { handlers: { POST: async ({ request }) => {
    const { precheckStarsOrder } = await import("@/lib/cloudy/telegram-stars.server");
    return precheckStarsOrder(request);
  } } },
});
