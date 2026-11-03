import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { D, LI, LV, LVS, levelLessons, levelPool } from "../lib/cloudy/data";
import {
  advance,
  applyAnswer,
  buildExercises,
  defaultState,
  finishLesson,
  lessonTitle,
  newSession,
  normalizeState,
} from "../lib/cloudy/logic";
import type { CloudyState, Exercise, Level, Session } from "../lib/cloudy/types";

export const Route = createFileRoute("/")({ component: Index });

const STORAGE_KEY = "cloudy-english-progress-v1";

function Index() {
  const [state, setState] = useState<CloudyState>(() => defaultState());
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<Level>("A1");
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [pickedLeft, setPickedLeft] = useState<number | null>(null);
  const [pickedRight, setPickedRight] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const restored = normalizeState(JSON.parse(saved) as unknown);
        setState(restored);
        if (restored.lv) setSelectedLevel(restored.lv);
      }
    } catch {
      // Ignore damaged or unavailable local storage; the app remains playable.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing or a full device must not prevent lessons from working.
    }
  }, [ready, state]);

  const levelIndexes = useMemo(() => levelLessons(selectedLevel), [selectedLevel]);
  const done = state.dn[selectedLevel];
  const currentLesson = levelIndexes[Math.min(done, levelIndexes.length - 1)] ?? 0;
  const exercise = session?.ex[session.i];

  function startLesson() {
    const nextState = { ...state, lv: selectedLevel };
    setState(nextState);
    setCompleted(false);
    setFeedback(null);
    setDraft("");
    setMatched([]);
    setPickedLeft(null);
    setPickedRight(null);
    const lesson = levelIndexes[Math.min(nextState.dn[selectedLevel], levelIndexes.length - 1)] ?? 0;
    const lessonData = D[lesson];
    if (!lessonData) return;
    setSession(newSession(lesson, buildExercises(lessonData, levelPool(selectedLevel), { mic: true })));
  }

  function grade(good: boolean, word?: string) {
    if (!session || feedback) return;
    const result = applyAnswer(state, session, good, word);
    setState(result.state);
    setSession(result.session);
    setFeedback(good ? "correct" : "wrong");
  }

  function finishCurrentLesson(active: Session) {
    const result = finishLesson({ ...state, lv: selectedLevel }, active);
    setState(result.state);
    setSession(null);
    setCompleted(true);
    setFeedback(null);
  }

  function continueSession() {
    if (!session) return;
    const next = advance(session, levelPool(selectedLevel));
    if (!next) {
      finishCurrentLesson(session);
      return;
    }
    setSession(next);
    setFeedback(null);
    setDraft("");
    setMatched([]);
    setPickedLeft(null);
    setPickedRight(null);
  }

  function checkTextAnswer() {
    if (!exercise || (exercise.k !== "b" && exercise.k !== "p")) return;
    const expected = exercise.k === "b" ? exercise.a : exercise.en;
    const actual = draft.trim().replace(/\s+/g, " ").toLowerCase().replace(/[.!?]/g, "");
    const target = expected.trim().replace(/\s+/g, " ").toLowerCase().replace(/[.!?]/g, "");
    grade(actual === target, exercise.k === "p" ? exercise.en : expected);
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.88;
    window.speechSynthesis.speak(utterance);
  }

  function selectWord(word: string) {
    setDraft((current) => current ? current + " " + word : word);
  }

  function checkMatching() {
    if (!exercise || exercise.k !== "m" || pickedLeft === null || pickedRight === null) return;
    const left = exercise.L[pickedLeft];
    const right = exercise.R[pickedRight];
    if (!left || !right) return;
    const isGood = left[1] === right[1];
    if (isGood) setMatched((items) => [...items, pickedLeft]);
    grade(isGood, left[1]);
    setPickedLeft(null);
    setPickedRight(null);
  }

  const progressPercent = Math.round((done / Math.max(levelIndexes.length, 1)) * 100);
  const totalLessons = LVS.reduce((sum, level) => sum + state.dn[level], 0);

  return (
    <main className="cloudy-shell">
      <div className="cloudy-glow cloudy-glow-one" />
      <div className="cloudy-glow cloudy-glow-two" />
      <header className="cloudy-topbar">
        <a className="cloudy-brand" href="/" aria-label="Cloudy English Academy">
          <span className="cloudy-brand-mark">☁</span>
          <span>cloudy<span className="cloudy-brand-light">english</span></span>
        </a>
        <div className="cloudy-top-stats">
          <span title="Опыт">⚡ {state.xp} XP</span>
          <span title="Дней подряд">🔥 {state.streak}</span>
          <span title="Сердца">♥ 5</span>
        </div>
      </header>

      {!session ? (
        <div className="cloudy-dashboard">
          <section className="cloudy-hero">
            <div className="cloudy-hero-copy">
              <span className="cloudy-eyebrow">ТВОЯ АНГЛИЙСКАЯ ПРИКЛЮЧЕНИЕ НАЧИНАЕТСЯ ЗДЕСЬ</span>
              <h1>Учить английский<br /><span>легче, чем кажется.</span></h1>
              <p>Короткие уроки, понятные упражнения и маленькие победы каждый день.</p>
              <button className="cloudy-primary" onClick={startLesson}>
                {totalLessons > 0 ? "Продолжить обучение" : "Начать первый урок"} <span>→</span>
              </button>
            </div>
            <div className="cloudy-mascot-wrap" aria-label="Облачный маскот Cloudy">
              <div className="cloudy-orbit orbit-one" />
              <div className="cloudy-orbit orbit-two" />
              <div className="cloudy-mascot">☁️</div>
              <div className="cloudy-mascot-caption">Привет! Я Cloudy 👋</div>
            </div>
          </section>

          <section className="cloudy-overview">
            <div className="cloudy-section-heading">
              <div><span className="cloudy-eyebrow">ТВОЙ ПРОГРЕСС</span><h2>Каждый шаг имеет значение</h2></div>
              <span className="cloudy-save-label">● Прогресс сохраняется на устройстве</span>
            </div>
            <div className="cloudy-stat-grid">
              <article className="cloudy-stat-card"><span>⚡</span><strong>{state.xp}</strong><small>Всего XP</small></article>
              <article className="cloudy-stat-card"><span>🔥</span><strong>{state.streak}</strong><small>Дней подряд</small></article>
              <article className="cloudy-stat-card"><span>📚</span><strong>{totalLessons}</strong><small>Уроков пройдено</small></article>
              <article className="cloudy-stat-card"><span>🎯</span><strong>{state.acc[1] ? Math.round(state.acc[0] / state.acc[1] * 100) : 0}%</strong><small>Точность ответов</small></article>
            </div>
          </section>

          <section className="cloudy-level-section">
            <div className="cloudy-section-heading">
              <div><span className="cloudy-eyebrow">ПРОГРАММА ОБУЧЕНИЯ</span><h2>Выбери свой уровень</h2></div>
              <span className="cloudy-level-count">24 урока · 4 уровня</span>
            </div>
            <div className="cloudy-level-grid">
              {LVS.map((level) => {
                const count = levelLessons(level).length;
                const amount = state.dn[level];
                return (
                  <button key={level} className={`cloudy-level-card ${selectedLevel === level ? "is-selected" : ""}`} onClick={() => setSelectedLevel(level)}>
                    <span className="cloudy-level-code">{level}</span>
                    <strong>{LI[level][0]}</strong>
                    <small>{LI[level][1]}</small>
                    <span className="cloudy-progress-track"><i style={{ width: `${amount / count * 100}%` }} /></span>
                    <span className="cloudy-level-progress">{amount} из {count} уроков</span>
                  </button>
                );
              })}
            </div>
            <div className="cloudy-current-level">
              <div><span className="cloudy-eyebrow">ВЫБРАННЫЙ УРОВЕНЬ · {selectedLevel}</span><h3>{done >= levelIndexes.length ? "Уровень завершён! 🎉" : lessonTitle(currentLesson)}</h3><p>{done >= levelIndexes.length ? "Отличная работа. Можешь повторить уроки или выбрать следующий уровень." : `Следующий урок · ${done + 1} из ${levelIndexes.length}`}</p></div>
              <div className="cloudy-current-progress"><strong>{progressPercent}%</strong><span>завершено</span></div>
              <button className="cloudy-primary cloudy-start-button" onClick={startLesson}>{done >= levelIndexes.length ? "Повторить уровень" : "Открыть урок"} <span>→</span></button>
            </div>
          </section>

          {completed && <div className="cloudy-toast">🎉 Урок завершён! Опыт добавлен, прогресс сохранён.</div>}
          <footer className="cloudy-footer">Cloudy English Academy <span>Учись в своём темпе ☁️</span></footer>
        </div>
      ) : (
        <section className="cloudy-lesson">
          <div className="cloudy-lesson-top">
            <button className="cloudy-back" onClick={() => setSession(null)}>← Выйти из урока</button>
            <span>{selectedLevel} · {lessonTitle(session.lesson)}</span>
            <span>♥ {session.hp}</span>
          </div>
          <div className="cloudy-lesson-progress"><i style={{ width: `${Math.min(100, session.i / Math.max(session.ex.length, 1) * 100)}%` }} /></div>
          <div className="cloudy-exercise-card">
            <span className="cloudy-eyebrow">ВОПРОС {session.i + 1} ИЗ {session.ex.length}</span>
            <h1>{exercise?.k === "l" ? "Послушай и выбери" : exercise?.k === "m" ? "Найди пары" : exercise?.k === "p" ? "Напиши услышанное слово" : exercise?.title ?? "Выполни задание"}</h1>
            {exercise?.k === "c" && <><p className="cloudy-question">{exercise.q}</p><div className="cloudy-answer-grid">{exercise.o.map((option) => <button key={option} disabled={!!feedback} onClick={() => grade(option === exercise.a, exercise.en)}>{option}</button>)}</div></>}
            {exercise?.k === "l" && <><button className="cloudy-audio-button" onClick={() => speak(exercise.en)}>🔊 Прослушать фразу</button><div className="cloudy-answer-grid">{exercise.o.map((option) => <button key={option} disabled={!!feedback} onClick={() => grade(option === exercise.a, exercise.en)}>{option}</button>)}</div></>}
            {exercise?.k === "b" && <><p className="cloudy-question">{exercise.q}</p><div className="cloudy-word-answer">{draft || "Составь предложение из слов ниже"}</div><div className="cloudy-word-bank">{exercise.o.map((word, index) => <button key={`${word}-${index}`} disabled={!!feedback} onClick={() => selectWord(word)}>{word}</button>)}</div><button className="cloudy-primary cloudy-check" disabled={!draft.trim() || !!feedback} onClick={checkTextAnswer}>Проверить ответ</button></>}
            {exercise?.k === "p" && <><button className="cloudy-audio-button" onClick={() => speak(exercise.en)}>🔊 Прослушать слово</button><input className="cloudy-text-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Введи слово на английском" disabled={!!feedback} /><button className="cloudy-primary cloudy-check" disabled={!draft.trim() || !!feedback} onClick={checkTextAnswer}>Проверить ответ</button></>}
            {exercise?.k === "m" && <><p className="cloudy-question">Соедини английское слово с переводом</p><div className="cloudy-match-grid"><div>{exercise.L.map((pair, index) => <button key={pair[1]} className={pickedLeft === index ? "is-picked" : matched.includes(index) ? "is-matched" : ""} disabled={!!feedback || matched.includes(index)} onClick={() => setPickedLeft(index)}>{pair[0]}</button>)}</div><div>{exercise.R.map((pair, index) => <button key={pair[1]} className={pickedRight === index ? "is-picked" : ""} disabled={!!feedback} onClick={() => setPickedRight(index)}>{pair[0]}</button>)}</div></div><button className="cloudy-primary cloudy-check" disabled={pickedLeft === null || pickedRight === null || !!feedback} onClick={checkMatching}>Проверить пару</button></>}
            {feedback && <div className={`cloudy-feedback ${feedback}`}>{feedback === "correct" ? "✓ Правильно! Отличная работа." : "Не совсем так. Запомни правильный вариант и двигайся дальше."}<button className="cloudy-primary cloudy-check" onClick={continueSession}>Продолжить →</button></div>}
          </div>
        </section>
      )}
    </main>
  );
}
