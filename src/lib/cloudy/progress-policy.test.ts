import { describe, expect, it } from "vitest";
import {
  CLOUDY_LESSON_XP,
  CLOUDY_MAX_DAILY_LESSON_AWARDS,
  isLessonInLevel,
} from "./progress-policy";

describe("server XP policy", () => {
  it("uses a fixed award and a bounded daily award count", () => {
    expect(CLOUDY_LESSON_XP).toBe(24);
    expect(CLOUDY_MAX_DAILY_LESSON_AWARDS).toBe(5);
  });

  it("accepts only lessons assigned to the requested CEFR level", () => {
    expect(isLessonInLevel(0, "A1")).toBe(true);
    expect(isLessonInLevel(15, "A2")).toBe(true);
    expect(isLessonInLevel(20, "B1")).toBe(true);
    expect(isLessonInLevel(23, "B2")).toBe(true);
    expect(isLessonInLevel(0, "B2")).toBe(false);
    expect(isLessonInLevel(24, "A1")).toBe(false);
    expect(isLessonInLevel(1.5, "A1")).toBe(false);
    expect(isLessonInLevel(1, "unknown")).toBe(false);
  });
});
