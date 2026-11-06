import { normalizeState } from "./logic";
import type { CloudyState } from "./types";

export const CLOUDY_LESSON_XP = 24;
export const CLOUDY_MAX_DAILY_LESSON_AWARDS = 5;

const LESSONS_BY_LEVEL: Record<string, readonly number[]> = {
  A1: [0, 1, 2, 3, 4, 5, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 54, 55, 56],
  A2: [6, 7, 8, 15, 16, 17, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 57, 58, 59],
  B1: [9, 10, 11, 18, 19, 20],
  B2: [12, 13, 14, 21, 22, 23],
};

export function isLessonInLevel(lessonIndex: number, level: string): boolean {
  return Number.isInteger(lessonIndex) && (LESSONS_BY_LEVEL[level]?.includes(lessonIndex) ?? false);
}

const clampInt = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.trunc(Number.isFinite(value) ? value : min)));

/**
 * Whitelist and bound all browser-supplied progress before a service-role write.
 * XP is subsequently overwritten by the database ledger; client-owned counters
 * remain display/progress hints and are never used to authorize XP awards.
 */
export function sanitizeCloudyProgress(raw: unknown): CloudyState {
  const state = normalizeState(raw);
  state.streak = clampInt(state.streak, 0, 3650);
  state.last = state.last.slice(0, 40);
  state.dn = {
    A1: clampInt(state.dn.A1, 0, 24),
    A2: clampInt(state.dn.A2, 0, 24),
    B1: clampInt(state.dn.B1, 0, 6),
    B2: clampInt(state.dn.B2, 0, 6),
  };
  state.acc = [
    clampInt(state.acc[0], 0, 1_000_000),
    clampInt(state.acc[1], 0, 1_000_000),
  ];
  state.mis = Object.fromEntries(
    Object.entries(state.mis).slice(0, 200)
      .filter(([word]) => word.length > 0 && word.length <= 80)
      .map(([word, count]) => [word, clampInt(count, 0, 10_000)]),
  );
  state.days = [...new Set(state.days.filter((day) => /^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$/.test(day)).slice(-60))];
  state.ach = [...new Set(state.ach.filter((id) => /^[a-z0-9_-]{1,24}$/i.test(id)).slice(0, 32))];
  state.wk = {
    k: state.wk.k.slice(0, 16),
    xp: clampInt(state.wk.xp, 0, 1_000_000),
  };
  state.perf = clampInt(state.perf, 0, 100_000);
  state.tested = state.tested ? 1 : 0;
  state.set = {
    snd: state.set.snd ? 1 : 0,
    vol: Math.min(1, Math.max(0, state.set.vol)),
    voice: state.set.voice ? 1 : 0,
    goal: clampInt(state.set.goal, 5, 240),
    mic: state.set.mic ? 1 : 0,
    th: state.set.th,
    rem: state.set.rem ? 1 : 0,
    remT: /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(state.set.remT) ? state.set.remT : "19:00",
  };
  state.td = {
    d: state.td.d.slice(0, 40),
    xp: clampInt(state.td.xp, 0, 100_000),
    les: clampInt(state.td.les, 0, 1000),
    ok: clampInt(state.td.ok, 0, 100_000),
    claim: state.td.claim ? 1 : 0,
  };
  return state;
}
