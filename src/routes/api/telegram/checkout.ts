import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/telegram/checkout")({
  server: { handlers: { POST: async ({ request }) => {
    const { createTeacherCheckout } = await import("@/lib/cloudy/telegram-stars.server");
    return createTeacherCheckout(request);
  } } },
});
