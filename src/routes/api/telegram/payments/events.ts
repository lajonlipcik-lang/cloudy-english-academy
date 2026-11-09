import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/telegram/payments/events")({
  staticData: { sitemap: false },
  server: { handlers: { POST: async ({ request }) => {
    const { handleStarsPaymentEvent } = await import("@/lib/cloudy/telegram-stars.server");
    return handleStarsPaymentEvent(request);
  } } },
});
