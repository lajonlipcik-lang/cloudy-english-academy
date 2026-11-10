export type CloudyTokenMessage = { content?: unknown };

export function estimateCloudyTokenReservation(
  messages: CloudyTokenMessage[],
  maxOutputTokens: number,
): number {
  const inputBytes = messages.reduce(
    (sum, message) => sum + new TextEncoder().encode(String(message.content ?? "")).length,
    0,
  );
  const outputReserve = Math.max(1, Math.min(2000, Math.ceil(Number(maxOutputTokens) || 1)));
  return Math.max(1, Math.ceil(inputBytes / 3) + outputReserve);
}

export function normalizeCloudyTokenQuota(value: unknown) {
  const quota = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const limit = Math.max(1, Number(quota.limit_tokens) || 30_000);
  const used = Math.max(0, Number(quota.used_tokens) || 0);
  const reserved = Math.max(0, Number(quota.reserved_tokens) || 0);
  return {
    limit_tokens: limit,
    used_tokens: used,
    reserved_tokens: reserved,
    remaining_tokens: Math.max(0, Math.min(limit, Number(quota.remaining_tokens) || 0)),
    resets_at: typeof quota.resets_at === "string" ? quota.resets_at : null,
  };
}
