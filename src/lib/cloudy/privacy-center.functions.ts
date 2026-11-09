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
