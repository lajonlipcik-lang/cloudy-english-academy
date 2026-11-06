import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

type FeedInput = { accessToken?: string };

export const listShortsFeed = createServerFn({ method: "POST" })
  .inputValidator((input: Partial<FeedInput>): FeedInput => {
    const accessToken = typeof input?.accessToken === "string" ? input.accessToken : "";
    if (accessToken && (accessToken.length > 8192 || accessToken.split(".").length !== 3)) {
      throw new Error("Unauthorized");
    }
    return { accessToken };
  })
  .handler(async ({ data }) => {
    // Published Shorts are readable without an account; every playback URL is
    // short-lived and the underlying Storage bucket remains private.
    if (data.accessToken) {
      const url = process.env["SUPABASE_URL"];
      const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
      if (!url || !key) throw new Error("Core Supabase is not configured.");
      const auth = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data: identity, error: authError } = await auth.auth.getUser(data.accessToken);
      if (authError || !identity.user) throw new Error("Unauthorized");
    }

    const { getCloudyContentAdmin } = await import("@/integrations/supabase/content.server");
    const content = getCloudyContentAdmin();
    const { data: rows, error } = await content
      .from("shorts_videos")
      .select("id,author_id,storage_path,caption,published_at,created_at,duration_seconds")
      .eq("status", "approved")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(30);
    if (error) throw new Error("Не удалось загрузить ленту Shorts.");

    const ids = [...new Set((rows ?? []).map((row: any) => row.author_id))];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error: profileError } = ids.length
      ? await supabaseAdmin.from("profiles").select("id,display_name").in("id", ids)
      : { data: [], error: null };
    if (profileError) throw new Error("Не удалось загрузить авторов Shorts.");
    const names = new Map((profiles ?? []).map((profile: any) => [
      profile.id,
      String(profile.display_name || "Участник").slice(0, 80),
    ]));

    const videos = await Promise.all((rows ?? []).map(async (row: any) => {
      const { data: signed, error: signedError } = await content.storage
        .from("cloudy-shorts")
        .createSignedUrl(row.storage_path, 3600);
      if (signedError || !signed?.signedUrl) return null;
      return {
        id: row.id,
        authorName: names.get(row.author_id) || "Участник",
        caption: String(row.caption || "").slice(0, 500),
        publishedAt: row.published_at || row.created_at,
        durationSeconds: row.duration_seconds,
        playbackUrl: signed.signedUrl,
      };
    }));
    return { videos: videos.filter(Boolean) };
  });
