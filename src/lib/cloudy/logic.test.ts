import { describe, expect, it } from "vitest";
import { applyAnswer, buildExercises, defaultState, finishLesson, newSession, normalizeState } from "./logic";
import type { Exercise, Lesson } from "./types";

describe("Cloudy learning progress", () => {
  it("normalizes damaged or empty saved data without throwing", () => {
    expect(normalizeState(null)).toEqual(defaultState());
    const restored = normalizeState({ xp: "bad", streak: 4, set: { th: "light" } });
    expect(restored.xp).toBe(0);
    expect(restored.streak).toBe(4);
    expect(restored.set.th).toBe("light");
  });

  it("records correct and incorrect answers without mutating the original state", () => {
    const state = defaultState();
    const exercise: Exercise[] = [{ k: "c", q: "hello", a: "привет", en: "hello", spk: false, o: ["привет", "пока"], title: "Перевод" }];
    const session = newSession(0, exercise);
    const good = applyAnswer(state, session, true, "hello");
    expect(good.session.ok).toBe(1);
    expect(good.session.hp).toBe(5);
    const bad = applyAnswer(state, session, false, "hello");
    expect(bad.session.hp).toBe(4);
    expect(bad.state.mis["hello"]).toBe(1);
    expect(state.mis["hello"]).toBeUndefined();
  });

  it("advances the A2 path when a newly added lesson is completed in order", () => {
    const state = { ...defaultState(), lv: "A2" as const, dn: { A1: 0, A2: 20, B1: 0, B2: 0 } };
    const session = newSession(53, [{ k: "c", q: "hello", a: "привет", en: "hello", spk: false, o: ["привет"], title: "Перевод" }]);
    const result = finishLesson(state, session, new Date("2026-11-05T12:00:00"));
    expect(result.state.dn.A2).toBe(21);
  });

  it("awards lesson XP and updates the daily streak", () => {
    const state = { ...defaultState(), lv: "A1" as const };
    const session = newSession(0, [{ k: "c", q: "hello", a: "привет", en: "hello", spk: false, o: ["привет"], title: "Перевод" }]);
    const result = finishLesson(state, session, new Date("2026-11-03T12:00:00"));
    expect(result.state.xp).toBe(30);
    expect(result.state.streak).toBe(1);
    expect(result.state.dn.A1).toBe(1);
  });
  it("uses single-word lesson vocabulary as sentence-builder distractors", () => {
    const lesson: Pick<Lesson, "w" | "s"> = {
      w: [["hello", "привет"], ["friend", "друг"], ["school", "школа"]],
      s: [
        ["Привет, мой друг", "Hello my friend", "you the"],
        ["Я иду в школу", "I go to school", "four the"],
      ],
    };
    const exercises = buildExercises(lesson, lesson.w, { mic: false }, () => 0);
    const builders = exercises.filter((exercise) => exercise.k === "b");
    expect(builders).toHaveLength(2);
    for (const exercise of builders) {
      expect(exercise.o?.every((token) => !token.includes(" "))).toBe(true);
      expect(exercise.o).not.toContain("you");
      expect(exercise.o).not.toContain("the");
    }
  });

  it("splits multiword vocabulary and avoids punctuation-only duplicate distractors", () => {
    const lesson: Pick<Lesson, "w" | "s"> = {
      w: [["hello", "привет"], ["a little", "немного"], ["water", "вода"], ["bottle", "бутылка"]],
      s: [
        ["Привет, в бутылке немного воды", "Hello, there is a little water in the bottle", "hello the"],
        ["У меня есть вода", "I have water", "bottle a"],
      ],
    };
    const builders = buildExercises(lesson, lesson.w, { mic: false }, () => 0)
      .filter((exercise) => exercise.k === "b");
    expect(builders).toHaveLength(2);
    const first = builders.find((exercise) => exercise.a.startsWith("Hello,"))!;
    expect(first.o).not.toContain("hello");
    expect(first.o).not.toContain("a little");
    expect(first.o?.every((token) => !token.includes(" "))).toBe(true);
    const normalized = first.o?.map((token) => token.toLocaleLowerCase().replace(/[.,!?]/g, ""));
    expect(new Set(normalized).size).toBe(normalized.length);
  });


});
