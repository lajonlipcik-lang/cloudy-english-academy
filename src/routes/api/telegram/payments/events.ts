import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/telegram/payments/events")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleStarsPaymentEvent } = await import("@/lib/cloudy/telegram-stars.server");
    return handleStarsPaymentEvent(request);
  } } },
});
