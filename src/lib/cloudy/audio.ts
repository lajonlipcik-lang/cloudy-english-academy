type Tone = [number, number, number, OscillatorType?, number?];
let AC: AudioContext | null = null;
let MG: GainNode | null = null;
let cfg = { snd: 1, vol: 0.7, voice: 1 };
export const setAudioConfig = (c: typeof cfg) => (cfg = c);

export type SoundName = "tap" | "pick" | "tab" | "sheet" | "go" | "ok" | "match" | "bad" | "win" | "chest" | "star";

export function snd(t: SoundName, c = 0) {
  if (!cfg.snd || typeof window === "undefined") return;
  try {
    if (!AC) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return;
      AC = new Ctor();
      MG = AC.createGain();
      MG.connect(AC.destination);
    }
    if (AC.state === "suspended") void AC.resume();
    MG!.gain.value = cfg.vol;
    const b = 1 + Math.min(c, 7) * 0.07;
    const P: Record<SoundName, Tone[]> = {
      tap: [[560, 0, 0.07, "triangle"]], pick: [[420, 0, 0.08, "sine", 640], [640, 0.05, 0.08]], tab: [[760, 0, 0.07, "sine", 520]],
      sheet: [[300, 0, 0.25, "sine", 700]], go: [[330, 0, 0.3, "sine", 990]], ok: [[523 * b, 0, 0.18], [784 * b, 0.09, 0.26]],
      match: [[880, 0, 0.12], [1175, 0.07, 0.2]], bad: [[220, 0, 0.18, "sawtooth", 140], [150, 0.14, 0.22, "sawtooth", 100]],
      win: [[523, 0, 0.2], [659, 0.12, 0.2], [784, 0.24, 0.2], [1047, 0.36, 0.5]],
      chest: [[392, 0, 0.15], [523, 0.09, 0.15], [659, 0.18, 0.15], [784, 0.27, 0.15], [1047, 0.36, 0.15], [1319, 0.5, 0.6]],
      star: [[1200, 0, 0.15], [1600, 0.07, 0.25]],
    };
    P[t].forEach(([f, d, l, w, e]) => {
      const o = AC!.createOscillator(), g = AC!.createGain(), s = AC!.currentTime + d;
      o.type = w || "sine";
      o.frequency.setValueAtTime(f, s);
      if (e) o.frequency.exponentialRampToValueAtTime(e, s + l);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(t === "bad" ? 0.12 : 0.22, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + l + 0.05);
      o.connect(g); g.connect(MG!); o.start(s); o.stop(s + l + 0.1);
    });
  } catch { /* audio unavailable */ }
}

export const ttsSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

const maleAmericanVoiceName = /^(alex|aaron|fred|eddy|reed|tom|bruce|daniel|arthur|ralph)(\s|$)/i;

function selectMaleAmericanVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const american = voices.filter((voice) => /^en-US$/i.test(voice.lang || ""));
  return american.find((voice) => maleAmericanVoiceName.test(voice.name || ""))
    || american.find((voice) => /\b(male|masculine)\b/i.test(voice.name || ""))
    || null;
}

let speechRequestId = 0;

export function say(t: string, force = false) {
  if (!force && !cfg.voice) return;
  if (!ttsSupported() || !t) return;
  try {
    const requestId = ++speechRequestId;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(t);
    utterance.lang = "en-US";
    utterance.rate = 0.92;

    const speakWithAvailableVoice = () => {
      if (requestId !== speechRequestId) return;
      const voice = selectMaleAmericanVoice(speechSynthesis.getVoices());
      if (voice) utterance.voice = voice;
      speechSynthesis.speak(utterance);
    };

    if (speechSynthesis.getVoices().length) {
      speakWithAvailableVoice();
    } else {
      let started = false;
      const onVoicesChanged = () => {
        if (started) return;
        started = true;
        speechSynthesis.removeEventListener?.("voiceschanged", onVoicesChanged);
        speakWithAvailableVoice();
      };
      speechSynthesis.addEventListener?.("voiceschanged", onVoicesChanged, { once: true });
      window.setTimeout(() => {
        if (started) return;
        started = true;
        speechSynthesis.removeEventListener?.("voiceschanged", onVoicesChanged);
        speakWithAvailableVoice();
      }, 1200);
    }
  } catch { /* speech synthesis unavailable */ }
}

export const getSR = (): any =>
  typeof window === "undefined" ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
export const srSupported = () => !!getSR();

export function confetti(n = 40) {
  const c = ["#fff", "#bfe0ff", "#4db3ff", "#ffd35a", "#38d39a"];
  for (let k = 0; k < n; k++) {
    const d = document.createElement("i");
    d.className = "cf";
    d.style.cssText = `left:${Math.random() * 100}%;width:${6 + Math.random() * 6}px;height:${10 + Math.random() * 8}px;background:${c[k % 5]};--t:${2.4 + Math.random() * 1.6}s;--dx:${(Math.random() - 0.5) * 160}px;--r:${Math.random() * 900}deg;animation-delay:${Math.random() * 0.5}s`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 4500);
  }
}

export function toast(text: string, withSound = true) {
  if (withSound) snd("star");
  const d = document.createElement("div");
  d.className = "toast";
  d.textContent = text;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3200);
}

export function splash(l: string, title: string) {
  const s = document.createElement("div");
  s.className = "spl " + l;
  const lc = document.createElement("div"); lc.className = "lc " + l; lc.textContent = l;
  const h = document.createElement("h2"); h.textContent = title;
  s.append(lc, h);
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 1800);
}
