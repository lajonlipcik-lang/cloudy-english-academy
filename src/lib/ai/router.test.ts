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

  it("honors Retry-After and does not probe a sleeping provider", async () => {
    let calls = 0;
    await expect(runWithAiFallback(
      [{ id: "groq", priority: 1 }],
      async () => {
        calls += 1;
        const error = new Error("rate limited") as Error & { status: number; retryAfterMs: number };
        error.status = 429;
        error.retryAfterMs = 120_000;
        throw error;
      },
      1_000,
    )).rejects.toBeInstanceOf(AiProvidersUnavailableError);

    await expect(runWithAiFallback(
      [{ id: "groq", priority: 1 }],
      async () => { calls += 1; return "unexpected"; },
      120_999,
    )).rejects.toBeInstanceOf(AiProvidersUnavailableError);
    expect(calls).toBe(1);
  });

  it("fails with a safe generic error when no providers are configured", async () => {
    await expect(runWithAiFallback([], async () => "never")).rejects.toThrow(
      "Все AI-провайдеры временно недоступны.",
    );
  });
  it.each([401, 403, 429, 500, 503])("falls back to the next provider after HTTP %i", async (status) => {
    const tried: string[] = [];
    const result = await runWithAiFallback(
      [{ id: "groq", priority: 1 }, { id: "openai", priority: 2 }],
      async (provider) => {
        tried.push(provider.id);
        if (provider.id === "groq") {
          throw Object.assign(new Error("provider request failed"), { status });
        }
        return "backup response";
      },
    );
    expect(tried).toEqual(["groq", "openai"]);
    expect(result).toEqual({ value: "backup response", providerId: "openai" });
  });

  it("falls back after timeout and network errors", async () => {
    const tried: string[] = [];
    const result = await runWithAiFallback(
      [{ id: "groq", priority: 1 }, { id: "openrouter", priority: 2 }],
      async (provider) => {
        tried.push(provider.id);
        if (provider.id === "groq") throw new Error("The operation timed out");
        return "backup response";
      },
    );
    expect(tried).toEqual(["groq", "openrouter"]);
    expect(result.value).toBe("backup response");
  });

  it("returns a safe unavailable error only after every provider fails", async () => {
    const tried: string[] = [];
    await expect(runWithAiFallback(
      [{ id: "groq", priority: 1 }, { id: "openai", priority: 2 }],
      async (provider) => {
        tried.push(provider.id);
        throw Object.assign(new Error("private provider detail"), { status: 503 });
      },
    )).rejects.toBeInstanceOf(AiProvidersUnavailableError);
    expect(tried).toEqual(["groq", "openai"]);
  });

});
