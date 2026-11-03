import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Msg = { r: "u" | "a"; t: string };
type In = { level: string; history: Msg[] };

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
    if (!process.env["LOVABLE_API_KEY"]) return { ok: false, error: "not_configured" };
    const sys =
      "Ты Клауди, дружелюбное облачко-учитель английского для русскоговорящего ученика уровня " + data.level +
      ". Говори по-английски простыми фразами этого уровня, коротко (1-3 предложения). Если ученик ошибся, мягко исправь и объясни по-русски в одну строку. Задавай один вопрос за раз. Без эмодзи и разметки.";
    const tr = data.history.map((m) => (m.r === "u" ? "Ученик: " : "Клауди: ") + m.t).join("\n");
    try {
      const { generateResponse } = await import("@lovable.dev/ai-gateway");
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: sys,
        input: "Диалог:\n" + (tr || "(пока пусто, начни разговор)") + "\n\nНапиши следующую реплику Клауди.",
      });
      const out = (res as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> }).output ?? [];
      const text = out
        .filter((o) => o.type === "message")
        .flatMap((o) => o.content ?? [])
        .filter((c) => c.type === "output_text")
        .map((c) => c.text ?? "")
        .join("")
        .trim();
      return text ? { ok: true, text } : { ok: false, error: "failed" };
    } catch (e) {
      const name = (e as { name?: string })?.name;
      console.error("claudy chat failed", name);
      if (name === "ConfigurationError" || name === "AuthenticationError") return { ok: false, error: "not_configured" };
      if (name === "PaymentRequiredError") return { ok: false, error: "credits" };
      if (name === "RateLimitError") return { ok: false, error: "rate_limit" };
      return { ok: false, error: "failed" };
    }
  });
