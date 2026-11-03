import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { isLessonInLevel } from "@/lib/cloudy/progress-policy";

type ProgressInput = { accessToken: string; state?: unknown; lessonIndex?: number; level?: string };

function validate(input: ProgressInput) {
  const token = String(input?.accessToken ?? "");
  if (!token || token.length > 8192 || token.split(".").length !== 3) throw new Error("Unauthorized");
  return { ...input, accessToken: token };
}

async function getUserAndAdmin(token: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase server is not configured.");
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { user: data.user, db: supabaseAdmin as any };
}

export const saveCloudyProgress = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    if (!data.state || typeof data.state !== "object" || Array.isArray(data.state)) {
      throw new Error("Invalid progress payload");
    }
    const { user, db } = await getUserAndAdmin(data.accessToken);
    const { data: saved, error } = await db.rpc("save_cloudy_progress", {
      _user_id: user.id,
      _state: data.state,
    });
    if (error) throw new Error("Не удалось сохранить прогресс.");
    return { state: saved };
  });

export const awardCloudyLessonXp = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const lessonIndex = Number(data.lessonIndex);
    const level = String(data.level ?? "");
    if (!isLessonInLevel(lessonIndex, level)) {
      throw new Error("Некорректный урок.");
    }
    const { user, db } = await getUserAndAdmin(data.accessToken);
    const { data: result, error } = await db.rpc("award_cloudy_lesson_xp", {
      _user_id: user.id,
      _lesson_index: lessonIndex,
      _level: level,
    });
    if (error) {
      if (/Daily lesson XP limit reached/i.test(error.message)) throw new Error("Достигнут дневной лимит начисления опыта.");
      if (/Lesson does not belong/i.test(error.message)) throw new Error("Урок не соответствует выбранному уровню.");
      throw new Error("Не удалось подтвердить завершение урока.");
    }
    return result as { awarded: number; total_xp: number; week_key: string; week_xp: number; daily_lessons: number };
  });
