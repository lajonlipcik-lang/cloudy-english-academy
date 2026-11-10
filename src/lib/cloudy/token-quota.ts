export type CloudyTokenMessage = { role?: unknown; content?: unknown };

export const CLOUDY_DEFAULT_DAILY_TOKEN_LIMIT = 30_000;
export const CLOUDY_QUOTA_WARNING_RATIO = 0.8;
export const CLOUDY_MESSAGE_FRAMING_TOKENS = 16;
export const CLOUDY_MAX_OUTPUT_RESERVE = 2000;

/**
 * Lightweight preflight estimate, not a provider tokenizer.
 * ASCII text is estimated at roughly one token per three characters;
 * non-ASCII code points are counted individually. This intentionally avoids
 * charging Cyrillic by raw UTF-8 bytes. Provider usage remains authoritative
 * for settlement whenever the API returns it.
 */
export function estimateCloudyTextTokens(text: string): number {
  let ascii = 0;
  let other = 0;
  for (const ch of text) {
    if ((ch.codePointAt(0) ?? 0) < 128) ascii += 1;
    else other += 1;
  }
  return Math.ceil(ascii / 3) + other;
}

function messageTokens(message: CloudyTokenMessage): number {
  return estimateCloudyTextTokens(String(message.content ?? "")) + CLOUDY_MESSAGE_FRAMING_TOKENS;
}

export function clampCloudyOutputReserve(maxOutputTokens: number): number {
  return Math.max(1, Math.min(CLOUDY_MAX_OUTPUT_RESERVE, Math.ceil(Number(maxOutputTokens) || 1)));
}

export function estimateCloudyTokenReservation(
  messages: CloudyTokenMessage[],
  maxOutputTokens: number,
): number {
  const input = messages.reduce((sum, message) => sum + messageTokens(message), 0);
  return Math.max(1, input + clampCloudyOutputReserve(maxOutputTokens));
}

/**
 * Keep system instructions and the newest contiguous history that fits the
 * per-request budget. The current user message is never silently discarded.
 * If system instructions + the current message cannot fit, fail explicitly
 * instead of sending a request that SQL will reject as an exhausted quota.
 */
export function trimMessagesToReservation<T extends CloudyTokenMessage>(
  messages: T[],
  maxOutputTokens: number,
  maxReservation: number,
): T[] {
  const budget = maxReservation - clampCloudyOutputReserve(maxOutputTokens);
  const system = messages.filter((message) => message.role === "system");
  const rest = messages.filter((message) => message.role !== "system");
  const systemCost = system.reduce((sum, message) => sum + messageTokens(message), 0);
  if (budget < 0 || systemCost > budget) {
    throw new Error("Системный контекст Cloudy слишком велик для одного запроса. Попробуйте позже.");
  }

  let used = systemCost;
  const kept: T[] = [];
  for (let index = rest.length - 1; index >= 0; index -= 1) {
    const message = rest[index];
    if (!message) continue;
    const cost = messageTokens(message);
    if (kept.length > 0 && used + cost > budget) break;
    if (kept.length === 0 && used + cost > budget) {
      throw new Error("Последнее сообщение слишком длинное для одного запроса. Сократите его и попробуйте снова.");
    }
    used += cost;
    kept.unshift(message);
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
