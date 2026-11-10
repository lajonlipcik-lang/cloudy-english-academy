import { encodeChat } from "gpt-tokenizer";

export type CloudyTokenMessage = { role?: unknown; content?: unknown };

export const CLOUDY_DEFAULT_DAILY_TOKEN_LIMIT = 30_000;
export const CLOUDY_QUOTA_WARNING_RATIO = 0.8;
export const CLOUDY_MAX_OUTPUT_RESERVE = 2000;
export const CLOUDY_LITE_TOKENIZER_MODEL = "gpt-oss-20b" as const;

const tokenizerOptions = { disallowedSpecial: new Set<string>() };

/**
 * Count the complete GPT-OSS 20B chat payload using its o200k_harmony tokenizer.
 * This is a model-specific local preflight count. Groq's returned usage remains
 * authoritative for final accounting because its server-side request wrapper
 * may add provider-specific tokens.
 */
export function countCloudyChatTokens(messages: CloudyTokenMessage[]): number {
  if (messages.length === 0) return 0;
  const normalized = messages.map((message) => ({
    role: String(message.role ?? "user"),
    content: typeof message.content === "string" ? message.content : String(message.content ?? ""),
  }));
  return encodeChat(normalized as never, CLOUDY_LITE_TOKENIZER_MODEL, tokenizerOptions).length;
}

export function clampCloudyOutputReserve(maxOutputTokens: number): number {
  return Math.max(1, Math.min(CLOUDY_MAX_OUTPUT_RESERVE, Math.ceil(Number(maxOutputTokens) || 1)));
}

export function estimateCloudyTokenReservation(
  messages: CloudyTokenMessage[],
  maxOutputTokens: number,
): number {
  const input = countCloudyChatTokens(messages);
  return Math.max(1, input + clampCloudyOutputReserve(maxOutputTokens));
}

/**
 * Keep system instructions and the newest contiguous history that fits the
 * per-request budget. Count the whole candidate chat each time: BPE token
 * counts are not safely additive across message boundaries.
 */
export function trimMessagesToReservation<T extends CloudyTokenMessage>(
  messages: T[],
  maxOutputTokens: number,
  maxReservation: number,
): T[] {
  const budget = maxReservation - clampCloudyOutputReserve(maxOutputTokens);
  const system = messages.filter((message) => message.role === "system");
  const rest = messages.filter((message) => message.role !== "system");
  if (budget < 0 || countCloudyChatTokens(system) > budget) {
    throw new Error("Системный контекст Cloudy слишком велик для одного запроса. Попробуйте позже.");
  }

  let kept: T[] = [];
  for (let index = rest.length - 1; index >= 0; index -= 1) {
    const message = rest[index];
    if (!message) continue;
    const candidate = [message, ...kept];
    if (countCloudyChatTokens([...system, ...candidate]) > budget) {
      if (kept.length === 0) {
        throw new Error("Последнее сообщение слишком длинное для одного запроса. Сократите его и попробуйте снова.");
      }
      break;
    }
    kept = candidate;
  }

  const keepSet = new Set<T>([...system, ...kept]);
  return messages.filter((message) => keepSet.has(message));
}

export type CloudyQuotaSnapshot = {
  limit_tokens: number;
  used_tokens: number;
  reserved_tokens: number;
  remaining_tokens: number;
  resets_at: string | null;
};

export function normalizeCloudyTokenQuota(
  value: unknown,
  defaultLimit = CLOUDY_DEFAULT_DAILY_TOKEN_LIMIT,
): CloudyQuotaSnapshot {
  const quota = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const limit = Math.max(1, Number(quota["limit_tokens"]) || defaultLimit);
  const used = Math.max(0, Number(quota["used_tokens"]) || 0);
  const reserved = Math.max(0, Number(quota["reserved_tokens"]) || 0);
  const fallbackRemaining = Math.max(0, limit - used - reserved);
  const hasSnapshot = value !== null && typeof value === "object";
  const reportedRemaining = Number(quota["remaining_tokens"]);
  return {
    limit_tokens: limit,
    used_tokens: used,
    reserved_tokens: reserved,
    remaining_tokens: !hasSnapshot
      ? 0
      : Number.isFinite(reportedRemaining)
        ? Math.max(0, Math.min(limit, reportedRemaining))
        : fallbackRemaining,
    resets_at: typeof quota["resets_at"] === "string" ? quota["resets_at"] : null,
  };
}

export function isCloudyQuotaWarning(snapshot: unknown): boolean {
  const quota = normalizeCloudyTokenQuota(snapshot);
  return quota.used_tokens + quota.reserved_tokens >= Math.ceil(quota.limit_tokens * CLOUDY_QUOTA_WARNING_RATIO);
}

/** "через 5 ч 12 мин" / "через 7 мин" / "менее чем через минуту" */
export function formatCloudyResetDelay(seconds: number): string {
  const safeSeconds = Math.max(1, Math.ceil(Number(seconds) || 1));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.ceil((safeSeconds % 3600) / 60);
  if (hours >= 1) return minutes === 60 ? `через ${hours + 1} ч` : `через ${hours} ч${minutes ? ` ${minutes} мин` : ""}`;
  if (safeSeconds < 60) return "менее чем через минуту";
  return `через ${minutes} мин`;
}

export function cloudyQuotaDeniedMessage(
  reservation: { reason?: unknown; resets_at?: unknown } | null | undefined,
  now = Date.now(),
): string {
  if (reservation?.reason === "invalid_estimate") {
    return "Сообщение или история слишком длинные для одного запроса. Сократите сообщение или начните новый диалог.";
  }
  const resetAt = Date.parse(String(reservation?.resets_at ?? ""));
  const seconds = Number.isFinite(resetAt) ? Math.max(1, Math.ceil((resetAt - now) / 1000)) : 86_400;
  return `Дневной лимит бесплатного Cloudy Lite исчерпан. Лимит обновится ${formatCloudyResetDelay(seconds)}.`;
}
