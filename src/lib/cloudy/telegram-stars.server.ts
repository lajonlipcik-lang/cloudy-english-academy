import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;

export function readObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

export function getTelegramRuntime() {
  const url = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const secretKey = process.env["SUPABASE_SECRET_KEY"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const botToken = process.env["TELEGRAM_BOT_TOKEN"];
  const webhookSecret = process.env["TELEGRAM_WEBHOOK_SECRET"];
  const botUsername = (process.env["TELEGRAM_BOT_USERNAME"] ?? "cloudysupport_t_bot").replace(/^@/, "");
  if (!url || !publishableKey || !secretKey || !botToken || !webhookSecret) {
    throw new Error("Telegram Stars server environment is incomplete.");
  }
  return { url, publishableKey, secretKey, botToken, webhookSecret, botUsername };
}

export function createAdminClient(url: string, secretKey: string): SupabaseClient {
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function requireCloudyUser(request: Request) {
  const runtime = getTelegramRuntime();
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!accessToken || accessToken.length > 8192 || accessToken.split(".").length !== 3) {
    throw new Error("UNAUTHORIZED");
  }
  const client = createClient(runtime.url, runtime.publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("UNAUTHORIZED");
  return { runtime, userId: data.user.id };
}

export function randomToken(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function telegramApi<T = JsonRecord>(
  botToken: string,
  method: string,
  payload: JsonRecord,
): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = readObject(await response.json().catch(() => ({})));
  if (!response.ok || result.ok !== true) {
    throw new Error(`Telegram API request failed: ${method}`);
  }
  return result.result as T;
}
