import { createFileRoute } from "@tanstack/react-router";
import {
  createAdminClient,
  getTelegramRuntime,
  readObject,
  sha256Hex,
  telegramApi,
} from "@/lib/cloudy/telegram-stars.server";

type TelegramUser = { id?: number; username?: string };
type TelegramMessage = {
  text?: string;
  chat?: { id?: number };
  from?: TelegramUser;
  successful_payment?: {
    currency?: string;
    total_amount?: number;
    invoice_payload?: string;
    telegram_payment_charge_id?: string;
    provider_payment_charge_id?: string;
    subscription_expiration_date?: number;
    is_recurring?: boolean;
    is_first_recurring?: boolean;
  };
  refunded_payment?: {
    currency?: string;
    total_amount?: number;
    invoice_payload?: string;
    telegram_payment_charge_id?: string;
  };
};

export const Route = createFileRoute("/api/telegram/stars-webhook")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const runtime = getTelegramRuntime();
          if (request.headers.get("x-telegram-bot-api-secret-token") !== runtime.webhookSecret) {
            return Response.json({ ok: false }, { status: 401 });
          }
          const length = Number(request.headers.get("content-length") ?? 0);
          if (length > 1_000_000) return Response.json({ ok: false }, { status: 413 });
          const update = readObject(await request.json());
          const admin = createAdminClient(runtime.url, runtime.secretKey);
          const updateId = Number(update['update_id']);
          const eventType = update['pre_checkout_query'] ? "pre_checkout_query"
            : readObject(update['message'])['successful_payment'] ? "successful_payment"
            : readObject(update['message'])['refunded_payment'] ? "refunded_payment"
            : update['subscription'] ? "subscription"
            : "other";
          const eventKey = Number.isSafeInteger(updateId) ? String(updateId) : "";
          if (!eventKey) return Response.json({ ok: true });

          const { data: existingEvent } = await admin['from']("subscription_provider_events")
            .select("id,processed_at")
            .eq("provider", "telegram_stars")
            .eq("provider_event_id", eventKey)
            .maybeSingle();
          if (existingEvent?.processed_at) return Response.json({ ok: true, duplicate: true });

          if (!existingEvent) {
            const { error: eventError } = await admin['from']("subscription_provider_events").insert({
              provider: "telegram_stars",
              provider_event_id: eventKey,
              event_type: eventType,
              payload: update,
            });
            if (eventError && eventError.code !== "23505") throw eventError;
          }

          const markProcessed = async () => {
            await admin['from']("subscription_provider_events")
              .update({ processed_at: new Date().toISOString(), processing_error: null })
              .eq("provider", "telegram_stars")
              .eq("provider_event_id", eventKey);
          };

          const preCheckout = readObject(update['pre_checkout_query']);
          if (Object.keys(preCheckout).length) {
            const from = readObject(preCheckout['from']);
            const payload = String(preCheckout['invoice_payload'] ?? "");
            const { data: order } = await admin['from']("telegram_payment_orders")
              .select("telegram_user_id,amount_stars,status,expires_at")
              .eq("invoice_payload", payload)
              .maybeSingle();
            const valid = !!order &&
              String(order.telegram_user_id) === String(from['id']) &&
              Number(preCheckout['total_amount']) === Number(order.amount_stars) &&
              preCheckout['currency'] === "XTR" &&
              ["pending", "active"].includes(String(order.status)) &&
              (order.status === "active" || Date.parse(String(order.expires_at)) > Date.now());
            await telegramApi(runtime.botToken, "answerPreCheckoutQuery", {
              pre_checkout_query_id: String(preCheckout['id'] ?? ""),
              ok: valid,
              ...(!valid ? { error_message: "Счёт недействителен или срок его действия истёк. Создайте новый." } : {}),
            });
            await markProcessed();
            return Response.json({ ok: true });
          }

          const subscriptionUpdate = readObject(update['subscription']);
          if (Object.keys(subscriptionUpdate).length) {
            const subscriptionUser = readObject(subscriptionUpdate['user']);
            const payload = String(subscriptionUpdate['invoice_payload'] ?? "");
            const state = String(subscriptionUpdate['state'] ?? "");
            const { data: order, error: orderError } = await admin
              ['from']("telegram_payment_orders")
              .select("subscription_id,telegram_user_id")
              .eq("invoice_payload", payload)
              .maybeSingle();
            if (orderError) throw orderError;
            if (order?['subscription']_id &&
                String(order.telegram_user_id) === String(subscriptionUser['id']) &&
                ["active", "canceled", "failed"].includes(state)) {
              const changes = state === "active"
                ? { cancel_at_period_end: false, canceled_at: null, updated_at: new Date().toISOString() }
                : { cancel_at_period_end: true, canceled_at: state === "canceled" ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
              const { error } = await admin['from']("subscriptions")
                .update(changes)
                .eq("id", order['subscription']_id);
              if (error) throw error;
            }
            await markProcessed();
            return Response.json({ ok: true });
          }

          const message = readObject(update['message']) as TelegramMessage;
          const chatId = message.chat?['id'];
          const fromId = message['from']?['id'];
          const text = String(message.text ?? "");
          const linkMatch = /^\/start\s+link_([a-f0-9]{32})$/.exec(text);
          if (linkMatch && chatId && fromId) {
            const tokenHash = await sha256Hex(linkMatch[1] ?? '');
            const { error } = await admin.rpc("consume_telegram_link_token", {
              p_token_hash: tokenHash,
              p_telegram_user_id: fromId,
              p_telegram_chat_id: chatId,
              p_telegram_username: message['from']?['user']name ?? null,
            });
            if (error) {
              await telegramApi(runtime.botToken, "sendMessage", {
                chat_id: chatId,
                text: "Ссылка привязки недействительна или устарела. Создайте новую ссылку в Cloudy English.",
              });
            } else {
              await telegramApi(runtime.botToken, "sendMessage", {
                chat_id: chatId,
                text: "Telegram успешно связан с вашим аккаунтом Cloudy English. Вернитесь в приложение.",
              });
            }
            await markProcessed();
            return Response.json({ ok: true });
          }

          const payment = message['successful_payment'];
          if (payment && fromId) {
            if (!payment['invoice_payload'] || payment['currency'] !== "XTR" ||
                !payment.telegram_payment_charge_id || !Number.isSafeInteger(payment['total_amount'])) {
              throw new Error("Telegram sent an incomplete Stars payment update.");
            }
            const expiresAt = typeof payment['subscription']_expiration_date === "number"
              ? new Date(payment['subscription']_expiration_date * 1000).toISOString()
              : null;
            const { error } = await admin.rpc("apply_telegram_stars_payment", {
              p_invoice_payload: payment['invoice_payload'],
              p_telegram_user_id: fromId,
              p_telegram_payment_charge_id: payment.telegram_payment_charge_id,
              p_provider_payment_charge_id: payment.provider_payment_charge_id ?? null,
              p_amount_stars: payment['total_amount'],
              p_currency: payment['currency'],
              p_subscription_expires_at: expiresAt,
              p_payment_metadata: {
                is_recurring: payment.is_recurring === true,
                is_first_recurring: payment.is_first_recurring === true,
                telegram_update_id: updateId,
              },
            });
            if (error) throw error;
            await markProcessed();
            await telegramApi(runtime.botToken, "sendMessage", {
              chat_id: chatId ?? fromId,
              text: "Оплата подтверждена. Доступ Cloudy English активирован.",
            });
            return Response.json({ ok: true });
          }

          const refund = message['refunded_payment'];
          if (refund?.telegram_payment_charge_id) {
            const { data: paymentRow, error: paymentError } = await admin
              ['from']("subscription_payments")
              .select("id,subscription_id")
              .eq("provider", "telegram_stars")
              .eq("provider_payment_id", refund.telegram_payment_charge_id)
              .maybeSingle();
            if (paymentError) throw paymentError;
            if (paymentRow) {
              await admin['from']("subscription_payments")
                .update({ status: "refunded", refunded_at: new Date().toISOString() })
                .eq("id", paymentRow['id']);
              if (paymentRow['subscription']_id) {
                const { data: order } = await admin['from']("telegram_payment_orders")
                  .select("last_charge_id")
                  .eq("subscription_id", paymentRow['subscription']_id)
                  .maybeSingle();
                // Refunding an older installment must not revoke a subscription
                // that has already been renewed with a later successful payment.
                if (order?.last_charge_id === refund.telegram_payment_charge_id) {
                  const now = new Date().toISOString();
                  await admin['from']("subscriptions")
                    .update({ status: "canceled", canceled_at: now, ended_at: now, updated_at: now })
                    .eq("id", paymentRow['subscription']_id);
                }
              }
            }
            await markProcessed();
            return Response.json({ ok: true });
          }

          // IMPORTANT: Do not point the existing support bot webhook here until its
          // current command/support handler is merged or forwards updates to this route.
          // This route currently handles only Stars linking and payment updates.
          await markProcessed();
          return Response.json({ ok: true, ignored: true });
        } catch (error) {
          const message = error instanceof Error ? error['message'] : "Telegram webhook processing failed.";
          return Response.json({ ok: false, error: message.slice(0, 300) }, { status: 400 });
        }
      },
    },
  },
});
