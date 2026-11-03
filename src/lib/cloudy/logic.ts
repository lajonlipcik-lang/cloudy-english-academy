import { D, LVS, levelLessons, ruOf } from "./data";
import type { CloudyState, Exercise, Lesson, Level, Pair, Session } from "./types";

export type Rand = () => number;

export const defaultState = (): CloudyState => ({
  xp: 0, streak: 0, last: "", lv: "",
  dn: { A1: 0, A2: 0, B1: 0, B2: 0 },
  acc: [0, 0], mis: {}, days: [], ach: [], wk: { k: "", xp: 0 }, perf: 0, tested: 0,
  set: { snd: 1, vol: 0.7, voice: 1, goal: 30, mic: 1, th: "dark", rem: 0, remT: "19:00" },
  td: { d: "", xp: 0, les: 0, ok: 0, claim: 0 },
});

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Normalizes any stored/legacy state (including the original single-file "cl2" format). Never carries `user` or passwords. */
export function normalizeState(raw: unknown): CloudyState {
  const d = defaultState();
  if (!raw || typeof raw !== "object") return d;
  const j = raw as Record<string, any>;
  const s: CloudyState = {
    ...d,
    xp: num(j.xp), streak: num(j.streak), last: typeof j.last === "string" ? j.last : "",
    lv: LVS.includes(j.lv) ? j.lv : "",
    dn: { ...d.dn, ...(j.dn && typeof j.dn === "object" ? j.dn : {}) },
    acc: Array.isArray(j.acc) && j.acc.length === 2 ? [num(j.acc[0]), num(j.acc[1])] : [0, 0],
    mis: j.mis && typeof j.mis === "object" ? { ...j.mis } : {},
    days: Array.isArray(j.days) ? j.days.filter((x: unknown) => typeof x === "string") : [],
    ach: Array.isArray(j.ach) ? j.ach.filter((x: unknown) => typeof x === "string") : [],
    wk: j.wk && typeof j.wk === "object" ? { k: String(j.wk.k ?? ""), xp: num(j.wk.xp) } : d.wk,
    perf: num(j.perf), tested: num(j.tested),
    set: { ...d.set, ...(j.set && typeof j.set === "object" ? j.set : {}) },
    td: { ...d.td, ...(j.td && typeof j.td === "object" ? j.td : {}) },
  };
  // legacy migration from original: done counter without dn/lv
  if (!j.dn && j.done && j.lv === undefined) { s.dn.A1 = num(j.done); s.lv = "A1"; }
  if (s.set.th !== "light") s.set.th = "dark";
  return s;
}

export const dayKey = (d: Date) => d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
export function weekKey(d = new Date()) {
  const y = new Date(d.getFullYear(), 0, 1);
  return d.getFullYear() + "w" + Math.floor(((d.getTime() - y.getTime()) / 864e5 + y.getDay()) / 7);
}

export function rollDay(s: CloudyState, now = new Date()): CloudyState {
  const t = now.toDateString();
  return s.td.d !== t ? { ...s, td: { d: t, xp: 0, les: 0, ok: 0, claim: 0 } } : s;
}

export const shuffle = <T,>(a: readonly T[], r: Rand = Math.random): T[] => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};

export function choiceQuestion(en: string, ru: string, m: number, pool: Pair[], r: Rand = Math.random): Exercise {
  const o = shuffle([[en, ru] as Pair, ...shuffle(pool.filter((x) => x[0] !== en), r).slice(0, 3)], r);
  if (m === 2) return { k: "l", a: en, en, o: o.map((x) => x[0]), title: "Что вы слышите?" };
  return { k: "c", q: m ? en : ru, a: m ? ru : en, en, spk: !!m, o: o.map((x) => (m ? x[1] : x[0])), title: m ? "Что это значит?" : "Переведите на английский" };
}

