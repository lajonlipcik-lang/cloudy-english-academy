export type Level = "A1" | "A2" | "B1" | "B2";
export type Pair = [string, string];
export interface Lesson {
  t: string;
  w: Pair[];
  s: [string, string, string][];
}
export interface Section {
  n: string;
  l: number[];
}
export interface LevelDef {
  s: Section[];
}

export interface Settings {
  snd: number;
  vol: number;
  voice: number;
  goal: number;
  mic: number;
  th: "dark" | "light";
  rem: number;
  remT: string;
}

export interface Today {
  d: string;
  xp: number;
  les: number;
  ok: number;
  claim: number;
}

export interface CloudyState {
  xp: number;
  streak: number;
  last: string;
  lv: Level | "";
  dn: Record<Level, number>;
  acc: [number, number];
  mis: Record<string, number>;
  days: string[];
  ach: string[];
  wk: { k: string; xp: number };
  perf: number;
  tested: number;
  set: Settings;
  td: Today;
}

export type Exercise =
  | { k: "c"; q: string; a: string; en: string; spk: boolean; o: string[]; title: string }
  | { k: "l"; a: string; en: string; o: string[]; title: string }
  | { k: "b"; q: string; a: string; o: string[]; title: string; en?: undefined }
  | { k: "m"; L: Pair[]; R: Pair[]; en?: undefined }
  | { k: "p"; en: string };

export interface Session {
  review: boolean;
  lesson: number; // -1 for review
  ex: Exercise[];
  i: number;
  hp: number;
  cmb: number;
  ok: number;
  tot: number;
  lm: string[];
  rt: boolean;
}
