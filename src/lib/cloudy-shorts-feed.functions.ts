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
    let viewerId: string | null = null;
    if (data.accessToken) {
      const url = process.env["SUPABASE_URL"];
      const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
      if (!url || !key) throw new Error("Core Supabase is not configured.");
      const auth = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data: identity, error: authError } = await auth.auth.getUser(data.accessToken);
      if (authError || !identity.user) throw new Error("Unauthorized");
      viewerId = identity.user.id;
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

    const postIds = (rows ?? []).map((row: any) => row.id);
    const authorIds = [...new Set((rows ?? []).map((row: any) => row.author_id))];
    const [{ data: likeRows, error: likesError }, { data: commentRows, error: commentsError }, { data: followRows, error: followsError }, { data: savedRows, error: savedError }] = await Promise.all([
      postIds.length ? content.from("shorts_likes").select("video_id,user_id").in("video_id", postIds) : Promise.resolve({ data: [], error: null }),
      postIds.length ? content.from("shorts_comments").select("video_id").in("video_id", postIds).in("status", ["published", "pending_review"]) : Promise.resolve({ data: [], error: null }),
      viewerId && authorIds.length ? content.from("shorts_follows").select("following_id").eq("follower_id", viewerId).in("following_id", authorIds) : Promise.resolve({ data: [], error: null }),
      viewerId && postIds.length ? content.from("shorts_saved_posts").select("video_id").eq("user_id", viewerId).in("video_id", postIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (likesError || commentsError || followsError || savedError) throw new Error("Не удалось загрузить статистику Shorts.");
    const likeCounts = new Map<string, number>(), commentCounts = new Map<string, number>();
    const likedIds = new Set<string>(), followedAuthorIds = new Set<string>(), savedIds = new Set<string>();
    for (const like of likeRows ?? []) { likeCounts.set(like.video_id, (likeCounts.get(like.video_id) ?? 0) + 1); if (viewerId && like.user_id === viewerId) likedIds.add(like.video_id); }
    for (const comment of commentRows ?? []) commentCounts.set(comment.video_id, (commentCounts.get(comment.video_id) ?? 0) + 1);
    for (const follow of followRows ?? []) followedAuthorIds.add(follow.following_id);
    for (const saved of savedRows ?? []) savedIds.add(saved.video_id);
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
        authorId: row.author_id,
        isOwn: viewerId === row.author_id,
        mediaType: row.media_type || "video",
        authorName: names.get(row.author_id) || "Участник",
        caption: String(row.caption || "").slice(0, 500),
        textContent: String(row.text_content || "").slice(0, 2000),
        publishedAt: row.published_at || row.created_at,
        durationSeconds: row.duration_seconds,
        playbackUrl: row.media_type === "video" ? mediaUrl : null,
        imageUrl: row.media_type === "image" ? mediaUrl : null,
        likes: likeCounts.get(row.id) ?? 0,
        comments: commentCounts.get(row.id) ?? 0,
        isLiked: likedIds.has(row.id),
        isFollowingAuthor: followedAuthorIds.has(row.author_id),
        isSaved: savedIds.has(row.id),
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
    const authorId = data.authorId!;
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
      .from("profiles").select("id,display_name,bio,is_public").eq("id", authorId).maybeSingle();
    if (profileError || !profile) throw new Error("Этот профиль недоступен.");
    if (profile.is_public !== true && viewerId !== authorId) throw new Error("Этот профиль закрыт.");
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(authorId!);
    const metadata = authUser?.user?.user_metadata ?? {};
    const safeImageUrl = (value: unknown) => {
      if (typeof value !== "string" || value.length > 2048) return null;
      try { const parsed = new URL(value); return parsed.protocol === "https:" ? value : null; } catch { return null; }
    };
    const avatarPath = typeof metadata["avatar_path"] === "string" ? metadata["avatar_path"] : "";
    const coverPath = typeof metadata["cover_path"] === "string" ? metadata["cover_path"] : "";
    const [{ data: avatarSigned }, { data: coverSigned }] = await Promise.all([
      avatarPath.startsWith(`profiles/${authorId}/avatar/`) ? (await import("@/integrations/supabase/content.server")).getCloudyContentAdmin().storage.from("cloudy-shorts").createSignedUrl(avatarPath, 3600) : Promise.resolve({ data: null }),
      coverPath.startsWith(`profiles/${authorId}/cover/`) ? (await import("@/integrations/supabase/content.server")).getCloudyContentAdmin().storage.from("cloudy-shorts").createSignedUrl(coverPath, 3600) : Promise.resolve({ data: null }),
    ]);
    const avatarUrl = avatarSigned?.signedUrl || safeImageUrl(metadata["avatar_url"] ?? metadata["picture"]);
    const coverUrl = coverSigned?.signedUrl || safeImageUrl(metadata["cover_url"]);
    const username = typeof metadata["username"] === "string" && /^[a-zA-Z0-9_.]{3,24}$/.test(metadata["username"])
      ? metadata["username"] : null;
    const { getCloudyContentAdmin } = await import("@/integrations/supabase/content.server");
    const content = getCloudyContentAdmin();
    const { data: rows, error } = await content.from("shorts_videos")
      .select("id,author_id,storage_path,media_type,text_content,caption,published_at,created_at,duration_seconds,status")
      .eq("author_id", authorId).in("status", viewerId === authorId ? ["approved","pending_review"] : ["approved"])
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
        status:row.status,isOwn:viewerId===authorId};
    }));
    const postIds = posts.map((post) => post.id);
    const [{ count: followersCount, error: followersError }, { count: followingCount, error: followingError }, viewerFollow] = await Promise.all([
      content.from("shorts_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", authorId),
      content.from("shorts_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", authorId),
      viewerId && viewerId !== authorId
        ? content.from("shorts_follows").select("follower_id").eq("follower_id", viewerId).eq("following_id", authorId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (followersError || followingError || viewerFollow.error) throw new Error("Не удалось загрузить подписки профиля.");
    const { data: likeRows, error: likesError } = postIds.length
      ? await content.from("shorts_likes").select("video_id").in("video_id", postIds)
      : { data: [], error: null };
    if (likesError) throw new Error("Не удалось загрузить статистику профиля.");
    const likeCounts = new Map<string, number>();
    for (const like of likeRows ?? []) likeCounts.set(like.video_id, (likeCounts.get(like.video_id) ?? 0) + 1);
    for (const post of posts) (post as any).likes = likeCounts.get(post.id) ?? 0;
    return {profile:{id:profile.id,displayName:String(profile.display_name||"Участник"),bio:String(profile.bio||""),
      username,avatarUrl,coverUrl,isPublic:profile.is_public===true,isOwn:viewerId===authorId},
      stats:{posts:posts.filter((post) => post.status === "approved").length,likes:posts.reduce((sum,post) => sum + ((post as any).likes||0),0),
        followers:followersCount||0,following:followingCount||0},isFollowing:!!viewerFollow.data,posts};
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


type UpdateProfileInput = { accessToken?: string; displayName?: string; bio?: string; isPublic?: boolean; avatarPath?: string; coverPath?: string };
export const updateShortsCreatorProfile = createServerFn({ method:"POST" })
 .inputValidator((input:Partial<UpdateProfileInput>):UpdateProfileInput=>{
   const accessToken=String(input?.accessToken??""),displayName=String(input?.displayName??"").trim(),bio=String(input?.bio??"").trim(),isPublic=input?.isPublic;
   if(!accessToken||accessToken.length>8192||accessToken.split(".").length!==3)throw new Error("Unauthorized");
   if(displayName.length<1||displayName.length>40)throw new Error("Имя должно содержать от 1 до 40 символов.");
   if(bio.length>240)throw new Error("Описание не должно превышать 240 символов.");
   if(typeof isPublic!=="boolean")throw new Error("Выберите видимость профиля.");
   const avatarPath = input?.avatarPath === undefined ? undefined : String(input.avatarPath);
   const coverPath = input?.coverPath === undefined ? undefined : String(input.coverPath);
   if (avatarPath !== undefined && !/^profiles\/[0-9a-f-]{36}\/avatar\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(avatarPath)) throw new Error("Некорректный путь аватара.");
   if (coverPath !== undefined && !/^profiles\/[0-9a-f-]{36}\/cover\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(coverPath)) throw new Error("Некорректный путь обложки.");
   return {accessToken,displayName,bio,isPublic,...(avatarPath !== undefined ? {avatarPath} : {}),...(coverPath !== undefined ? {coverPath} : {})};
 })
 .handler(async({data})=>{
   const url=process.env["SUPABASE_URL"],key=process.env["SUPABASE_PUBLISHABLE_KEY"];
   if(!url||!key)throw new Error("Core Supabase is not configured.");
   const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   const {data:identity,error}=await auth.auth.getUser(data.accessToken);
   if(error||!identity.user)throw new Error("Unauthorized");
   const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
   if ((data.avatarPath !== undefined && !data.avatarPath.startsWith(`profiles/${identity.user.id}/avatar/`)) ||
       (data.coverPath !== undefined && !data.coverPath.startsWith(`profiles/${identity.user.id}/cover/`))) {
     throw new Error("Нельзя менять изображения другого профиля.");
   }
   const {error:updateError}=await supabaseAdmin.from("profiles").update({display_name:data.displayName!,bio:data.bio!,is_public:data.isPublic!}).eq("id",identity.user.id);
   if(updateError)throw new Error("Не удалось сохранить профиль.");
   if (data.avatarPath !== undefined || data.coverPath !== undefined) {
     const { data: current } = await supabaseAdmin.auth.admin.getUserById(identity.user.id);
     const metadata = { ...(current?.user?.user_metadata ?? {}) };
     if (data.avatarPath !== undefined) metadata["avatar_path"] = data.avatarPath;
     if (data.coverPath !== undefined) metadata["cover_path"] = data.coverPath;
     const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(identity.user.id, { user_metadata: metadata });
     if (metadataError) throw new Error("Не удалось сохранить изображения профиля.");
   }
   return {ok:true,displayName:data.displayName,bio:data.bio,isPublic:data.isPublic};
 });


type FollowInput = { accessToken?: string; authorId?: string; follow?: boolean };
export const setShortsFollow = createServerFn({ method: "POST" })
  .inputValidator((input: Partial<FollowInput>): FollowInput => {
    const accessToken = String(input?.accessToken ?? "");
    const authorId = String(input?.authorId ?? "");
    if (!accessToken || accessToken.length > 8192 || accessToken.split(".").length !== 3) throw new Error("Unauthorized");
    if (!/^[0-9a-f-]{36}$/i.test(authorId)) throw new Error("Некорректный профиль.");
    if (typeof input?.follow !== "boolean") throw new Error("Некорректное действие.");
    return { accessToken, authorId, follow: input.follow };
  })
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"], key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Core Supabase is not configured.");
    const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: identity, error: authError } = await auth.auth.getUser(data.accessToken);
    if (authError || !identity.user) throw new Error("Unauthorized");
    if (identity.user.id === data.authorId) throw new Error("Нельзя подписаться на собственный профиль.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: profileError } = await supabaseAdmin.from("profiles")
      .select("id,is_public").eq("id", data.authorId!).maybeSingle();
    if (profileError || !profile || profile.is_public !== true) throw new Error("Подписаться можно только на открытый профиль.");
    const { getCloudyContentAdmin } = await import("@/integrations/supabase/content.server");
    const content = getCloudyContentAdmin();
    if (data.follow) {
      const { error } = await content.from("shorts_follows").upsert(
        { follower_id: identity.user.id, following_id: data.authorId! },
        { onConflict: "follower_id,following_id", ignoreDuplicates: true },
      );
      if (error) throw new Error("Не удалось подписаться.");
    } else {
      const { error } = await content.from("shorts_follows").delete()
        .eq("follower_id", identity.user.id).eq("following_id", data.authorId!);
      if (error) throw new Error("Не удалось отменить подписку.");
    }
    const [{ count: followers }, { count: following }] = await Promise.all([
      content.from("shorts_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", data.authorId!),
      content.from("shorts_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", data.authorId!),
    ]);
    return { ok: true, isFollowing: data.follow, followers: followers || 0, following: following || 0 };
  });


