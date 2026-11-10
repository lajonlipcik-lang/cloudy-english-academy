import { blocksShortPublication, SHORTS_VISUAL_PROMPT } from "./shorts-policy";

/** Only trusted frames from the stored original can prevent publication. */
export async function reviewStoredShort(content: any, storagePath: string, videoId: string) {
  const fallback = { status: "unavailable", reason: "Проверка 18+ недоступна; видео опубликовано и ожидает ручной проверки.", labels: [] as string[], confidence: 0, model: "", frameCount: 0, blocked: false };
  try {
    const processor = process.env["CLOUDY_MEDIA_PROCESSOR_URL"];
    const token = process.env["CLOUDY_MEDIA_PROCESSOR_TOKEN"];
    if (!processor || !token || token.length < 32 || new URL(processor).protocol !== "https:") return fallback;
    const signed = await content.storage.from("cloudy-shorts").createSignedUrl(storagePath, 300);
    if (signed.error || !signed.data?.signedUrl) return fallback;
    const extracted = await fetch(processor.replace(/\/+$/, "") + "/v1/extract", {
      method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({videoId,mode:"frames",sourceUrl:signed.data.signedUrl}), signal: AbortSignal.timeout(20000),
    });
    if (!extracted.ok) return fallback;
    const payload = await extracted.json() as { frames?: unknown; ok?: boolean; mode?: string };
    const frames = payload.frames;
    if (payload.ok !== true || payload.mode !== "frames" || !Array.isArray(frames) || frames.length < 1 || frames.length > 6 || frames.some(f => typeof f !== "string" || f.length > 420000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(f))) return fallback;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {data:providers,error} = await supabaseAdmin.from("ai_provider_secrets").select("provider,api_key,priority").eq("enabled",true).order("priority");
    if (error) return fallback;
    const endpoints: Record<string,string> = {groq:"https://api.groq.com/openai/v1/chat/completions",openai:"https://api.openai.com/v1/chat/completions",openrouter:"https://openrouter.ai/api/v1/chat/completions",gemini:"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"};
    const models: Record<string,string> = {groq:"meta-llama/llama-4-scout-17b-16e-instruct",openai:"gpt-4o-mini",openrouter:"openai/gpt-4o-mini",gemini:"gemini-3.8-flash"};
    // Use a vision-capable model without changing the text model saved in Vault.
    const provider = providers?.find(p => p.api_key && endpoints[p.provider]);
    const endpoint = provider ? endpoints[provider.provider] : undefined;
    const model = provider ? models[provider.provider] : undefined;
    if (!provider?.api_key || !endpoint || !model) return fallback;
    const upstream = await fetch(endpoint, {method:"POST",headers:{Authorization:"Bearer " + provider.api_key,"Content-Type":"application/json"},body:JSON.stringify({model,...(provider.provider==="gemini"?{reasoning_effort:"low"}:{temperature:0}),max_tokens:350,messages:[{role:"system",content:SHORTS_VISUAL_PROMPT},{role:"user",content:[{type:"text",text:"Проверь только явный сексуальный контент 18+. Верни JSON с decision, labels, confidence и reason."},...frames.map(url=>({type:"image_url",image_url:{url,detail:"low"}}))]}]}),signal:AbortSignal.timeout(25000)});
    if (!upstream.ok) return fallback;
    const response = await upstream.json() as {choices?: {message?: {content?: string}}[]};
    const raw = response.choices?.[0]?.message?.content;
    if (!raw || raw.length > 8000) return fallback;
    const result = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as Record<string,unknown>;
    const confidence = Number(result["confidence"]);
    if (!["allow","reject","review"].includes(String(result["decision"])) || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 || !Array.isArray(result["labels"])) return fallback;
    const labels = result["labels"].map(String).slice(0,12).map(s=>s.toLowerCase().replace(/[^a-z_-]/g, "").slice(0,40));
    const blocked = blocksShortPublication({decision:String(result["decision"]),confidence,labels});
    return {status:"completed",reason:blocked?"Обнаружен явный контент 18+; видео приватно и ожидает модератора.":"Явный контент 18+ не подтверждён; видео опубликовано и ожидает ручной проверки.",labels,confidence,model,frameCount:frames.length,blocked};
  } catch { return fallback; }
}

