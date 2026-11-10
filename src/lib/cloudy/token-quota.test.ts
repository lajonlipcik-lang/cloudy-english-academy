import { describe, expect, it } from "vitest";
import { estimateCloudyTokenReservation, normalizeCloudyTokenQuota } from "./token-quota";

describe("Cloudy daily token quota helpers", () => {
  it("reserves for the complete system prompt, history, and output budget", () => {
    const messages = [
      { role: "system", content: "x".repeat(3000) },
      { role: "user", content: "hello" },
      { role: "assistant", content: "world" },
    ];
    expect(estimateCloudyTokenReservation(messages, 350)).toBe(
      3010 + 3 * 16 + 350,
    );
  });

  it("counts UTF-8 bytes rather than assuming every language uses four characters per token", () => {
    const messages = [{ content: "Привет, Cloudy!" }];
    expect(estimateCloudyTokenReservation(messages, 100)).toBe(
      new TextEncoder().encode("Привет, Cloudy!").length + 16 + 100,
    );
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

  it("uses safe defaults for a missing quota snapshot", () => {
    expect(normalizeCloudyTokenQuota(null)).toEqual({
      limit_tokens: 30000,
      used_tokens: 0,
      reserved_tokens: 0,
      remaining_tokens: 0,
      resets_at: null,
    });
  });
});

  
  it("adds framing overhead for every message and never under-reserves UTF-8 bytes", () => {
    const messages = [
      { role: "system", content: "инструкция" },
      { role: "user", content: "hello" },
    ];
    const bytes = new TextEncoder().encode("инструкция").length + new TextEncoder().encode("hello").length;
    expect(estimateCloudyTokenReservation(messages, 200)).toBe(bytes + 2 * 16 + 200);
  });
