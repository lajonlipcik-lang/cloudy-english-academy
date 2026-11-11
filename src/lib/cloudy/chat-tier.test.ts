import { describe, expect, it } from "vitest";
import {
  CLOUDY_CHAT_TIER_CONFIG,
  getCloudyChatTierConfig,
  limitCloudyChatHistory,
  formatGroqRateLimitMessage,
  getGroqRateLimitRetryMs,
  selectAvailableAiChatProviders,
} from "./chat-tier";

describe("Cloudy chat tiers and provider routing", () => {
  it("pins Lite to the smaller Groq model and lower output budget", () => {
    const lite = getCloudyChatTierConfig("lite");
    expect(lite.model).toBe("openai/gpt-oss-20b");
    expect(lite.maxOutputTokens).toBeLessThan(CLOUDY_CHAT_TIER_CONFIG.teacher.maxOutputTokens);
    expect(lite.systemInstruction).toContain("Do not intentionally make mistakes");
  });

  it("gives Teacher the stronger Groq model and expanded output budget", () => {
    const teacher = getCloudyChatTierConfig("teacher");
    expect(teacher.model).toBe("openai/gpt-oss-120b");
    expect(teacher.maxOutputTokens).toBeGreaterThan(CLOUDY_CHAT_TIER_CONFIG.lite.maxOutputTokens);
  });

  it("does not derive chat models from provider-saved model values", () => {
    expect(getCloudyChatTierConfig("lite").model).not.toBe("openai/gpt-oss-120b");
    expect(getCloudyChatTierConfig("teacher").model).not.toBe("openai/gpt-oss-20b");
  });

  it("limits Lite history more aggressively than Teacher history", () => {
    const messages = Array.from({ length: 90 }, (_, index) => ({
      role: "user",
      content: String(index).padEnd(1500, "x"),
    }));
    const lite = limitCloudyChatHistory(messages, "lite");
    const teacher = limitCloudyChatHistory(messages, "teacher");
    expect(lite).toHaveLength(12);
    expect(lite[0]!.content.startsWith("78")).toBe(true);
    expect(lite[0]!.content).toHaveLength(600);
    expect(teacher).toHaveLength(80);
    expect(teacher[0]!.content.startsWith("10")).toBe(true);
    expect(teacher[0]!.content).toHaveLength(1200);
  });

  it("routes across enabled Groq, OpenAI and OpenRouter providers outside cooldown", () => {
    const rows = [
      { id: "openai", provider: "openai", enabled: true, priority: 0 },
      { id: "openrouter", provider: "openrouter", enabled: true, priority: 6 },
      { id: "gemini", provider: "gemini", enabled: true, priority: 7 },
      { id: "disabled", provider: "groq", enabled: false, priority: 1 },
      { id: "cooling", provider: "groq", enabled: true, priority: 2, cooldown_until: "2026-11-11T03:00:00.000Z" },
      { id: "groq-2", provider: "groq", enabled: true, priority: 5 },
      { id: "groq-1", provider: "groq", enabled: true, priority: 3 },
    ];
    const selected = selectAvailableAiChatProviders(rows, Date.parse("2026-11-11T02:00:00.000Z"));
    expect(selected.map((row) => row.id)).toEqual(["openai", "groq-1", "groq-2", "openrouter"]);
  });

  it("makes a key available again when its cooldown has expired", () => {
    const rows = [
      { id: "groq", provider: "groq", enabled: true, priority: 1, cooldown_until: "2026-11-11T01:00:00.000Z" },
    ];
    expect(selectAvailableAiChatProviders(rows, Date.parse("2026-11-11T02:00:00.000Z"))).toHaveLength(1);
  });
});

describe("Groq rate-limit messaging", () => {
  it("normalizes Retry-After and caps the client cooldown", () => {
    expect(getGroqRateLimitRetryMs(5_000)).toBe(5_000);
    expect(getGroqRateLimitRetryMs(0)).toBe(60_000);
    expect(getGroqRateLimitRetryMs(2_000_000)).toBe(15 * 60_000);
  });

  it("shows an actionable limit message with a rounded-up wait", () => {
    expect(formatGroqRateLimitMessage(1_001)).toContain("через 2 сек.");
    expect(formatGroqRateLimitMessage(60_000)).toContain("Вы превысили лимит");
  });
});