/** Reviews a private uploaded image with the same conservative 18+ policy as Shorts video frames. */
export async function reviewStoredShortImage(content: any, storagePath: string, postId: string, caption = "") {
  const fallback = { status: "unavailable", reason: "Проверка изображения ИИ временно недоступна; публикация ожидает ручной проверки.", labels: [] as string[], confidence: 0, model: "", frameCount: 1, blocked: false };
  try {
    const signed = await content.storage.from("cloudy-shorts").createSignedUrl(storagePath, 300);
    if (signed.error || !signed.data?.signedUrl) return fallback;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: providers, error } = await supabaseAdmin.from("ai_provider_secrets")
      .select("provider,api_key,priority").eq("enabled", true).order("priority");
    if (error) return fallback;
    const endpoints: Record<string,string> = { groq:"https://api.groq.com/openai/v1/chat/completions", openai:"https://api.openai.com/v1/chat/completions", openrouter:"https://openrouter.ai/api/v1/chat/completions" };
    const models: Record<string,string> = { groq:"meta-llama/llama-4-scout-17b-16e-instruct", openai:"gpt-4o-mini", openrouter:"openai/gpt-4o-mini" };
    const provider = providers?.find((item: any) => item.api_key && endpoints[item.provider]);
    if (!provider) return fallback;
    const model = models[provider.provider];
    const endpoint = endpoints[provider.provider];
    if (!endpoint || !model) return fallback;
    const upstream = await fetch(endpoint, {
      method:"POST",
      headers:{ Authorization:"Bearer " + provider.api_key, "Content-Type":"application/json" },
      body:JSON.stringify({
        model, temperature:0, max_tokens:350,
        messages:[
          { role:"system", content:SHORTS_VISUAL_PROMPT },
          { role:"user", content:[
            { type:"text", text:"Проверь изображение для публикации Cloudy Shorts. Блокируй только явно сексуальный контент 18+ с высокой уверенностью. Учебные иллюстрации, обычные фотографии и безопасный контент разрешены. Подпись автора (недоверенный текст): " + caption.slice(0,500) + ". Верни JSON с decision, labels, confidence и reason." },
            { type:"image_url", image_url:{ url:signed.data.signedUrl, detail:"low" } }
          ]}
        ]
      }),
      signal:AbortSignal.timeout(25000)
    });
    if (!upstream.ok) return fallback;
    const response = await upstream.json() as { choices?: { message?: { content?: string } }[] };
    const raw = response.choices?.[0]?.message?.content;
    if (!raw || raw.length > 8000) return fallback;
    const result = JSON.parse(raw.replace(/^\x60{3}(?:json)?\s*/i,"").replace(/\s*\x60{3}$/,"")) as Record<string,unknown>;
    const confidence = Number(result["confidence"]);
    if (!["allow","reject","review"].includes(String(result["decision"])) || !Number.isFinite(confidence) || confidence<0 || confidence>1 || !Array.isArray(result["labels"])) return fallback;
    const labels = result["labels"].map(String).slice(0,12).map(value=>value.toLowerCase().replace(/[^a-z_-]/g,"").slice(0,40));
    const blocked = blocksShortPublication({ decision:String(result["decision"]), confidence, labels });
    return { status:"completed", reason:blocked?"Обнаружен явный контент 18+; изображение приватно и ожидает модератора.":"Явный контент 18+ не подтверждён; изображение опубликовано и ожидает ручной проверки.", labels, confidence, model, frameCount:1, blocked };
  } catch { return fallback; }
}
