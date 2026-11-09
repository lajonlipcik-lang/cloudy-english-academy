const BLOCKED_COUNTRIES = new Set(["RU"]);
const PUBLIC_PATHS = new Set([
  "/legal",
  "/availability",
  "/cloudy-icon.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
]);
const LEGAL_BUNDLE_PREFIXES = ["/assets/", "/_build/"];
const LEGAL_BUNDLE_EXTENSIONS = /\.(?:css|js|mjs|woff2?|ttf|otf)$/i;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalRequest(request: Request): boolean {
  return LOCAL_HOSTS.has(new URL(request.url).hostname);
}

/**
 * The production app is deployed through Cloudflare's Nitro target.
 * Only Cloudflare's edge-generated country header is accepted.
 */
function getTrustedCountry(request: Request): string | null {
  // Cloudflare and Vercel inject edge-derived country headers.
  const value = (
    request.headers.get("cf-ipcountry")
    ?? request.headers.get("x-vercel-ip-country")
  )?.trim().toUpperCase();
  if (!value || !/^[A-Z]{2}$/.test(value) || value === "XX" || value === "T1") return null;
  return value;
}

export function isCloudyRegionBlocked(request: Request): boolean {
  const url = new URL(request.url);
  const isReadOnlyRequest = request.method === "GET" || request.method === "HEAD";
  const isLegalBundleAsset = LEGAL_BUNDLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
    && LEGAL_BUNDLE_EXTENSIONS.test(url.pathname);
  const isPublicGet = isReadOnlyRequest && (
    PUBLIC_PATHS.has(url.pathname) || isLegalBundleAsset
  );

  // Keep the legal center and only its generated application bundles public.
  // Root-level learning HTML, scripts, styles and APIs must pass the region gate.
  if (isPublicGet) return false;
  if (isLocalRequest(request)) return false;

  // Fail closed when the edge cannot provide a trustworthy country code.
  const country = getTrustedCountry(request);
  if (!country) return true;

  return BLOCKED_COUNTRIES.has(country);
}

