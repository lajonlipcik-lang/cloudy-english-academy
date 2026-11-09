/* Cloudy UI layer: appearance prefs, fonts, interface language, settings drawer, shorts gestures.
   Loaded BEFORE cloudy-english-app.js. Touches only presentation; learning logic stays untouched. */
(function () {
  "use strict";
  var KEY = "cloudy-ui-v1";
  var DEFAULTS = { accent: "sky", font: "nunito", motion: "full", lang: "ru", dbl: 1, prog: 1 };
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
  P.lang = ["ru", "en", "uk"].includes(P.lang) ? P.lang : "ru";
  P.dbl = P.dbl ? 1 : 0; P.prog = P.prog ? 1 : 0;
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} }

  function applyPrefs() {
    var h = document.documentElement;
    h.dataset.accent = P.accent;
    h.dataset.font = P.font;
    h.dataset.motion = P.motion;
    h.dataset.lang = P.lang;
    h.lang = { ru: "ru", en: "en", uk: "uk" }[P.lang] || "ru";
    h.style.setProperty("--font", (FONTS[P.font] || FONTS.nunito).css);
    loadFont(P.font);
    document.body && (document.body.dataset.prog = P.prog ? "1" : "0");
  }

  /* ---------- i18n (Russian text is the key) ---------- */
  var DICT = {
    "Учёба": ["Learn", "Навчання"], "Задания": ["Quests", "Завдання"], "Лига": ["League", "Ліга"],
    "Профиль": ["Profile", "Профіль"], "Видео": ["Videos", "Відео"], "Создать": ["Create", "Створити"],
    "Настройки": ["Settings", "Налаштування"], "Внешний вид": ["Appearance", "Вигляд"],
    "Цветовая тема": ["Colour theme", "Кольорова тема"], "Шрифт": ["Font", "Шрифт"],
    "Анимации": ["Animations", "Анімації"], "Плавные": ["Smooth", "Плавні"], "Спокойные": ["Calm", "Спокійні"],
    "Выключены": ["Off", "Вимкнено"], "Язык интерфейса": ["Interface language", "Мова інтерфейсу"],
    "Небо": ["Sky", "Небо"], "Мята": ["Mint", "М'ята"], "Закат": ["Sunset", "Захід"], "Виноград": ["Grape", "Виноград"],
    "Обучение": ["Learning", "Навчання"], "Цель на день": ["Daily goal", "Ціль на день"],
    "Звуковые эффекты": ["Sound effects", "Звукові ефекти"], "Громкость": ["Volume", "Гучність"],
    "Автоозвучка слов": ["Auto-pronounce words", "Автоозвучення слів"],
    "Практика произношения": ["Pronunciation practice", "Практика вимови"],
    "Напоминание": ["Reminder", "Нагадування"], "Время напоминания": ["Reminder time", "Час нагадування"],
    "Двойное касание — лайк": ["Double-tap to like", "Подвійний дотик — лайк"],
    "Полоса прогресса видео": ["Video progress bar", "Смуга прогресу відео"],
    "Аккаунт и данные": ["Account & data", "Акаунт і дані"], "Открыть профиль": ["Open profile", "Відкрити профіль"],
    "Сбросить прогресс": ["Reset progress", "Скинути прогрес"], "Сброс": ["Reset", "Скинути"],
    "Документы и поддержка": ["Documents & support", "Документи та підтримка"],
    "Вернуть внешний вид по умолчанию": ["Restore default look", "Повернути вигляд за замовчуванням"],
    "Видео": ["Videos", "Відео"],
    "Закрыть": ["Close", "Закрити"], "ЗАКРЫТЬ": ["CLOSE", "ЗАКРИТИ"], "ОТМЕНА": ["CANCEL", "СКАСУВАТИ"],
    "СБРОСИТЬ": ["RESET", "СКИНУТИ"], "Сбросить прогресс?": ["Reset progress?", "Скинути прогрес?"],
    "Уроки, XP и серия обнулятся. Настройки сохранятся.": ["Lessons, XP and streak will be cleared. Settings stay.", "Уроки, XP і серія обнуляться. Налаштування збережуться."],
    "дней подряд": ["day streak", "днів поспіль"], "XP всего": ["total XP", "XP всього"], "уроков": ["lessons", "уроків"],
    "точность": ["accuracy", "точність"], "Серия": ["Streak", "Серія"], "Серия дней": ["Day streak", "Серія днів"],
    "Задания дня": ["Daily quests", "Завдання дня"], "Пройди 2 урока": ["Complete 2 lessons", "Пройди 2 уроки"],
    "Дай 12 верных ответов": ["Give 12 correct answers", "Дай 12 правильних відповідей"],
    "Повторение ошибок": ["Review mistakes", "Повторення помилок"], "ПОВТОРИТЬ": ["REVIEW", "ПОВТОРИТИ"],
    "Сундук дня": ["Daily chest", "Скриня дня"], "Забрать": ["Claim", "Забрати"], "Получено": ["Claimed", "Отримано"],
    "Достигни цели и забери награду": ["Hit your goal to open it", "Досягни цілі й забери нагороду"],
    "ЗАБРАТЬ НАГРАДУ": ["CLAIM REWARD", "ЗАБРАТИ НАГОРОДУ"], "Награда получена": ["Reward claimed", "Нагороду отримано"],
    "НАЧАТЬ": ["START", "ПОЧАТИ"], "Практика с Клауди": ["Practice with Cloudy", "Практика з Клауді"],
    "Практика": ["Practice", "Практика"], "Рейтинг недели": ["Weekly ranking", "Рейтинг тижня"],
    "Достижения": ["Achievements", "Досягнення"], "Максимальная лига": ["Top league", "Найвища ліга"],
    "Вы": ["You", "Ви"], "Алекс": ["Alex", "Алекс"], "Мария": ["Maria", "Марія"], "Дима": ["Dima", "Діма"],
    "Лиза": ["Liza", "Ліза"], "Олег": ["Oleg", "Олег"],
    "Бронза": ["Bronze", "Бронза"], "Серебро": ["Silver", "Срібло"], "Золото": ["Gold", "Золото"],
    "Сапфир": ["Sapphire", "Сапфір"], "Бриллиант": ["Diamond", "Діамант"],
    "Соперники учебные: пример для будущей онлайн-лиги": ["Rivals are examples for a future online league", "Суперники навчальні: приклад для майбутньої онлайн-ліги"],
    "Подписки": ["Following", "Підписки"], "Для вас": ["For you", "Для вас"], "Звук": ["Sound", "Звук"],
    "Ещё": ["More", "Ще"], "Сохранить": ["Save", "Зберегти"], "Сохранено": ["Saved", "Збережено"],
    "+ Подписаться": ["+ Follow", "+ Підписатися"], "Вы подписаны": ["Following", "Ви підписані"],
    "Поделиться видео": ["Share video", "Поділитися відео"], "Удалить видео": ["Delete video", "Видалити відео"],
    "Комментарии": ["Comments", "Коментарі"], "Нравится": ["Like", "Подобається"], "Поиск": ["Search", "Пошук"],
    "Оригинальный звук · Cloudy English": ["Original sound · Cloudy English", "Оригінальний звук · Cloudy English"],
    "Фотография · Cloudy English": ["Photo · Cloudy English", "Фотографія · Cloudy English"],
    "Учебная заметка · Cloudy English": ["Study note · Cloudy English", "Навчальна нотатка · Cloudy English"],
    "Загружаем публикации…": ["Loading posts…", "Завантажуємо публікації…"],
    "Пока нет публикаций. Поделись первым учебным материалом!": ["No posts yet. Share the first study material!", "Ще немає публікацій. Поділися першим навчальним матеріалом!"],
    "Здесь появятся публикации авторов, на которых ты подпишешься.": ["Posts from authors you follow will appear here.", "Тут з'являться публікації авторів, на яких ти підпишешся."],
    "Загружаем обсуждение…": ["Loading discussion…", "Завантажуємо обговорення…"],
    "Публичный профиль": ["Public profile", "Публічний профіль"], "Аккаунт": ["Account", "Акаунт"],
    "Возраст": ["Age", "Вік"], "ИЗМЕНИТЬ": ["CHANGE", "ЗМІНИТИ"], "ВЫЙТИ": ["SIGN OUT", "ВИЙТИ"],
    "ВОЙТИ ИЛИ РЕГИСТРАЦИЯ": ["SIGN IN OR SIGN UP", "УВІЙТИ АБО РЕЄСТРАЦІЯ"],
    "Режим гостя": ["Guest mode", "Режим гостя"], "Ученик": ["Student", "Учень"],
    "Уровень английского": ["English level", "Рівень англійської"], "ПРОЙТИ ТЕСТ УРОВНЯ": ["TAKE LEVEL TEST", "ПРОЙТИ ТЕСТ РІВНЯ"],
    "Цель на сегодня": ["Today's goal", "Ціль на сьогодні"], "Календарь серии": ["Streak calendar", "Календар серії"],
    "Помощь и документы": ["Help & documents", "Допомога та документи"],
    "ДОКУМЕНТЫ И ПОДДЕРЖКА": ["DOCUMENTS & SUPPORT", "ДОКУМЕНТИ ТА ПІДТРИМКА"],
    "Управление приложением": ["App management", "Керування застосунком"],
    "Открыт": ["Public", "Відкритий"], "Закрыт": ["Private", "Закритий"],
    "О себе": ["About me", "Про себе"], "до 240 символов": ["up to 240 chars", "до 240 символів"],
    "Показывать мой профиль": ["Show my profile", "Показувати мій профіль"],
    "Начальный": ["Beginner", "Початковий"], "Элементарный": ["Elementary", "Елементарний"],
    "Средний": ["Intermediate", "Середній"], "Выше среднего": ["Upper-intermediate", "Вище середнього"],
    "Знаю базовые слова и фразы": ["I know basic words and phrases", "Знаю базові слова й фрази"],
    "Могу говорить на простые темы": ["I can talk about simple topics", "Можу говорити на прості теми"],
    "Поддерживаю беседу на знакомые темы": ["I can hold a conversation on familiar topics", "Підтримую розмову на знайомі теми"],
    "Свободно общаюсь и читаю сложные тексты": ["I communicate freely and read complex texts", "Вільно спілкуюся й читаю складні тексти"],
    "Какой у вас уровень английского?": ["What is your English level?", "Який у вас рівень англійської?"],
    "Выберите уровень, а затем мы проверим его коротким тестом": ["Pick a level and we'll check it with a short test", "Оберіть рівень, а потім ми перевіримо його коротким тестом"],
    "НЕ ЗНАЮ, ОПРЕДЕЛИТЬ ТЕСТОМ": ["NOT SURE — TEST ME", "НЕ ЗНАЮ, ВИЗНАЧИТИ ТЕСТОМ"],
    "Вход": ["Log in", "Вхід"], "Регистрация": ["Sign up", "Реєстрація"], "Пароль": ["Password", "Пароль"],
    "ВОЙТИ": ["LOG IN", "УВІЙТИ"], "СОЗДАТЬ АККАУНТ": ["CREATE ACCOUNT", "СТВОРИТИ АКАУНТ"], "или": ["or", "або"],
    "ВОЙТИ ЧЕРЕЗ GOOGLE": ["CONTINUE WITH GOOGLE", "УВІЙТИ ЧЕРЕЗ GOOGLE"],
    "ПРОДОЛЖИТЬ КАК ГОСТЬ": ["CONTINUE AS GUEST", "ПРОДОВЖИТИ ЯК ГІСТЬ"],
    "ПРОВЕРИТЬ": ["CHECK", "ПЕРЕВІРИТИ"], "ПОНЯТНО, ДАЛЬШЕ": ["GOT IT, NEXT", "ЗРОЗУМІЛО, ДАЛІ"],
    "Не знаю": ["I don't know", "Не знаю"], "ПРОДОЛЖИТЬ": ["CONTINUE", "ПРОДОВЖИТИ"],
    "Персональный экзамен": ["Personal exam", "Персональний іспит"], "Экзамен готов": ["Exam ready", "Іспит готовий"],
    "Экзамен не готов": ["Exam not ready", "Іспит не готовий"],
    "Загружаем твой прогресс…": ["Loading your progress…", "Завантажуємо твій прогрес…"],
    "Шпаргалка": ["Cheat sheet", "Шпаргалка"], "Цель дня": ["Daily goal", "Ціль дня"],
    "Шрифт, язык, анимации, звук": ["Font, language, animations, sound", "Шрифт, мова, анімації, звук"],
    "Пн": ["Mon", "Пн"], "Вт": ["Tue", "Вт"], "Ср": ["Wed", "Ср"], "Чт": ["Thu", "Чт"], "Пт": ["Fri", "Пт"], "Сб": ["Sat", "Сб"], "Вс": ["Sun", "Нд"]
  };
  var RX = [
    [/^Слов для повторения: (\d+)$/, ["Words to review: $1", "Слів для повторення: $1"]],
    [/^Ошибки: (\d+)$/, ["Mistakes: $1", "Помилки: $1"]],
    [/^Диалог на уровне (\S+)$/, ["Dialogue at level $1", "Діалог на рівні $1"]],
    [/^Уровень (\S+) пройден!$/, ["Level $1 complete!", "Рівень $1 пройдено!"]],
    [/^ПЕРЕЙТИ НА (\S+)$/, ["GO TO $1", "ПЕРЕЙТИ НА $1"]],
    [/^РАЗДЕЛ (\d+)$/, ["UNIT $1", "РОЗДІЛ $1"]],
    [/^(\d+) из (\d+) XP$/, ["$1 of $2 XP", "$1 з $2 XP"]],
    [/^Набери (\d+) XP$/, ["Earn $1 XP", "Набери $1 XP"]],
    [/^(\d+) лет$/, ["$1 years", "$1 років"]],
    [/^Лига: (.+)$/, ["League: $1", "Ліга: $1"]],
    [/^До лиги (.+): (\d+) XP$/, ["$2 XP to $1 league", "$2 XP до ліги $1"]],
    [/^Шпаргалка: (.+)$/, ["Cheat sheet: $1", "Шпаргалка: $1"]],
    [/^Проверка уровня (\S+)$/, ["Level check $1", "Перевірка рівня $1"]],
    [/^ПРОДОЛЖИТЬ С (\S+)$/, ["CONTINUE WITH $1", "ПРОДОВЖИТИ З $1"]],
    [/^Достижение: (.+)$/, ["Achievement: $1", "Досягнення: $1"]]
  ];
  var ACH_TR = {
    "Первый шаг": ["First step", "Перший крок"], "Серия 3": ["Streak 3", "Серія 3"], "Серия 7": ["Streak 7", "Серія 7"],
    "Без ошибок": ["No mistakes", "Без помилок"], "100 XP": ["100 XP", "100 XP"]
  };
  Object.keys(ACH_TR).forEach(function (k) { DICT[k] = ACH_TR[k]; });
  var LI = { en: 0, uk: 1 };

  function tr(src) {
    if (P.lang === "ru") return src;
    var key = src.trim(); if (!key) return src;
    var i = LI[P.lang], d = DICT[key];
    if (d) return src.replace(key, d[i]);
    for (var r = 0; r < RX.length; r++) {
      var m = key.match(RX[r][0]);
      if (m) return src.replace(key, RX[r][1][i].replace(/\$(\d)/g, function (_, n) { var v = m[+n]; if (v == null) return ""; var dd = DICT[v]; return dd ? dd[i] : v; }));
    }
    return src;
  }

  var last = new WeakMap();   // text node -> {src,out}
  var ATTRS = ["placeholder", "aria-label", "title"];
  function trText(n) {
    var rec = last.get(n), v = n.nodeValue;
    if (rec && v === rec.out) { if (P.lang === "ru") { n.nodeValue = rec.src; last.delete(n); } else { var o = tr(rec.src); if (o !== rec.out) { n.nodeValue = o; last.set(n, { src: rec.src, out: o }); } } return; }
    if (P.lang === "ru") return;
    var out = tr(v);
    if (out !== v) { n.nodeValue = out; last.set(n, { src: v, out: out }); }
  }
  function trAttrs(el) {
    for (var k = 0; k < ATTRS.length; k++) {
      var a = ATTRS[k]; if (!el.hasAttribute || !el.hasAttribute(a)) continue;
      var sk = "data-src-" + a, src = el.getAttribute(sk), cur = el.getAttribute(a);
      if (src == null) { src = cur; if (P.lang === "ru") continue; }
      var out = P.lang === "ru" ? src : tr(src);
      if (out !== cur) el.setAttribute(a, out);
      if (P.lang !== "ru" && out !== src) el.setAttribute(sk, src); else if (P.lang === "ru") el.removeAttribute(sk);
    }
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SVG: 1, svg: 1 };
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { trText(root); return; }
    if (root.nodeType !== 1 || SKIP[root.tagName]) return;
    trAttrs(root);
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.nodeType === 1 && SKIP[n.tagName] ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    var n; while ((n = tw.nextNode())) { if (n.nodeType === 3) trText(n); else trAttrs(n); }
  }
  var queue = [], scheduled = false, busy = false;
  function flush() {
    scheduled = false; busy = true;
    var q = queue; queue = [];
    try { q.forEach(walk); } finally { busy = false; }
  }
  var mo = new MutationObserver(function (list) {
    if (busy) return;
    var need = false;
    list.forEach(function (m) {
      if (m.type === "characterData") { queue.push(m.target); need = true; }
      else if (m.type === "attributes") { queue.push(m.target); need = true; }
      else m.addedNodes.forEach(function (n) { queue.push(n); need = true; });
    });
    if (need && !scheduled) { scheduled = true; requestAnimationFrame(flush); }
  });
  function startObserver() {
    if (!document.body) return;
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function retranslateAll() {
    busy = true; try { walk(document.body); } finally { busy = false; }
    var t = { ru: "Cloudy English", en: "Cloudy English", uk: "Cloudy English" };
    document.title = t[P.lang] || "Cloudy English";
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
    var langs = [["ru", "Русский"], ["en", "English"], ["uk", "Українська"]];
    var goals = [10, 20, 30, 50].map(function (n) { return [String(n), n + " XP"]; });
    var lock = !s;
    var html =
      '<header class="sp-head"><button type="button" class="sp-x" aria-label="Закрыть" onclick="CloudyUI.close()">' + ic("x") + '</button><h3>Настройки</h3><span class="sp-grip"></span></header>' +
      '<div class="sp-body">' +
      section("Внешний вид", ic("star"),
        '<div class="sp-block"><div class="sp-cap">Цветовая тема</div><div class="sp-swatches">' + accents + '</div></div>' +
        '<div class="sp-block"><div class="sp-cap">Шрифт</div><div class="sp-fonts">' + fonts + '</div></div>' +
        '<div class="sp-block"><div class="sp-cap">Анимации</div>' + seg([["full", "Плавные"], ["calm", "Спокойные"], ["off", "Выключены"]], P.motion, "CloudyUI.motion") + '</div>' +
        '<div class="sp-block"><div class="sp-cap">Язык интерфейса</div>' + seg(langs, P.lang, "CloudyUI.lang") + '</div>', 0) +
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
    retranslateAll();
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
    lang: function (v) { if (!["ru","en","uk"].includes(v)) return; P.lang = v; persist(); applyPrefs(); retranslateAll(); snd_("pick"); paint(true); },
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
    restore: function () { Object.assign(P, DEFAULTS); persist(); applyPrefs(); retranslateAll(); snd_("pick"); paint(true); },
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
  function boot() { applyPrefs(); startObserver(); retranslateAll(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
