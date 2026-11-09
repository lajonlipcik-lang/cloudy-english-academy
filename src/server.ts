import "./lib/error-capture";

import cloudyAdminJs from "./server-assets/cloudy-admin.js?raw";
import cloudyCatalogJs from "./server-assets/cloudy-catalog.js?raw";
import cloudyEnglishAppJs from "./server-assets/cloudy-english-app.js?raw";
import cloudyEnglishCss from "./server-assets/cloudy-english.css?raw";
import cloudyUiCss from "./server-assets/cloudy-ui.css?raw";
import cloudyUiJs from "./server-assets/cloudy-ui.js?raw";
import cloudyEnglishHtml from "./server-assets/cloudy-english.html?raw";
import cloudyExercisesJs from "./server-assets/cloudy-exercises.js?raw";
import cloudyLearningJs from "./server-assets/cloudy-learning.js?raw";
import cloudySpeechJs from "./server-assets/cloudy-speech.js?raw";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { createCloudyRegionBlockedResponse, isCloudyRegionBlocked } from "./lib/region-access";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type LearningAsset = {
  body: string;
  contentType: string;
};

// These files intentionally live outside public/. Nitro's Cloudflare runtime can
// serve public assets before the application handler runs, bypassing our region gate.
// Keeping the learning shell and its dependencies in this server-only bundle ensures
// every request is checked in src/server.ts before any learning code is returned.
const LEARNING_ASSETS = new Map<string, LearningAsset>([
  ["/cloudy-english.html", { body: cloudyEnglishHtml, contentType: "text/html; charset=utf-8" }],
  ["/cloudy-english.css", { body: cloudyEnglishCss, contentType: "text/css; charset=utf-8" }],
  ["/cloudy-ui.css", { body: cloudyUiCss, contentType: "text/css; charset=utf-8" }],
  ["/cloudy-ui.js", { body: cloudyUiJs, contentType: "text/javascript; charset=utf-8" }],
  ["/cloudy-admin.js", { body: cloudyAdminJs, contentType: "text/javascript; charset=utf-8" }],
  ["/cloudy-catalog.js", { body: cloudyCatalogJs, contentType: "text/javascript; charset=utf-8" }],
  ["/cloudy-english-app.js", { body: cloudyEnglishAppJs, contentType: "text/javascript; charset=utf-8" }],
  ["/cloudy-exercises.js", { body: cloudyExercisesJs, contentType: "text/javascript; charset=utf-8" }],
  ["/cloudy-learning.js", { body: cloudyLearningJs, contentType: "text/javascript; charset=utf-8" }],
  ["/cloudy-speech.js", { body: cloudySpeechJs, contentType: "text/javascript; charset=utf-8" }],
]);

function serveLearningAsset(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const asset = LEARNING_ASSETS.get(new URL(request.url).pathname);
  if (!asset) return null;

  return new Response(request.method === "HEAD" ? null : asset.body, {
    status: 200,
    headers: {
      "content-type": asset.contentType,
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "vary": "CF-IPCountry",
    },
  });
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // This check must run before the learning shell or any of its scripts/styles
      // are returned. Do not move the learning files back into public/.
      if (isCloudyRegionBlocked(request)) {
        return createCloudyRegionBlockedResponse();
      }

      const learningAsset = serveLearningAsset(request);
      if (learningAsset) return learningAsset;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