type LikeInput = { accessToken?: string; videoId?: string; like?: boolean };
export const setShortsLike = createServerFn({ method: "POST" })
  .inputValidator((input: Partial<LikeInput>): LikeInput => {
    const accessToken = String(input?.accessToken ?? ""), videoId = String(input?.videoId ?? "");
    if (!accessToken || accessToken.length > 8192 || accessToken.split(".").length !== 3) throw new Error("Unauthorized");
    if (!/^[0-9a-f-]{36}$/i.test(videoId) || typeof input?.like !== "boolean") throw new Error("Некорректное действие с лайком.");
    return { accessToken, videoId, like: input.like };
  })
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"], key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Core Supabase is not configured.");
    const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: identity, error: authError } = await auth.auth.getUser(data.accessToken);
    if (authError || !identity.user) throw new Error("Unauthorized");
    const { getCloudyContentAdmin } = await import("@/integrations/supabase/content.server");
    const content = getCloudyContentAdmin();
    const { data: video, error: videoError } = await content.from("shorts_videos").select("id,status").eq("id", data.videoId).maybeSingle();
    if (videoError || !video || video.status !== "approved") throw new Error("Публикация недоступна для оценки.");
    if (data.like) {
      const { error } = await content.from("shorts_likes").upsert({ video_id: data.videoId, user_id: identity.user.id }, { onConflict: "video_id,user_id", ignoreDuplicates: true });
      if (error) throw new Error("Не удалось поставить лайк.");
    } else {
      const { error } = await content.from("shorts_likes").delete().eq("video_id", data.videoId).eq("user_id", identity.user.id);
      if (error) throw new Error("Не удалось убрать лайк.");
    }
    const [{ count: likes }, { data: mine, error: mineError }] = await Promise.all([
      content.from("shorts_likes").select("user_id", { count: "exact", head: true }).eq("video_id", data.videoId),
      content.from("shorts_likes").select("video_id").eq("video_id", data.videoId).eq("user_id", identity.user.id).maybeSingle(),
    ]);
    if (mineError) throw new Error("Не удалось проверить состояние лайка.");
    return { ok: true, isLiked: !!mine, likes: likes ?? 0 };
  });

