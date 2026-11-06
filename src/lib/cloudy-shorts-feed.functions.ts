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
      .select("id,author_id,storage_path,media_type,text_content,caption,published_at,created_at,duration_seconds")
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
      let mediaUrl: string | null = null;
      if (row.media_type !== "text" && row.storage_path) {
        const { data: signed, error: signedError } = await content.storage
          .from("cloudy-shorts").createSignedUrl(row.storage_path, 3600);
        if (signedError || !signed?.signedUrl) return null;
        mediaUrl = signed.signedUrl;
      }
      return {
        id: row.id,
        mediaType: row.media_type || "video",
        authorName: names.get(row.author_id) || "Участник",
        caption: String(row.caption || "").slice(0, 500),
        textContent: String(row.text_content || "").slice(0, 2000),
        publishedAt: row.published_at || row.created_at,
        durationSeconds: row.duration_seconds,
        playbackUrl: row.media_type === "video" ? mediaUrl : null,
        imageUrl: row.media_type === "image" ? mediaUrl : null,
      };
    }));
    return { videos: videos.filter(Boolean) };
  });


type ProfileInput = { accessToken?: string; authorId?: string };
export const getShortsCreatorProfile = createServerFn({ method: "POST" })
  .inputValidator((input: Partial<ProfileInput>): ProfileInput => {
    const accessToken = typeof input?.accessToken === "string" ? input.accessToken : "";
    const authorId = String(input?.authorId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(authorId)) throw new Error("Некорректный профиль.");
    if (accessToken && (accessToken.length > 8192 || accessToken.split(".").length !== 3)) throw new Error("Unauthorized");
    return { accessToken, authorId };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let viewerId: string | null = null;
    if (data.accessToken) {
      const url = process.env["SUPABASE_URL"], key = process.env["SUPABASE_PUBLISHABLE_KEY"];
      if (!url || !key) throw new Error("Core Supabase is not configured.");
      const auth = createClient(url, key, { auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } });
      const { data: identity, error } = await auth.auth.getUser(data.accessToken);
      if (error || !identity.user) throw new Error("Unauthorized");
      viewerId = identity.user.id;
    }
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles").select("id,display_name,bio,is_public").eq("id", data.authorId).maybeSingle();
    if (profileError || !profile || (!profile.is_public && viewerId !== data.authorId)) throw new Error("Этот профиль недоступен.");
    const { getCloudyContentAdmin } = await import("@/integrations/supabase/content.server");
    const content = getCloudyContentAdmin();
    const { data: rows, error } = await content.from("shorts_videos")
      .select("id,author_id,storage_path,media_type,text_content,caption,published_at,created_at,duration_seconds,status")
      .eq("author_id", data.authorId).in("status", ["approved","pending_review"])
      .order("created_at", { ascending:false }).limit(60);
    if (error) throw new Error("Не удалось загрузить публикации профиля.");
    const posts = await Promise.all((rows ?? []).map(async (row:any) => {
      let mediaUrl:string|null=null;
      if(row.storage_path && row.media_type!=="text"){
        const {data:signed,error:signedError}=await content.storage.from("cloudy-shorts").createSignedUrl(row.storage_path,3600);
        if(!signedError)mediaUrl=signed?.signedUrl||null;
      }
      return {id:row.id,mediaType:row.media_type||"video",caption:String(row.caption||"").slice(0,500),
        textContent:String(row.text_content||"").slice(0,2000),publishedAt:row.published_at||row.created_at,
        playbackUrl:row.media_type==="video"?mediaUrl:null,imageUrl:row.media_type==="image"?mediaUrl:null,
        status:row.status,isOwn:viewerId===data.authorId};
    }));
    return {profile:{id:profile.id,displayName:String(profile.display_name||"Участник"),bio:String(profile.bio||""),
      isPublic:profile.is_public===true,isOwn:viewerId===data.authorId},posts};
  });

type DeleteInput = { accessToken?: string; postId?: string };
export const deleteOwnShortPost = createServerFn({ method: "POST" })
  .inputValidator((input: Partial<DeleteInput>): DeleteInput => {
    const accessToken=String(input?.accessToken??""),postId=String(input?.postId??"");
    if(!accessToken||accessToken.length>8192||accessToken.split(".").length!==3)throw new Error("Unauthorized");
    if(!/^[0-9a-f-]{36}$/i.test(postId))throw new Error("Некорректная публикация.");
    return {accessToken,postId};
  })
  .handler(async({data})=>{
    const url=process.env["SUPABASE_URL"],key=process.env["SUPABASE_PUBLISHABLE_KEY"];
    if(!url||!key)throw new Error("Core Supabase is not configured.");
    const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const {data:identity,error:authError}=await auth.auth.getUser(data.accessToken);
    if(authError||!identity.user)throw new Error("Unauthorized");
    const {getCloudyContentAdmin}=await import("@/integrations/supabase/content.server");
    const content=getCloudyContentAdmin();
    const {data:post,error}=await content.from("shorts_videos").select("id,author_id,storage_path")
      .eq("id",data.postId).eq("author_id",identity.user.id).maybeSingle();
    if(error||!post)throw new Error("Публикация не найдена или принадлежит другому аккаунту.");
    const {error:deleteError}=await content.from("shorts_videos").delete().eq("id",data.postId).eq("author_id",identity.user.id);
    if(deleteError)throw new Error("Не удалось удалить публикацию.");
    if(post.storage_path)await content.storage.from("cloudy-shorts").remove([post.storage_path]);
    return {ok:true,postId:data.postId};
  });
