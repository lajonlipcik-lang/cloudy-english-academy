import { describe, expect, it } from "vitest";
import { D, LV } from "./data";

describe("Cloudy A1-A2 curriculum structure", () => {
  it("contains exactly seven sections with three lessons at each target level", () => {
    expect(LV.A1.s).toHaveLength(7);
    expect(LV.A2.s).toHaveLength(7);
    for (const level of ["A1", "A2"] as const) {
      expect(LV[level].s.every((section) => section.l.length === 3)).toBe(true);
      expect(LV[level].s.flatMap((section) => section.l)).toHaveLength(21);
    }
  });

  it("maps every A1-A2 lesson index to a populated lesson", () => {
    for (const level of ["A1", "A2"] as const) {
      const indexes = LV[level].s.flatMap((section) => section.l);
      expect(new Set(indexes).size).toBe(21);
      for (const index of indexes) {
        const lesson = D[index];
        expect(lesson, `Missing ${level} lesson at index ${index}`).toBeDefined();
        expect(lesson?.t.trim().length).toBeGreaterThan(0);
        expect(lesson?.w.length).toBeGreaterThan(0);
        expect(lesson?.s.length).toBeGreaterThan(0);
        for (const [word, translation] of lesson?.w ?? []) {
          expect(word.trim().length).toBeGreaterThan(0);
          expect(translation.trim().length).toBeGreaterThan(0);
        }
        for (const [russian, english] of lesson?.s ?? []) {
          expect(russian.trim().length).toBeGreaterThan(0);
          expect(english.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("keeps corrected translations and question punctuation", () => {
    expect(D[30]?.s.find(([ru]) => ru.includes("библиотеку"))?.[0]).toBe("Я хожу в библиотеку");
    expect(D[31]?.s[0]?.[0]).toBe("Я езжу на автобусе");
    expect(D[32]?.s[1]?.[0]).toBe("На небе есть облако");
    expect(D[34]?.s[0]?.[1]).toBe("Where is my phone?");
    expect(D[47]?.s[0]?.[0]).toBe("Ты когда-нибудь был в Лондоне?");
    expect(D[47]?.s[0]?.[1]).toBe("Have you ever been to London?");
    expect(D[48]?.s[0]?.[0]).toBe("Хочешь пойти в кино?");
    expect(D[48]?.s[1]?.[0]).toBe("Давай встретимся в шесть?");
    expect(D[53]?.s[4]?.[1]).toBe("Is this the checkout line?");
  });

  it("places the three new independence-focused topics at the end of A2", () => {
    expect(D[51]?.t).toBe("Рабочие задачи");
    expect(D[52]?.t).toBe("Телефонное общение");
    expect(D[53]?.t).toBe("Покупки и услуги");
    expect(LV.A2.s[6]?.n).toBe("Работа, общение и самостоятельность");
    expect(LV.A2.s[6]?.l).toEqual([51, 52, 53]);
    for (const index of [51, 52, 53]) {
      expect(D[index]?.w.length).toBeGreaterThanOrEqual(10);
      expect(D[index]?.s.length).toBeGreaterThanOrEqual(7);
    }
  });
});
