import { describe, expect, it, vi } from "vitest";
import { handleSupportAi, LIMITS, type ProviderRow, type RelayDeps } from "./relay.server";

const SECRET = "test-secret-0123456789abcdef";
const KEY = "gsk_SUPER_SECRET_KEY_123";
const provider: ProviderRow = { provider: "groq", label: "Groq", model: "qwen/qwen3.8-27b", api_key: KEY, priority: 0 };

function req(body: unknown, token: string | null = SECRET, raw?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["authorization"] = `Bearer ${token}`;
  return new Request("http://localhost/api/internal/support-ai", {
    method: "POST", headers, body: raw ?? JSON.stringify(body),
  });
}
function deps(over: Partial<RelayDeps> = {}): RelayDeps {
  return {
    getSecret: () => SECRET,
    loadProvider: async () => provider,
    fetchImpl: vi.fn(async () => Response.json({ choices: [{ message: { content: "Привет! Чем помочь?" } }] })) as unknown as typeof fetch,
    ...over,
  };
}
const ok = { messages: [{ role: "user", content: "Как сменить уровень?" }] };

describe("support-ai relay", () => {
  it("returns 503 when secret missing", async () => {
    const r = await handleSupportAi(req(ok), deps({ getSecret: () => undefined }));
    expect(r.status).toBe(503);
  });
  it("rejects missing or wrong token", async () => {
    expect((await handleSupportAi(req(ok, null), deps())).status).toBe(401);
    expect((await handleSupportAi(req(ok, "wrong-secret-xxxxxxxxxx"), deps())).status).toBe(401);
  });
  it("rejects malformed JSON and bad shapes", async () => {
    expect((await handleSupportAi(req(null, SECRET, "{bad"), deps())).status).toBe(400);
    expect((await handleSupportAi(req({ messages: [{ role: "system", content: "x" }] }), deps())).status).toBe(400);
    expect((await handleSupportAi(req({ ...ok, tools: [] }), deps())).status).toBe(400);
  });
  it("rejects oversized payloads", async () => {
    const many = { messages: Array.from({ length: LIMITS.maxMessages + 1 }, () => ({ role: "user", content: "hi" })) };
    expect((await handleSupportAi(req(many), deps())).status).toBe(400);
    const long = { messages: [{ role: "user", content: "a".repeat(LIMITS.maxMessageChars + 1) }] };
    expect((await handleSupportAi(req(long), deps())).status).toBe(400);
    const huge = { messages: [{ role: "user", content: "a".repeat(LIMITS.maxBodyBytes + 10) }] };
    expect((await handleSupportAi(req(huge), deps())).status).toBe(413);
  });
  it("returns 503 when provider missing or disabled", async () => {
    expect((await handleSupportAi(req(ok), deps({ loadProvider: async () => null }))).status).toBe(503);
    expect((await handleSupportAi(req(ok), deps({ loadProvider: async () => { throw new Error("db"); } }))).status).toBe(503);
  });
  it("sanitizes upstream errors without leaking key", async () => {
    const fetchImpl = (async () => new Response(`bad key ${KEY}`, { status: 401 })) as unknown as typeof fetch;
    const r = await handleSupportAi(req(ok), deps({ fetchImpl }));
    expect(r.status).toBe(502);
    expect(await r.text()).not.toContain(KEY);
  });
  it("returns model reply on success and sends only allowed fields", async () => {
    const d = deps();
    const r = await handleSupportAi(req(ok), d);
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(JSON.parse(body)).toEqual({ reply: "Привет! Чем помочь?", model: "qwen/qwen3.8-27b" });
    expect(body).not.toContain(KEY);
    const [url, init] = (d.fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.model).toBe("qwen/qwen3.8-27b");
    expect(sent.tools).toBeUndefined();
    expect(sent.messages[0].role).toBe("system");
  });
});
