import { describe, expect, it } from "vitest";
import {
  CLOUDY_LESSON_XP,
  CLOUDY_MAX_DAILY_LESSON_AWARDS,
  isLessonInLevel,
  sanitizeCloudyProgress,
} from "./progress-policy";

describe("server XP policy", () => {
  it("uses a fixed award and a bounded daily award count", () => {
    expect(CLOUDY_LESSON_XP).toBe(24);
    expect(CLOUDY_MAX_DAILY_LESSON_AWARDS).toBe(5);
  });

  it("whitelists and bounds untrusted progress before a service-role save", () => {
    const safe = sanitizeCloudyProgress({
      xp: 999999999, streak: 999999, lv: "A1",
      dn: { A1: 999, A2: -4, B1: 2.8, B2: "bad" },
      acc: [999999999, -1], mis: { hello: 999999, ["x".repeat(100)]: 4 },
      days: Array.from({ length: 100 }, (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`),
      ach: ["first", "not allowed!"], set: { vol: 4, goal: 9999, remT: "not-time" },
      unknownSecret: "must not survive", user: { id: "attacker" },
    });
    expect(safe.dn).toEqual({ A1: 21, A2: 0, B1: 2, B2: 0 });
    expect(safe.streak).toBe(3650);
    expect(safe.acc).toEqual([1_000_000, 0]);
    expect(safe.mis["hello"]).toBe(10_000);
    expect(Object.keys(safe.mis)).toHaveLength(1);
    expect(safe.days).toHaveLength(60);
    expect(safe.ach).toEqual(["first"]);
    expect(safe.set.vol).toBe(1);
    expect(safe.set.goal).toBe(240);
    expect(safe.set.remT).toBe("19:00");
    expect(safe).not.toHaveProperty("unknownSecret");
    expect(safe).not.toHaveProperty("user");
  });

  it("bounds A2 progress to its expanded 18-lesson path", () => {
    expect(sanitizeCloudyProgress({ dn: { A2: 999 } }).dn.A2).toBe(18);
  });

  it("accepts only lessons assigned to the requested CEFR level", () => {
    expect(isLessonInLevel(0, "A1")).toBe(true);
    expect(isLessonInLevel(15, "A2")).toBe(true);
    expect(isLessonInLevel(20, "B1")).toBe(true);
    expect(isLessonInLevel(23, "B2")).toBe(true);
    expect(isLessonInLevel(0, "B2")).toBe(false);
    expect(isLessonInLevel(24, "A1")).toBe(true);
    expect(isLessonInLevel(38, "A1")).toBe(true);
    expect(isLessonInLevel(39, "A1")).toBe(false);
    expect(isLessonInLevel(39, "A2")).toBe(true);
    expect(isLessonInLevel(50, "A2")).toBe(true);
    expect(isLessonInLevel(38, "A2")).toBe(false);
    expect(isLessonInLevel(6, "A1")).toBe(false);
    expect(isLessonInLevel(1.5, "A1")).toBe(false);
    expect(isLessonInLevel(1, "unknown")).toBe(false);
  });
});
