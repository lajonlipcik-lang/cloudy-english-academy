import { describe, expect, it } from "vitest";
import {
  cloudyQuotaDeniedMessage,
  estimateCloudyTextTokens,
  estimateCloudyTokenReservation,
  formatCloudyResetDelay,
  isCloudyQuotaWarning,
  normalizeCloudyTokenQuota,
  trimMessagesToReservation,
} from "./token-quota";

describe("Cloudy daily token quota helpers", () => {
  it("uses a lightweight estimate for ASCII and non-ASCII text", () => {
    expect(estimateCloudyTextTokens("abcdef")).toBe(2);
    expect(estimateCloudyTextTokens("Привет")).toBe(6);
    expect(estimateCloudyTextTokens("")).toBe(0);
  });

  it("does not charge Cyrillic by its full UTF-8 byte length", () => {
    const text = "Привет, как дела?".repeat(50);
    const bytes = new TextEncoder().encode(text).length;
    expect(estimateCloudyTextTokens(text)).toBeLessThan(bytes);
    expect(estimateCloudyTextTokens(text)).toBeGreaterThanOrEqual(Math.ceil(text.length / 2));
  });

  it("reserves history, per-message framing, and output allowance", () => {
    const messages = [
      { role: "system", content: "x".repeat(3000) },
      { role: "user", content: "hello" },
    ];
    expect(estimateCloudyTokenReservation(messages, 350)).toBe(1000 + 2 + 16 + 16 + 350);
  });

  it("clamps the output reserve to 2000 and to at least 1", () => {
    expect(estimateCloudyTokenReservation([], 99_999)).toBe(2000);
    expect(estimateCloudyTokenReservation([], 0)).toBe(1);
  });

  it("trims oldest history first and keeps system instructions and the newest message", () => {
    const system = { role: "system", content: "s" };
    const oldest = { role: "user", content: "я".repeat(400) };
    const middle = { role: "assistant", content: "я".repeat(400) };
    const newest = { role: "user", content: "привет" };
    const trimmed = trimMessagesToReservation([system, oldest, middle, newest], 100, 600);
    expect(trimmed).toEqual([system, middle, newest]);
    expect(estimateCloudyTokenReservation(trimmed, 100)).toBeLessThanOrEqual(600);
  });

  it("rejects a newest message that cannot fit instead of sending an oversized request", () => {
    const newest = { role: "user", content: "я".repeat(5000) };
    expect(() => trimMessagesToReservation([newest], 100, 300)).toThrow("Последнее сообщение слишком длинное");
  });

  it("rejects system instructions that alone exceed the request budget", () => {
    const system = { role: "system", content: "x".repeat(1000) };
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
    expect(normalizeCloudyTokenQuota(null).remaining_tokens).toBe(30000);
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
});
