/* Cloudy Learning Intelligence — device-local evidence and an offline event outbox.
 * Server sync always derives user_id from the authenticated Supabase session.
 * No credentials or raw audio are collected.
 */
(() => {
  "use strict";
  const VERSION = 2, MAX_EVENTS = 1000;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const makeId = () => {
    try { if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID(); } catch { /* fallback */ }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); });
  };
  const safeRead = key => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      if (!value || !Array.isArray(value.events) || !value.skills || ![1, VERSION].includes(value.version)) return { version: VERSION, events: [], skills: {}, activeSession: null };
      const events = value.events.map(event => event && event.eventId ? event : { ...event, eventId: makeId(), eventType: "answer_submitted", sessionId: null, synced: true });
      return { ...value, version: VERSION, events, activeSession: value.activeSession || null };
    } catch { return { version: VERSION, events: [], skills: {}, activeSession: null }; }
  };
  const storageKey = scope => "cl2:learning-intelligence:" + String(scope || "guest").slice(0, 180);
  const skillFor = exercise => {
    if (exercise && exercise.en) return "vocabulary:" + String(exercise.en).toLowerCase().trim();
    if (exercise && exercise.k === "b") return "grammar:sentence-building";
    if (exercise && exercise.k === "m") return "vocabulary:matching";
    if (exercise && exercise.k === "p") return "pronunciation:" + String(exercise.en || "").toLowerCase().trim();
    return "grammar:" + String(exercise && exercise.k || "unknown");
  };
  const scheduleDays = (mastery, evidence) => evidence < 2 || mastery < 0.55 ? 1 : mastery < 0.7 ? 2 : mastery < 0.82 ? 4 : mastery < 0.92 ? 7 : 14;
  const cleanText = (value, max = 160) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  function save(key, data) {
    if (data.events.length > MAX_EVENTS) {
      const overflow = data.events.length - MAX_EVENTS, acknowledged = data.events.filter(event => event.synced).slice(0, overflow);
      const remove = new Set(acknowledged.map(event => event.eventId));
      data.events = data.events.filter(event => !remove.has(event.eventId));
      if (data.events.length > MAX_EVENTS) data.events.splice(0, data.events.length - MAX_EVENTS);
    }
    try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* learning remains usable */ }
  }
  function emit(scope, event) {
    try { window.dispatchEvent(new CustomEvent("cloudy:learning-updated", { detail: { scope: String(scope || "guest"), event } })); } catch { /* offline learning remains usable */ }
  }
  function appendEvent(scope, data, event) { data.events.push(event); save(storageKey(scope), data); emit(scope, event); return event; }
  function track(scope, eventType, details = {}) {
    const key = storageKey(scope), data = safeRead(key), session = data.activeSession;
    if (!["question_skipped", "hint_used"].includes(eventType)) return null;
    return appendEvent(scope, data, {
      eventId: makeId(), eventType, at: Date.now(), sessionId: session?.sessionId || null,
      level: session?.level || null, lessonIndex: Number.isInteger(session?.lessonIndex) ? session.lessonIndex : null,
      exerciseType: cleanText(details.exerciseType, 24) || null, skillId: cleanText(details.skillId, 90) || null,
      correct: null, retry: false, responseSeconds: null, selectedAnswer: null, correctAnswer: null, synced: false
    });
  }
  function beginSession(scope, context = {}) {
    const key = storageKey(scope), data = safeRead(key);
    if (data.activeSession?.sessionId) endSession(scope, "lesson_abandoned");
    const session = {
      sessionId: makeId(), startedAt: Date.now(),
      level: ["A1", "A2", "B1", "B2"].includes(String(context.level)) ? String(context.level) : null,
      lessonIndex: Number.isInteger(context.lessonIndex) ? clamp(context.lessonIndex, -1, 1000) : null,
      sessionType: context.sessionType === "review" ? "review" : "lesson"
    };
    data.activeSession = session; save(key, data);
    appendEvent(scope, data, {
      eventId: makeId(), eventType: "session_started", at: session.startedAt, sessionId: session.sessionId,
      level: session.level, lessonIndex: session.lessonIndex, exerciseType: null, skillId: null,
      correct: null, retry: false, responseSeconds: null, selectedAnswer: null, correctAnswer: null,
      sessionType: session.sessionType, synced: false
    });
    return session.sessionId;
  }
  function endSession(scope, outcome = "lesson_completed") {
    const key = storageKey(scope), data = safeRead(key), session = data.activeSession;
    if (!session?.sessionId) return null;
    const eventType = ["lesson_completed", "lesson_failed", "lesson_abandoned"].includes(outcome) ? outcome : "lesson_abandoned";
    data.activeSession = null;
    return appendEvent(scope, data, {
      eventId: makeId(), eventType, at: Date.now(), sessionId: session.sessionId,
      level: session.level, lessonIndex: session.lessonIndex, exerciseType: null, skillId: null,
      correct: null, retry: false, responseSeconds: null, selectedAnswer: null, correctAnswer: null,
      sessionType: session.sessionType, synced: false
    });
  }
  function record(scope, exercise, correct, options = {}) {
    if (!exercise || options.skipped) return null;
    const key = storageKey(scope), data = safeRead(key), now = Date.now(), skillId = skillFor(exercise);
    const prior = data.skills[skillId] || { mastery: 0.5, evidence: 0, correct: 0, incorrect: 0, lastPracticed: 0, dueAt: 0 };
    const retry = Boolean(options.retry), weight = retry ? 0.35 : 1, outcome = correct ? 1 : 0;
    const mastery = clamp(prior.mastery + (outcome - prior.mastery) * (0.22 * weight), 0.05, 0.98);
    const evidence = Math.min(1000, prior.evidence + weight);
    data.skills[skillId] = { mastery, evidence, correct: prior.correct + (correct ? 1 : 0), incorrect: prior.incorrect + (correct ? 0 : 1), lastPracticed: now, dueAt: now + scheduleDays(mastery, evidence) * 86400000 };
    const session = data.activeSession;
    appendEvent(scope, data, {
      eventId: makeId(), eventType: "answer_submitted", at: now, sessionId: session?.sessionId || null,
      level: session?.level || null, lessonIndex: Number.isInteger(session?.lessonIndex) ? session.lessonIndex : null,
      skillId, exerciseType: cleanText(exercise.k || "unknown", 24), correct: Boolean(correct), retry,
      responseSeconds: Number.isFinite(options.responseSeconds) ? clamp(Math.round(options.responseSeconds), 0, 3600) : null,
      selectedAnswer: cleanText(options.selectedAnswer, 160) || null,
      correctAnswer: cleanText(options.correctAnswer ?? exercise.a ?? exercise.en, 160) || null, synced: false
    });
    return { skillId, ...data.skills[skillId] };
  }
  function profile(scope) {
    const data = safeRead(storageKey(scope)), skills = Object.entries(data.skills).map(([id, value]) => ({ id, ...value, due: value.dueAt <= Date.now() }));
    const answers = data.events.filter(event => event.eventType === "answer_submitted");
    return { version: VERSION, attempts: answers.length, skills: skills.sort((a, b) => a.mastery - b.mastery), dueCount: skills.filter(skill => skill.dueAt <= Date.now()).length, recentEvents: answers.slice(-20).map(({ at, skillId, exerciseType, correct, retry }) => ({ at, skillId, exerciseType, correct, retry })) };
  }
  function pending(scope, limit = 50) {
    return safeRead(storageKey(scope)).events.filter(event => !event.synced && event.eventId).slice(0, clamp(Number(limit) || 50, 1, 50)).map(({ synced, ...event }) => event);
  }
  function acknowledge(scope, eventIds) {
    if (!Array.isArray(eventIds) || !eventIds.length) return 0;
    const key = storageKey(scope), data = safeRead(key), accepted = new Set(eventIds.map(String)); let count = 0;
    data.events = data.events.map(event => { if (!event.synced && accepted.has(event.eventId)) { count++; return { ...event, synced: true }; } return event; });
    save(key, data); return count;
  }
  function prioritize(scope, exercises) {
    const data = safeRead(storageKey(scope));
    return exercises.map((exercise, index) => { const skill = data.skills[skillFor(exercise)], due = skill && skill.dueAt <= Date.now(), weakness = skill ? 1 - skill.mastery : 0.25; return { exercise, index, score: (due ? 2 : 0) + weakness }; }).sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.exercise);
  }
  window.CloudyLearning = Object.freeze({ version: VERSION, record, profile, prioritize, beginSession, endSession, track, pending, acknowledge });
})();