export function buildExercises(l: Pick<Lesson, "w" | "s">, pool: Pair[], opts: { mic: boolean }, r: Rand = Math.random): Exercise[] {
  const out: Exercise[] = [];
  l.w.forEach(([en, ru], k) => out.push(choiceQuestion(en, ru, k % 3, pool, r)));
  const p = shuffle(l.w, r).slice(0, 4);
  if (p.length) out.push({ k: "m", L: shuffle(p.map((x) => [x[0], x[0]] as Pair), r), R: shuffle(p.map((x) => [x[1], x[0]] as Pair), r) });
  l.s.forEach(([ru, en, d]) => out.push({ k: "b", q: ru, a: en, o: shuffle([...en.split(" "), ...d.split(" ")], r), title: "Переведите на английский" }));
  if (l.w.length && opts.mic) out.push({ k: "p", en: shuffle(l.w, r)[0][0] });
  return shuffle(out, r);
}

export const newSession = (lesson: number, ex: Exercise[], review = false): Session => ({
  review, lesson, ex, i: 0, hp: 5, cmb: 0, ok: 0, tot: 0, lm: [], rt: review,
});

export function startReview(s: CloudyState, pool: Pair[], opts: { mic: boolean }, r: Rand = Math.random): Session | null {
  const w = Object.keys(s.mis).slice(0, 8).map((en) => [en, ruOf(en)] as Pair).filter((x) => x[1]);
  if (!w.length) return null;
  return newSession(-1, buildExercises({ w, s: [] }, pool, opts, r), true);
}

function addMistake(s: CloudyState, sess: Session, en?: string): [CloudyState, Session] {
  if (!en) return [s, sess];
  return [{ ...s, mis: { ...s.mis, [en]: (s.mis[en] || 0) + 1 } }, sess.lm.includes(en) ? sess : { ...sess, lm: [...sess.lm, en] }];
}

/** One graded answer (choice, listening, builder, pronunciation, or a single matching pair). */
export function applyAnswer(s: CloudyState, sess: Session, good: boolean, en?: string): { state: CloudyState; session: Session } {
  if (good) {
    let st = s;
    if (sess.review && en && st.mis[en]) {
      const mis = { ...st.mis };
      if (--mis[en] <= 0) delete mis[en];
      st = { ...st, mis };
    }
    return { state: st, session: { ...sess, ok: sess.ok + 1, tot: sess.tot + 1, cmb: sess.cmb + 1 } };
  }
  const [st, se] = addMistake(s, sess, en);
  return { state: st, session: { ...se, hp: se.hp - 1, cmb: 0, tot: se.tot + 1 } };
}

/** Skipping (e.g. pronunciation) is neutral: not counted as correct nor as an attempt. */
export const skipAnswer = (sess: Session): Session => ({ ...sess, cmb: 0 });

/** Advance; appends up to 3 retry questions for mistaken words once. Returns null when finished. */
export function advance(sess: Session, pool: Pair[], r: Rand = Math.random): Session | null {
  let next = { ...sess, i: sess.i + 1 };
  if (next.i >= next.ex.length && !next.rt && next.lm.length) {
    next = { ...next, rt: true, ex: [...next.ex, ...next.lm.slice(0, 3).map((en) => choiceQuestion(en, ruOf(en), (r() * 2) | 0, pool, r))] };
  }
  return next.i >= next.ex.length ? null : next;
}

export const lessonGain = (hp: number) => 15 + Math.max(hp, 0) * 3;
export const lessonStars = (hp: number) => (hp >= 5 ? 3 : hp >= 3 ? 2 : 1);
export const accuracy = (ok: number, tot: number) => Math.round((ok / Math.max(tot, 1)) * 100);

export function updateStreak(s: CloudyState, now: Date): CloudyState {
  const t = now.toDateString();
  const y = new Date(now.getTime() - 864e5).toDateString();
  if (s.last === t) return s;
  return { ...s, streak: s.last === y ? s.streak + 1 : 1, last: t };
}

