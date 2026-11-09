/* Cloudy UI layer: appearance preferences, fonts, settings drawer, shorts gestures.
   Loaded BEFORE cloudy-english-app.js. Touches only presentation; learning logic stays untouched. */
(function () {
  "use strict";
  var KEY = "cloudy-ui-v1";
  var DEFAULTS = { accent: "sky", font: "nunito", motion: "full", dbl: 1, prog: 1 };
  var P = Object.assign({}, DEFAULTS);
  try { Object.assign(P, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}

  /* ---------- fonts ---------- */
  var FONTS = {
    nunito:    { name: "Nunito",    css: "'Nunito',ui-rounded,system-ui,sans-serif",   gf: "Nunito:wght@500;700;800;900" },
    rubik:     { name: "Rubik",     css: "'Rubik',system-ui,sans-serif",               gf: "Rubik:wght@500;600;700;800" },
    manrope:   { name: "Manrope",   css: "'Manrope',system-ui,sans-serif",             gf: "Manrope:wght@500;700;800" },
    comfortaa: { name: "Comfortaa", css: "'Comfortaa','Nunito',system-ui,sans-serif",  gf: "Comfortaa:wght@500;600;700" },
    onest:     { name: "Onest",     css: "'Onest',system-ui,sans-serif",               gf: "Onest:wght@500;700;800;900" }
  };
  var loadedFonts = {};
  function loadFont(id) {
    var f = FONTS[id]; if (!f || loadedFonts[id]) return;
    loadedFonts[id] = 1;
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=" + f.gf + "&subset=cyrillic,latin&display=swap";
    document.head.appendChild(l);
  }

  var ACCENTS = {
    sky:    { n: "Небо",      c: ["#4db3ff", "#2d86f2"] },
    mint:   { n: "Мята",      c: ["#3ddc97", "#10a56a"] },
    sunset: { n: "Закат",     c: ["#ff9a5c", "#f0562e"] },
    grape:  { n: "Виноград",  c: ["#b58cff", "#7a49f0"] }
  };

  P.accent = ACCENTS[P.accent] ? P.accent : "sky";
  P.font = FONTS[P.font] ? P.font : "nunito";
  P.motion = ["full", "calm", "off"].includes(P.motion) ? P.motion : "full";

  P.dbl = P.dbl ? 1 : 0; P.prog = P.prog ? 1 : 0;
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} }
  // Drop the obsolete language preference while preserving all other settings.
  delete P.lang;
  persist();

  function applyPrefs() {
    var h = document.documentElement;
    h.dataset.accent = P.accent;
    h.dataset.font = P.font;
    h.dataset.motion = P.motion;
    h.lang = "ru";
    h.style.setProperty("--font", (FONTS[P.font] || FONTS.nunito).css);
    loadFont(P.font);
    document.body && (document.body.dataset.prog = P.prog ? "1" : "0");
  }

  /* ---------- helpers ---------- */
  function S_() { return typeof S !== "undefined" ? S : null; }
  function snd_(t) { try { if (typeof snd === "function") snd(t); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- settings drawer ---------- */
  var drawer = null;
  function sw(on, js, label) {
    return '<button class="sw ' + (on ? "on" : "") + '" type="button" role="switch" aria-checked="' + (on ? "true" : "false") +
      '" aria-label="' + esc(label) + '" onclick="' + js + '"><i></i></button>';
  }
  function row(label, ctl, ic) {
    return '<div class="sp-row"><span class="sp-lab">' + (ic ? '<em>' + ic + '</em>' : "") + '<span>' + label + '</span></span>' + ctl + '</div>';
  }
  function seg(items, cur, fnName) {
    return '<div class="sp-seg" style="--n:' + items.length + ';--i:' + Math.max(0, items.findIndex(function (x) { return x[0] === cur; })) + '"><i class="sp-seg-ind"></i>' +
      items.map(function (x) { return '<button type="button" class="' + (x[0] === cur ? "on" : "") + '" onclick="' + fnName + "('" + x[0] + "')" + '">' + x[1] + '</button>'; }).join("") + '</div>';
  }
  function section(title, icon, body, i) {
    return '<section class="sp-sec" style="--i:' + i + '"><h4><span>' + icon + '</span>' + title + '</h4><div class="sp-card">' + body + '</div></section>';
  }
  function render() {
    var s = S_(), set = (s && s.set) || {}, ic = typeof window.__ic === "function" ? window.__ic : function (n) { return '<svg class="i"><use href="#' + n + '"/></svg>'; };
    var accents = Object.keys(ACCENTS).map(function (k) {
      return '<button type="button" class="sp-sw ' + (P.accent === k ? "on" : "") + '" style="--a:' + ACCENTS[k].c[0] + ';--b:' + ACCENTS[k].c[1] + '" aria-label="' + ACCENTS[k].n +
        '" onclick="CloudyUI.set(\'accent\',\'' + k + '\')"><i></i><small>' + ACCENTS[k].n + '</small></button>';
    }).join("");
    var fonts = Object.keys(FONTS).map(function (k) {
      return '<button type="button" class="sp-font ' + (P.font === k ? "on" : "") + '" style="font-family:' + FONTS[k].css + '" onclick="CloudyUI.set(\'font\',\'' + k + '\')"><b>Aa</b><small>' + FONTS[k].name + '</small></button>';
    }).join("");

    var goals = [10, 20, 30, 50].map(function (n) { return [String(n), n + " XP"]; });
    var lock = !s;
    var html =
      '<header class="sp-head"><button type="button" class="sp-x" aria-label="Закрыть" onclick="CloudyUI.close()">' + ic("x") + '</button><h3>Настройки</h3><span class="sp-grip"></span></header>' +
      '<div class="sp-body">' +
      section("Внешний вид", ic("star"),
        '<div class="sp-block"><div class="sp-cap">Цветовая тема</div><div class="sp-swatches">' + accents + '</div></div>' +
        '<div class="sp-block"><div class="sp-cap">Шрифт</div><div class="sp-fonts">' + fonts + '</div></div>' +
        '<div class="sp-block"><div class="sp-cap">Анимации</div>' + seg([["full", "Плавные"], ["calm", "Спокойные"], ["off", "Выключены"]], P.motion, "CloudyUI.motion") + '</div>' +
        0) +
      (lock ? "" : section("Обучение", ic("book"),
        '<div class="sp-block"><div class="sp-cap">Цель на день</div>' + seg(goals, String(set.goal || 30), "CloudyUI.goal") + '</div>' +
        row("Звуковые эффекты", sw(set.snd, "CloudyUI.tog('snd')", "Звуковые эффекты")) +
        row("Громкость", '<input class="sp-range" type="range" min="0.1" max="1" step="0.05" value="' + (set.vol == null ? 0.7 : set.vol) + '" oninput="CloudyUI.vol(this.value)" onchange="CloudyUI.ping()">') +
        row("Автоозвучка слов", sw(set.voice, "CloudyUI.tog('voice')", "Автоозвучка слов")) +
        row("Практика произношения", sw(set.mic, "CloudyUI.tog('mic')", "Практика произношения")) +
        row("Напоминание", sw(set.rem, "CloudyUI.tog('rem')", "Напоминание")) +
        row("Время напоминания", '<input type="time" class="ti" value="' + (set.remT || "19:00") + '" onchange="CloudyUI.remT(this.value)">'), 1)) +
      section("Видео", ic("play"),
        row("Двойное касание — лайк", sw(P.dbl, "CloudyUI.pref('dbl')", "Двойное касание — лайк")) +
        row("Полоса прогресса видео", sw(P.prog, "CloudyUI.pref('prog')", "Полоса прогресса видео")), 2) +
      (lock ? "" : section("Аккаунт и данные", ic("user"),
        '<button type="button" class="sp-link" onclick="CloudyUI.profile()"><span>Открыть профиль</span><i>›</i></button>' +
        '<button type="button" class="sp-link" onclick="window.parent.location.href=\'/legal\'"><span>Документы и поддержка</span><i>›</i></button>' +
        '<button type="button" class="sp-link danger" onclick="CloudyUI.reset()"><span>Сбросить прогресс</span><i>›</i></button>', 3)) +
      '<button type="button" class="sp-restore" onclick="CloudyUI.restore()">Вернуть внешний вид по умолчанию</button>' +
      '</div>';
    return html;
  }
  function paint(keepScroll) {
    if (!drawer) return;
    var panel = drawer.querySelector(".sp-panel");
    var body = panel.querySelector(".sp-body"), top = body ? body.scrollTop : 0;
    var oldSeg = [].map.call(panel.querySelectorAll(".sp-seg"), function (e) { return e.style.getPropertyValue("--i"); });
    var oldSw = [].map.call(panel.querySelectorAll(".sw"), function (e) { return e.classList.contains("on"); });
    panel.innerHTML = render();
    if (keepScroll) { var b = panel.querySelector(".sp-body"); if (b) b.scrollTop = top; panel.classList.add("sp-still"); }
    // re-play slide / switch transitions that a full re-render would otherwise skip
    [].forEach.call(panel.querySelectorAll(".sp-seg"), function (e, k) {
      var nw = e.style.getPropertyValue("--i");
      if (oldSeg[k] != null && oldSeg[k] !== "" && oldSeg[k] !== nw) {
        e.style.setProperty("--i", oldSeg[k]); void e.offsetWidth;
        requestAnimationFrame(function () { e.style.setProperty("--i", nw); });
      }
    });
    [].forEach.call(panel.querySelectorAll(".sw"), function (e, k) {
      var now = e.classList.contains("on");
      if (oldSw[k] != null && oldSw[k] !== now) {
        e.classList.toggle("on", oldSw[k]); void e.offsetWidth;
        requestAnimationFrame(function () { e.classList.toggle("on", now); });
      }
    });

  }
  function open() {
    if (drawer) return;
    ["font"].forEach(function () { Object.keys(FONTS).forEach(loadFont); });
    drawer = document.createElement("div");
    drawer.className = "sp-root";
    drawer.innerHTML = '<div class="sp-scrim"></div><aside class="sp-panel" role="dialog" aria-modal="true"></aside>';
    document.body.appendChild(drawer);
    paint(false);
    drawer.querySelector(".sp-scrim").addEventListener("click", close);
    bindSwipe(drawer.querySelector(".sp-panel"));
    document.addEventListener("keydown", onKey);
    document.body.classList.add("sp-open");
    requestAnimationFrame(function () { requestAnimationFrame(function () { drawer && drawer.classList.add("in"); }); });
    snd_("sheet");
  }
  function close() {
    if (!drawer) return;
    var d = drawer; drawer = null;
    document.removeEventListener("keydown", onKey);
    d.classList.remove("in"); d.classList.add("out");
    document.body.classList.remove("sp-open");
    setTimeout(function () { d.remove(); }, P.motion === "off" ? 0 : 380);
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  function bindSwipe(panel) {
    var x0 = 0, y0 = 0, dx = 0, drag = false, lock = false;
    panel.addEventListener("touchstart", function (e) {
      var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; dx = 0; drag = true; lock = false;
    }, { passive: true });
    panel.addEventListener("touchmove", function (e) {
      if (!drag) return;
      var t = e.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
      if (!lock) { if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.4) lock = true; else if (Math.abs(my) > 10) { drag = false; return; } }
      if (lock && mx > 0) { dx = mx; panel.style.transition = "none"; panel.style.transform = "translateX(" + dx + "px)"; }
    }, { passive: true });
    panel.addEventListener("touchend", function () {
      if (!drag || !lock) { drag = false; return; }
      drag = false; panel.style.transition = ""; panel.style.transform = "";
      if (dx > 90) close();
    });
  }

  /* ---------- public API ---------- */
  var API = {
    open: open, close: close, prefs: function () { return P; },
    pref: function (k) { if (k !== "dbl" && k !== "prog") return; P[k] = P[k] ? 0 : 1; persist(); applyPrefs(); snd_("tap"); paint(true); },
    set: function (k, v) {
      if (k === "accent" && !ACCENTS[v] || k === "font" && !FONTS[v] || k === "motion" && !["full","calm","off"].includes(v)) return;
      if (!["accent","font","motion"].includes(k)) return;
      P[k] = v; persist(); applyPrefs(); snd_("pick");
      if (k === "accent") try { document.querySelector('meta[name="theme-color"]').content = ACCENTS[v].c[1]; } catch (e) {}
      paint(true);
    },
    motion: function (v) { API.set("motion", v); },
    tog: function (k) {
      var s = S_(); if (!s) return;
      s.set[k] = s.set[k] ? 0 : 1; save_(); snd_("tap");
      if (k === "rem" && s.set.rem) { try { Notification.requestPermission(); } catch (e) {} }
      paint(true);
    },
    goal: function (v) { var s = S_(); if (!s || ![10,20,30,50].includes(+v)) return; s.set.goal = +v; save_(); snd_("pick"); try { view(0); } catch (e) {} paint(true); },
    vol: function (v) { var s = S_(); if (!s) return; s.set.vol = Math.max(0.1, Math.min(1, Number(v) || 0.1)); save_(); },
    remT: function (v) { var s = S_(); if (!s) return; s.set.remT = v; save_(); },
    ping: function () { snd_("ok"); },
    profile: function () { close(); try { tab(3); } catch (e) {} },
    reset: function () { close(); try { rst(); } catch (e) {} },
    restore: function () { Object.assign(P, DEFAULTS); persist(); applyPrefs(); snd_("pick"); paint(true); },
    heart: heartBurst
  };
  function save_() { try { save(); } catch (e) {} }
  window.CloudyUI = API;

  /* ---------- shorts gestures: progress bar + double-tap like ---------- */
  document.addEventListener("timeupdate", function (e) {
    var v = e.target;
    if (!v || !v.classList || !v.classList.contains("shorts-real-video") || !v.duration) return;
    var c = v.closest(".shorts-video"); if (c) c.style.setProperty("--p", (v.currentTime / v.duration * 100).toFixed(2) + "%");
  }, true);

  function heartBurst(x, y, host) {
    var h = document.createElement("div");
    h.className = "tt-heart"; h.style.left = x + "px"; h.style.top = y + "px";
    h.style.setProperty("--rot", ((Math.random() * 30) - 15).toFixed(1) + "deg");
    h.innerHTML = '<svg viewBox="0 0 24 24"><use href="#heart"/></svg>';
    host.appendChild(h); setTimeout(function () { h.remove(); }, 900);
  }
  var tapT = 0, tapX = 0, tapY = 0;
  document.addEventListener("pointerup", function (e) {
    if (!P.dbl) return;
    var card = e.target.closest && e.target.closest(".shorts-video");
    if (!card || e.target.closest(".shorts-actions,.shorts-caption,.shorts-topbar,button,a")) return;
    var now = Date.now(), dx = Math.abs(e.clientX - tapX), dy = Math.abs(e.clientY - tapY);
    if (now - tapT < 320 && dx < 40 && dy < 40) {
      tapT = 0;
      var r = card.getBoundingClientRect();
      heartBurst(e.clientX - r.left, e.clientY - r.top, card);
      var id = card.dataset.shortId, btn = card.querySelector(".shorts-like");
      if (id && btn && !btn.classList.contains("liked") && typeof shortsLike === "function") shortsLike(id);
    } else { tapT = now; tapX = e.clientX; tapY = e.clientY; }
  }, true);

  /* ---------- boot ---------- */
  applyPrefs();
  function boot() { applyPrefs(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
