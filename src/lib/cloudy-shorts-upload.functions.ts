import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "cloudy-shorts";
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

type StartUploadInput = {
  accessToken: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string;
  durationSeconds?: number;
  mediaType?: "video" | "image";
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
 * Reserves a private Shorts row and returns a short-lived signed upload token.
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
    const mediaType = input?.mediaType === "image" ? "image" : "video";

    if (!fileName || /[\\/]/.test(fileName)) throw new Error("Некорректное имя видео.");
    const allowedTypes = mediaType === "image" ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
    const maxBytes = mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (!allowedTypes.has(mimeType)) throw new Error(mediaType === "image" ? "Поддерживаются JPG, PNG и WebP." : "Поддерживаются MP4, WebM и MOV.");
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > maxBytes) {
      throw new Error(mediaType === "image" ? "Размер фотографии не должен превышать 15 МБ." : "Размер видео не должен превышать 100 МБ.");
    }
    if (caption.length > 500) throw new Error("Подпись не должна превышать 500 символов.");
    if (mediaType === "video" && durationSeconds && (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 600)) {
      throw new Error("Продолжительность видео должна быть не больше 10 минут.");
    }
    return { accessToken, fileName, mimeType, sizeBytes, caption, durationSeconds, mediaType };
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
    const extension = data.mediaType === "image" ? (data.mimeType === "image/png" ? "png" : data.mimeType === "image/webp" ? "webp" : "jpg") : data.mimeType === "video/webm" ? "webm" : data.mimeType === "video/quicktime" ? "mov" : "mp4";
    const storagePath = user.id + "/" + videoId + "." + extension;
    const { data: signed, error: signedError } = await content.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });
    if (signedError || !signed?.token) throw new Error("Не удалось подготовить защищённую загрузку.");

    const { error: insertError } = await content.from("shorts_videos").insert({
      id: videoId,
      author_id: user.id,
      storage_path: storagePath,
      media_type: data.mediaType,
      caption: data.caption,
      duration_seconds: data.mediaType === "video" ? data.durationSeconds || null : null,
      status: "draft",
      moderation_status: "pending",
    });
    if (insertError) throw new Error("Не удалось создать черновик видео.");

    const contentUrl =
      process.env["CLOUDY_CONTENT_SUPABASE_URL"] ||
      import.meta.env["VITE_SUPABASE_URL"] ||
      process.env["SUPABASE_URL"];
    const publishableKey =
      process.env["CLOUDY_CONTENT_SUPABASE_PUBLISHABLE_KEY"] ||
      import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
      process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!contentUrl || !publishableKey) {
      await content.from("shorts_videos").delete().eq("id", videoId).eq("author_id", user.id);
      throw new Error("Для защищённой загрузки не настроен публичный ключ Cloudy Content.");
    }

    return {
      videoId,
      contentUrl,
      publishableKey,
      bucket: BUCKET,
      path: storagePath,
      token: signed.token,
      signedUrl: signed.signedUrl,
      maxBytes: data.mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES,
      mediaType: data.mediaType,
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
      .select("id,author_id,storage_path,status,media_type,caption")
      .eq("id", data.videoId)
      .maybeSingle();
    if (videoError || !video || video.author_id !== user.id || video.status !== "draft" || video.media_type !== "video") {
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

    const { reviewStoredShort } = await import("./shorts-publication.server");
    const review = await reviewStoredShort(content, video.storage_path, video.id);
    const {data: applied, error: updateError} = await content.rpc("finalize_shorts_publication", {
      p_video_id:video.id,p_author_id:user.id,p_blocked:review.blocked,p_status:review.status,
      p_reason:review.reason,p_labels:review.labels,p_confidence:review.confidence,p_model:review.model,p_frame_count:review.frameCount,
    });
    if (updateError || !applied) throw new Error("Не удалось завершить публикацию видео. Попробуйте снова.");
    return { ok:true, videoId:video.id, status:review.blocked?"pending_review":"approved",
      published:!review.blocked, needsHumanReview:true, mediaReviewed:false, message:review.reason };
  });

