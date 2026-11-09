import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_SKEW_SECONDS = 300;
const BOT_USERNAME = "cloudysupport_t_bot";
const json = (value: unknown, status = 200) => Response.json(value, { status });

function signature(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}
function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function signedResponse(value: unknown, status = 200) {
  const body = JSON.stringify(value);
  const secret = process.env["CLOUDY_PAYMENTS_SECRET"];
  if (!secret) return new Response("Payments unavailable", { status: 503 });
  const timestamp = String(Math.floor(Date.now() / 1000));
  return new Response(body, { status, headers: {
    "Content-Type": "application/json",
    "X-Cloudy-Timestamp": timestamp,
    "X-Cloudy-Signature": signature(secret, timestamp, body),
    "Cache-Control": "no-store",
  }});
}
async function signedBody(request: Request): Promise<any | null> {
  const secret = process.env["CLOUDY_PAYMENTS_SECRET"];
  if (!secret) return null;
  const timestamp = request.headers.get("X-Cloudy-Timestamp");
  const sig = request.headers.get("X-Cloudy-Signature");
  if (!timestamp || !sig || !/^\d{10}$/.test(timestamp)) return null;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > MAX_SKEW_SECONDS) return null;
  const raw = await request.text();
  if (!safeEqual(signature(secret, timestamp, raw), sig)) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function fail(status: number, message: string) { return signedResponse({ error: message }, status); }

export async function createTeacherCheckout(request: Request) {
  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return json({ error: "Требуется авторизация" }, 401);
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Сессия недействительна" }, 401);

  const { data: plan, error: planError } = await supabaseAdmin
    .from("subscription_plans").select("id,code,is_active,telegram_stars_amount")
    .eq("code", "cloudy_teacher").maybeSingle();
  if (planError) return json({ error: "Не удалось проверить тариф" }, 503);
  if (!plan?.is_active || !Number.isInteger(plan.telegram_stars_amount) ||
      plan.telegram_stars_amount < 1 || plan.telegram_stars_amount > 10000) {
    return json({ error: "Оплата Cloudy Teacher пока настраивается" }, 503);
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const { error: insertError } = await supabaseAdmin.from("telegram_payment_tokens").insert({
    user_id: auth.user.id, plan_id: plan.id, token_hash: tokenHash,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (insertError) return json({ error: "Не удалось создать ссылку оплаты" }, 503);
  return json({ url: `https://t.me/${BOT_USERNAME}?start=pay_${rawToken}`, expires_in: 600 });
}

export async function resolveStarsOrder(request: Request) {
  const body = await signedBody(request);
  if (!body) return fail(401, "Unauthorized");
  if (typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token) ||
      !Number.isSafeInteger(body.telegram_user_id) || body.telegram_user_id <= 0) return fail(400, "Invalid request");
  const tokenHash = createHash("sha256").update(body.token).digest("hex");
  const { data, error } = await supabaseAdmin.rpc("resolve_telegram_stars_order", {
    p_token_hash: tokenHash, p_telegram_user_id: body.telegram_user_id,
  });
  if (error) {
    const msg = error.message ?? "";
    const status = /invalid|expired|already used|no longer available/i.test(msg) ? 410 : 409;
    return fail(status, "Payment link cannot be used");
  }
  return signedResponse(data);
}

export async function precheckStarsOrder(request: Request) {
  const body = await signedBody(request);
  if (!body) return fail(401, "Unauthorized");
  if (typeof body.order_id !== "string" || !Number.isSafeInteger(body.telegram_user_id) ||
      !Number.isSafeInteger(body.total_amount) || body.currency !== "XTR") return fail(400, "Invalid request");
  const { data, error } = await supabaseAdmin.from("telegram_payment_orders")
    .select("telegram_user_id,amount_stars,status,expires_at")
    .eq("invoice_payload", body.order_id).maybeSingle();
  if (error) return fail(503, "Order lookup failed");
  const ok = !!data && Number(data.telegram_user_id) === body.telegram_user_id &&
    data.amount_stars === body.total_amount && data.status === "pending" &&
    new Date(data.expires_at).getTime() > Date.now();
  return signedResponse({ ok, reason: ok ? undefined : "order_mismatch" });
}

export async function handleStarsPaymentEvent(request: Request) {
  const body = await signedBody(request);
  if (!body) return fail(401, "Unauthorized");
  const required = ["event_id","type","order_id","telegram_payment_charge_id"];
  if (required.some((key) => typeof body[key] !== "string" || !body[key]) ||
      !Number.isSafeInteger(body.telegram_user_id) || !Number.isSafeInteger(body.total_amount) ||
      body.currency !== "XTR" || !["successful_payment","refunded_payment"].includes(body.type)) {
    return fail(400, "Invalid payment event");
  }
  if (body.type === "successful_payment") {
    const { data, error } = await supabaseAdmin.rpc("apply_telegram_stars_payment", {
      p_invoice_payload: body.order_id,
      p_telegram_user_id: body.telegram_user_id,
      p_telegram_payment_charge_id: body.telegram_payment_charge_id,
      p_provider_payment_charge_id: body.provider_payment_charge_id ?? null,
      p_amount_stars: body.total_amount,
      p_currency: body.currency,
      p_subscription_expires_at: body.subscription_expiration_date ?? null,
      p_payment_metadata: { event_id: body.event_id, is_recurring: !!body.is_recurring,
        is_first_recurring: !!body.is_first_recurring, occurred_at: body.occurred_at ?? null },
    });
    if (error) return fail(409, "Payment could not be applied");
    return signedResponse({ ok: true, subscription_id: data });
  }

  const { data, error } = await supabaseAdmin.rpc("refund_telegram_stars_payment", {
    p_invoice_payload: body.order_id,
    p_telegram_user_id: body.telegram_user_id,
    p_telegram_payment_charge_id: body.telegram_payment_charge_id,
    p_amount_stars: body.total_amount,
  });
  if (error) return fail(409, "Refund could not be applied");
  return signedResponse({ ok: true, refunded: true, subscription_id: data });
}