export function createCloudyRegionBlockedResponse(): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#071b49">
  <meta name="robots" content="noindex,nofollow">
  <title>Cloudy English — Service availability</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-synthesis: none;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      min-height: 100vh;
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: max(28px, env(safe-area-inset-top)) 22px max(28px, env(safe-area-inset-bottom));
      color: #f7fbff;
      overflow-x: hidden;
      background:
        radial-gradient(ellipse at 12% 15%, rgba(91,181,255,.25), transparent 38%),
        radial-gradient(ellipse at 90% 85%, rgba(37,117,224,.34), transparent 42%),
        linear-gradient(155deg, #050d2b 0%, #0a2a73 55%, #176bb4 100%);
    }
    .glow {
      position: fixed; width: 250px; height: 250px; border-radius: 50%;
      filter: blur(65px); opacity: .3; pointer-events: none; background: #76c7ff;
    }
    .glow.one { top: -120px; left: -100px; }
    .glow.two { right: -120px; bottom: -130px; background: #287de5; }
    main {
      position: relative; width: min(100%, 440px); text-align: center;
      display: flex; flex-direction: column; align-items: center;
      padding: 8px 0; animation: appear .55s ease-out both;
    }
    .cloud-mascot { display:block; width:116px; height:94px; margin:0 auto 4px; overflow:visible; filter:drop-shadow(0 9px 20px rgba(104,190,255,.28)); }
    .cloud-mascot .eyes { transform-box:fill-box; transform-origin:center; animation:cloudBlink 4.2s infinite; }
    @keyframes cloudBlink { 0%,44%,48%,100% { transform:scaleY(1); } 46% { transform:scaleY(.08); } }
    .brand {
      margin: 0 0 12px; color: #d9efff; font-size: 19px;
      line-height: 1.25; font-weight: 750; letter-spacing: -.45px;
    }
    .status {
      margin: 0 0 13px; color: #ffb5c0; font-size: 12px;
      font-weight: 800; letter-spacing: .12em;
    }
    h1 {
      margin: 0; color: #fff; font-size: clamp(27px, 7vw, 34px);
      line-height: 1.16; font-weight: 800; letter-spacing: -.85px;
    }
    .lead {
      max-width: 355px; margin: 10px auto 0; color: #d1e2f7;
      font-size: 14px; line-height: 1.5; font-weight: 400;
    }
    .details {
      max-width: 360px; margin: 12px auto 0; color: #b9d1eb;
      font-size: 12px; line-height: 1.5;
    }
    .links {
      display: flex; flex-wrap: wrap; justify-content: center; gap: 9px 18px;
      margin-top: 16px;
    }
    a {
      color: #91d8ff; font-size: 13px; font-weight: 650;
      text-decoration: none; text-underline-offset: 4px;
    }
    a:hover, a:focus-visible { text-decoration: underline; }
    .support {
      display: inline-flex; align-items: center; justify-content: center;
      min-height: 44px; margin-top: 16px; padding: 0 23px;
      border-radius: 14px; color: #fff; font-size: 14px; font-weight: 750;
      background: linear-gradient(100deg, #55baff, #2879e8);
      box-shadow: 0 8px 24px rgba(26,112,224,.28);
    }
    .footer { margin: 16px 0 0; color: rgba(202,222,246,.58); font-size: 11px; }
    @keyframes appear { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 360px) {
      .cloud-mascot { width:104px; height:84px; }
      .brand { margin-bottom: 10px; }
      .lead { font-size: 14px; }
    }
    @media (prefers-reduced-motion: reduce) {
      main { animation: none; }
    }
  </style>
</head>
<body>
  <div class="glow one" aria-hidden="true"></div>
  <div class="glow two" aria-hidden="true"></div>
  <main>
    <svg class="cloud-mascot" viewBox="0 0 100 80" role="img" aria-label="Cloudy English cloud mascot"><path d="M26 68a18 18 0 0 1-2-37 24 24 0 0 1 46-6 20 20 0 0 1 6 43z" fill="#dff1ff"/><g class="eyes"><circle cx="40" cy="45" r="5" fill="#06143a"/><circle cx="62" cy="45" r="5" fill="#06143a"/><circle cx="42" cy="43" r="1.8" fill="#fff"/><circle cx="64" cy="43" r="1.8" fill="#fff"/></g><path d="M44 54q7 8 14 0" stroke="#06143a" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="31" cy="55" r="4" fill="#ff9fb0" opacity=".55"/><circle cx="71" cy="55" r="4" fill="#ff9fb0" opacity=".55"/></svg>
    <p class="brand">Cloudy English Academy</p>
    <h1 id="region-title">Cloudy English is not available in your region</h1>
    <p class="lead" id="region-lead">Cloudy English Academy cannot currently provide access from the country detected for your connection.</p>
    <p class="details" id="region-details">This is due to regional restrictions and the availability of the service’s technical providers. If you believe your country was detected incorrectly, please contact our support team.</p>
    <nav class="links" aria-label="Documents" id="region-links">
      <a href="/availability" id="region-availability">Country availability</a>
      <a href="/legal" id="region-legal">Legal documents</a>
    </nav>
    <a class="support" href="https://t.me/cloudysupport_t_bot" target="_blank" rel="noopener noreferrer">Contact support</a>
    <p class="footer">Cloudy English Academy · © 2026</p>
  </main>
  <script>
    (function () {
      var lang = "en";
      try {
        var prefs = JSON.parse(localStorage.getItem("cloudy-ui-v1") || "{}");
        if (prefs.lang === "ru" || prefs.lang === "uk") lang = prefs.lang;
      } catch (_) {}
      var copy = {
        en: {
          title: "Cloudy English is not available in your region",
          lead: "Cloudy English Academy cannot currently provide access from the country detected for your connection.",
          details: "This is due to regional restrictions and the availability of the service’s technical providers. If you believe your country was detected incorrectly, please contact our support team.",
          availability: "Country availability", legal: "Legal documents", support: "Contact support", docs: "Documents",
          pageTitle: "Cloudy English — Service availability", mascot: "Cloudy English cloud mascot"
        },
        ru: {
          title: "Сейчас мы недоступны в вашем регионе",
          lead: "К сожалению, Cloudy English Academy пока не может предоставить доступ из страны, определённой для вашего подключения.",
          details: "Это связано с региональными ограничениями и доступностью технических поставщиков сервиса. Если вы считаете, что страна определена неверно, пожалуйста, свяжитесь с нашей поддержкой.",
          availability: "Доступность по странам", legal: "Юридические документы", support: "Связаться с поддержкой", docs: "Документы",
          pageTitle: "Cloudy English — доступность сервиса", mascot: "Облачко Cloudy English"
        },
        uk: {
          title: "Cloudy English наразі недоступний у вашому регіоні",
          lead: "На жаль, Cloudy English Academy поки не може надати доступ із країни, визначеної для вашого підключення.",
          details: "Це пов’язано з регіональними обмеженнями та доступністю технічних постачальників сервісу. Якщо ви вважаєте, що країну визначено неправильно, зверніться до нашої служби підтримки.",
          availability: "Доступність за країнами", legal: "Юридичні документи", support: "Зв’язатися з підтримкою", docs: "Документи",
          pageTitle: "Cloudy English — доступність сервісу", mascot: "Хмаринка Cloudy English"
        }
      }[lang];
      document.documentElement.lang = lang;
      document.title = copy.pageTitle;
      document.getElementById("region-title").textContent = copy.title;
      document.getElementById("region-lead").textContent = copy.lead;
      document.getElementById("region-details").textContent = copy.details;
      document.getElementById("region-availability").textContent = copy.availability;
      document.getElementById("region-legal").textContent = copy.legal;
      document.getElementById("region-links").setAttribute("aria-label", copy.docs);
      document.querySelector(".support").textContent = copy.support;
      document.querySelector(".cloud-mascot").setAttribute("aria-label", copy.mascot);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 403,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
      "x-robots-tag": "noindex, nofollow",
      "vary": "CF-IPCountry",
    },
  });
}
