const BLOCKED_COUNTRIES = new Set(["RU"]);
const BRAND_ASSETS = new Set(["/cloudy-icon.png", "/apple-touch-icon.png", "/favicon.ico"]);

function getTrustedCountry(request: Request): string | null {
  const headers = [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "cloudfront-viewer-country",
  ];

  for (const header of headers) {
    const value = request.headers.get(header)?.trim().toUpperCase();
    if (value && /^[A-Z]{2}$/.test(value) && value !== "XX" && value !== "T1") {
      return value;
    }
  }

  return null;
}

export function isCloudyRegionBlocked(request: Request): boolean {
  if (!BLOCKED_COUNTRIES.has(getTrustedCountry(request) ?? "")) return false;

  const url = new URL(request.url);
  const isBrandAsset = BRAND_ASSETS.has(url.pathname) &&
    (request.method === "GET" || request.method === "HEAD");

  return !isBrandAsset;
}

export function createCloudyRegionBlockedResponse(): Response {
  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#071b49">
  <meta name="robots" content="noindex,nofollow">
  <title>Доступ ограничен — Cloudy English</title>
  <style>
    :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      min-height: 100vh; min-height: 100dvh; display: grid; place-items: center;
      padding: max(24px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom));
      color: #f7fbff; overflow-x: hidden;
      background:
        radial-gradient(ellipse at 12% 15%, rgba(91,181,255,.25), transparent 38%),
        radial-gradient(ellipse at 90% 85%, rgba(37,117,224,.34), transparent 42%),
        linear-gradient(155deg, #050d2b 0%, #0a2a73 55%, #176bb4 100%);
    }
    .glow { position: fixed; width: 250px; height: 250px; border-radius: 50%; filter: blur(65px); opacity: .3; pointer-events: none; background: #76c7ff; }
    .glow.one { top: -120px; left: -100px; }
    .glow.two { right: -120px; bottom: -130px; background: #287de5; }
    main { position: relative; width: min(100%, 440px); text-align: center; }
    .brand { display: flex; align-items: center; justify-content: center; gap: 11px; margin-bottom: 24px; }
    .brand img { width: 42px; height: 42px; object-fit: contain; filter: drop-shadow(0 5px 14px rgba(85,180,255,.25)); }
    .brand span { font-size: 19px; font-weight: 800; letter-spacing: -.45px; }
    .panel {
      padding: clamp(25px, 7vw, 36px) clamp(20px, 6vw, 32px) 25px;
      border: 1px solid rgba(220,239,255,.17); border-radius: 28px;
      background: linear-gradient(145deg, rgba(24,51,91,.91), rgba(12,31,68,.94));
      box-shadow: 0 24px 70px rgba(0,8,32,.32), inset 0 1px 0 rgba(255,255,255,.07);
      backdrop-filter: blur(18px);
    }
    .mascot {
      width: 104px; height: 104px; margin: 0 auto 22px; display: grid; place-items: center;
      border-radius: 50%; background: linear-gradient(145deg, rgba(117,202,255,.25), rgba(41,112,205,.2));
      border: 1px solid rgba(197,231,255,.2); box-shadow: 0 12px 35px rgba(0,0,0,.18);
    }
    .mascot img { width: 76px; height: 76px; object-fit: contain; }
    .status {
      display: inline-flex; align-items: center; gap: 8px; margin-bottom: 18px; padding: 7px 12px;
      border-radius: 999px; color: #ffd99a; background: rgba(255,190,91,.12);
      border: 1px solid rgba(255,205,130,.18); font-size: 12px; font-weight: 750; letter-spacing: .2px;
    }
    .status i { width: 6px; height: 6px; border-radius: 50%; background: #ffbd62; box-shadow: 0 0 10px #ffbd62; }
    h1 { margin: 0; font-size: clamp(25px, 6vw, 31px); line-height: 1.18; letter-spacing: -.8px; }
    .lead { margin: 14px auto 0; max-width: 330px; color: #d1e2f7; font-size: 15px; line-height: 1.65; }
    .reason {
      margin-top: 25px; padding: 17px 16px; text-align: left; border-radius: 17px;
      background: rgba(111,166,226,.11); border: 1px solid rgba(190,222,255,.12);
    }
    .reason h2 { margin: 0 0 7px; font-size: 14px; font-weight: 800; }
    .reason p { margin: 0; color: #b9cde6; font-size: 13px; line-height: 1.55; }
    button {
      width: 100%; margin-top: 21px; padding: 15px 18px; border: 0; border-radius: 15px;
      color: #fff; font: inherit; font-size: 15px; font-weight: 800; cursor: pointer;
      background: linear-gradient(100deg, #55baff, #2879e8); box-shadow: 0 7px 20px rgba(26,112,224,.27);
      transition: transform .18s ease, filter .18s ease;
    }
    button:active { transform: scale(.985); filter: brightness(.95); }
    .footer { margin: 21px 0 0; color: rgba(202,222,246,.58); font-size: 11px; letter-spacing: .2px; }
    @media (max-width: 360px) { .panel { border-radius: 23px; } .lead { font-size: 14px; } }
    @media (prefers-reduced-motion: no-preference) {
      .mascot { animation: float 4s ease-in-out infinite; }
      @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    }
  </style>
</head>
<body>
  <div class="glow one"></div><div class="glow two"></div>
  <main>
    <div class="brand"><img src="/cloudy-icon.png" alt=""><span>Cloudy English</span></div>
    <section class="panel" aria-labelledby="blocked-title">
      <div class="mascot"><img src="/cloudy-icon.png" alt="Облачко Cloudy"></div>
      <div class="status"><i></i> ДОСТУП ОГРАНИЧЕН</div>
      <h1 id="blocked-title">К сожалению, доступ закрыт</h1>
      <p class="lead">Сервис сейчас недоступен для пользователей из вашего региона.</p>
      <div class="reason" id="region-reason">
        <h2>Почему я вижу это сообщение?</h2>
        <p>Cloudy English пока не может предоставить доступ к обучению с территории России в соответствии с региональными правилами доступности сервиса.</p>
      </div>
      <button type="button" id="understood">Понятно</button>
    </section>
    <p class="footer">Cloudy English · © 2026</p>
  </main>
  <script>
    document.getElementById("understood")?.addEventListener("click", function () {
      const reason = document.getElementById("region-reason");
      if (reason) reason.hidden = true;
      this.hidden = true;
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 403,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
      "x-robots-tag": "noindex, nofollow",
      "vary": "CF-IPCountry, X-Vercel-IP-Country, CloudFront-Viewer-Country",
    },
  });
}