type ProfileImageUploadInput = { accessToken?: string; kind?: string; mimeType?: string; fileSize?: number };
export const createShortsProfileImageUpload = createServerFn({ method: "POST" })
  .inputValidator((input: Partial<ProfileImageUploadInput>): ProfileImageUploadInput => {
    const accessToken = String(input?.accessToken ?? "");
    const kind = String(input?.kind ?? "");
    const mimeType = String(input?.mimeType ?? "");
    const fileSize = Number(input?.fileSize);
    if (!accessToken || accessToken.length > 8192 || accessToken.split(".").length !== 3) throw new Error("Unauthorized");
    if (!["avatar", "cover"].includes(kind)) throw new Error("Некорректный тип изображения.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) throw new Error("Поддерживаются JPG, PNG и WebP.");
    if (!Number.isInteger(fileSize) || fileSize < 1 || fileSize > 5 * 1024 * 1024) throw new Error("Размер изображения не должен превышать 5 МБ.");
    return { accessToken, kind, mimeType, fileSize };
  })
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"], key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Core Supabase is not configured.");
    const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: identity, error } = await auth.auth.getUser(data.accessToken);
    if (error || !identity.user) throw new Error("Unauthorized");
    const extension = data.mimeType === "image/jpeg" ? "jpg" : data.mimeType === "image/png" ? "png" : "webp";
    const path = `profiles/${identity.user.id}/${data.kind}/${crypto.randomUUID()}.${extension}`;
    const { getCloudyContentAdmin } = await import("@/integrations/supabase/content.server");
    const content = getCloudyContentAdmin();
    const { data: signed, error: signedError } = await content.storage.from("cloudy-shorts").createSignedUploadUrl(path);
    if (signedError || !signed?.signedUrl) throw new Error("Не удалось подготовить загрузку изображения.");
    return { path, signedUrl: signed.signedUrl, token: signed.token };
  });


