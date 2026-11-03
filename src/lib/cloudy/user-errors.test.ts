import { describe, expect, it } from "vitest";
import { toUserErrorMessage } from "./user-errors";

describe("user-facing error messages", () => {
  it("explains invalid credentials without exposing provider details", () => {
    expect(toUserErrorMessage(new Error("Invalid login credentials"), "auth"))
      .toContain("проверьте email и пароль");
  });

  it("guides users with an unconfirmed email", () => {
    expect(toUserErrorMessage({ message: "Email not confirmed" }, "auth"))
      .toContain("подтвердите email");
  });

  it("does not expose technical AI provider errors", () => {
    const message = toUserErrorMessage(new Error("groq API: HTTP 404"), "ai");
    expect(message).toContain("не удалось получить ответ");
    expect(message).not.toMatch(/groq|HTTP|404|API/i);
  });

  it("gives a specific next step for progress failures", () => {
    expect(toUserErrorMessage(new Error("database unavailable"), "progress"))
      .toContain("сохранить прогресс");
  });

  it("handles timeouts with an actionable message", () => {
    expect(toUserErrorMessage(new Error("Request timed out"), "generic"))
      .toContain("слишком много времени");
  });
});
