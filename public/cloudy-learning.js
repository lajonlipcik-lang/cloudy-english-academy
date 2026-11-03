/* Cloudy Learning Intelligence — device-local, versioned learner evidence.
 * No network calls, no credentials, no raw audio, no cross-user sharing.
 */
(() => {
  "use strict";
  const VERSION = 1;
  const MAX_EVENTS = 500;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const safeRead = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && value.version === VERSION && Array.isArray(value.events) && value.skills
        ? value : { version: VERSION, events: [], skills: {} };
    } catch { return { version: VERSION, events: [], skills: {} }; }
  };
  const storageKey = (scope) => "cl2:learning-intelligence:" + String(scope || "guest").slice(0, 180);
  const skillFor = (exercise) => {
    if (exercise && exercise.en) return "vocabulary:" + String(exercise.en).toLowerCase().trim();
    if (exercise && exercise.k === "b") return "grammar:sentence-building";
    if (exercise && exercise.k === "m") return "vocabulary:matching";
    if (exercise && exercise.k === "p") return "pronunciation:" + String(exercise.en || "").toLowerCase().trim();
    return "grammar:" + String(exercise && exercise.k || "unknown");
  };
  const scheduleDays = (mastery, evidence) => {
    if (evidence < 2 || mastery < 0.55) return 1;
    if (mastery < 0.7) return 2;
    if (mastery < 0.82) return 4;
    if (mastery < 0.92) return 7;
    return 14;
  };
  function record(scope, exercise, correct, options = {}) {
    if (!exercise || options.skipped) return null;
    const key = storageKey(scope), data = safeRead(key), now = Date.now();
    const skillId = skillFor(exercise), prior = data.skills[skillId] || {
      mastery: 0.5, evidence: 0, correct: 0, incorrect: 0, lastPracticed: 0, dueAt: 0
    };
    const retry = Boolean(options.retry);
    const weight = retry ? 0.35 : 1;
    const outcome = correct ? 1 : 0;
    const mastery = clamp(prior.mastery + (outcome - prior.mastery) * (0.22 * weight), 0.05, 0.98);
    const evidence = Math.min(1000, prior.evidence + weight);
    const next = {
      mastery,
      evidence,
      correct: prior.correct + (correct ? 1 : 0),
      incorrect: prior.incorrect + (correct ? 0 : 1),
      lastPracticed: now,
      dueAt: now + scheduleDays(mastery, evidence) * 86400000
    };
    data.skills[skillId] = next;
    data.events.push({
      v: VERSION, at: now, skillId, exerciseType: exercise.k || "unknown",
      correct: Boolean(correct), retry, responseSeconds: Number.isFinite(options.responseSeconds)
        ? clamp(Math.round(options.responseSeconds), 0, 3600) : null
    });
    if (data.events.length > MAX_EVENTS) data.events.splice(0, data.events.length - MAX_EVENTS);
    try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* progress app remains usable if storage is full */ }
    return { skillId, ...next };
  }
  function profile(scope) {
    const data = safeRead(storageKey(scope));
    const skills = Object.entries(data.skills).map(([id, value]) => ({ id, ...value, due: value.dueAt <= Date.now() }));
    return {
      version: VERSION,
      attempts: data.events.length,
      skills: skills.sort((a, b) => a.mastery - b.mastery),
      dueCount: skills.filter((skill) => skill.dueAt <= Date.now()).length,
      recentEvents: data.events.slice(-20).map(({ at, skillId, exerciseType, correct, retry }) => ({ at, skillId, exerciseType, correct, retry }))
    };
  }
  function prioritize(scope, exercises) {
    const data = safeRead(storageKey(scope));
    return exercises.map((exercise, index) => {
      const skill = data.skills[skillFor(exercise)];
      const due = skill && skill.dueAt <= Date.now();
      const weakness = skill ? 1 - skill.mastery : 0.25;
      return { exercise, index, score: (due ? 2 : 0) + weakness };
    }).sort((a, b) => b.score - a.score || a.index - b.index).map((item) => item.exercise);
  }
  window.CloudyLearning = Object.freeze({ version: VERSION, record, profile, prioritize });
})();