/** Create a text-only Shorts post and pass it through Cloudy AI text moderation. */
export const createShortTextPost = createServerFn({ method: "POST" })
  .inputValidator((input: Partial<StartUploadInput>): StartUploadInput => {
    const accessToken = validateToken(input?.accessToken);
    const text = String(input?.caption ?? "").trim();
    if (text.length < 1 || text.length > 500) throw new Error("Текст публикации должен содержать от 1 до 500 символов.");
    return { accessToken, fileName:"text-post.txt", mimeType:"text/plain", sizeBytes:text.length,
      caption:text, durationSeconds:0, mediaType:"image" };
  })
  .handler(async ({ data }) => {
    const { user, content } = await getAuthenticatedContentContext(data.accessToken);
    const { data: restrictions, error } = await content.from("content_user_restrictions")
      .select("restriction_type,starts_at,expires_at").eq("user_id",user.id).eq("active",true)
      .in("restriction_type",["upload_block","community_block","temporary_ban","permanent_ban"]);
    if(error)throw new Error("Не удалось проверить ограничения аккаунта.");
    const now=Date.now();
    if((restrictions??[]).some((item:any)=>Date.parse(item.starts_at)<=now&&(!item.expires_at||Date.parse(item.expires_at)>now)))
      throw new Error("Публикации для аккаунта временно недоступны.");
    const id=crypto.randomUUID();
    const {error:insertError}=await content.from("shorts_videos").insert({
      id,author_id:user.id,storage_path:null,media_type:"text",caption:data.caption,
      text_content:data.caption,duration_seconds:null,status:"draft",moderation_status:"pending"
    });
    if(insertError)throw new Error("Не удалось создать текстовую публикацию.");
    try {
      const ai=await import("@/lib/cloudy-ai.functions");
      const result=await ai.moderateOwnShortContent({data:{accessToken:data.accessToken,id,contentType:"short_video"} as never});
      return {ok:true,videoId:id,status:result.decision==="allow"?"approved":result.decision==="reject"?"removed":"pending_review",
        published:result.decision==="allow",message:result.reason};
    } catch(error) {
      await content.from("shorts_videos").update({status:"pending_review",moderation_status:"needs_human_review",
        moderation_reason:"Автоматическая проверка текста временно недоступна; публикация ожидает ручной проверки."}).eq("id",id).eq("author_id",user.id).eq("status","draft").eq("moderation_status","pending");
      return {ok:true,videoId:id,status:"pending_review",published:false,
        message:"Текст ожидает ручной проверки: "+(error instanceof Error?error.message:"AI unavailable")};
    }
  });

/** Finalize a photo upload after verifying the private object and AI result. */
export const finalizeShortImageUpload = createServerFn({ method: "POST" })
  .inputValidator((input: Partial<FinalizeUploadInput>): FinalizeUploadInput => {
    const accessToken=validateToken(input?.accessToken),videoId=String(input?.videoId??"");
    if(!/^[0-9a-f-]{36}$/i.test(videoId))throw new Error("Некорректная публикация.");
    return {accessToken,videoId};
  })
  .handler(async({data})=>{
    const {user,content}=await getAuthenticatedContentContext(data.accessToken);
    const {data:post,error}=await content.from("shorts_videos")
      .select("id,author_id,storage_path,status,media_type,caption").eq("id",data.videoId).maybeSingle();
    if(error||!post||post.author_id!==user.id||post.status!=="draft"||post.media_type!=="image"||!post.storage_path)
      throw new Error("Черновик фотографии не найден.");
    const slash=post.storage_path.lastIndexOf("/"),folder=post.storage_path.slice(0,slash),fileName=post.storage_path.slice(slash+1);
    const {data:objects,error:listError}=await content.storage.from(BUCKET).list(folder,{search:fileName,limit:10});
    if(listError)throw new Error("Не удалось проверить фотографию.");
    const object=(objects??[]).find((item:any)=>item.name===fileName);
    const actualSize=Number(object?.metadata?.size??0);
    if(!object||!actualSize||actualSize>MAX_IMAGE_BYTES){
      await content.storage.from(BUCKET).remove([post.storage_path]);
      throw new Error("Фотография не загружена или превышает 15 МБ.");
    }
    const {reviewStoredShortImage}=await import("./shorts-publication.server");
    const review=await reviewStoredShortImage(content,post.storage_path,post.id,post.caption);
    const {data:applied,error:applyError}=await content.rpc("finalize_shorts_nonvideo_publication",{
      p_post_id:post.id,p_author_id:user.id,p_blocked:review.blocked,p_status:review.status,
      p_reason:review.reason,p_labels:review.labels,p_confidence:review.confidence,p_model:review.model
    });
    if(applyError||!applied)throw new Error("Не удалось завершить публикацию фотографии.");
    return {ok:true,videoId:post.id,status:review.blocked?"pending_review":"approved",
      published:!review.blocked,needsHumanReview:true,mediaReviewed:true,message:review.reason};
  });
