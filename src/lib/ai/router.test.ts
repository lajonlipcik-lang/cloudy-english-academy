import { afterEach, describe, expect, it } from "vitest";
import {
  AiProvidersUnavailableError,
  resetAiRouterState,
  runWithAiFallback,
} from "./router";

afterEach(() => resetAiRouterState());

describe("AI provider router", () => {
  it("tries providers by priority and returns the first successful result", async () => {
    const tried: string[] = [];
    const result = await runWithAiFallback(
      [{ id: "openai", priority: 20 }, { id: "groq", priority: 1 }],
      async (provider) => {
        tried.push(provider.id);
        return provider.id;
      },
    );
    expect(tried).toEqual(["groq"]);
    expect(result).toEqual({ value: "groq", providerId: "groq" });
  });

  it("falls back after a provider error", async () => {
    const tried: string[] = [];
    const result = await runWithAiFallback(
      [{ id: "groq", priority: 1 }, { id: "openrouter", priority: 2 }],
      async (provider) => {
        tried.push(provider.id);
        if (provider.id === "groq") {
          const error = new Error("rate limited") as Error & { status: number };
          error.status = 429;
          throw error;
        }
        return "ok";
      },
    );
    expect(tried).toEqual(["groq", "openrouter"]);
    expect(result.value).toBe("ok");
  });

  it("skips a provider during its cooldown on the next request", async () => {
    await expect(runWithAiFallback(
      [{ id: "groq", priority: 1 }],
      async () => {
        const error = new Error("rate limited") as Error & { status: number };
        error.status = 429;
        throw error;
      },
      1_000,
    )).rejects.toBeInstanceOf(AiProvidersUnavailableError);

    const second: string[] = [];
    const result = await runWithAiFallback(
      [{ id: "groq", priority: 1 }, { id: "openai", priority: 2 }],
      async (provider) => {
        second.push(provider.id);
        return "available";
      },
      1_001,
    );
    expect(second).toEqual(["openai"]);
    expect(result.value).toBe("available");
  });

  it("fails with a safe generic error when no providers are configured", async () => {
    await expect(runWithAiFallback([], async () => "never")).rejects.toThrow(
      "Все AI-провайдеры временно недоступны.",
    );
  });
});
