import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { runWithAiFallback } from "@/lib/ai/router";
const OWNER="lajonlipcik@gmail.com";
type Input={accessToken:string;provider?:string;apiKey?:string;label?:string;model?:string;priority?:number;id?:string;message?:string;level?:string;history?:Array<{role:string;content:string}>};
function validate(v:Input){const t=String(v?.accessToken??"");if(!t||t.length>8192||t.split(".").length!==3)throw new Error("Unauthorized");return {...v,accessToken:t}}
async function ctx(token:string,owner=false){const url=process.env["SUPABASE_URL"],pub=process.env["SUPABASE_PUBLISHABLE_KEY"];if(!url||!pub)throw new Error("Supabase server is not configured.");const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await auth.auth.getUser(token);if(error||!data.user)throw new Error("Unauthorized");const email=(data.user.email??"").trim().toLowerCase(),role=data.user.app_metadata?.["role"];if(owner&&role!=="admin"&&email!==OWNER)throw new Error("Недостаточно прав.");const {supabaseAdmin}=await import("@/integrations/supabase/client.server");return {user:data.user,db:supabaseAdmin as any}}
// New keys are stored in api_key in this RLS-protected table. Legacy AES-GCM
// records remain readable only when the old encryption secret is still configured.
async function legacyUnseal(ciphertext:string,iv:string){
  const secret=process.env["AI_SECRETS_ENCRYPTION_KEY"];
  if(!secret||secret.length<32) throw new Error("Старый ключ провайдера зашифрован прежним секретом. Для него временно верните AI_SECRETS_ENCRYPTION_KEY или сохраните API-ключ заново.");
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret));
  const key=await crypto.subtle.importKey("raw",hash,"AES-GCM",false,["decrypt"]);
  const bytes=(v:string)=>Uint8Array.from(atob(v),x=>x.charCodeAt(0));
  const buf=await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(iv)},key,bytes(ciphertext));
  return new TextDecoder().decode(buf);
}
const safe=(r:any)=>({id:r.id,provider:r.provider,label:r.label,model:r.model,enabled:r.enabled,priority:r.priority,key_hint:r.key_hint,last_tested_at:r.last_tested_at,last_status:r.last_status});
async function rows(db:any){const {data,error}=await db.from("ai_provider_secrets").select("*").order("priority");if(error)throw new Error("AI Vault не создан. Примените миграцию 0001_cloudy_ai_vault.");return data??[]}
async function ask(r:any,messages:any[],max_tokens=700){
  const key=String(r.api_key??"").trim()||(r.ciphertext&&r.iv?await legacyUnseal(r.ciphertext,r.iv):"");
  if(!key)throw new Error("Для провайдера не сохранён API-ключ. Добавьте его в админ-панели.");
  const provider=String(r.provider??"");
  const model=String(r.model??"").trim()||(provider==="groq"?"openai/gpt-oss-120b":provider==="openrouter"?"openrouter/auto":"gpt-4o-mini");
  const endpoints:Record<string,string>={groq:"https://api.groq.com/openai/v1",openrouter:"https://openrouter.ai/api/v1",openai:"https://api.openai.com/v1"};
  const base=endpoints[provider];
  if(!base)throw new Error("Провайдер не поддерживается.");
  const res=await fetch(base+"/chat/completions",{
    method:"POST",
    headers:{
      Authorization:"Bearer "+key,
      "Content-Type":"application/json",
      ...(provider==="openrouter"?{"HTTP-Referer":"https://cloudy-english-quest.lovable.app","X-Title":"Cloudy English Academy"}:{}),
    },
    body:JSON.stringify({model,messages,temperature:.35,max_tokens:Math.max(1,Math.min(Number(max_tokens)||700,2000))}),
    signal:AbortSignal.timeout(25000),
  });
  if(!res.ok){
    const error=new Error(provider+" API: HTTP "+res.status) as Error & {status:number};
    error.status=res.status;
    throw error;
  }
  const data=await res.json() as any;
  const raw=data.choices?.[0]?.message?.content;
  const content=typeof raw==="string"?raw:Array.isArray(raw)?raw.map((part:any)=>typeof part?.text==="string"?part.text:"").join(""):"";
  if(!content.trim())throw new Error("Пустой ответ AI");
  return {content:content.trim(),provider,model};
}
export const listCloudyUsers=createServerFn({method:"POST"}).inputValidator(validate).handler(async({data})=>{const {db}=await ctx(data.accessToken,true);const {data:u,error}=await db.auth.admin.listUsers({page:1,perPage:200});if(error)throw new Error("Не удалось загрузить пользователей.");const ids=(u.users??[]).map((x:any)=>x.id);const [p,g]=await Promise.all([db.from("profiles").select("id,display_name").in("id",ids),db.from("user_progress").select("user_id,total_xp,week_xp,updated_at").in("user_id",ids)]);const pm=new Map((p.data??[]).map((x:any)=>[x.id,x])),gm=new Map((g.data??[]).map((x:any)=>[x.user_id,x]));return {users:(u.users??[]).map((x:any)=>({id:x.id,email:x.email??"",name:(pm.get(x.id) as any)?.display_name??x.user_metadata?.["name"]??"Ученик",created_at:x.created_at,last_sign_in_at:x.last_sign_in_at??null,confirmed:!!x.email_confirmed_at,total_xp:(gm.get(x.id) as any)?.total_xp??0,week_xp:(gm.get(x.id) as any)?.week_xp??0}))}});
export const listAiProviders=createServerFn({method:"POST"}).inputValidator(validate).handler(async({data})=>{const {db}=await ctx(data.accessToken,true);return {providers:(await rows(db)).map(safe)}});
export const saveAiProvider=createServerFn({method:"POST"}).inputValidator(validate).handler(async({data})=>{const {db,user}=await ctx(data.accessToken,true),provider=String(data.provider??"");if(!["openai","groq","openrouter"].includes(provider))throw new Error("Провайдер не поддерживается.");const secret=String(data.apiKey??"").trim();if(secret.length<12||secret.length>500)throw new Error("Проверьте API-ключ.");const {data:r,error}=await db.from("ai_provider_secrets").upsert({provider,
    api_key: secret,
    ciphertext: null,
    iv: null,
    label: String(data.label ?? provider).slice(0, 50),
    model: String(data.model ?? "").slice(0, 120),
    key_hint: secret.slice(0, 4) + "••••" + secret.slice(-4),
    enabled: true,
    priority: Number(data.priority) || 10,
    updated_by: user.id,
    updated_at: new Date().toISOString(),},{onConflict:"provider"}).select("*").single();if(error)throw new Error("Не удалось сохранить API: "+error.message);return {provider:safe(r)}});
