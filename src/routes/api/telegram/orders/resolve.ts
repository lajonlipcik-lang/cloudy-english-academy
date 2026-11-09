import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/telegram/orders/resolve")({
  server: { handlers: { POST: async ({ request }) => {
    const { resolveStarsOrder } = await import("@/lib/cloudy/telegram-stars.server");
    return resolveStarsOrder(request);
  } } },
});
