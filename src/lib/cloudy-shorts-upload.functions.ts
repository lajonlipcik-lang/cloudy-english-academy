import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "cloudy-shorts";
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

type StartUploadInput = {
  accessToken: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string;
  durationSeconds?: number;
};

type FinalizeUploadInput = {
  accessToken: string;
  videoId: string;
};

function validateToken(value: unknown): string {
  const token = String(value ?? "");
  if (!token || token.length > 8192 || token.split(".").length !== 3) {
    throw new Error("Unauthorized");
  }
  return token;
}

async function getAuthenticatedContentContext(token: string) {
  const coreUrl = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!coreUrl || !publishableKey) throw new Error("Core Supabase is not configured.");

  const auth = createClient(coreUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");

  const { getCloudyContentAdmin } = await import("@/integrations/supabase/content.server");
  const content = getCloudyContentAdmin();
  return { user: data.user, content };
}

/**
 * Reserves a private Content DB row and returns a short-lived signed upload token.
 * The Core identity is verified first; no service-role credential reaches the browser.
 */
export const createShortVideoUpload = createServerFn({ method: "POST" })
  .inputValidator((input: Partial<StartUploadInput>): StartUploadInput => {
    const accessToken = validateToken(input?.accessToken);
    const fileName = String(input?.fileName ?? "").trim().slice(0, 180);
    const mimeType = String(input?.mimeType ?? "").toLowerCase();
    const sizeBytes = Number(input?.sizeBytes);
    const caption = typeof input?.caption === "string" ? input.caption.trim() : "";
    const durationSeconds = Number(input?.durationSeconds ?? 0);

    if (!fileName || /[\\/]/.test(fileName)) throw new Error("Некорректное имя видео.");
    if (!ALLOWED_VIDEO_TYPES.has(mimeType)) throw new Error("Поддерживаются MP4, WebM и MOV.");
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_VIDEO_BYTES) {
      throw new Error("Размер видео не должен превышать 100 МБ.");
    }
    if (caption.length > 500) throw new Error("Подпись не должна превышать 500 символов.");
    if (durationSeconds && (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 600)) {
      throw new Error("Продолжительность видео должна быть не больше 10 минут.");
    }
    return { accessToken, fileName, mimeType, sizeBytes, caption, durationSeconds };
  })
  .handler(async ({ data }) => {
    const { user, content } = await getAuthenticatedContentContext(data.accessToken);
    const { data: restrictions, error: restrictionError } = await content
      .from("content_user_restrictions")
      .select("restriction_type,starts_at,expires_at")
      .eq("user_id", user.id)
      .eq("active", true)
      .in("restriction_type", ["upload_block", "community_block", "temporary_ban", "permanent_ban"]);
    if (restrictionError) throw new Error("Не удалось проверить ограничения аккаунта.");

    const now = Date.now();
    const blocked = (restrictions ?? []).some((item: any) => {
      const starts = Date.parse(item.starts_at);
      const expires = item.expires_at ? Date.parse(item.expires_at) : Number.POSITIVE_INFINITY;
      return starts <= now && expires > now;
    });
    if (blocked) throw new Error("Загрузка видео для аккаунта временно недоступна.");

    const videoId = crypto.randomUUID();
    const extension = data.mimeType === "video/webm" ? "webm" : data.mimeType === "video/quicktime" ? "mov" : "mp4";
    const storagePath = user.id + "/" + videoId + "." + extension;
    const { data: signed, error: signedError } = await content.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });
    if (signedError || !signed?.token) throw new Error("Не удалось подготовить защищённую загрузку.");

    const { error: insertError } = await content.from("shorts_videos").insert({
      id: videoId,
      author_id: user.id,
      storage_path: storagePath,
      caption: data.caption,
      duration_seconds: data.durationSeconds || null,
      status: "draft",
      moderation_status: "pending",
    });
    if (insertError) throw new Error("Не удалось создать черновик видео.");

    return {
      videoId,
      bucket: BUCKET,
      path: storagePath,
      token: signed.token,
      signedUrl: signed.signedUrl,
      maxBytes: MAX_VIDEO_BYTES,
    };
  });

/**
 * Confirms that the object exists in private storage before placing the video
 * into the moderation queue. This does not approve or publish the video.
 */
export const finalizeShortVideoUpload = createServerFn({ method: "POST" })
  .inputValidator((input: Partial<FinalizeUploadInput>): FinalizeUploadInput => {
    const accessToken = validateToken(input?.accessToken);
    const videoId = String(input?.videoId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(videoId)) throw new Error("Некорректное видео.");
    return { accessToken, videoId };
  })
  .handler(async ({ data }) => {
    const { user, content } = await getAuthenticatedContentContext(data.accessToken);
    const { data: video, error: videoError } = await content
      .from("shorts_videos")
      .select("id,author_id,storage_path,status")
      .eq("id", data.videoId)
      .maybeSingle();
    if (videoError || !video || video.author_id !== user.id || video.status !== "draft") {
      throw new Error("Черновик видео не найден.");
    }

    const separator = video.storage_path.lastIndexOf("/");
    const folder = video.storage_path.slice(0, separator);
    const fileName = video.storage_path.slice(separator + 1);
    const { data: objects, error: listError } = await content.storage
      .from(BUCKET)
      .list(folder, { search: fileName, limit: 10 });
    if (listError) throw new Error("Не удалось проверить загруженный файл.");
    const object = (objects ?? []).find((item: any) => item.name === fileName);
    if (!object) throw new Error("Видео ещё не загружено полностью.");

    const actualSize = Number(object.metadata?.size ?? 0);
    if (!actualSize || actualSize > MAX_VIDEO_BYTES) {
      await content.storage.from(BUCKET).remove([video.storage_path]);
      throw new Error("Размер загруженного видео недопустим.");
    }

    const { error: updateError } = await content
      .from("shorts_videos")
      .update({ status: "pending_review", updated_at: new Date().toISOString() })
      .eq("id", video.id)
      .eq("author_id", user.id)
      .eq("status", "draft");
    if (updateError) throw new Error("Не удалось отправить видео на проверку.");

    return {
      ok: true,
      videoId: video.id,
      status: "pending_review",
      mediaReviewed: false,
      message: "Видео загружено и ожидает проверки Cloudy AI.",
    };
  });
