import { describe, expect, it } from "vitest";
import {
  CLOUDY_CHAT_TIER_CONFIG,
  getCloudyChatTierConfig,
  limitCloudyChatHistory,
  selectAvailableGroqChatProviders,
} from "./chat-tier";

describe("Cloudy Groq chat tiers", () => {
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

  it("routes chat only through enabled Groq keys outside cooldown", () => {
    const rows = [
      { id: "openai", provider: "openai", enabled: true, priority: 0 },
      { id: "disabled", provider: "groq", enabled: false, priority: 1 },
      { id: "cooling", provider: "groq", enabled: true, priority: 2, cooldown_until: "2026-11-11T03:00:00.000Z" },
      { id: "groq-2", provider: "groq", enabled: true, priority: 5 },
      { id: "groq-1", provider: "groq", enabled: true, priority: 3 },
    ];
    const selected = selectAvailableGroqChatProviders(rows, Date.parse("2026-11-11T02:00:00.000Z"));
    expect(selected.map((row) => row.id)).toEqual(["groq-1", "groq-2"]);
  });

  it("makes a key available again when its cooldown has expired", () => {
    const rows = [
      { id: "groq", provider: "groq", enabled: true, priority: 1, cooldown_until: "2026-11-11T01:00:00.000Z" },
    ];
    expect(selectAvailableGroqChatProviders(rows, Date.parse("2026-11-11T02:00:00.000Z"))).toHaveLength(1);
  });
});
