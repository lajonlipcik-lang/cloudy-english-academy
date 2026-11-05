import { useEffect, useRef, type RefObject } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureOwnerAdmin } from "@/lib/admin-role.functions";
import { toUserErrorMessage } from "@/lib/cloudy/user-errors";

type AuthRequest = { channel?: string; type?: string; id?: string; action?: string; name?: unknown; age?: unknown; email?: unknown; password?: unknown; state?: unknown; userId?: unknown; payload?: unknown; lessonIndex?: unknown; level?: unknown; expectedUpdatedAt?: unknown; syncId?: unknown };

export function useCloudyAppBridge(frameRef: RefObject<HTMLIFrameElement | null>, enabled = true) {
  const accessTokenRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const frame = frameRef.current;
    if (!frame) return;

    const send = (payload: Record<string, unknown>) => {
      frame.contentWindow?.postMessage({ channel: "cloudy-auth", ...payload }, window.location.origin);
    };

    const syncSession = async () => {
      const currentFrame = frameRef.current;
      if (!currentFrame?.contentWindow) return;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const user = data.session?.user;
        accessTokenRef.current = data.session?.access_token ?? null;
        userIdRef.current = user?.id ?? null;
        let ownerIsAdmin = user?.app_metadata?.["role"] === "admin";
        if (user?.email?.toLowerCase() === "lajonlipcik@gmail.com" && data.session?.access_token) {
          try {
            const role = await ensureOwnerAdmin({ data: { accessToken: data.session.access_token } });
            ownerIsAdmin = role.isAdmin;
          } catch {
            console.error("[cloudy-admin] owner role refresh failed");
          }
        }
        let progress: { state: unknown; updated_at: string } | null = null;
        let learnerProfile: { english_level: string | null; placement_test_completed: boolean } | null = null;
        let progressLoadFailed = false;
        if (user) {
          const { data: saved, error: progressError } = await supabase.from("user_progress").select("state, updated_at").eq("user_id", user.id).maybeSingle();
          progress = saved;
          if (progressError) {
            progressLoadFailed = true;
            console.warn("[cloudy-progress] cloud progress could not be loaded");
          }
          const { data: profile, error: profileError } = await supabase.from("profiles").select("english_level, placement_test_completed").eq("id", user.id).maybeSingle();
          if (profileError) console.warn("[cloudy-progress] learner profile could not be loaded");
          else learnerProfile = profile;
        }
        const rawAge = Number(user?.user_metadata?.["age"]);
        send({
          type: "session",
          ok: true,
          user: user ? {
            id: user.id,
            email: user.email ?? "",
            name: String(user.user_metadata?.["name"] ?? user.user_metadata?.["display_name"] ?? ""),
            age: Number.isInteger(rawAge) && rawAge >= 13 && rawAge <= 120 ? rawAge : null,
            isAdmin: ownerIsAdmin || user.email?.toLowerCase() === "lajonlipcik@gmail.com",
          } : null,
          progress,
          learnerProfile,
          progressLoadFailed,
        });
      } catch (err) {
        accessTokenRef.current = null;
        userIdRef.current = null;
        console.error("[cloudy-auth] syncSession failed:", err);
        send({ type: "session", ok: false, error: toUserErrorMessage(err, "auth") });
      }
    };

    const onMessage = async (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
      if (!event.data || typeof event.data !== "object") return;
      const message = event.data as AuthRequest;
      if (message.channel !== "cloudy-auth") return;

      if (message.type === "init") {
        await syncSession();
        return;
      }

      if (message.type === "progress-save") {
        const state = message.state;
        const accessToken = accessTokenRef.current;
        if (!state || typeof state !== "object" || Array.isArray(state) || !accessToken || typeof message.userId !== "string" || message.userId !== userIdRef.current) {
          send({ type: "progress-save-result", ok: false, error: "Сессия истекла. Войдите снова.", syncId: message.syncId });
          return;
        }
        try {
          const api = await import("@/lib/cloudy/progress.functions");
          const saved = await api.saveCloudyProgress({
            data: {
              accessToken,
              state,
              expectedUpdatedAt: typeof message.expectedUpdatedAt === "string" ? message.expectedUpdatedAt : null,
            },
          });
          send({
            type: "progress-save-result",
            ok: saved.ok,
            conflict: saved.conflict,
            state: saved.state,
            updatedAt: saved.updated_at,
            syncId: message.syncId,
          });
        } catch (error) {
          send({ type: "progress-save-result", ok: false, error: toUserErrorMessage(error, "progress"), syncId: message.syncId });
        }
        return;
      }

      if (message.type === "lesson-complete") {
        const accessToken = accessTokenRef.current;
        if (!accessToken) {
          send({ type: "lesson-award-result", ok: false, error: "Сессия истекла. Войдите снова." });
          return;
        }
        try {
          const api = await import("@/lib/cloudy/progress.functions");
          const result = await api.awardCloudyLessonXp({
            data: { accessToken, lessonIndex: Number(message.lessonIndex), level: String(message.level ?? "") },
          });
          send({ type: "lesson-award-result", ok: true, result });
        } catch (error) {
          send({ type: "lesson-award-result", ok: false, error: toUserErrorMessage(error, "progress") });
        }
        return;
      }

      if (message.type !== "request" || typeof message.id !== "string") return;
      const reply = (result: Record<string, unknown>) => send({ type: "response", id: message.id, ...result });

      try {
        const accessToken = accessTokenRef.current;
        if (["admin-users","admin-providers","admin-provider-save","admin-provider-delete","admin-provider-test","ai-chat","tts"].includes(String(message.action))) {
          if (!accessToken) throw new Error("Сначала войдите в аккаунт.");
          const payload = { accessToken, ...(message.payload && typeof message.payload === "object" ? message.payload as Record<string, unknown> : {}) };
          const api = await import("@/lib/cloudy-ai.functions");
          let result: unknown;
          if (message.action === "admin-users") result = await api.listCloudyUsers({ data: payload });
          else if (message.action === "admin-providers") result = await api.listAiProviders({ data: payload });
          else if (message.action === "admin-provider-save") result = await api.saveAiProvider({ data: payload as never });
          else if (message.action === "admin-provider-delete") result = await api.deleteAiProvider({ data: payload as never });
          else if (message.action === "admin-provider-test") result = await api.testAiProvider({ data: payload as never });
          else if (message.action === "tts") result = await api.cloudyTextToSpeech({ data: { accessToken, message: String((payload as any).text ?? "") } });
          else result = await api.cloudyTutorChat({ data: payload as never });
          reply({ ok: true, result }); return;
        }
        if (message.action === "signUp") {
          const { data, error } = await supabase.auth.signUp({
            email: String(message.email ?? "").trim().toLowerCase(),
            password: String(message.password ?? ""),
            options: { data: {} },
          });
          if (error) throw error;
          if (!data.session || !data.user) {
            reply({ ok: true, needsConfirmation: true });
            return;
          }
          accessTokenRef.current = data.session.access_token;
          userIdRef.current = data.user.id;
          let ownerIsAdmin = data.user.app_metadata?.["role"] === "admin";
          if (data.user.email?.toLowerCase() === "lajonlipcik@gmail.com") {
            try {
              const role = await ensureOwnerAdmin({ data: { accessToken: data.session.access_token } });
              ownerIsAdmin = role.isAdmin;
            } catch {
              console.error("[cloudy-admin] owner role refresh failed");
            }
          }
          reply({
            ok: true,
            user: {
              id: data.user.id,
              email: data.user.email ?? "",
              name: String(data.user.user_metadata?.["name"] ?? ""),
              age: Number.isInteger(Number(data.user.user_metadata?.["age"])) && Number(data.user.user_metadata?.["age"]) >= 13 && Number(data.user.user_metadata?.["age"]) <= 120 ? Number(data.user.user_metadata?.["age"]) : null,
              isAdmin: ownerIsAdmin,
            },
          });
          return;
        }

        if (message.action === "signIn") {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: String(message.email ?? "").trim().toLowerCase(),
            password: String(message.password ?? ""),
          });
          if (error) throw error;
          if (!data.user || !data.session) throw new Error("Не удалось загрузить аккаунт.");
          const existingAge = Number(data.user.user_metadata?.["age"]);
          if (Number.isInteger(existingAge) && existingAge < 13) {
            await supabase.auth.signOut();
            throw new Error("Регистрация в Cloudy English Academy доступна с 13 лет. Если возраст указан неверно, обратитесь в поддержку.");
          }
          accessTokenRef.current = data.session.access_token;
          userIdRef.current = data.user.id;
          let ownerIsAdmin = data.user.app_metadata?.["role"] === "admin";
          if (data.user.email?.toLowerCase() === "lajonlipcik@gmail.com") {
            try {
              const role = await ensureOwnerAdmin({ data: { accessToken: data.session.access_token } });
              ownerIsAdmin = role.isAdmin;
            } catch {
              console.error("[cloudy-admin] owner role refresh failed");
            }
          }
          let progress: { state: unknown; updated_at: string } | null = null;
          let learnerProfile: { english_level: string | null; placement_test_completed: boolean } | null = null;
          let progressLoadFailed = false;
          const { data: saved, error: progressError } = await supabase.from("user_progress").select("state, updated_at").eq("user_id", data.user.id).maybeSingle();
          if (progressError) progressLoadFailed = true;
          else progress = saved;
          const { data: profile, error: profileError } = await supabase.from("profiles").select("english_level, placement_test_completed").eq("id", data.user.id).maybeSingle();
          if (profileError) progressLoadFailed = true;
          else learnerProfile = profile;
          reply({
            ok: true,
            user: {
              id: data.user.id,
              email: data.user.email ?? "",
              name: String(data.user.user_metadata?.["name"] ?? data.user.user_metadata?.["display_name"] ?? ""),
              age: Number.isInteger(Number(data.user.user_metadata?.["age"])) && Number(data.user.user_metadata?.["age"]) >= 13 && Number(data.user.user_metadata?.["age"]) <= 120 ? Number(data.user.user_metadata?.["age"]) : null,
              isAdmin: ownerIsAdmin,
            },
            progress,
            learnerProfile,
            progressLoadFailed,
          });
          return;
        }

        if (message.action === "updateProfile") {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          const currentUser = sessionData.session?.user;
          if (!currentUser) throw new Error("Сначала войдите в аккаунт.");
          const hasAgeUpdate = message.age !== undefined && message.age !== null;
          const rawAge = Number(message.age);
          if (hasAgeUpdate && (!Number.isInteger(rawAge) || rawAge < 13 || rawAge > 120)) {
            throw new Error("Возраст должен быть указан в полных годах и составлять не менее 13 лет.");
          }
          const currentAge = Number(currentUser.user_metadata?.["age"]);
          const newName = typeof message.name === "string" && message.name.trim() ? message.name.trim().slice(0, 40) : undefined;
          const hasStoredAge = Number.isInteger(currentAge) && currentAge >= 13 && currentAge <= 120;
          if (hasAgeUpdate && hasStoredAge && currentAge !== rawAge && !newName) {
            throw new Error("Изменение возраста доступно только через поддержку @cloudysupportt_bot.");
          }
          const validAge = hasAgeUpdate && !hasStoredAge ? rawAge : null;
          if (validAge === null && !newName) throw new Error("Укажите корректное имя или возраст.");
          const updateData: Record<string, unknown> = { ...(currentUser.user_metadata ?? {}) };
          if (hasStoredAge) updateData["age"] = currentAge;
          else if (validAge !== null) updateData["age"] = validAge;
          if (newName) updateData["name"] = newName;
          const { data, error } = await supabase.auth.updateUser({ data: updateData });
          if (error) throw error;
          if (!data.user) throw new Error("Не удалось обновить профиль.");
          if (newName) {
            const { error: profileError } = await supabase.from("profiles").update({ display_name: newName }).eq("id", data.user.id);
            if (profileError) throw profileError;
          }
          accessTokenRef.current = sessionData.session?.access_token ?? accessTokenRef.current;
          userIdRef.current = data.user.id;
          const updatedAge = Number(data.user.user_metadata?.["age"]);
          reply({
            ok: true,
            user: {
              id: data.user.id,
              email: data.user.email ?? "",
              name: String(data.user.user_metadata?.["name"] ?? data.user.user_metadata?.["display_name"] ?? newName ?? "Ученик"),
              age: Number.isInteger(updatedAge) && updatedAge >= 13 && updatedAge <= 120 ? updatedAge : null,
              isAdmin: data.user.email?.toLowerCase() === "lajonlipcik@gmail.com",
            },
          });
          return;
        }

        if (message.action === "signOut") {
          accessTokenRef.current = null;
          userIdRef.current = null;
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
          reply({ ok: true });
          return;
        }
      } catch (error) {
        const isAdminAction = String(message.action ?? "").startsWith("admin-");
        const messageText = isAdminAction
          ? (error instanceof Error ? error.message : "Не удалось выполнить действие.")
          : toUserErrorMessage(error, message.action === "ai-chat" ? "ai" : "auth");
        reply({ ok: false, error: messageText });
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void syncSession();
    });

    window.addEventListener("message", onMessage);
    const initialize = () => {
      const doc = frame.contentDocument;
      if (doc && !doc.getElementById("cloudy-admin-runtime")) {
        const script = doc.createElement("script");
        script.id = "cloudy-admin-runtime";
        script.src = "/cloudy-admin.js";
        script.onload = () => { void syncSession(); };
        doc.body.appendChild(script);
      } else {
        void syncSession();
      }
    };
    if (frame.contentDocument?.readyState === "complete") initialize();
    else frame.addEventListener("load", initialize, { once: true });

    return () => {
      window.removeEventListener("message", onMessage);
      frame.removeEventListener("load", initialize);
      authListener.subscription.unsubscribe();
    };
  }, [enabled]);

}
