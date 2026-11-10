import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AiProvidersUnavailableError, runWithAiFallback } from "@/lib/ai/router";

type Msg = { r: "u" | "a"; t: string };
type In = { level: string; history: Msg[] };

type VaultProvider = { id: string; provider: string; api_key: string | null; model: string | null; priority: number | null; enabled: boolean };

async function askVaultProvider(provider: VaultProvider, messages: Array<{ role: string; content: string }>) {
  const key = String(provider.api_key ?? "").trim();
  if (!key) throw new Error("AI provider key is missing.");
  const endpoints: Record<string, string> = {
    groq: "https://api.groq.com/openai/v1",
    openai: "https://api.openai.com/v1",
    openrouter: "https://openrouter.ai/api/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  };
  const base = endpoints[provider.provider];
  if (!base) throw new Error("Unsupported AI provider.");
  const model = String(provider.model ?? "").trim() ||
    (provider.provider === "groq" ? "openai/gpt-oss-120b" :
      provider.provider === "gemini" ? "gemini-2.5-flash" :
      provider.provider === "openrouter" ? "openrouter/auto" : "gpt-4o-mini");
  const response = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      ...(provider.provider === "openrouter" ? {
        "HTTP-Referer": "https://cloudy-english-quest.lovable.app",
        "X-Title": "Cloudy English Academy",
      } : {}),
    },
    body: JSON.stringify({ model, messages, temperature: 0.35, max_tokens: 700 }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    const error = new Error(provider.provider + " API: HTTP " + response.status) as Error & { status: number; retryAfterMs?: number };
    error.status = response.status;
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      const dateDelay = Date.parse(retryAfter) - Date.now();
      if (Number.isFinite(seconds)) error.retryAfterMs = seconds * 1000;
      else if (Number.isFinite(dateDelay)) error.retryAfterMs = Math.max(0, dateDelay);
    }
    throw error;
  }
  const data = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Пустой ответ AI.");
  return content.trim();
}

export type ChatResult = { ok: true; text: string } | { ok: false; error: "not_configured" | "credits" | "rate_limit" | "failed" };

export const claudyReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: In): In => {
    const level = ["A1", "A2", "B1", "B2"].includes(input?.level) ? input.level : "A1";
    const history = Array.isArray(input?.history)
      ? input.history.slice(-20).map((m) => ({ r: m?.r === "u" ? "u" : "a", t: String(m?.t ?? "").slice(0, 500) }) as Msg)
      : [];
    return { level, history };
  })
  .handler(async ({ data }): Promise<ChatResult> => {
    const sys =
      "Ты Клауди, дружелюбное облачко-учитель английского для русскоговорящего ученика уровня " + data.level +
      ". Говори по-английски простыми фразами этого уровня, коротко (1-3 предложения). Если ученик ошибся, мягко исправь и объясни по-русски в одну строку. Задавай один вопрос за раз. Без эмодзи и разметки.";
    const messages = [
      { role: "system", content: sys },
      ...data.history.map((m) => ({ role: m.r === "u" ? "user" : "assistant", content: m.t })),
      ...(data.history.length ? [] : [{ role: "user", content: "Начни разговор и задай один простой вопрос на английском." }]),
    ];
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      const { data: vaultRows, error: vaultError } = await db
        .from("ai_provider_secrets")
        .select("id,provider,api_key,model,priority,enabled,cooldown_until")
        .eq("enabled", true)
        .order("priority", { ascending: true });
      if (vaultError) throw vaultError;
      const configuredRows = (vaultRows ?? []).filter((row: any) =>
        ["groq", "openai", "openrouter", "gemini"].includes(String(row.provider)) && String(row.api_key ?? "").trim()
      );
      const now = Date.now();
      const readyRows = configuredRows.filter((row: any) => !row.cooldown_until || Date.parse(row.cooldown_until) <= now);
      const candidates = readyRows.map((row: any) => ({ id: String(row.id), priority: Number(row.priority) || 10 }));
      if (process.env["LOVABLE_API_KEY"]) candidates.push({ id: "lovable-gateway", priority: 10_000 });
      if (!candidates.length) return { ok: false, error: configuredRows.length ? "rate_limit" : "not_configured" };
      let groqOrganizationCoolingDown = false;
      const routed = await runWithAiFallback(candidates, async (candidate) => {
        if (candidate.id === "lovable-gateway") {
          const { generateResponse } = await import("@lovable.dev/ai-gateway");
          const historyText = data.history.map((m) => (m.r === "u" ? "Ученик: " : "Клауди: ") + m.t).join("\n");
          const response = await generateResponse({
            model: "openai/gpt-6-astra",
            instructions: sys,
            input: "Диалог:\n" + (historyText || "(пока пусто, начни разговор)") + "\n\nНапиши следующую реплику Клауди.",
          });
          const out = (response as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> }).output ?? [];
          return out.filter((o) => o.type === "message").flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("").trim();
        }
        const provider = readyRows.find((row: any) => String(row.id) === candidate.id);
        if (!provider) throw new Error("AI provider configuration changed.");
        if (String(provider.provider) === "groq" && groqOrganizationCoolingDown) {
          throw new Error("Groq organization is cooling down after HTTP 429.");
        }
        try {
          const answer = await askVaultProvider(provider as VaultProvider, messages);
          await db.from("ai_provider_secrets").update({
            cooldown_until: null, last_status: "ok", last_error_code: null,
          }).eq("id", provider.id);
          return answer;
        } catch (error) {
          const status = (error as { status?: number })?.status;
          const retryAfterMs = (error as { retryAfterMs?: number })?.retryAfterMs;
          const cooldownMs = typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs)
            ? Math.max(1_000, Math.min(15 * 60_000, retryAfterMs))
            : status === 429 ? 60_000
            : status === 401 || status === 403 ? 5 * 60_000
            : status === 408 || (typeof status === "number" && status >= 500) ? 15_000
            : error instanceof Error && /timeout|network|fetch failed|socket|econn/i.test(error.message) ? 15_000
            : 0;
          if (cooldownMs > 0) {
            const cooldownUntil = new Date(Date.now() + cooldownMs).toISOString();
            const update = {
              cooldown_until: cooldownUntil,
              last_status: status === 429 ? "rate_limited" : "cooldown",
              last_error_code: status ?? null,
            };
            if (String(provider.provider) === "groq" && status === 429) {
              // Groq limits are shared at the organization level: do not rotate
              // into another Groq key to bypass the same organization's 429.
              groqOrganizationCoolingDown = true;
              await db.from("ai_provider_secrets").update(update).eq("provider", "groq").eq("enabled", true);
            } else {
              await db.from("ai_provider_secrets").update(update).eq("id", provider.id);
            }
          }
          throw error;
        }
      });
      return routed.value ? { ok: true, text: routed.value } : { ok: false, error: "failed" };
    } catch (e) {
      const cause = e instanceof AiProvidersUnavailableError ? e.lastError : e;
      const name = (cause as { name?: string })?.name;
      console.error("claudy chat failed", name);
      if (name === "ConfigurationError" || name === "AuthenticationError") return { ok: false, error: "not_configured" };
      if (name === "PaymentRequiredError") return { ok: false, error: "credits" };
      const status = (cause as { status?: number })?.status;
      if (name === "RateLimitError" || status === 429) return { ok: false, error: "rate_limit" };
      if (status === 401 || status === 403) return { ok: false, error: "not_configured" };
      return { ok: false, error: "failed" };
    }
  });
