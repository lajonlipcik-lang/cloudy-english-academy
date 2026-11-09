import { createClient } from "@supabase/supabase-js";
import { isLessonInLevel, sanitizeCloudyProgress } from "@/lib/cloudy/progress-policy";
import { normalizeCloudyLearningEvents } from "@/lib/cloudy-learning-events";

type MobileBody = {
  action?: unknown;
  state?: unknown;
  expectedUpdatedAt?: unknown;
  lessonIndex?: unknown;
  level?: unknown;
  events?: unknown;
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function handleCloudyMobileRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return response({ error: "Content-Type must be application/json." }, 415);
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 70000) {
    return response({ error: "Request body is too large." }, 413);
  }

  let body: MobileBody;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) return response({ error: "Invalid request body." }, 400);
    body = parsed as MobileBody;
  } catch {
    return response({ error: "Invalid JSON request body." }, 400);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || token.length > 8192 || token.split(".").length !== 3) {
    return response({ error: "Unauthorized." }, 401);
  }

  const url = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishableKey) {
    return response({ error: "Cloudy backend is not configured." }, 503);
  }

  try {
    const authClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return response({ error: "Unauthorized." }, 401);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const userId = authData.user.id;
    const action = String(body.action ?? "");

    if (action === "progress-load") {
      const [progressResult, profileResult] = await Promise.all([
        db.from("user_progress")
          .select("state, updated_at")
          .eq("user_id", userId)
          .maybeSingle(),
        db.from("profiles")
          .select("english_level, placement_test_completed")
          .eq("id", userId)
          .maybeSingle(),
      ]);
      if (progressResult.error || profileResult.error) {
        return response({ error: "Не удалось загрузить прогресс аккаунта." }, 500);
      }
      return response({
        ok: true,
        progress: progressResult.data,
        learnerProfile: profileResult.data,
      });
    }

    if (action === "progress-save") {
      if (!isRecord(body.state)) {
        return response({ error: "Некорректные данные прогресса." }, 400);
      }
      let serialized: string;
      try {
        serialized = JSON.stringify(body.state);
      } catch {
        return response({ error: "Некорректные данные прогресса." }, 400);
      }
      if (serialized.length > 64000) {
        return response({ error: "Данные прогресса слишком большие." }, 413);
      }
      const safeState = sanitizeCloudyProgress(body.state);
      const expectedRaw = body.expectedUpdatedAt;
      const expected = expectedRaw == null ? null : new Date(String(expectedRaw));
      if (expected && Number.isNaN(expected.getTime())) {
        return response({ error: "Некорректная версия прогресса." }, 400);
      }
      const { data, error } = await db.rpc("save_cloudy_progress", {
        _user_id: userId,
        _state: safeState,
        _expected_updated_at: expected?.toISOString() ?? null,
      });
      if (error) return response({ error: "Не удалось сохранить прогресс." }, 500);
      return response(data);
    }

    if (action === "lesson-complete") {
      const lessonIndex = Number(body.lessonIndex);
      const level = String(body.level ?? "");
      if (!Number.isInteger(lessonIndex) || !isLessonInLevel(lessonIndex, level)) {
        return response({ error: "Некорректный урок." }, 400);
      }
      const { data, error } = await db.rpc("award_cloudy_lesson_xp", {
        _user_id: userId,
        _lesson_index: lessonIndex,
        _level: level,
      });
      if (error) {
        if (/Daily lesson XP limit reached/i.test(error.message)) {
          return response({ error: "Достигнут дневной лимит начисления опыта." }, 409);
        }
        if (/Lesson does not belong/i.test(error.message)) {
          return response({ error: "Урок не соответствует выбранному уровню." }, 400);
        }
        return response({ error: "Не удалось подтвердить завершение урока." }, 500);
      }
      return response({ ok: true, result: data });
    }

    if (action === "learning-events") {
      let rows: ReturnType<typeof normalizeCloudyLearningEvents>;
      try {
        rows = normalizeCloudyLearningEvents(body.events, userId);
      } catch (error) {
        return response({
          error: error instanceof Error ? error.message : "Некорректные события обучения.",
        }, 400);
      }
      const { error } = await db
        .from("cloudy_learning_events")
        .upsert(rows, { onConflict: "user_id,event_id", ignoreDuplicates: true });
      if (error) return response({ error: "Не удалось сохранить журнал обучения." }, 500);
      return response({ ok: true, accepted: rows.length });
    }

    return response({ error: "Unsupported Cloudy mobile action." }, 400);
  } catch {
    return response({ error: "Внутренняя ошибка Cloudy. Попробуйте позже." }, 500);
  }
}
