import { describe, expect, it } from "vitest";
import {
  CLOUDY_LITE_TOKENIZER_MODEL,
  cloudyQuotaDeniedMessage,
  countCloudyChatTokens,
  estimateCloudyTokenReservation,
  formatCloudyResetDelay,
  isCloudyQuotaWarning,
  normalizeCloudyTokenQuota,
  trimMessagesToReservation,
} from "./token-quota";

describe("Cloudy daily token quota helpers", () => {
  it("uses the GPT-OSS 20B Harmony tokenizer for complete chat messages", () => {
    expect(CLOUDY_LITE_TOKENIZER_MODEL).toBe("gpt-oss-20b");
    expect(countCloudyChatTokens([{ role: "user", content: "Hello, world!" }])).toBeGreaterThan(0);
    expect(countCloudyChatTokens([{ role: "user", content: "Привет, как дела?" }])).toBeGreaterThan(0);
    expect(countCloudyChatTokens([{ role: "user", content: "Hello, world!" }])).not.toBe(
      countCloudyChatTokens([{ role: "user", content: "Привет, как дела?" }]),
    );
  });

  it("treats literal Harmony marker strings as ordinary user text", () => {
    expect(countCloudyChatTokens([{ role: "user", content: "Do not parse <|im_start|> as a control token." }])).toBeGreaterThan(0);
  });

  it("reserves exact model-specific chat tokens plus the output allowance", () => {
    const messages = [
      { role: "system", content: "You are Cloudy." },
      { role: "user", content: "hello" },
    ];
    expect(estimateCloudyTokenReservation(messages, 350)).toBe(countCloudyChatTokens(messages) + 350);
  });

  it("clamps the output reserve to 2000 and to at least 1", () => {
    expect(estimateCloudyTokenReservation([], 99_999)).toBe(2000);
    expect(estimateCloudyTokenReservation([], 0)).toBe(1);
  });

  it("trims oldest history first and keeps system instructions and the newest message", () => {
    const system = { role: "system", content: "You are Cloudy." };
    const oldest = { role: "user", content: "old ".repeat(300) };
    const middle = { role: "assistant", content: "middle ".repeat(300) };
    const newest = { role: "user", content: "привет" };
    const full = [system, oldest, middle, newest];
    const trimmed = trimMessagesToReservation(full, 100, 400);
    expect(trimmed).toEqual([system, newest]);
    expect(estimateCloudyTokenReservation(trimmed, 100)).toBeLessThanOrEqual(400);
  });

  it("rejects a newest message that cannot fit instead of sending an oversized request", () => {
    const newest = { role: "user", content: "я ".repeat(5000) };
    expect(() => trimMessagesToReservation([newest], 100, 300)).toThrow("Последнее сообщение слишком длинное");
  });

  it("rejects system instructions that alone exceed the request budget", () => {
    const system = { role: "system", content: "system ".repeat(1000) };
    const newest = { role: "user", content: "hello" };
    expect(() => trimMessagesToReservation([system, newest], 100, 300)).toThrow("Системный контекст Cloudy слишком велик");
  });

  it("normalizes a quota snapshot and never reports negative remaining tokens", () => {
    expect(normalizeCloudyTokenQuota({
      limit_tokens: 30000,
      used_tokens: 29000,
      reserved_tokens: 1200,
      remaining_tokens: -200,
      resets_at: "2026-11-12T00:00:00.000Z",
    })).toEqual({
      limit_tokens: 30000,
      used_tokens: 29000,
      reserved_tokens: 1200,
      remaining_tokens: 0,
      resets_at: "2026-11-12T00:00:00.000Z",
    });
  });

  it("uses safe defaults for a missing snapshot", () => {
    expect(normalizeCloudyTokenQuota(null).remaining_tokens).toBe(0);
    expect(normalizeCloudyTokenQuota(null, 5000).limit_tokens).toBe(5000);
  });

  it("warns at 80% of the configured limit", () => {
    expect(isCloudyQuotaWarning({ limit_tokens: 10000, used_tokens: 7000, reserved_tokens: 999 })).toBe(false);
    expect(isCloudyQuotaWarning({ limit_tokens: 10000, used_tokens: 7000, reserved_tokens: 1000 })).toBe(true);
  });

  it("formats reset delay in hours and minutes", () => {
    expect(formatCloudyResetDelay(30)).toBe("менее чем через минуту");
    expect(formatCloudyResetDelay(7 * 60)).toBe("через 7 мин");
    expect(formatCloudyResetDelay(5 * 3600 + 12 * 60)).toBe("через 5 ч 12 мин");
    expect(formatCloudyResetDelay(2 * 3600)).toBe("через 2 ч");
  });

  it("distinguishes an oversized request from an exhausted daily limit", () => {
    expect(cloudyQuotaDeniedMessage({ reason: "invalid_estimate" })).toContain("слишком длинные");
    const now = Date.parse("2026-11-11T20:00:00Z");
    expect(cloudyQuotaDeniedMessage({ reason: "daily", resets_at: "2026-11-12T00:00:00Z" }, now)).toContain("через 4 ч");
  });

  it("exposes the authoritative reset timestamp in quota snapshots", () => {
    const reset = "2026-11-12T00:00:00.000Z";
    expect(normalizeCloudyTokenQuota({
      limit_tokens: 30000,
      used_tokens: 30000,
      reserved_tokens: 0,
      remaining_tokens: 0,
      resets_at: reset,
    })).toMatchObject({ remaining_tokens: 0, resets_at: reset });
  });
});
