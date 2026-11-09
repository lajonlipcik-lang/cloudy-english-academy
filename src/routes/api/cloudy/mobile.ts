import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;

function createUserSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if ((supabaseKey.startsWith("sb_publishable_") || supabaseKey.startsWith("sb_secret_")) &&
        headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

const objectValue = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};

async function dispatchMobileAction(action: string, input: JsonRecord): Promise<unknown> {
  if (action === "progress-load") {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Supabase server is not configured.");
    const client = createClient(url, key, {
      global: {
        headers: { Authorization: "Bearer " + String(input.accessToken ?? "") },
        fetch: createUserSupabaseFetch(key),
      },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: identity, error: authError } = await client.auth.getUser(String(input.accessToken ?? ""));
    if (authError || !identity.user) throw new Error("Unauthorized");
    const [progressResult, profileResult] = await Promise.all([
      client.from("user_progress")
        .select("state, updated_at")
        .eq("user_id", identity.user.id)
        .maybeSingle(),
      client.from("profiles")
        .select("english_level, placement_test_completed")
        .eq("id", identity.user.id)
        .maybeSingle(),
    ]);
    if (progressResult.error || profileResult.error) {
      throw new Error("Не удалось загрузить прогресс аккаунта.");
    }
    return {
      progress: progressResult.data,
      learnerProfile: profileResult.data,
    };
  }
  if (action === "subscription-status") {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Supabase server is not configured.");
    const client = createClient(url, key, {
      global: {
        headers: { Authorization: "Bearer " + String(input.accessToken ?? "") },
        fetch: createUserSupabaseFetch(key),
      },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: identity, error: authError } = await client.auth.getUser(String(input.accessToken ?? ""));
    if (authError || !identity.user) throw new Error("Unauthorized");
    const uid = identity.user.id;
    const { data: rows, error: subscriptionError } = await client.from("subscriptions")
      .select("id,plan_id,status,current_period_start,current_period_end,cancel_at_period_end,canceled_at,created_at")
      .eq("user_id", uid)
      .in("status", ["trialing", "active", "canceled"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (subscriptionError) throw new Error("Не удалось проверить подписку аккаунта.");
    const subscription = rows?.[0] ?? null;
    if (!subscription) {
      return { hasAccess: false, status: "inactive", subscription: null, plan: null, entitlements: [] };
    }

    const periodEnd = typeof subscription.current_period_end === "string"
      ? Date.parse(subscription.current_period_end)
      : Number.NaN;
    const status = String(subscription.status);
    const withinPeriod = !Number.isFinite(periodEnd) || periodEnd > Date.now();
    const hasAccess = withinPeriod && (
      status === "active" || status === "trialing" ||
      (status === "canceled" && Number.isFinite(periodEnd) && periodEnd > Date.now())
    );

    const [planResult, entitlementResult] = await Promise.all([
      client.from("subscription_plans").select("code,name,entitlements")
        .eq("id", subscription.plan_id).maybeSingle(),
      hasAccess
        ? client.from("subscription_entitlements")
            .select("feature_key,enabled,usage_limit")
            .eq("subscription_id", subscription.id)
            .eq("user_id", uid)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (planResult.error || entitlementResult.error) {
      throw new Error("Не удалось загрузить права подписки.");
    }
    return {
      hasAccess,
      status: hasAccess ? status : (withinPeriod ? status : "expired"),
      subscription: {
        id: subscription.id,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
        canceledAt: subscription.canceled_at,
      },
      plan: planResult.data ? {
        code: planResult.data.code,
        name: planResult.data.name,
        entitlements: objectValue(planResult.data.entitlements),
      } : null,
      entitlements: entitlementResult.data ?? [],
    };
  }

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

  if (action.startsWith("community-")) {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Supabase server is not configured.");
    const client = createClient(url, key, {
      global: {
        headers: { Authorization: "Bearer " + String(input.accessToken ?? "") },
        fetch: createUserSupabaseFetch(key),
      },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: identity, error: authError } = await client.auth.getUser(String(input.accessToken ?? ""));
    if (authError || !identity.user) throw new Error("Unauthorized");
    const uid = identity.user.id;
    const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

    if (action === "community-interactions-get") {
      const ids = Array.isArray(input.postIds)
        ? [...new Set(input.postIds.filter(uuid))].slice(0, 50) as string[]
        : [];
      if (!ids.length) return { comments: [], reactions: [] };
      const [commentsResult, reactionsResult] = await Promise.all([
        client.from("community_comments").select("id,post_id,author_id,body,created_at")
          .in("post_id", ids).eq("status", "published").order("created_at", { ascending: true }).limit(250),
        client.from("community_reactions").select("post_id,user_id,reaction").in("post_id", ids),
      ]);
      if (commentsResult.error) throw commentsResult.error;
      if (reactionsResult.error) throw reactionsResult.error;
      const comments = commentsResult.data ?? [];
      const authorIds = [...new Set(comments.map((comment: any) => comment.author_id))];
      const profiles = authorIds.length
        ? await client.from("community_public_profiles").select("id,display_name").in("id", authorIds)
        : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      const names = new Map((profiles.data ?? []).map((profile: any) => [profile.id, profile.display_name || "Участник"]));
      return {
        comments: comments.map((comment: any) => ({
          ...comment,
          author_name: names.get(comment.author_id) || (comment.author_id === uid ? "Вы" : "Участник"),
          is_own: comment.author_id === uid,
        })),
        reactions: (reactionsResult.data ?? []).map((reaction: any) => ({
          post_id: reaction.post_id, is_own: reaction.user_id === uid, reaction: reaction.reaction,
        })),
      };
    }

    if (action === "community-comment-create") {
      const postId = input.postId;
      const body = typeof input.body === "string" ? input.body.trim() : "";
      if (!uuid(postId)) throw new Error("Некорректная публикация.");
      if (body.length < 1 || body.length > 1000) throw new Error("Комментарий должен содержать от 1 до 1000 символов.");
      const { data, error } = await client.from("community_comments")
        .insert({ post_id: postId, author_id: uid, body }).select("id").single();
      if (error) throw error;
      return { id: data.id };
    }

    if (action === "community-comment-delete") {
      const commentId = input.commentId;
      if (!uuid(commentId)) throw new Error("Некорректный комментарий.");
      const { data, error } = await client.from("community_comments")
        .delete().eq("id", commentId).eq("author_id", uid).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Комментарий не найден или уже удалён.");
      return { id: data.id };
    }

    if (action === "community-reaction-toggle") {
      const postId = input.postId;
      if (!uuid(postId)) throw new Error("Некорректная публикация.");
      const { data: existing, error: readError } = await client.from("community_reactions")
        .select("post_id").eq("post_id", postId).eq("user_id", uid).maybeSingle();
      if (readError) throw readError;
      if (existing) {
        const { error } = await client.from("community_reactions").delete().eq("post_id", postId).eq("user_id", uid);
        if (error) throw error;
      } else {
        const { error } = await client.from("community_reactions").insert({ post_id: postId, user_id: uid, reaction: "like" });
        if (error) throw error;
      }
      return { active: !existing };
    }

    if (action === "community-report-create") {
      const postId = typeof input.postId === "string" ? input.postId : "";
      const commentId = typeof input.commentId === "string" ? input.commentId : "";
      const reason = input.reason;
      const details = typeof input.details === "string" ? input.details.trim().slice(0, 1000) : "";
      if ((!postId && !commentId) || (postId && !uuid(postId)) || (commentId && !uuid(commentId)) || (postId && commentId)) {
        throw new Error("Некорректная жалоба.");
      }
      if (!["harassment", "personal_data", "spam", "inappropriate", "other"].includes(String(reason))) {
        throw new Error("Выбери причину жалобы.");
      }
      const { data, error } = await client.from("community_reports")
        .insert({ reporter_id: uid, post_id: postId || null, comment_id: commentId || null, reason, details })
        .select("id").single();
      if (error) throw error;
      return { id: data.id };
    }

    if (action === "community-feed-get") {
      const { data: posts, error } = await client.from("community_posts")
        .select("id,author_id,body,status,created_at").eq("status", "published")
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      const own = await client.from("community_posts").select("id,author_id,body,status,created_at")
        .eq("author_id", uid).order("created_at", { ascending: false }).limit(30);
      if (own.error) throw own.error;
      const merged = new Map<string, any>();
      for (const post of [...(posts ?? []), ...(own.data ?? [])]) merged.set(post.id, post);
      const rows = [...merged.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 50);
      const authorIds = [...new Set(rows.map((post: any) => post.author_id))];
      const profiles = authorIds.length
        ? await client.from("community_public_profiles").select("id,display_name").in("id", authorIds)
        : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      const names = new Map((profiles.data ?? []).map((profile: any) => [profile.id, profile.display_name || "Участник"]));
      return rows.map((post: any) => ({
        ...post,
        author_name: names.get(post.author_id) || (post.author_id === uid ? "Вы" : "Участник"),
        is_own: post.author_id === uid,
      }));
    }

    if (action === "community-post-create") {
      const body = typeof input.body === "string" ? input.body.trim() : "";
      if (body.length < 1 || body.length > 2000) throw new Error("Текст публикации должен содержать от 1 до 2000 символов.");
      const { data, error } = await client.from("community_posts")
        .insert({ author_id: uid, body }).select("id").single();
      if (error) throw error;
      return { id: data.id };
    }

    if (action === "community-post-delete") {
      const postId = input.postId;
      if (!uuid(postId)) throw new Error("Некорректная публикация.");
      const { data, error } = await client.from("community_posts")
        .delete().eq("id", postId).eq("author_id", uid).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Публикация не найдена или уже удалена.");
      return { id: data.id };
    }

    if (action === "community-profile-get") {
      const { data, error } = await client.from("profiles").select("is_public,bio").eq("id", uid).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Профиль не найден.");
      return { is_public: data.is_public === true, bio: String(data.bio ?? "").slice(0, 240) };
    }

    if (action === "community-profile-update") {
      if (typeof input.is_public !== "boolean") throw new Error("Некорректная настройка публичности.");
      const bio = typeof input.bio === "string" ? input.bio.trim() : "";
      if (bio.length > 240) throw new Error("Описание слишком длинное.");
      const { data, error } = await client.from("profiles")
        .update({ is_public: input.is_public, bio }).eq("id", uid).select("is_public,bio").single();
      if (error) throw error;
      return { is_public: data.is_public === true, bio: String(data.bio ?? "").slice(0, 240) };
    }
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