type SavedPostInput = { accessToken?: string; videoId?: string; saved?: boolean };
export const setShortsSavedPost = createServerFn({ method: "POST" })
  .inputValidator((input: Partial<SavedPostInput>): SavedPostInput => {
    const accessToken = String(input?.accessToken ?? ""), videoId = String(input?.videoId ?? "");
    if (!accessToken || accessToken.length > 8192 || accessToken.split(".").length !== 3) throw new Error("Unauthorized");
    if (!/^[0-9a-f-]{36}$/i.test(videoId) || typeof input?.saved !== "boolean") throw new Error("Некорректное действие с сохранением.");
    return { accessToken, videoId, saved: input.saved };
  })
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"], key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Core Supabase is not configured.");
    const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: identity, error: authError } = await auth.auth.getUser(data.accessToken);
    if (authError || !identity.user) throw new Error("Unauthorized");
    const { getCloudyContentAdmin } = await import("@/integrations/supabase/content.server");
    const content = getCloudyContentAdmin();
    const { data: video, error: videoError } = await content.from("shorts_videos").select("id,status").eq("id", data.videoId).maybeSingle();
    if (videoError || !video || video.status !== "approved") throw new Error("Публикация недоступна для сохранения.");
    if (data.saved) {
      const { error } = await content.from("shorts_saved_posts").upsert({ video_id: data.videoId, user_id: identity.user.id }, { onConflict: "video_id,user_id", ignoreDuplicates: true });
      if (error) throw new Error("Не удалось сохранить публикацию.");
    } else {
      const { error } = await content.from("shorts_saved_posts").delete().eq("video_id", data.videoId).eq("user_id", identity.user.id);
      if (error) throw new Error("Не удалось убрать публикацию из сохранённых.");
    }
    return { ok: true, isSaved: data.saved };
  });
