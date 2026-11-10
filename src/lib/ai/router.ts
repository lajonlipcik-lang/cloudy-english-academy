export type AiProviderCandidate = {
  id: string;
  priority?: number;
};

type CooldownEntry = { until: number; failures: number };

const cooldowns = new Map<string, CooldownEntry>();
const DEFAULT_COOLDOWN_MS = 15_000;

function statusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function cooldownFor(error: unknown, failures: number): number {
  const retryAfterMs = (error as { retryAfterMs?: unknown } | null)?.retryAfterMs;
  if (typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs)) {
    return Math.max(1_000, Math.min(15 * 60_000, retryAfterMs));
  }
  const status = statusOf(error);
  if (status === 401 || status === 403) return 60_000;
  if (status === 429) return 60_000;
  if (status === 408 || status === 409 || status === 425 || (status !== undefined && status >= 500)) {
    return Math.min(60_000, DEFAULT_COOLDOWN_MS * failures);
  }
  if (error instanceof Error && /timeout|network|fetch failed|socket|econn/i.test(error.message)) {
    return Math.min(60_000, DEFAULT_COOLDOWN_MS * failures);
  }
  return 0;
}

export class AiProvidersUnavailableError extends Error {
  constructor(readonly lastError?: unknown) {
    const status = statusOf(lastError);
    const detail = status ? ` (HTTP ${status})` : "";
    super(`Все AI-провайдеры временно недоступны${detail}.`);
    this.name = "AiProvidersUnavailableError";
  }
}

/**
 * Runs providers by priority, falls back on failures and temporarily cools down
 * providers that are rate-limited, misconfigured or unavailable.
 *
 * Cooldowns are intentionally process-local: they are an availability hint,
 * not a security or billing control. Every request still checks credentials.
 */
export async function runWithAiFallback<T>(
  providers: AiProviderCandidate[],
  execute: (provider: AiProviderCandidate) => Promise<T>,
  now = Date.now(),
): Promise<{ value: T; providerId: string }> {
  const ordered = [...providers].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  if (ordered.length === 0) throw new AiProvidersUnavailableError();

  const ready = ordered.filter((provider) => (cooldowns.get(provider.id)?.until ?? 0) <= now);
  // Never probe a provider before its cooldown expires.
  if (ready.length === 0) throw new AiProvidersUnavailableError();
  const candidates = ready;

  let lastError: unknown;
  for (const provider of candidates) {
    try {
      const value = await execute(provider);
      cooldowns.delete(provider.id);
      return { value, providerId: provider.id };
    } catch (error) {
      lastError = error;
      const failures = (cooldowns.get(provider.id)?.failures ?? 0) + 1;
      const delay = cooldownFor(error, failures);
      if (delay > 0) cooldowns.set(provider.id, { until: now + delay, failures });
      else cooldowns.delete(provider.id);
    }
  }

  throw new AiProvidersUnavailableError(lastError);
}

/** Test-only reset; does not expose or alter provider credentials. */
export function resetAiRouterState(): void {
  cooldowns.clear();
}
