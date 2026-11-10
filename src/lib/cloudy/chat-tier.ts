export type CloudyChatTier = "lite" | "teacher";

export const CLOUDY_CHAT_TIER_CONFIG = {
  lite: {
    model: "openai/gpt-oss-20b",
    maxOutputTokens: 350,
    historyLimit: 12,
    historyMessageChars: 600,
    learnerSkillLimit: 5,
    recentEventLimit: 3,
    systemInstruction: [
      "CLOUDY LITE MODE: Give accurate, concise teaching support.",
      "Answer the learner's direct question first. Explain the main point in simple Russian and normally give one short English example with translation.",
      "Focus on the current question instead of producing exhaustive analysis, long lesson plans, or several alternative explanations unless they are needed for correctness or safety.",
      "Do not intentionally make mistakes, omit a correction, or lower factual accuracy. Keep all safety, privacy, and age-appropriate teaching rules unchanged.",
    ].join("\n"),
  },
  teacher: {
    model: "openai/gpt-oss-120b",
    maxOutputTokens: 1000,
    historyLimit: 80,
    historyMessageChars: 1200,
    learnerSkillLimit: 20,
    recentEventLimit: 12,
    systemInstruction: [
      "CLOUDY TEACHER MODE: Provide deeper, personalized teaching.",
      "Explain why an answer is correct or incorrect, identify likely misconceptions, connect explanations to the learner's weak or due skills, and use up to two useful examples when appropriate.",
      "Use relevant conversation history and learner evidence to adapt explanations. Offer a focused next practice step when it genuinely helps.",
      "Keep all safety, privacy, and age-appropriate teaching rules unchanged. Never invent learner evidence.",
    ].join("\n"),
  },
} as const;

export function getCloudyChatTierConfig(tier: CloudyChatTier) {
  return CLOUDY_CHAT_TIER_CONFIG[tier];
}

export function limitCloudyChatHistory<T extends { role: string; content: string }>(
  messages: T[],
  tier: CloudyChatTier,
): T[] {
  const config = getCloudyChatTierConfig(tier);
  return messages.slice(-config.historyLimit).map((message) => ({
    ...message,
    content: message.content.slice(0, config.historyMessageChars),
  }));
}

type GroqProviderRow = {
  id?: string;
  provider?: unknown;
  enabled?: unknown;
  priority?: unknown;
  cooldown_until?: unknown;
};

export function selectAvailableGroqChatProviders<T extends GroqProviderRow>(
  providers: T[],
  now = Date.now(),
): T[] {
  return providers
    .filter((provider) => {
      if (provider.provider !== "groq" || !provider.enabled) return false;
      if (!provider.cooldown_until) return true;
      const cooldownUntil = Date.parse(String(provider.cooldown_until));
      return !Number.isFinite(cooldownUntil) || cooldownUntil <= now;
    })
    .sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));
}

/** Normalize provider Retry-After values to a bounded client cooldown. */
export function getGroqRateLimitRetryMs(value: unknown, fallback = 60_000): number {
  const parsed = Number(value);
  const candidate = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.max(1_000, Math.min(15 * 60_000, candidate));
}

export function formatGroqRateLimitMessage(retryAfterMs: number): string {
  const seconds = Math.max(1, Math.ceil(getGroqRateLimitRetryMs(retryAfterMs) / 1_000));
  return `Вы превысили лимит запросов к ИИ. Повторите попытку через ${seconds} сек.`;
}