export function finishLesson(s0: CloudyState, sess: Session, now = new Date()) {
  let s = updateStreak(rollDay(s0, now), now);
  const gain = lessonGain(sess.hp);
  const t = dayKey(now);
  const days = s.days.includes(t) ? s.days : [...s.days, t].slice(-60);
  const w = weekKey(now);
  const wk = s.wk.k !== w ? { k: w, xp: 0 } : { ...s.wk };
  wk.xp += gain;
  s = {
    ...s, xp: s.xp + gain, days, wk,
    perf: sess.hp >= 5 && !sess.review ? s.perf + 1 : s.perf,
    td: { ...s.td, xp: s.td.xp + gain, les: s.td.les + (sess.review ? 0 : 1), ok: s.td.ok + sess.ok },
    acc: [s.acc[0] + sess.ok, s.acc[1] + sess.tot],
  };
  if (!sess.review && s.lv) {
    const lv = s.lv as Level;
    const ps = levelLessons(lv);
    if (ps.indexOf(sess.lesson) === s.dn[lv] && s.dn[lv] < ps.length) s = { ...s, dn: { ...s.dn, [lv]: s.dn[lv] + 1 } };
  }
  return { state: s, gain, stars: lessonStars(sess.hp), acc: accuracy(sess.ok, sess.tot) };
}

export function claimChest(s: CloudyState): CloudyState | null {
  if (s.td.xp >= s.set.goal && !s.td.claim) return { ...s, xp: s.xp + 25, td: { ...s.td, claim: 1 } };
  return null;
}

export const ACH: [string, string, string, string, (s: CloudyState) => boolean][] = [
  ["first", "Первый шаг", "Набрать XP", "bolt", (s) => s.xp > 0],
  ["s3", "Серия 3", "3 дня подряд", "flame", (s) => s.streak >= 3],
  ["s7", "Серия 7", "7 дней подряд", "flame", (s) => s.streak >= 7],
  ["perf", "Без ошибок", "Урок без потерь", "heart", (s) => s.perf > 0],
  ["x1", "100 XP", "Набрать 100 XP", "star", (s) => s.xp >= 100],
  ["x5", "500 XP", "Набрать 500 XP", "star", (s) => s.xp >= 500],
  ["a1", "Уровень A1", "Пройти A1", "check", (s) => s.dn.A1 >= 6],
  ["tst", "Знаток", "Пройти тест", "target", (s) => s.tested > 0],
];
export const newAchievements = (s: CloudyState) => ACH.filter((a) => a[4](s) && !s.ach.includes(a[0]));

export const hasProgress = (s: CloudyState) => s.xp > 0 || s.tested > 0 || Object.values(s.dn).some((n) => n > 0) || s.lv !== "";

/** Safe guest→account merge: never loses data on either side. */
export function mergeProgress(guest: CloudyState, account: CloudyState | null): CloudyState {
  if (!account) return guest;
  const dn = { ...account.dn };
  (Object.keys(dn) as Level[]).forEach((k) => (dn[k] = Math.max(dn[k], guest.dn[k])));
  const mis = { ...account.mis };
  Object.entries(guest.mis).forEach(([k, v]) => (mis[k] = (mis[k] || 0) + v));
  const lastNewer = new Date(guest.last || 0).getTime() > new Date(account.last || 0).getTime();
  const wk = account.wk.k === guest.wk.k ? { k: account.wk.k, xp: account.wk.xp + guest.wk.xp } : lastNewer ? guest.wk : account.wk;
  return {
    ...account,
    xp: account.xp + guest.xp,
    streak: Math.max(account.streak, guest.streak),
    last: lastNewer ? guest.last : account.last,
    lv: account.lv || guest.lv,
    dn, mis, wk,
    acc: [account.acc[0] + guest.acc[0], account.acc[1] + guest.acc[1]],
    days: Array.from(new Set([...account.days, ...guest.days])).slice(-60),
    ach: Array.from(new Set([...account.ach, ...guest.ach])),
    perf: account.perf + guest.perf,
    tested: Math.max(account.tested, guest.tested),
  };
}

export const lessonTitle = (i: number) => D[i]?.t ?? "";
