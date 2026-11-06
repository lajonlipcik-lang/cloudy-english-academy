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
        if (["admin-users","admin-providers","admin-provider-save","admin-provider-delete","admin-provider-test","admin-community-reports","admin-community-moderate","ai-chat","tts","learning-exam-sync","learning-exam-profile","learning-exam-status","learning-exam-start","learning-exam-submit","learning-events","shorts-moderate","shorts-comments-get","shorts-comment-create","shorts-upload-start","shorts-upload-finalize"].includes(String(message.action))) {
          if (!accessToken) throw new Error("Сначала войдите в аккаунт.");
          const payload = { accessToken, ...(message.payload && typeof message.payload === "object" ? message.payload as Record<string, unknown> : {}) };
          if (message.action === "shorts-upload-start" || message.action === "shorts-upload-finalize") {
            const uploadApi = await import("@/lib/cloudy-shorts-upload.functions");
            const uploadResult = message.action === "shorts-upload-start"
              ? await uploadApi.createShortVideoUpload({ data: payload as never })
              : await uploadApi.finalizeShortVideoUpload({ data: payload as never });
            reply({ ok: true, result: uploadResult });
            return;
          }
          const api = await import("@/lib/cloudy-ai.functions");
          let result: unknown;
          if (message.action === "admin-users") result = await api.listCloudyUsers({ data: payload });
          else if (message.action === "admin-providers") result = await api.listAiProviders({ data: payload });
          else if (message.action === "admin-provider-save") result = await api.saveAiProvider({ data: payload as never });
          else if (message.action === "admin-provider-delete") result = await api.deleteAiProvider({ data: payload as never });
          else if (message.action === "admin-provider-test") result = await api.testAiProvider({ data: payload as never });
          else if (message.action === "admin-community-reports") result = await api.listCommunityReports({ data: payload as never });
          else if (message.action === "admin-community-moderate") result = await api.moderateCommunityReport({ data: payload as never });
          else if (message.action === "tts") result = await api.cloudyTextToSpeech({ data: { accessToken, message: String((payload as any).text ?? "") } });
          else if (message.action === "learning-events") result = await api.syncCloudyLearningEvents({ data: payload as never });
          else if (message.action === "shorts-moderate") result = await api.moderateOwnShortContent({ data: payload as never });
          else if (message.action === "shorts-comments-get") result = await api.getShortsComments({ data: payload as never });
          else if (message.action === "shorts-comment-create") result = await api.createShortComment({ data: payload as never });
          else if (String(message.action).startsWith("learning-exam-")) result = await api.cloudyPersonalExam({ data: { ...payload, accessToken, examAction: String(message.action).replace("learning-exam-", "") } as never });
          else result = await api.cloudyTutorChat({ data: payload as never });
          reply({ ok: true, result }); return;
        }
        if (message.action === "community-interactions-get") {
          const uid = userIdRef.current;
          if (!accessTokenRef.current || !uid) throw new Error("Сначала войдите в аккаунт.");
          const payload = message.payload && typeof message.payload === "object" ? message.payload as Record<string, unknown> : {};
          const postIds = Array.isArray(payload["postIds"]) ? [...new Set((payload["postIds"] as unknown[]).filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 50) : [];
          if (!postIds.length) {
            reply({ ok: true, result: { comments: [], reactions: [] } });
            return;
          }
          const [commentsResult, reactionsResult]: any[] = await Promise.all([
            (supabase.from("community_comments" as any) as any).select("id, post_id, author_id, body, created_at").in("post_id", postIds).eq("status", "published").order("created_at", { ascending: true }).limit(250),
            (supabase.from("community_reactions" as any) as any).select("post_id, user_id, reaction").in("post_id", postIds),
          ]);
          if (commentsResult.error) throw commentsResult.error;
          if (reactionsResult.error) throw reactionsResult.error;
          const comments = (commentsResult.data ?? []) as { id: string; post_id: string; author_id: string; body: string; created_at: string }[];
          const authorIds = [...new Set(comments.map(comment => comment.author_id))];
          const profiles: any = authorIds.length ? await (supabase.from("community_public_profiles" as any) as any).select("id, display_name").in("id", authorIds) : { data: [], error: null };
          if (profiles.error) throw profiles.error;
          const names = new Map(((profiles.data ?? []) as { id: string; display_name: string | null }[]).map(profile => [profile.id, profile.display_name || "Участник"]));
          reply({ ok: true, result: {
            comments: comments.map(comment => ({ ...comment, author_name: names.get(comment.author_id) || (comment.author_id === uid ? "Вы" : "Участник"), is_own: comment.author_id === uid })),
            reactions: (reactionsResult.data ?? []).map((reaction: any) => ({ post_id: reaction.post_id, is_own: reaction.user_id === uid, reaction: reaction.reaction })),
          } });
          return;
        }
        if (message.action === "community-comment-create") {
          const uid = userIdRef.current;
          if (!accessTokenRef.current || !uid) throw new Error("Сначала войдите в аккаунт.");
          const payload = message.payload && typeof message.payload === "object" ? message.payload as Record<string, unknown> : {};
          const postId = typeof payload["postId"] === "string" ? payload["postId"] : "";
          const body = typeof payload["body"] === "string" ? (payload["body"] as string).trim() : "";
          if (!/^[0-9a-f-]{36}$/i.test(postId)) throw new Error("Некорректная публикация.");
          if (body.length < 1 || body.length > 1000) throw new Error("Комментарий должен содержать от 1 до 1000 символов.");
          const result: any = await (supabase.from("community_comments" as any) as any).insert({ post_id: postId, author_id: uid, body }).select("id").single();
          if (result.error) throw result.error;
          reply({ ok: true, result: { id: result.data.id } });
          return;
        }
        if (message.action === "community-comment-delete") {
          const uid = userIdRef.current;
          if (!accessTokenRef.current || !uid) throw new Error("Сначала войдите в аккаунт.");
          const payload = message.payload && typeof message.payload === "object" ? message.payload as Record<string, unknown> : {};
          const commentId = typeof payload["commentId"] === "string" ? payload["commentId"] : "";
          if (!/^[0-9a-f-]{36}$/i.test(commentId)) throw new Error("Некорректный комментарий.");
          const result: any = await (supabase.from("community_comments" as any) as any).delete().eq("id", commentId).eq("author_id", uid).select("id").maybeSingle();
          if (result.error) throw result.error;
          if (!result.data) throw new Error("Комментарий не найден или уже удалён.");
          reply({ ok: true, result: { id: result.data.id } });
          return;
        }
        if (message.action === "community-reaction-toggle") {
          const uid = userIdRef.current;
          if (!accessTokenRef.current || !uid) throw new Error("Сначала войдите в аккаунт.");
          const payload = message.payload && typeof message.payload === "object" ? message.payload as Record<string, unknown> : {};
          const postId = typeof payload["postId"] === "string" ? payload["postId"] : "";
          if (!/^[0-9a-f-]{36}$/i.test(postId)) throw new Error("Некорректная публикация.");
          const readResult: any = await (supabase.from("community_reactions" as any) as any).select("post_id").eq("post_id", postId).eq("user_id", uid).maybeSingle();
          if (readResult.error) throw readResult.error;
          const existing = readResult.data;
          if (existing) {
            const deleteResult: any = await (supabase.from("community_reactions" as any) as any).delete().eq("post_id", postId).eq("user_id", uid);
            if (deleteResult.error) throw deleteResult.error;
          } else {
            const insertResult: any = await (supabase.from("community_reactions" as any) as any).insert({ post_id: postId, user_id: uid, reaction: "like" });
            if (insertResult.error) throw insertResult.error;
          }
          reply({ ok: true, result: { active: !existing } });
          return;
        }
        if (message.action === "community-report-create") {
          const uid = userIdRef.current;
          if (!accessTokenRef.current || !uid) throw new Error("Сначала войдите в аккаунт.");
          const payload = message.payload && typeof message.payload === "object" ? message.payload as Record<string, unknown> : {};
          const postId = typeof payload["postId"] === "string" ? payload["postId"] : "";
          const commentId = typeof payload["commentId"] === "string" ? payload["commentId"] : "";
          const reason = payload["reason"];
          const details = typeof payload["details"] === "string" ? (payload["details"] as string).trim().slice(0, 1000) : "";
          if ((!postId && !commentId) || (postId && !/^[0-9a-f-]{36}$/i.test(postId)) || (commentId && !/^[0-9a-f-]{36}$/i.test(commentId)) || (postId && commentId)) throw new Error("Некорректная жалоба.");
          if (!["harassment", "personal_data", "spam", "inappropriate", "other"].includes(String(reason))) throw new Error("Выбери причину жалобы.");
          const result: any = await (supabase.from("community_reports" as any) as any).insert({ reporter_id: uid, post_id: postId || null, comment_id: commentId || null, reason, details }).select("id").single();
          if (result.error) throw result.error;
          reply({ ok: true, result: { id: result.data.id } });
          return;
        }
        if (message.action === "community-feed-get") {
          const uid = userIdRef.current;
          if (!accessTokenRef.current || !uid) throw new Error("Сначала войдите в аккаунт.");
          const { data: posts, error } = await supabase.from("community_posts").select("id, author_id, body, status, created_at").eq("status", "published").order("created_at", { ascending: false }).limit(50);
          if (error) throw error;
          const own = await supabase.from("community_posts").select("id, author_id, body, status, created_at").eq("author_id", uid).order("created_at", { ascending: false }).limit(30);
          if (own.error) throw own.error;
          const merged = new Map<string, { id: string; author_id: string; body: string; status: string; created_at: string }>();
          for (const post of [...(posts ?? []), ...(own.data ?? [])]) merged.set(post.id, post);
          const rows = [...merged.values()].sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at)).slice(0, 50);
          const authorIds = [...new Set(rows.map(post => post.author_id))];
          const profiles: any = authorIds.length ? await supabase.from("community_public_profiles" as any).select("id, display_name").in("id", authorIds) : { data: [], error: null };
          if (profiles.error) throw profiles.error;
          const profileRows = (profiles.data ?? []) as { id: string; display_name: string | null }[];
          const names = new Map(profileRows.map(profile => [profile.id, profile.display_name || "Участник"]));
          reply({ ok: true, result: rows.map(post => ({ ...post, author_name: names.get(post.author_id) || (post.author_id === uid ? "Вы" : "Участник"), is_own: post.author_id === uid })) });
          return;
        }
        if (message.action === "community-post-create") {
          const uid = userIdRef.current;
          if (!accessTokenRef.current || !uid) throw new Error("Сначала войдите в аккаунт.");
          const payload = message.payload && typeof message.payload === "object" ? message.payload as Record<string, unknown> : {};
          const body = typeof payload["body"] === "string" ? (payload["body"] as string).trim() : "";
          if (body.length < 1 || body.length > 2000) throw new Error("Текст публикации должен содержать от 1 до 2000 символов.");
          const { data, error } = await supabase.from("community_posts").insert({ author_id: uid, body }).select("id").single();
          if (error) throw error;
          reply({ ok: true, result: { id: data.id } });
          return;
        }
        if (message.action === "community-post-delete") {
          const uid = userIdRef.current;
          if (!accessTokenRef.current || !uid) throw new Error("Сначала войдите в аккаунт.");
          const payload = message.payload && typeof message.payload === "object" ? message.payload as Record<string, unknown> : {};
          const postId = typeof payload["postId"] === "string" ? payload["postId"] : "";
          if (!/^[0-9a-f-]{36}$/i.test(postId)) throw new Error("Некорректная публикация.");
          const { data, error } = await supabase.from("community_posts").delete().eq("id", postId).eq("author_id", uid).select("id").maybeSingle();
          if (error) throw error;
          if (!data) throw new Error("Публикация не найдена или уже удалена.");
          reply({ ok: true, result: { id: data.id } });
          return;
        }
        if (message.action === "community-profile-get") {
          if (!accessTokenRef.current || !userIdRef.current) throw new Error("Сначала войдите в аккаунт.");
          const { data, error } = await supabase.from("profiles").select("is_public, bio").eq("id", userIdRef.current).maybeSingle();
          if (error) throw error;
          if (!data) throw new Error("Профиль не найден.");
          reply({ ok: true, result: { is_public: data.is_public === true, bio: String(data.bio ?? "").slice(0, 240) } });
          return;
        }
        if (message.action === "community-profile-update") {
          if (!accessTokenRef.current || !userIdRef.current) throw new Error("Сначала войдите в аккаунт.");
          const payload = message.payload && typeof message.payload === "object" ? message.payload as Record<string, unknown> : {};
          if (typeof payload["is_public"] !== "boolean") throw new Error("Некорректная настройка публичности.");
          const bio = typeof payload["bio"] === "string" ? (payload["bio"] as string).trim() : "";
          if (bio.length > 240) throw new Error("Описание слишком длинное.");
          const { data, error } = await supabase.from("profiles").update({ is_public: payload["is_public"] as boolean, bio }).eq("id", userIdRef.current).select("is_public, bio").single();
          if (error) throw error;
          reply({ ok: true, result: { is_public: data.is_public === true, bio: String(data.bio ?? "").slice(0, 240) } });
          return;
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
