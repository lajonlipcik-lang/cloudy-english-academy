import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

type ChatMessage = { r: "u" | "a"; t: string };
type ChatThreadInput = { id: string; title: string; messages: ChatMessage[]; updatedAt?: number };
type ChatHistoryInput = { accessToken: string; accountId?: string; thread?: unknown; threadId?: string };

function validateToken(input: ChatHistoryInput) {
  const accessToken = String(input?.accessToken ?? "");
  if (!accessToken || accessToken.length > 8192 || accessToken.split(".").length !== 3) {
    throw new Error("Unauthorized");
  }
  const accountId = String(input?.accountId ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId)) {
    throw new Error("Некорректный идентификатор аккаунта.");
  }
  return { ...input, accessToken, accountId };
}

function validateThread(value: unknown): ChatThreadInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Некорректный диалог.");
  const raw = value as Record<string, unknown>;
  const id = String(raw["id"] ?? "");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error("Некорректный идентификатор диалога.");
  const title = String(raw["title"] ?? "Новый диалог").replace(/\s+/g, " ").trim().slice(0, 120) || "Новый диалог";
  if (!Array.isArray(raw["messages"]) || raw["messages"].length > 80) throw new Error("Некорректная история сообщений.");
  const messages = raw["messages"].map((entry): ChatMessage => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Некорректное сообщение.");
    const message = entry as Record<string, unknown>;
    if (message["r"] !== "u" && message["r"] !== "a") throw new Error("Некорректная роль сообщения.");
    if (typeof message["t"] !== "string" || message["t"].length > 8000) throw new Error("Сообщение слишком длинное.");
    return { r: message["r"], t: message["t"] };
  });
  if (JSON.stringify(messages).length > 700_000) throw new Error("История диалога слишком большая.");
  return { id, title, messages, updatedAt: Number(raw["updatedAt"]) || Date.now() };
}

async function getUserAndDb(token: string, expectedAccountId: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase server is not configured.");
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  if (data.user.id !== expectedAccountId) throw new Error("Account changed. Reload chat history.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { user: data.user, db: supabaseAdmin as any };
}

export const listCloudyChatHistory = createServerFn({ method: "POST" })
  .inputValidator(validateToken)
  .handler(async ({ data }) => {
    const { user, db } = await getUserAndDb(data.accessToken, data.accountId!);
    const { data: rows, error } = await db.from("cloudy_chat_threads")
      .select("thread_id,title,messages,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) throw new Error("Не удалось загрузить историю чатов.");
    return {
      chats: (rows ?? []).map((row: any) => ({
        id: String(row.thread_id),
        title: String(row.title || "Новый диалог"),
        messages: Array.isArray(row.messages) ? row.messages : [],
        updatedAt: Date.parse(row.updated_at) || Date.now(),
      })),
    };
  });

export const saveCloudyChatThread = createServerFn({ method: "POST" })
  .inputValidator(validateToken)
  .handler(async ({ data }) => {
    const thread = validateThread(data.thread);
    const { user, db } = await getUserAndDb(data.accessToken, data.accountId!);
    const { error } = await db.from("cloudy_chat_threads").upsert({
      user_id: user.id,
      thread_id: thread.id,
      title: thread.title,
      messages: thread.messages,
      updated_at: new Date(thread.updatedAt ?? Date.now()).toISOString(),
    }, { onConflict: "user_id,thread_id" });
    if (error) throw new Error("Не удалось сохранить диалог в аккаунте.");
    return { ok: true, id: thread.id };
  });

export const deleteCloudyChatThread = createServerFn({ method: "POST" })
  .inputValidator(validateToken)
  .handler(async ({ data }) => {
    const threadId = String(data.threadId ?? "");
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(threadId)) throw new Error("Некорректный идентификатор диалога.");
    const { user, db } = await getUserAndDb(data.accessToken);
    const { error } = await db.from("cloudy_chat_threads")
      .delete()
      .eq("user_id", user.id)
      .eq("thread_id", threadId);
    if (error) throw new Error("Не удалось удалить диалог из аккаунта.");
    return { ok: true, id: threadId };
  });