export const deleteAiProvider=createServerFn({method:"POST"}).inputValidator(validate).handler(async({data})=>{const {db}=await ctx(data.accessToken,true);const {error}=await db.from("ai_provider_secrets").delete().eq("id",String(data.id??""));if(error)throw new Error("Не удалось удалить API.");return {ok:true}});
export const testAiProvider=createServerFn({method:"POST"}).inputValidator(validate).handler(async({data})=>{const {db}=await ctx(data.accessToken,true),r=(await rows(db)).find((x:any)=>x.id===String(data.id??""));if(!r)throw new Error("Провайдер не найден.");try{const a=await ask(r,[{role:"user",content:"Ответь одним словом: Cloudy работает."}],20);await db.from("ai_provider_secrets").update({last_tested_at:new Date().toISOString(),last_status:"ok"}).eq("id",r.id);return {ok:true,provider:a.provider,model:a.model,response:a.content}}catch(e){await db.from("ai_provider_secrets").update({last_tested_at:new Date().toISOString(),last_status:"error"}).eq("id",r.id);throw e}});
export const cloudyTutorChat=createServerFn({method:"POST"}).inputValidator(validate).handler(async({data})=>{const {db}=await ctx(data.accessToken),prompt=String(data.message??"").trim().slice(0,3000);if(!prompt)throw new Error("Напишите сообщение.");const level=["A1","A2","B1","B2"].includes(String(data.level))?String(data.level):"A1";const history=Array.isArray(data.history)?data.history.slice(-16).map((m:any)=>({role:m?.role==="assistant"?"assistant":"user",content:String(m?.content??"").slice(0,3000)})).filter((m:any)=>m.content):[];const providers=(await rows(db)).filter((x:any)=>x.enabled).sort((a:any,b:any)=>a.priority-b.priority);if(!providers.length)throw new Error("ИИ ещё не подключён администратором.");const system="Ты Cloudy — дружелюбный преподаватель английского языка для русскоговорящего ученика уровня CEFR "+level+". Отвечай коротко и понятно, используй английский по уровню ученика. Мягко исправляй ошибки и объясняй по-русски одной строкой. Задавай только один вопрос за раз. Без эмодзи и Markdown. Не выдумывай прогресс ученика.";const messages=[{role:"system",content:system},...history];if(!history.length||history[history.length-1]?.role!=="user")messages.push({role:"user",content:prompt});const routed=await runWithAiFallback(providers.map((r:any)=>({id:String(r.id),priority:Number(r.priority)||0})),async(candidate)=>{const provider=providers.find((r:any)=>String(r.id)===candidate.id);if(!provider)throw new Error("AI provider configuration changed.");return ask(provider,messages,700)});const a=routed.value;return {answer:a.content,provider:a.provider,model:a.model}});
