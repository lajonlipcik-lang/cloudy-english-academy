import { createFileRoute } from "@tanstack/react-router";

type JsonRecord = Record<string, unknown>;

const objectValue = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};

async function dispatchMobileAction(action: string, input: JsonRecord): Promise<unknown> {
  if (action === "progress-save") {
    const api = await import("@/lib/cloudy/progress.functions");
    return api.saveCloudyProgress({ data: input as never });
  }
  if (action === "lesson-complete") {
    const api = await import("@/lib/cloudy/progress.functions");
    return api.awardCloudyLessonXp({ data: input as never });
  }
  if (action === "learning-events") {
    const api = await import("@/lib/cloudy-ai.functions");
    return api.syncCloudyLearningEvents({ data: input as never });
  }
  if (action === "ai-chat") {
    const api = await import("@/lib/cloudy-ai.functions");
    return api.cloudyTutorChat({ data: input as never });
  }
  if (action === "tts") {
    const api = await import("@/lib/cloudy-ai.functions");
    return api.cloudyTextToSpeech({ data: {
      accessToken: input.accessToken,
      message: String(input.text ?? input.message ?? ""),
    } });
  }
  if (action.startsWith("learning-exam-")) {
    const api = await import("@/lib/cloudy-ai.functions");
    return api.cloudyPersonalExam({
      data: {
        ...input,
        examAction: action.slice("learning-exam-".length),
      } as never,
    });
  }

  if (action.startsWith("chat-history-")) {
    const api = await import("@/lib/cloudy/chat-history.functions");
    if (action === "chat-history-get") return api.listCloudyChatHistory({ data: input as never });
    if (action === "chat-history-save") return api.saveCloudyChatThread({ data: input as never });
    if (action === "chat-history-delete") return api.deleteCloudyChatThread({ data: input as never });
  }

  if (action.startsWith("privacy-")) {
    const api = await import("@/lib/cloudy/privacy-center.functions");
    if (action === "privacy-center-get") return api.getCloudyPrivacyCenter({ data: input as never });
    if (action === "privacy-consent-set") return api.setCloudyAiTrainingConsent({ data: input as never });
    if (action === "privacy-request-create") return api.createCloudyPrivacyRequest({ data: input as never });
    if (action === "privacy-data-export") return api.exportCloudyPersonalData({ data: input as never });
  }

  if (["shorts-moderate", "shorts-frame-review", "shorts-audio-review",
       "shorts-comments-get", "shorts-comment-create", "shorts-comment-like-set"].includes(action)) {
    const api = await import("@/lib/cloudy-ai.functions");
    switch (action) {
      case "shorts-moderate": return api.moderateOwnShortContent({ data: input as never });
      case "shorts-frame-review": return api.analyzeShortVideoFrames({ data: input as never });
      case "shorts-audio-review": return api.analyzeShortVideoAudio({ data: input as never });
      case "shorts-comments-get": return api.getShortsComments({ data: input as never });
      case "shorts-comment-create": return api.createShortComment({ data: input as never });
      case "shorts-comment-like-set": return api.setShortCommentLike({ data: input as never });
    }
  }

  if (["shorts-feed-get", "shorts-profile-get", "shorts-post-delete",
       "shorts-profile-update", "shorts-profile-image-url", "shorts-follow-set",
       "shorts-like-set", "shorts-save-set"].includes(action)) {
    const api = await import("@/lib/cloudy-shorts-feed.functions");
    switch (action) {
      case "shorts-feed-get": return api.listShortsFeed({ data: input as never });
      case "shorts-profile-get": return api.getShortsCreatorProfile({ data: input as never });
      case "shorts-post-delete": return api.deleteOwnShortPost({ data: input as never });
      case "shorts-profile-update": return api.updateShortsCreatorProfile({ data: input as never });
      case "shorts-profile-image-url": return api.createShortsProfileImageUpload({ data: input as never });
      case "shorts-follow-set": return api.setShortsFollow({ data: input as never });
      case "shorts-like-set": return api.setShortsLike({ data: input as never });
      case "shorts-save-set": return api.setShortsSavedPost({ data: input as never });
    }
  }

  if (["shorts-upload-start", "shorts-upload-finalize",
       "shorts-upload-image-finalize", "shorts-text-create"].includes(action)) {
    const api = await import("@/lib/cloudy-shorts-upload.functions");
    if (action === "shorts-upload-start") return api.createShortVideoUpload({ data: input as never });
    if (action === "shorts-upload-finalize") return api.finalizeShortVideoUpload({ data: input as never });
    if (action === "shorts-upload-image-finalize") return api.finalizeShortImageUpload({ data: input as never });
    return api.createShortTextPost({ data: input as never });
  }

  throw new Error("Это действие пока не поддерживается в мобильном клиенте.");
}

export const Route = createFileRoute("/api/cloudy/mobile")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const declaredLength = Number(request.headers.get("content-length") ?? 0);
          if (declaredLength > 1_000_000) {
            return Response.json({ ok: false, error: "Слишком большой запрос." }, { status: 413 });
          }
          const body = objectValue(await request.json());
          const action = String(body.action ?? "");
          if (!/^[a-z][a-z0-9-]{1,63}$/.test(action)) {
            return Response.json({ ok: false, error: "Некорректное действие." }, { status: 400 });
          }

          const authorization = request.headers.get("authorization") ?? "";
          const accessToken = authorization.startsWith("Bearer ")
            ? authorization.slice(7).trim()
            : "";
          if (!accessToken || accessToken.length > 8192 || accessToken.split(".").length !== 3) {
            return Response.json({ ok: false, error: "Сначала войдите в аккаунт." }, { status: 401 });
          }

          const payload = objectValue(body.payload);
          const input = { ...payload, accessToken };
          if (JSON.stringify(input).length > 900_000) {
            return Response.json({ ok: false, error: "Слишком большой запрос." }, { status: 413 });
          }

          const result = await dispatchMobileAction(action, input);
          return Response.json({ ok: true, result });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Не удалось выполнить действие.";
          const unauthorized = /unauthorized|сначала войдите|сессия истекла/i.test(message);
          return Response.json(
            { ok: false, error: message.slice(0, 500) },
            { status: unauthorized ? 401 : 400 },
          );
        }
      },
    },
  },
});
