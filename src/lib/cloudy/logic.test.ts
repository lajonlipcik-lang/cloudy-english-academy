import { buildKnownGrammar } from "./exam-curriculum";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext, Script } from "node:vm";
import { describe, expect, it } from "vitest";
import { applyAnswer, buildExercises, defaultState, finishLesson, newSession, normalizeState } from "./logic";
import { A1_FOUNDATIONS, A2_FOUNDATIONS, CLOUDY_FOUNDATIONS, D, LV, levelLessons } from "./data";
import { isLessonInLevel, sanitizeCloudyProgress } from "./progress-policy";
import type { Exercise, Lesson } from "./types";

describe("Cloudy learning progress", () => {
  it("keeps production browser learning runtimes syntactically valid", () => {
    for (const file of ["cloudy-english-app.js", "cloudy-exercises.js", "cloudy-learning.js"]) {
      const source = readFileSync(join(process.cwd(), "src/server-assets", file), "utf8");
      expect(() => new Script(source, { filename: file })).not.toThrow();
    }
  });

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
    const state = { ...defaultState(), lv: "A2" as const, dn: { A1: 0, A2: 23, B1: 0, B2: 0 } };
    const session = newSession(59, [{ k: "c", q: "hello", a: "привет", en: "hello", spk: false, o: ["привет"], title: "Перевод" }]);
    const result = finishLesson(state, session, new Date("2026-11-05T12:00:00"));
    expect(result.state.dn.A2).toBe(24);
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
      w: [["hello", "привет"], ["friend", "друг"], ["school", "школа"], ["turn left", "повернуть налево"], ["quarter past", "четверть после"]],
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


  it("uses safe single-word distractors in the legacy browser exercise runtime", () => {
    const runtime = readFileSync(join(process.cwd(), "src/server-assets/cloudy-exercises.js"), "utf8");
    const start = runtime.indexOf("function mk(l){");
    const end = runtime.indexOf("\nfunction go", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const legacyMk = runInNewContext(`${runtime.slice(start, end)}; mk`, {
      sh: <T,>(items: T[]) => items,
      pool: () => [],
      S: { set: { mic: 0 } },
      window: { SpeechRecognition: undefined, webkitSpeechRecognition: undefined },
    }) as (lesson: Lesson) => Exercise[];

    for (const index of [...levelLessons("A1"), ...levelLessons("A2")]) {
      const lesson = D[index]!;
      const legacyExercises = legacyMk(lesson);
      const vocabularyExercises = legacyExercises.filter((exercise) => exercise.k === "c" || exercise.k === "l");
      const listeningExercises = legacyExercises.filter((exercise) => exercise.k === "l");
      const builders = legacyExercises.filter((exercise) => exercise.k === "b");
      expect(vocabularyExercises).toHaveLength(lesson.w.length);
      expect(listeningExercises).toHaveLength(Math.floor(lesson.w.length / 3));
      expect(builders).toHaveLength(lesson.s.length);
      for (const exercise of builders) {
        if (exercise.k !== "b") continue;
        const correctTokens = exercise.a.split(" ");
        const distractors = exercise.o.slice(correctTokens.length);
        const availableWords = new Set([
          ...lesson.w.map(([word]) => word).filter((word) => !/\s/.test(word)),
          ...lesson.s.flatMap(([, sentence]) => sentence.split(" ")),
        ]);
        expect(exercise.o.slice(0, correctTokens.length)).toEqual(correctTokens);
        expect(distractors.every((token) => availableWords.has(token))).toBe(true);
        expect(distractors.every((token) => !/\s/.test(token) && !/[.,!?]/.test(token))).toBe(true);
        expect(distractors.every((token) => !correctTokens.includes(token))).toBe(true);
        const normalizedCorrect = new Set(correctTokens.map((token) => token.toLocaleLowerCase().replace(/[.,!?]/g, "")));
        expect(distractors.every((token) => !normalizedCorrect.has(token.toLocaleLowerCase().replace(/[.,!?]/g, "")))).toBe(true);
      }
    }
  });

  it("keeps A1 and A2 as eight complete sections with 24 lessons each", () => {
    expect(LV.A1.s).toHaveLength(8);
    expect(LV.A2.s).toHaveLength(8);
    expect(levelLessons("A1")).toHaveLength(24);
    expect(levelLessons("A2")).toHaveLength(24);
    for (const index of [...levelLessons("A1"), ...levelLessons("A2")]) {
      const lesson = D[index]!;
      expect(lesson.w.length).toBeGreaterThanOrEqual(10);
      expect(lesson.s.length).toBeGreaterThanOrEqual(6);
      expect(new Set(lesson.w.map(([word]) => word.toLowerCase())).size).toBe(lesson.w.length);
      expect(lesson.w.every(([word, translation]) => word.trim() && translation.trim())).toBe(true);
      expect(lesson.s.every(([ru, en]) => ru.trim() && en.trim())).toBe(true);
    }
    for (const index of [...levelLessons("A1"), ...levelLessons("A2")]) {
      expect(D[index]).toBeDefined();
    }
  });

  it("keeps learner-facing sentences punctuated and preserves key A2 language corrections", () => {
    for (const index of [...levelLessons("A1"), ...levelLessons("A2")]) {
      for (const [ru, en] of D[index]!.s) {
        expect(ru).toMatch(/[.!?…]$/);
        expect(en).toMatch(/[.!?…]$/);
      }
    }
    expect(D[41]!.s.some(([ru, en]) => ru.includes("двоюродного брата или сестру") && en.includes("my cousin"))).toBe(true);
    expect(D[44]!.w.some(([word]) => word === "opposite")).toBe(true);
    expect(D[44]!.s.some(([, en]) => en.includes("opposite the station"))).toBe(true);
    expect(D[53]!.s.some(([ru, en]) => ru.includes("занимаюсь английским") && en.includes("practice English"))).toBe(true);
    expect(D[34]!.w.some(([word, translation]) => word === "clock" && translation.includes("настенные"))).toBe(true);
    expect(D[52]!.s.some(([ru, en]) => ru.includes("допустил(а) ошибку в адресе") && en.includes("mistake with the address"))).toBe(true);
    expect(D[27]!.w.some(([word]) => word === "raise")).toBe(true);
    expect(D[27]!.s.some(([ru, en]) => ru === "Подними руку." && en === "Raise your hand.")).toBe(true);
    expect(D[27]!.s.some(([ru, en]) => ru === "У меня болит рука." && en === "My arm hurts.")).toBe(true);
    expect(D[15]!.s.some(([ru, en]) => ru === "Можно мне счёт, пожалуйста?" && en === "Could I have the bill, please?")).toBe(true);
    for (const index of [...levelLessons("A1"), ...levelLessons("A2")]) {
      const englishSentences = D[index]!.s.map(([, en]) => en.toLowerCase());
      expect(new Set(englishSentences).size).toBe(englishSentences.length);
    }
  });

  it("keeps the browser runtime catalog identical to the typed curriculum", () => {
    const browserWindow: { CloudyCatalog?: { D: Lesson[]; LV: typeof LV; F: typeof A1_FOUNDATIONS } } = {};
    const browserCatalog = readFileSync(
      join(process.cwd(), "src/server-assets/cloudy-catalog.js"),
      "utf8",
    );
    runInNewContext(browserCatalog, { window: browserWindow });
    const browserLessons = browserWindow.CloudyCatalog?.D ?? [];
    const mismatchIndex = D.findIndex(
      (lesson, index) => JSON.stringify(lesson) !== JSON.stringify(browserLessons[index]),
    );
    expect(browserLessons.length).toBe(D.length);
    expect(
      mismatchIndex,
      mismatchIndex >= 0
        ? `Lesson ${mismatchIndex}: TS=${JSON.stringify(D[mismatchIndex])}; browser=${JSON.stringify(browserLessons[mismatchIndex])}`
        : "No lesson data mismatch",
    ).toBe(-1);
    expect(JSON.stringify(browserWindow.CloudyCatalog?.LV)).toBe(JSON.stringify(LV));
    expect(JSON.stringify(browserWindow.CloudyCatalog?.F)).toBe(JSON.stringify(CLOUDY_FOUNDATIONS));
  });

  it("introduces lesson vocabulary before graded practice", () => {
    const runtime = readFileSync(join(process.cwd(), "src/server-assets/cloudy-exercises.js"), "utf8");
    expect(runtime).toContain('const vocabulary={k:"v",words:D[n].w};');
    expect(runtime).toContain('ex=intro?[{k:"t",...intro},vocabulary,...guided,...recall,...practice]:[vocabulary,...guided,...recall,...practice];');
    expect(runtime).toContain('if(e.k=="v")b=');
    expect(runtime).toContain('e.k=="t"||e.k=="v"');
  });

  it("adds three typed vocabulary-recall prompts before multiple-choice practice", () => {
    const runtime = readFileSync(join(process.cwd(), "src/server-assets/cloudy-exercises.js"), "utf8");
    expect(runtime).toContain('const recall=sh(D[n].w).slice(0,Math.min(3,D[n].w.length)).map(([en,ru])=>({k:"r",q:ru,a:en,en,title:"Вспомни слово без подсказок"}));');
    expect(runtime).toContain("vocabulary,...guided,...recall,...practice");
    expect(runtime).toContain('else if(e.k=="r")b=');
    expect(runtime).toContain('typed===String(e.a).toLocaleLowerCase()');
    expect(runtime).toContain('selectedAnswer:e.k==="r"?typed');
    expect(runtime).toContain('e.k!=="b"&&e.k!=="r"');
  });
  it("adds only completed A1 verb topics and their taught examples to the personal exam", () => {
    const grammar = buildKnownGrammar([24, 26, 28], A1_FOUNDATIONS);
    expect([...new Set(grammar.map((pair) => pair.skillId))]).toEqual([
      "grammar:verbs:action",
      "grammar:present-simple:third-person",
      "grammar:present-simple:negatives",
    ]);
    expect(grammar.some((pair) => pair.en.includes("She likes tea.") && pair.ru.includes("Она любит чай."))).toBe(true);
    expect(buildKnownGrammar([23], A1_FOUNDATIONS)).toEqual([]);
  });


  it("adds the new A1 and A2 grammar topics to Cloudy's completed-material exam", () => {
    const grammar = buildKnownGrammar([54, 55, 56, 57, 58, 59], CLOUDY_FOUNDATIONS);
    expect(new Set(grammar.map((pair) => pair.skillId)).size).toBe(6);
    expect(grammar.some((pair) => pair.skillId === "grammar:wh-questions" && pair.en === "Where do you live?")).toBe(true);
    expect(grammar.some((pair) => pair.skillId === "grammar:past-simple-irregular" && pair.en === "Yesterday I went to work by bus.")).toBe(true);
    expect(grammar.some((pair) => pair.skillId === "grammar:modals-obligation" && pair.en === "You mustn't park here.")).toBe(true);
    expect(grammar.some((pair) => pair.skillId === "grammar:first-conditional" && pair.en === "If it rains, we'll stay home.")).toBe(true);
  });

  it("validates grammar exam targets against completed lesson examples", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/cloudy-ai.functions.ts"), "utf8");
    expect(source).toContain("const knownGrammar=buildKnownGrammar(lessonIds,CLOUDY_FOUNDATIONS);");
    expect(source).toContain("knownGrammar.find((pair)=>pair.skillId===skillId&&pair.en.toLowerCase()===normalizedTarget)");
    expect(source).toContain("buildFallbackExamQuestions(wordPairs,sentencePairs,knownGrammar,focus)");
  });

  it("renders Cloudy-style bilingual study cards with an accessible rightward transition", () => {
    const runtime = readFileSync(join(process.cwd(), "src/server-assets/cloudy-exercises.js"), "utf8");
    const styles = readFileSync(join(process.cwd(), "src/server-assets/cloudy-english.css"), "utf8");
    expect(runtime).toContain('class="pronoun-grid"');
    expect(runtime).toContain('L===25?[["I","Я"],["You","Ты / Вы"],["We","Мы"],["They","Они"]]');
    expect(runtime).toContain('L===26?[["He","Он"],["She","Она"],["It","Оно / это"]]');
    expect(runtime).toContain('class="vocab-card"');
    expect(runtime).toContain('study-stage-enter');
    expect(runtime).toContain('stage.classList.add("is-leaving")');
    expect(styles).toContain("@keyframes cloudyStudyLeave");
    expect(styles).toContain(".pronoun-card");
    expect(styles).toContain("@media(prefers-reduced-motion:reduce)");
  });

  it("teaches action verbs and Present Simple in a fixed six-step A1 progression", () => {
    const runtime = readFileSync(join(process.cwd(), "src/server-assets/cloudy-exercises.js"), "utf8");
    const start = runtime.indexOf("function verbPath(n){");
    const end = runtime.indexOf("\nfunction go", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const verbPath = runInNewContext(`${runtime.slice(start, end)}; verbPath`, {
      sh: <T,>(items: T[]) => [...items].reverse(),
    }) as (lesson: number) => { q: string; a: string; skillId: string; o: string[] }[];
    const expectedSkills = [
      "grammar:verbs:action",
      "grammar:present-simple:base",
      "grammar:present-simple:third-person",
      "grammar:present-simple:questions",
      "grammar:present-simple:negatives",
      "grammar:sentence-order",
    ];
    for (let offset = 0; offset < expectedSkills.length; offset++) {
      const drills = verbPath(24 + offset);
      expect(drills).toHaveLength(2);
      expect(drills.every((drill) => drill.skillId === expectedSkills[offset])).toBe(true);
      for (const drill of drills) {
        expect(drill.q.trim()).not.toBe("");
        expect(drill.a.trim()).not.toBe("");
        expect(drill.o).toContain(drill.a.split(" ")[0]);
        expect(drill.o.length).toBeGreaterThan(drill.a.split(" ").length);
      }
    }
    expect(verbPath(23)).toHaveLength(0);
    expect(verbPath(30)).toHaveLength(0);
  });


  it("teaches the next A1 and A2 grammar topics with distinct guided skills", () => {
    const runtime = readFileSync(join(process.cwd(), "src/server-assets/cloudy-exercises.js"), "utf8");
    const start = runtime.indexOf("function verbPath(n){");
    const end = runtime.indexOf("\nfunction go", start);
    const verbPath = runInNewContext(`${runtime.slice(start, end)}; verbPath`, {
      sh: <T,>(items: T[]) => [...items].reverse(),
    }) as (lesson: number) => { q: string; a: string; skillId: string; o: string[] }[];
    const expected = new Map<number, string>([
      [54, "grammar:wh-questions"],
      [55, "grammar:possessive-pronouns"],
      [56, "grammar:imperatives"],
      [57, "grammar:past-simple-irregular"],
      [58, "grammar:modals-obligation"],
      [59, "grammar:first-conditional"],
    ]);
    for (const [index, skillId] of expected) {
      const drills = verbPath(index);
      expect(drills).toHaveLength(2);
      expect(drills.every((drill) => drill.skillId === skillId)).toBe(true);
      for (const drill of drills) {
        expect(drill.q.trim()).not.toBe("");
        expect(drill.a.trim()).not.toBe("");
        expect(drill.o).toContain(drill.a.split(" ")[0]);
        expect(drill.o.length).toBeGreaterThan(drill.a.split(" ").length);
      }
    }
  });

  it("keeps guided grammar answers in separate learner skill records", () => {
    const learning = readFileSync(join(process.cwd(), "src/server-assets/cloudy-learning.js"), "utf8");
    expect(learning).toContain("if (exercise && exercise.skillId) return cleanText(exercise.skillId, 90);");
  });

  it("provides teach-before-test notes for every A1 lesson and the new A2 grammar block", () => {
    expect(Object.keys(A1_FOUNDATIONS).map(Number)).toEqual(levelLessons("A1"));
    expect(Object.keys(A2_FOUNDATIONS).map(Number)).toEqual([57, 58, 59]);
    for (const index of levelLessons("A1")) {
      const note = A1_FOUNDATIONS[index]!;
      expect(note.title.trim()).not.toBe("");
      expect(note.body.trim()).not.toBe("");
      expect(note.examples.length).toBeGreaterThanOrEqual(2);
      expect(note.examples.every(([english, russian]) => english.trim() && russian.trim())).toBe(true);
      expect(note.tip.trim()).not.toBe("");
    }
  });

  it("keeps lesson indices unique and progress authorization aligned with curriculum", () => {
    for (const level of ["A1", "A2", "B1", "B2"] as const) {
      const indices = levelLessons(level);
      expect(new Set(indices).size).toBe(indices.length);
      expect(indices.every((index) => D[index] !== undefined)).toBe(true);
      expect(indices.every((index) => isLessonInLevel(index, level))).toBe(true);
    }
    expect(levelLessons("A1").some((index) => levelLessons("A2").includes(index))).toBe(false);
  });

  it("authorizes the next A1 and A2 lesson block without reassigning existing indices", () => {
    expect([51, 52, 53, 57, 58, 59].every((index) => isLessonInLevel(index, "A2"))).toBe(true);
    expect([54, 55, 56].every((index) => isLessonInLevel(index, "A1"))).toBe(true);
    for (const index of [51, 52, 53, 57, 58, 59]) {
      expect(D[index]?.w).toHaveLength(10);
      expect(D[index]?.s.length).toBeGreaterThanOrEqual(6);
    }
    expect(isLessonInLevel(51, "A1")).toBe(false);
    expect(isLessonInLevel(57, "A1")).toBe(false);
    const state = sanitizeCloudyProgress({
      ...defaultState(),
      dn: { A1: 0, A2: 99, B1: 0, B2: 0 },
    });
    expect(state.dn.A2).toBe(24);
  });

  it("does not duplicate vocabulary words when sentence punctuation differs", () => {
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
    const normalized = (first.o ?? []).map((token) => token.toLocaleLowerCase().replace(/[.,!?]/g, ""));
    expect(new Set(normalized).size).toBe(normalized.length);
  });


  it("uses consistent American English across all A1-A2 lesson content", () => {
    const content = [...levelLessons("A1"), ...levelLessons("A2")]
      .map((index) => {
        const lesson = D[index]!;
        return [
          lesson.t,
          ...lesson.w.flatMap(([word, translation]) => [word, translation]),
          ...lesson.s.flatMap(([russian, english]) => [russian, english]),
        ].join(" ");
      })
      .join(" ")
      .toLocaleLowerCase();
    expect(content).not.toMatch(/\bfavourite\b|\bcolour\b|\bcity centre\b|\bunderground\b|\brubbish\b|\bwash up\b|\bpractise\b|\bat weekends\b|\btravelled\b|\bneighbourhood\b|\bgrey\b|\btrousers\b|\bfootball\b|\bcinema\b|\breturn ticket\b/);
    expect(content).toContain("favorite color");
    expect(content).toContain("subway");
    expect(content).toContain("take out the trash");
    expect(content).toContain("practice english");
    expect(content).toContain("on weekends");
    expect(content).toContain("round-trip ticket");
  });


  it("keeps American usage and contextual A2 vocabulary examples accurate", () => {
    expect(D[15]!.w.some(([word, translation]) => word === "appetizer" && translation === "закуска")).toBe(true);
    expect(D[15]!.s.some(([, en]) => en === "I'd like an appetizer.")).toBe(true);
    expect(D[39]!.w.some(([word, translation]) => word === "commute" && translation.includes("дорога на работу"))).toBe(true);
    expect(D[39]!.s.some(([, en]) => en === "My commute takes half an hour.")).toBe(true);
    expect(D[48]!.w.some(([word]) => word === "available")).toBe(true);
    expect(D[48]!.s.some(([, en]) => en === "Are you available tomorrow evening?")).toBe(true);
    expect(D[44]!.s.some(([ru, en]) => ru === "Мы прибываем в десять часов." && en === "We arrive at ten o'clock.")).toBe(true);
    expect(D[45]!.s.some(([ru, en]) => ru === "У меня сегодня повышенная температура." && en === "I have a fever today.")).toBe(true);
    expect(D[41]!.w.some(([word, translation]) => word === "appointment" && translation.includes("запись на приём"))).toBe(true);
    expect(D[48]!.w.some(([word, translation]) => word === "available" && translation.includes("доступен"))).toBe(true);
  });


  it("uses natural American English for directions, traffic, and clock times", () => {
    expect(D[6]!.w.some(([word]) => word === "intersection")).toBe(true);
    expect(D[6]!.s.some(([, en]) => en === "Turn right at the intersection.")).toBe(true);
    expect(D[6]!.s.some(([ru, en]) => ru === "На этой улице интенсивное движение." && en === "There is a lot of traffic on this street.")).toBe(true);
    expect(D[8]!.w.some(([word, translation]) => word === "quarter past" && translation.includes("четверть часа после"))).toBe(true);
    expect(D[8]!.s.some(([, en]) => en === "The train leaves at eight thirty.")).toBe(true);
  });


  it("avoids assigning an unstated gender in Russian translations", () => {
    expect(D[15]!.s.some(([ru]) => ru === "Я очень хочу есть.")).toBe(true);
    expect(D[15]!.s.some(([ru]) => ru === "Я бы хотел(а) закуску.")).toBe(true);
    expect(D[26]!.s.some(([ru]) => ru === "Я учусь в школе.")).toBe(true);
    expect(D[36]!.s.some(([ru]) => ru === "Сегодня я устал(а).")).toBe(true);
    expect(D[41]!.s.some(([ru]) => ru.includes("двоюродного брата или сестру") && ru.includes("эти выходные"))).toBe(true);
    expect(D[47]!.s.some(([ru]) => ru === "Ты когда-нибудь был(а) в Лондоне?")).toBe(true);
    expect(D[47]!.s.some(([ru]) => ru === "Я никогда не путешествовал(а) за границей.")).toBe(true);
    expect(D[48]!.s.some(([ru]) => ru === "У тебя есть время в субботу?")).toBe(true);
    expect(D[50]!.s.some(([ru]) => ru === "Я не понял(а) инструкции.")).toBe(true);
    expect(D[52]!.s.some(([ru]) => ru === "Я допустил(а) ошибку в адресе.")).toBe(true);
    expect(D[52]!.s.some(([ru]) => ru === "Я потерял(а) ключи.")).toBe(true);
  });


});
