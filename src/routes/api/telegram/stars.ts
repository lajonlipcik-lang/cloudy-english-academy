import { createFileRoute } from "@tanstack/react-router";
import {
  createAdminClient,
  randomToken,
  requireCloudyUser,
  sha256Hex,
} from "@/lib/cloudy/telegram-stars.server";

export const Route = createFileRoute("/api/telegram/stars")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({})) as Record<string, unknown>;
          const action = String(body['action'] ?? "");
          const { runtime, userId } = await requireCloudyUser(request);
          const admin = createAdminClient(runtime.url, runtime.secretKey);

          if (action === "create-link") {
            const token = randomToken();
            const tokenHash = await sha256Hex(token);
            const { error } = await admin.from("telegram_link_tokens").insert({
              user_id: userId,
              token_hash: tokenHash,
              expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            });
            if (error) throw new Error("Не удалось создать безопасную ссылку привязки Telegram.");
            return Response.json({
              ok: true,
              result: {
                url: `https://t.me/${runtime.botUsername}?start=link_${token}`,
                expiresInSeconds: 600,
              },
            });
          }

          if (action === "create-invoice") {
            const planCode = typeof body['planCode'] === "string" ? body['planCode'].trim() : "";
            if (!/^[a-z][a-z0-9_]{1,47}$/.test(planCode)) {
              return Response.json({ ok: false, error: "Некорректный тариф." }, { status: 400 });
            }
            const { data: link, error: linkError } = await admin
              .from("telegram_account_links")
              .select("telegram_user_id,telegram_chat_id")
              .eq("user_id", userId)
              .maybeSingle();
            if (linkError) throw linkError;
            if (!link) {
              return Response.json({ ok: false, error: "Сначала привяжите Telegram-аккаунт." }, { status: 409 });
            }

            const { data: plan, error: planError } = await admin
              .from("subscription_plans")
              .select("id,name,description,price_minor,currency,billing_interval,interval_count,is_active")
              .eq("code", planCode)
              .eq("is_active", true)
              .maybeSingle();
            if (planError) throw planError;
            const amount = Number(plan?.price_minor);
            if (!plan || plan.currency !== "XTR" || plan.billing_interval !== "month" ||
                plan.interval_count !== 1 || !Number.isSafeInteger(amount) || amount < 1 || amount > 10000) {
              return Response.json({
                ok: false,
                error: "Тариф для оплаты Telegram Stars ещё не настроен.",
              }, { status: 409 });
            }
            const title = String(plan.name ?? "").trim();
            if (!title || title.length > 32) {
              return Response.json({ ok: false, error: "Название платёжного тарифа должно быть настроено (до 32 символов)." }, { status: 409 });
            }

            const now = new Date();
            await admin.from("telegram_payment_orders")
              .update({ status: "expired", updated_at: now.toISOString() })
              .eq("user_id", userId)
              .eq("status", "pending")
              .lte("expires_at", now.toISOString());
            const { data: pendingOrder, error: pendingError } = await admin
              .from("telegram_payment_orders")
              .select("id")
              .eq("user_id", userId)
              .eq("status", "pending")
              .maybeSingle();
            if (pendingError) throw pendingError;
            if (pendingOrder) {
              return Response.json({
                ok: false,
                error: "У вас уже есть неоплаченный счёт в Telegram. Завершите его или дождитесь окончания срока.",
              }, { status: 409 });
            }

            const invoicePayload = `cs_${randomToken()}`;
            const { data: order, error: orderError } = await admin
              .from("telegram_payment_orders")
              .insert({
                user_id: userId,
                plan_id: plan.id,
                invoice_payload: invoicePayload,
                telegram_user_id: String(link.telegram_user_id),
                telegram_chat_id: String(link.telegram_chat_id),
                amount_stars: amount,
                subscription_period_seconds: 2592000,
                expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              })
              .select("id")
              .single();
            if (orderError || !order) throw new Error("Не удалось создать заказ на оплату.");

            try {
              const invoice = await fetch(`https://api.telegram.org/bot${runtime.botToken}/sendInvoice`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  chat_id: String(link.telegram_chat_id),
                  title,
                  description: String(plan.description ?? "Доступ к Cloudy English").slice(0, 255),
                  payload: invoicePayload,
                  provider_token: "",
                  currency: "XTR",
                  prices: [{ label: title, amount }],
                  subscription_period: 2592000,
                }),
              });
              const result = await invoice.json().catch(() => ({})) as {
                ok?: boolean;
                result?: { message_id?: number };
              };
              if (!invoice.ok || result.ok !== true || !result.result?.message_id) {
                await admin.from("telegram_payment_orders")
                  .update({ status: "expired", updated_at: new Date().toISOString() })
                  .eq("id", order.id);
                throw new Error("Telegram не смог выставить счёт. Попробуйте позже.");
              }
              await admin.from("telegram_payment_orders")
                .update({ invoice_message_id: result.result.message_id, updated_at: new Date().toISOString() })
                .eq("id", order.id);
              return Response.json({ ok: true, result: { orderId: order.id, sent: true } });
            } catch (error) {
              throw error;
            }
          }

          return Response.json({ ok: false, error: "Неизвестное действие." }, { status: 400 });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Не удалось подготовить оплату.";
          const status = message === "UNAUTHORIZED" ? 401 : 400;
          return Response.json({ ok: false, error: status === 401 ? "Сначала войдите в аккаунт." : message }, { status });
        }
      },
    },
  },
});
