import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

type Input = {
  accessToken: string;
  requestType?: string;
  details?: string;
  enabled?: boolean;
};

function validate(input: Input) {
  const accessToken = String(input?.accessToken ?? "");
  if (!accessToken || accessToken.length > 8192 || accessToken.split(".").length !== 3) {
    throw new Error("Unauthorized");
  }
  return { ...input, accessToken };
}

async function getUserAndDb(accessToken: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase server is not configured.");
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Unauthorized");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { user: data.user, db: supabaseAdmin as any };
}

const CONSENT_PURPOSE = "ai_model_training";
const CONSENT_DOCUMENT_VERSION = "2026-11-v1";

export const getCloudyPrivacyCenter = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const { user, db } = await getUserAndDb(data.accessToken);
    const [consent, requests] = await Promise.all([
      db.from("optional_consent_events")
        .select("action,document_version,created_at")
        .eq("user_id", user.id)
        .eq("purpose", CONSENT_PURPOSE)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("privacy_requests")
        .select("id,request_type,details,status,created_at,updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (consent.error || requests.error) throw new Error("Не удалось загрузить настройки конфиденциальности.");
    return {
      aiTrainingConsent: consent.data?.action === "granted",
      consentDocumentVersion: consent.data?.document_version ?? null,
      consentUpdatedAt: consent.data?.created_at ?? null,
      requests: (requests.data ?? []).map((row: any) => ({
        id: String(row.id),
        type: String(row.request_type),
        details: String(row.details ?? ""),
        status: String(row.status),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      })),
    };
  });

export const setCloudyAiTrainingConsent = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    if (typeof data.enabled !== "boolean") throw new Error("Необходимо явно выбрать состояние согласия.");
    const { user, db } = await getUserAndDb(data.accessToken);
    const { data: latest, error: readError } = await db.from("optional_consent_events")
      .select("action")
      .eq("user_id", user.id)
      .eq("purpose", CONSENT_PURPOSE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readError) throw new Error("Не удалось проверить текущее согласие.");
    const nextAction = data.enabled ? "granted" : "withdrawn";
    if (latest?.action === nextAction) return { ok: true, enabled: data.enabled, unchanged: true };
    const { error } = await db.from("optional_consent_events").insert({
      user_id: user.id,
      purpose: CONSENT_PURPOSE,
      action: nextAction,
      document_version: CONSENT_DOCUMENT_VERSION,
    });
    if (error) throw new Error("Не удалось сохранить изменение согласия.");
    return { ok: true, enabled: data.enabled, documentVersion: CONSENT_DOCUMENT_VERSION };
  });

export const createCloudyPrivacyRequest = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const allowed = ["access_export", "correction", "deletion", "withdraw_optional_consent"];
    const requestType = String(data.requestType ?? "");
    if (!allowed.includes(requestType)) throw new Error("Неизвестный тип запроса.");
    const details = String(data.details ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
    const { user, db } = await getUserAndDb(data.accessToken);
    const { data: row, error } = await db.from("privacy_requests").insert({
      user_id: user.id,
      request_type: requestType,
      details,
      status: "received",
    }).select("id,request_type,status,created_at").single();
    if (error || !row) throw new Error("Не удалось отправить запрос. Попробуйте позже.");
    return {
      ok: true,
      request: {
        id: String(row.id),
        type: String(row.request_type),
        status: String(row.status),
        createdAt: String(row.created_at),
      },
    };
  });

/** Self-service export from an explicit allowlist of the authenticated user's records. */
export const exportCloudyPersonalData = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const { user, db } = await getUserAndDb(data.accessToken);
    const { data: requestRow, error: requestError } = await db.from("privacy_requests")
      .insert({ user_id: user.id, request_type: "access_export", details: "Автоматически сформирован экспорт данных аккаунта.", status: "in_progress" })
      .select("id").single();
    if (requestError || !requestRow) throw new Error("Не удалось зарегистрировать запрос на экспорт данных.");
    const results = await Promise.all([
      db.from("profiles").select("id,display_name,english_level,placement_test_completed,is_public,bio,created_at").eq("id", user.id).maybeSingle(),
      db.from("user_progress").select("state,total_xp,updated_at,week_key,week_xp").eq("user_id", user.id).maybeSingle(),
      db.from("user_learning_profiles").select("profile,updated_at").eq("user_id", user.id).maybeSingle(),
      db.from("user_progress_xp").select("daily_key,daily_lessons,total_xp,week_key,week_xp").eq("user_id", user.id).maybeSingle(),
      db.from("user_progress_awards").select("award_day,created_at,lesson_index,level,xp_awarded").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5000),
      db.from("cloudy_learning_events").select("event_id,event_type,exercise_type,level,lesson_index,question_index,skill_id,is_correct,correct_answer,selected_answer,response_seconds,retry,session_id,session_type,occurred_at,created_at").eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(10000),
      db.from("cloudy_chat_threads").select("thread_id,title,messages,created_at,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1000),
      db.from("community_posts").select("id,body,status,created_at,updated_at").eq("author_id", user.id).order("created_at", { ascending: false }).limit(5000),
      db.from("community_comments").select("id,post_id,body,status,created_at,updated_at").eq("author_id", user.id).order("created_at", { ascending: false }).limit(5000),
      db.from("community_reactions").select("post_id,reaction,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5000),
      db.from("optional_consent_events").select("purpose,action,document_version,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1000),
      db.from("privacy_requests").select("id,request_type,details,status,created_at,updated_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1000),
    ]);
    const failed = results.find((result: any) => result.error);
    if (failed?.error) throw new Error("Не удалось полностью собрать данные аккаунта. Запрос сохранён для проверки поддержкой.");
    const [profile, progress, learnerProfile, progressXp, awards, learningEvents, chatThreads, communityPosts, communityComments, communityReactions, consentEvents, privacyRequests] = results.map((result: any) => result.data);
    const exportData = {
      format: "cloudy-personal-data-export", version: 1, exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email ?? null, createdAt: user.created_at ?? null, lastSignInAt: user.last_sign_in_at ?? null, name: typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null, ageYears: Number.isInteger(Number(user.user_metadata?.age)) ? Number(user.user_metadata.age) : null },
      profile,
      learning: { progress, learnerProfile, xp: progressXp, awards: awards ?? [], events: learningEvents ?? [] },
      aiChatHistory: chatThreads ?? [],
      community: { posts: communityPosts ?? [], comments: communityComments ?? [], reactions: communityReactions ?? [] },
      privacy: { optionalConsentEvents: consentEvents ?? [], requests: privacyRequests ?? [] },
      scope: { included: "Данные аккаунта, учебный прогресс, история Cloudy AI, материалы сообщества и записи центра конфиденциальности из основной базы Cloudy English.", notIncluded: "Данные внешних поставщиков, отдельных инфраструктурных проектов и технические журналы, не связанные с аккаунтом в основной базе.", limits: "Отдельные журналы и списки ограничены последними 1 000–10 000 записями." },
    };
    const { error: completeError } = await db.from("privacy_requests").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", requestRow.id).eq("user_id", user.id);
    if (completeError) throw new Error("Экспорт сформирован, но статус запроса не обновлён. Обратитесь в поддержку.");
    return { ok: true, requestId: String(requestRow.id), data: exportData };
  });
