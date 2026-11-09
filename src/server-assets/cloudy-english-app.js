
const { D, LV, ALL, P } = window.CloudyCatalog;
let SEC=[];
const DEF=()=>({xp:0,streak:0,last:"",done:0,lv:"",dn:{A1:0,A2:0,B1:0,B2:0},acc:[0,0],mis:{},days:[],ach:[],wk:{k:"",xp:0},perf:0,tested:0,user:null,set:{snd:1,vol:.7,voice:1,goal:30,mic:1,th:"dark",rem:0,remT:"19:00"},td:{d:"",xp:0,les:0,ok:0,claim:0}});
let S=DEF(),T=0;
let KEY="cl2";
const ls=(k,v)=>{try{return v===undefined?localStorage.getItem(k):localStorage.setItem(k,v)}catch(e){return null}};
function load(key){KEY=key;S=DEF();try{const j=JSON.parse(ls(key)||"{}");S=Object.assign(DEF(),j);S.set=Object.assign(DEF().set,j.set);S.td=Object.assign(DEF().td,j.td);S.dn=Object.assign(DEF().dn,j.dn);if(!j.dn&&j.done&&j.lv===undefined){S.dn.A1=j.done;S.lv="A1"}if(!["A1","A2","B1","B2"].includes(S.lv))S.lv="";S.set.th="dark"}catch(e){}}
load(ls("cl2s")?"cl2:"+ls("cl2s"):"cl2");
let cloudUserId=null,cloudSyncTimer=0,cloudSyncRetry=0,cloudSyncInFlight=null,cloudSyncPending=null,cloudSyncSeq=0,cloudLocalRevision=0,cloudSyncAttempts=0,cloudUpdatedAt=null,cloudSyncPaused=false,cloudBaseState=null;
// Embedded mode waits for the parent bridge; direct/PWA mode has no parent session to await.
let sessionHydrating=window.parent!==window;
let sessionHydrationTimer=0;
let cloudProgressPending=false;
let regionCheckPending=true,regionCheckFailed=false,regionCheckPromise=null;
function cloudLoader(){app.innerHTML=`<div style="min-height:100svh;display:grid;place-items:center;background:var(--bg,#0b1020);color:var(--text,#fff);font:600 15px system-ui"><div style="text-align:center"><div style="font-size:42px;margin-bottom:12px">☁️</div>Загружаем твой прогресс…</div></div>`}
function regionCheckError(){app.innerHTML=`<div role="status" style="min-height:100svh;display:grid;place-items:center;background:var(--bg,#0b1020);color:var(--text,#fff);font:600 15px system-ui;padding:24px"><div style="text-align:center;max-width:320px"><div style="font-size:42px;margin-bottom:12px">☁️</div><p>Не удалось проверить доступность сервиса.</p><p style="font-size:13px;opacity:.75">Проверьте подключение к интернету и повторите попытку.</p><button class="btn" type="button" onclick="retryCloudyRegionCheck()">ПОВТОРИТЬ ПРОВЕРКУ</button></div></div>`}
async function verifyCloudyRegion(){
 if(regionCheckPromise)return regionCheckPromise;
 regionCheckPending=true;regionCheckFailed=false;cloudLoader();
 regionCheckPromise=(async()=>{
  try{
   const response=await fetch("/",{method:"HEAD",cache:"no-store",credentials:"same-origin"});
   if(response.status===403){
    try{window.top.location.replace("/")}catch(_){window.location.replace("/")}
    return false;
   }
   if(!response.ok)throw new Error("Region check failed: "+response.status);
   regionCheckPending=false;return true;
  }catch(error){
   regionCheckPending=false;regionCheckFailed=true;regionCheckError();return false;
  }finally{regionCheckPromise=null}
 })();
 return regionCheckPromise;
}
async function retryCloudyRegionCheck(){const allowed=await verifyCloudyRegion();if(allowed)continueCloudyBoot()}
const cloneProgressState=state=>JSON.parse(JSON.stringify(state||{}));
const progressNumber=value=>Number.isFinite(Number(value))?Number(value):0;
const mergeCounter=(remoteValue,localValue,baseValue)=>Math.max(0,progressNumber(remoteValue)+progressNumber(localValue)-progressNumber(baseValue));
function mergeCloudProgress(remote,local,base={}){
 const merged={...remote,...local,xp:progressNumber(remote.xp),wk:remote.wk||local.wk};
 // Merge each preference independently. A stale device must not overwrite
 // unrelated settings changed on another device (voice, volume, theme, etc.).
 const settingKeys=new Set([...Object.keys(remote.set||{}),...Object.keys(local.set||{}),...Object.keys(base.set||{})]);
 merged.set={};
 settingKeys.forEach(key=>{
  const localValue=local.set?.[key],remoteValue=remote.set?.[key],baseValue=base.set?.[key];
  const localChanged=JSON.stringify(localValue)!==JSON.stringify(baseValue);
  merged.set[key]=localChanged&&localValue!==undefined?localValue:remoteValue!==undefined?remoteValue:localValue;
 });
 merged.set.th="dark";
 const levels=['A1','A2','B1','B2'];merged.dn={...(remote.dn||{}),...(local.dn||{})};
 levels.forEach(k=>merged.dn[k]=Math.max(progressNumber(remote.dn?.[k]),progressNumber(local.dn?.[k])));
 merged.done=Math.max(progressNumber(remote.done),progressNumber(local.done));
 merged.streak=Math.max(progressNumber(remote.streak),progressNumber(local.streak));
 merged.perf=mergeCounter(remote.perf,local.perf,base.perf);
 merged.ach=[...new Set([...(Array.isArray(remote.ach)?remote.ach:[]),...(Array.isArray(local.ach)?local.ach:[])])];
 merged.days=[...new Set([...(Array.isArray(remote.days)?remote.days:[]),...(Array.isArray(local.days)?local.days:[])])].sort((a,b)=>(Date.parse(a)||0)-(Date.parse(b)||0)).slice(-60);
 const words=new Set([...Object.keys(remote.mis||{}),...Object.keys(local.mis||{}),...Object.keys(base.mis||{})]);
 merged.mis={};words.forEach(word=>{const count=mergeCounter(remote.mis?.[word],local.mis?.[word],base.mis?.[word]);if(count>0)merged.mis[word]=count});
 if(Array.isArray(remote.acc)||Array.isArray(local.acc))merged.acc=[0,1].map(i=>mergeCounter(remote.acc?.[i],local.acc?.[i],base.acc?.[i]));
 if(remote.td&&local.td){
  if(remote.td.d===local.td.d&&remote.td.d===base.td?.d)merged.td={...remote.td,...local.td,xp:mergeCounter(remote.td.xp,local.td.xp,base.td.xp),les:mergeCounter(remote.td.les,local.td.les,base.td.les),ok:mergeCounter(remote.td.ok,local.td.ok,base.td.ok),claim:Number(remote.td.claim)||Number(local.td.claim)?1:0};
  else if(remote.td.d===local.td.d)merged.td={...remote.td,...local.td,xp:Math.max(progressNumber(remote.td.xp),progressNumber(local.td.xp)),les:Math.max(progressNumber(remote.td.les),progressNumber(local.td.les)),ok:Math.max(progressNumber(remote.td.ok),progressNumber(local.td.ok)),claim:Number(remote.td.claim)||Number(local.td.claim)?1:0};
  else merged.td=(Date.parse(local.td.d||'')||0)>(Date.parse(remote.td.d||'')||0)?local.td:remote.td;
 }
 const localLast=Date.parse(local.last||'')||0,remoteLast=Date.parse(remote.last||'')||0;
 if(localLast>remoteLast){merged.last=local.last;merged.streak=progressNumber(local.streak)}
 else if(remoteLast>localLast){merged.last=remote.last;merged.streak=progressNumber(remote.streak)}
 else merged.streak=Math.max(progressNumber(remote.streak),progressNumber(local.streak));
 const validLevel=value=>['A1','A2','B1','B2'].includes(value);
 merged.lv=validLevel(local.lv)?local.lv:validLevel(remote.lv)?remote.lv:'';
 merged.tested=Boolean(remote.tested||local.tested);
 return merged;
}
function flushCloudProgress(){
 if(!cloudUserId||S.user?.guest||!cloudSyncPending||cloudSyncInFlight)return;
 if(typeof navigator!=='undefined'&&!navigator.onLine)return;
 const pending=cloudSyncPending;clearTimeout(cloudSyncTimer);cloudSyncTimer=0;cloudSyncPending=null;cloudSyncInFlight=pending;
 try{window.parent.postMessage({channel:'cloudy-auth',type:'progress-save',state:pending.state,userId:cloudUserId,expectedUpdatedAt:cloudUpdatedAt,syncId:pending.id},location.origin)}
 catch(e){cloudSyncPending=pending;cloudSyncInFlight=null;scheduleCloudRetry()}
}
function scheduleCloudRetry(){
 if(cloudSyncRetry||!cloudSyncPending)return;
 const delay=Math.min(30000,1000*Math.pow(2,Math.min(cloudSyncAttempts,5)));
 cloudSyncAttempts++;cloudSyncRetry=setTimeout(()=>{cloudSyncRetry=0;flushCloudProgress()},delay);
}
function queueCloudProgress(){
 if(!cloudUserId||S.user?.guest||cloudSyncPaused)return;
 try{cloudSyncPending={id:++cloudSyncSeq,revision:++cloudLocalRevision,state:cloneProgressState(S),baseState:cloneProgressState(cloudBaseState||{})}}catch(e){return}
 clearTimeout(cloudSyncTimer);cloudSyncTimer=setTimeout(()=>{cloudSyncTimer=0;flushCloudProgress()},650);
}
const requestCloudSession=()=>{if(cloudUserId&&!S.user?.guest&&cloudSyncPaused)window.parent.postMessage({channel:'cloudy-auth',type:'init',state:'refresh'},location.origin)};
window.addEventListener('online',()=>{clearTimeout(cloudSyncRetry);cloudSyncRetry=0;if(cloudSyncPaused)requestCloudSession();else flushCloudProgress()});
window.addEventListener('pageshow',()=>{if(cloudUserId&&!S.user?.guest){if(cloudSyncPaused)requestCloudSession();else flushCloudProgress()}});
document.addEventListener('visibilitychange',()=>{if(cloudUserId&&!S.user?.guest){if(document.hidden)flushCloudProgress();else if(cloudSyncPaused)requestCloudSession();else flushCloudProgress()}});
window.addEventListener('pagehide',()=>{if(cloudUserId&&!S.user?.guest&&cloudSyncPending)flushCloudProgress()});
const save=(skipCloudSync=false)=>{
 try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){console.warn('[cloudy-progress] local backup could not be written')}
 if(!skipCloudSync&&cloudUserId&&!S.user?.guest)ls('cl2dirty:'+S.user.email,String(Date.now()));
 if(!skipCloudSync)queueCloudProgress();
};
const roll=()=>{const t=new Date().toDateString();if(S.td.d!=t)S.td={d:t,xp:0,les:0,ok:0,claim:0}};
const $=s=>document.querySelector(s),sh=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const app=$("#app"),ic=n=>`<svg class="i"><use href="#${n}"/></svg>`;
let AC,MG;
function snd(t,c=0){if(!S.set.snd)return;try{if(!AC){AC=new(window.AudioContext||window.webkitAudioContext)();MG=AC.createGain();MG.connect(AC.destination)}if(AC.state=="suspended")AC.resume();MG.gain.value=S.set.vol;const b=1+Math.min(c,7)*.07;
const P={tap:[[560,0,.07,"triangle"]],flip:[[460,0,0.04,"sine",340],[340,0.015,0.05,"sine",260]],pick:[[420,0,.08,"sine",640],[640,.05,.08]],tab:[[760,0,.07,"sine",520]],sheet:[[300,0,.25,"sine",700]],go:[[330,0,.3,"sine",990]],ok:[[523*b,0,.18],[784*b,.09,.26]],match:[[880,0,.12],[1175,.07,.2]],bad:[[220,0,.18,"sawtooth",140],[150,.14,.22,"sawtooth",100]],win:[[523,0,.2],[659,.12,.2],[784,.24,.2],[1047,.36,.5]],chest:[[392,0,.15],[523,.09,.15],[659,.18,.15],[784,.27,.15],[1047,.36,.15],[1319,.5,.6]],star:[[1200,0,.15],[1600,.07,.25]],send:[[520,0,.05,"sine",720],[720,.025,.07,"sine",960]]}[t];
P.forEach(([f,d,l,w,e])=>{const o=AC.createOscillator(),g=AC.createGain(),s=AC.currentTime+d;o.type=w||"sine";o.frequency.setValueAtTime(f,s);if(e)o.frequency.exponentialRampToValueAtTime(e,s+l);g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(t=="bad"?.12:.22,s+.02);g.gain.exponentialRampToValueAtTime(.0001,s+l+.05);o.connect(g);g.connect(MG);o.start(s);o.stop(s+l+.1)})}catch(e){}}
const cloudyMaleVoiceNames=/^(alex|aaron|fred|eddy|reed|tom|bruce|daniel|arthur|ralph)(\s|$)/i;
function cloudySelectMaleAmericanVoice(voices){
 const american=voices.filter(v=>/^en-US$/i.test(v.lang||""));
 return american.find(v=>cloudyMaleVoiceNames.test(v.name||""))
  ||american.find(v=>/\b(male|masculine)\b/i.test(v.name||""))
  ||null;
}
let cloudySpeechRequest=0;
const cloudyAudioCache=new Map();
let cloudyCurrentAudio=null;
function cloudyLocalSpeechFallback(text,request){
 try{
  if(request!==cloudySpeechRequest||typeof speechSynthesis==="undefined"||typeof SpeechSynthesisUtterance==="undefined")return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);const russian=/[А-Яа-яЁё]/.test(text);u.lang=russian?"ru-RU":"en-US";u.rate=russian ? 0.96 : 0.92;
  const voices=speechSynthesis.getVoices(),voice=russian?voices.find(v=>/^ru([_-]|$)/i.test(v.lang||"")):cloudySelectMaleAmericanVoice(voices);if(voice)u.voice=voice;
  speechSynthesis.speak(u);
 }catch(e){}
}
async function say(t,f){
 if(!f&&!S.set.voice)return;
 const text=String(t||"").replace(/\s+/g," ").trim();if(!text)return;
 const request=++cloudySpeechRequest;
 if(/[А-Яа-яЁё]/.test(text)){cloudyLocalSpeechFallback(text,request);return}
 try{
  if(cloudyCurrentAudio){cloudyCurrentAudio.pause();cloudyCurrentAudio=null}
  if(typeof speechSynthesis!=="undefined")speechSynthesis.cancel();
  let audioUrl=cloudyAudioCache.get(text);
  if(!audioUrl){
   const response=await authRequest("tts",{payload:{text:text.slice(0,200)}});
   if(request!==cloudySpeechRequest)return;
   const result=response?.result;
   if(!result?.audioBase64)throw new Error("Сервер не вернул аудио");
   const raw=atob(result.audioBase64),bytes=new Uint8Array(raw.length);
   for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
   audioUrl=URL.createObjectURL(new Blob([bytes],{type:result.mimeType||"audio/wav"}));
   cloudyAudioCache.set(text,audioUrl);
   while(cloudyAudioCache.size>30){const first=cloudyAudioCache.keys().next().value;const old=cloudyAudioCache.get(first);if(old)URL.revokeObjectURL(old);cloudyAudioCache.delete(first)}
  }
  if(request!==cloudySpeechRequest)return;
  const audio=new Audio(audioUrl);cloudyCurrentAudio=audio;audio.play().catch(()=>cloudyLocalSpeechFallback(text,request));
  audio.onended=()=>{if(cloudyCurrentAudio===audio)cloudyCurrentAudio=null};
 }catch(error){
  if(request===cloudySpeechRequest)cloudyLocalSpeechFallback(text,request);
 }
}
function conf(n=40){const c=["#fff","#bfe0ff","#4db3ff","#ffd35a","#38d39a"];for(let k=0;k<n;k++){const d=document.createElement("i");d.className="cf";d.style.cssText=`left:${Math.random()*100}%;width:${6+Math.random()*6}px;height:${10+Math.random()*8}px;background:${c[k%5]};--t:${2.4+Math.random()*1.6}s;--dx:${(Math.random()-.5)*160}px;--r:${Math.random()*900}deg;animation-delay:${Math.random()*.5}s`;document.body.appendChild(d);setTimeout(()=>d.remove(),4500)}}
const mascot=(m="h")=>`<svg class="ms" viewBox="0 0 100 80"><path d="M26 68a18 18 0 0 1-2-37 24 24 0 0 1 46-6 20 20 0 0 1 6 43z" fill="url(#gb)"/><g class="eyes"><circle cx="40" cy="45" r="5" fill="#06143a"/><circle cx="62" cy="45" r="5" fill="#06143a"/><circle cx="42" cy="43" r="1.800" fill="#fff"/><circle cx="64" cy="43" r="1.800" fill="#fff"/></g><path d="${m=="s"?"M44 60q7-7 14 0":"M44 54q7 8 14 0"}" stroke="#06143a" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="31" cy="55" r="4" fill="#ff9fb0" opacity=".55"/><circle cx="71" cy="55" r="4" fill="#ff9fb0" opacity=".55"/></svg>`;
function sheet(h){const s=document.createElement("div");s.className="sb";s.innerHTML=`<div class="sh">${h}</div>`;s.onclick=e=>{if(e.target==s)closeSh()};document.body.appendChild(s);snd("sheet")}
function closeSh(){const s=$(".sb");if(!s)return;if(s.dataset.shortsUpload==="1")shortsDisposeUpload();s.classList.add("out");setTimeout(()=>s.remove(),300)}
let __dockPrev=-1;const NAVORD=[0,1,2,3],NAVN={0:"Учёба",1:"Задания",2:"Лига",3:"Профиль"},NAVI={0:"home",1:"target",2:"medal",3:"user"};
const nav=()=>{
 const cur=NAVORD.indexOf(T),prev=__dockPrev<0?cur:__dockPrev;__dockPrev=cur;
 if(prev!==cur)requestAnimationFrame(()=>requestAnimationFrame(()=>{const n=document.querySelector("nav.dock");if(n)n.style.setProperty("--i",cur)}));
 return '<nav class="dock" style="--i:'+prev+'"><i class="dock-ind"></i>'+NAVORD.map(k=>'<button class="'+(T===k?"on":"") + '" onclick="tab('+k+')">'+ic(NAVI[k])+'<span>'+NAVN[k]+'</span></button>').join("")+'</nav>'+(T===0?'<button class="fab-ai" onclick="chat()" aria-label="Практика с Клауди">'+mascot()+'<span>Практика</span></button>':"");
};
const isAppleMobile=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isInstalledCloudy=()=>window.navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches;
function renderInstallGate(){
 const safari=/Safari/i.test(navigator.userAgent)&&!/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/i.test(navigator.userAgent);
 app.innerHTML=`<div class="install-gate"><section class="install-panel"><div class="install-cloud">${mascot()}</div><h1 class="install-title">Давай установим Cloudy!</h1><p class="install-lead">Добавь Cloudy на главный экран iPhone — и открывай его как настоящее приложение. Это займёт всего несколько секунд ☁️</p><div class="install-steps"><div class="install-step"><span class="install-number">1</span><div><strong>Нажми «Поделиться»</strong><small>${safari?'Внизу Safari нажми квадрат со стрелкой вверх.':'Открой этот сайт в Safari, затем нажми квадрат со стрелкой вверх.'}</small></div><span class="install-share-icon" aria-hidden="true">↥</span></div><div class="install-step"><span class="install-number">2</span><div><strong>Выбери «На экран Домой»</strong><small>Прокрути меню вниз, выбери этот пункт и оставь включённым «Открывать как веб-приложение», если появится переключатель.</small></div><span class="install-share-icon">＋</span></div><div class="install-step"><span class="install-number">3</span><div><strong>Нажми «Добавить»</strong><small>Затем вернись на главный экран и открой иконку Cloudy.</small></div><span class="install-share-icon">☁️</span></div></div><p class="install-note" id="installNote">${safari?'После добавления открой Cloudy именно с главного экрана iPhone.':'Для установки потребуется Safari. Встроенный браузер приложения не поддерживает этот способ.'}</p><button class="install-action" onclick="checkCloudyInstall()">Я добавил Cloudy — проверить</button><span class="install-browser">Cloudy English · Твой путь к английскому</span></section></div>`;
}
function checkCloudyInstall(){if(isInstalledCloudy()){try{localStorage.setItem('cloudyHomeInstalled','1')}catch(e){}view();return}const note=$('#installNote');if(note)note.textContent='Пока Cloudy открыт во вкладке Safari. Вернись на главный экран iPhone и запусти Cloudy с новой иконки — тогда установка подтвердится.';const panel=$('.install-panel');if(panel){panel.classList.remove('shk');void panel.offsetWidth;panel.classList.add('shk')}}
function ensureCloudyInstallGate(){if(!isAppleMobile()||isInstalledCloudy())return;if(!document.querySelector('#app .install-gate'))renderInstallGate()}
function continueCloudyBoot(){if(regionCheckPending||regionCheckFailed)return;if(isAppleMobile()&&!isInstalledCloudy()){renderInstallGate();setInterval(ensureCloudyInstallGate,20000);window.addEventListener('pageshow',ensureCloudyInstallGate);window.addEventListener('focus',ensureCloudyInstallGate);document.addEventListener('visibilitychange',()=>{if(!document.hidden)ensureCloudyInstallGate()});return}if(sessionHydrating){cloudLoader();return}view()}
function bootCloudy(){cloudLoader();void verifyCloudyRegion().then(allowed=>{if(allowed)continueCloudyBoot()})}
function mountShortsIntro(){
 if(T!==4||document.getElementById("cloudy-shorts-intro"))return;
 let seen=false;try{seen=sessionStorage.getItem("cloudyIntro")==="1"&&!/[?&]intro(?:=|&|$)/.test(location.search);}catch(_){}
 if(seen)return;
 if(!document.getElementById("cloudy-shorts-intro-style")){
  const style=document.createElement("style");style.id="cloudy-shorts-intro-style";
  style.textContent=`
  #cloudy-shorts-intro{position:fixed;inset:0;z-index:99999;overflow:hidden;background:linear-gradient(180deg,#050c24 0%,#0d2150 60%,#16336f 100%);color:#fff;font-family:Inter,"SF Pro Display",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;cursor:pointer;opacity:1;transition:opacity .9s ease}
  #cloudy-shorts-intro:before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.07) 1.5px,transparent 1.5px);background-size:46px 46px;pointer-events:none}
  #cloudy-shorts-intro.is-hidden{opacity:0;pointer-events:none}
  #cloudy-shorts-intro .csi-stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;will-change:transform}
  #cloudy-shorts-intro .csi-stage.zoom{transition:transform .9s cubic-bezier(.75,0,.95,.45);transform:scale(var(--zs,40))}
  #cloudy-shorts-intro .csi-logo{display:flex;flex-direction:column;align-items:center;gap:clamp(8px,2vw,20px);padding:0 16px;text-align:center}
  #cloudy-shorts-intro .csi-text{font-weight:800;letter-spacing:.06em;font-size:clamp(28px,8vw,84px);white-space:nowrap;display:flex;align-items:center;justify-content:center;transition:opacity .5s}
  #cloudy-shorts-intro .zoom .csi-text{opacity:0}
  #cloudy-shorts-intro .csi-char{opacity:0;display:inline-block;transform:translateY(8px);transition:opacity .08s,transform .08s}
  #cloudy-shorts-intro .csi-char.on{opacity:1;transform:none}
  #cloudy-shorts-intro .csi-white{color:#fff}#cloudy-shorts-intro .csi-blue{color:#9fd4ff}
  #cloudy-shorts-intro .csi-space{width:.3em}
  #cloudy-shorts-intro .csi-caret{display:inline-block;width:.07em;height:.85em;margin-left:.08em;background:#9fd4ff;animation:csiBlink .6s steps(1) infinite}
  #cloudy-shorts-intro .csi-caret.off{animation:none;opacity:0}
  @keyframes csiBlink{50%{opacity:0}}
  #cloudy-shorts-intro .csi-cloudslot{order:-1;width:clamp(130px,30vw,320px);aspect-ratio:100/80;position:relative}
  #cloudy-shorts-intro .csi-cloud{position:absolute;inset:0;opacity:0}
  #cloudy-shorts-intro .csi-cloud.fly{animation:csiFly 1s cubic-bezier(.25,.8,.3,1) forwards}
  @keyframes csiFly{0%{opacity:0;transform:translate(-70vw,-40vh) rotate(-25deg) scale(.5)}15%{opacity:1}60%{opacity:1;transform:translate(6vw,3vh) rotate(8deg) scale(1.05)}78%{transform:translate(-2vw,-1vh) rotate(-4deg) scale(.97,1.06)}90%{transform:translate(0,2px) rotate(0) scale(1.08,.9)}100%{opacity:1;transform:none}}
  #cloudy-shorts-intro .csi-ms{width:100%;display:block;filter:drop-shadow(0 8px 22px rgba(120,190,255,.5));transform-origin:50% 90%}
  #cloudy-shorts-intro .csi-cloud.settled .csi-ms{animation:csiFloat 3s ease-in-out infinite,csiSway 6s ease-in-out infinite}
  #cloudy-shorts-intro .csi-eyes{transform-box:fill-box;transform-origin:center;animation:csiEyeBlink 4.5s infinite}
  #cloudy-shorts-intro .csi-cheek{animation:csiCheek 3s ease-in-out infinite}
  @keyframes csiFloat{50%{transform:translateY(-10px)}}@keyframes csiSway{0%,100%{rotate:-3deg}50%{rotate:3deg}}
  @keyframes csiEyeBlink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}@keyframes csiCheek{50%{opacity:.85}}
  #cloudy-shorts-intro .csi-trail{position:absolute;height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,rgba(191,224,255,.7));opacity:0;pointer-events:none}
  #cloudy-shorts-intro .csi-trail.go{animation:csiTrail 1s ease-out forwards}
  @keyframes csiTrail{0%{opacity:0;transform:translate(-45vw,-25vh) rotate(-22deg) scaleX(.2)}20%{opacity:.8}100%{opacity:0;transform:translate(0,0) rotate(-22deg) scaleX(1)}}
  #cloudy-shorts-intro .csi-puff{position:absolute;border-radius:50%;background:#bfe0ff;opacity:0;pointer-events:none}
  #cloudy-shorts-intro .csi-puff.go{animation:csiPuff .8s ease-out forwards}
  @keyframes csiPuff{0%{opacity:.8;transform:translate(0,0) scale(.4)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1.2)}}
  #cloudy-shorts-intro .csi-flash{position:absolute;inset:0;background:radial-gradient(circle,#fff 0%,#bfe0ff 70%);opacity:0;pointer-events:none;transition:opacity .45s ease-in}
  #cloudy-shorts-intro .csi-flash.on{opacity:1}
  #cloudy-shorts-intro .csi-sound{position:absolute;top:max(14px,env(safe-area-inset-top));right:14px;z-index:2;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.12);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#fff;font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
  #cloudy-shorts-intro .csi-sound.hint{animation:csiHint 1.4s ease-in-out infinite}
  @keyframes csiHint{0%,100%{box-shadow:0 0 0 0 rgba(159,212,255,.55)}50%{box-shadow:0 0 0 10px rgba(159,212,255,0)}}
  @media(prefers-reduced-motion:reduce){#cloudy-shorts-intro *,#cloudy-shorts-intro *:before{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(style);
 }
 const root=document.createElement("div");root.id="cloudy-shorts-intro";
 root.innerHTML=`<div class="csi-stage"><div class="csi-logo"><div class="csi-cloudslot"><div class="csi-cloud"><svg class="csi-ms" viewBox="0 0 100 80" aria-hidden="true"><defs><linearGradient id="csi-gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#bfe0ff"/></linearGradient></defs><path d="M26 68a18 18 0 0 1-2-37 24 24 0 0 1 46-6 20 20 0 0 1 6 43z" fill="url(#csi-gb)"/><g class="csi-eyes"><circle cx="40" cy="45" r="5" fill="#06143a"/><circle cx="62" cy="45" r="5" fill="#06143a"/><circle cx="42" cy="43" r="1.8" fill="#fff"/><circle cx="64" cy="43" r="1.8" fill="#fff"/></g><path d="M44 54q7 8 14 0" stroke="#06143a" stroke-width="3" fill="none" stroke-linecap="round"/><circle class="csi-cheek" cx="31" cy="55" r="4" fill="#ff9fb0" opacity=".55"/><circle class="csi-cheek" cx="71" cy="55" r="4" fill="#ff9fb0" opacity=".55"/></svg></div></div><div class="csi-text"></div></div></div><div class="csi-flash"></div><button class="csi-sound" type="button" aria-label="Включить или выключить звук">🔇</button>`;
 document.body.appendChild(root);
 const stage=root.querySelector(".csi-stage"),cloud=root.querySelector(".csi-cloud"),slot=root.querySelector(".csi-cloudslot"),txt=root.querySelector(".csi-text"),flash=root.querySelector(".csi-flash"),sound=root.querySelector(".csi-sound");
 const timers=[];let finished=false,AC=null,muted=false;
 try{muted=localStorage.getItem("cloudyMute")==="1";}catch(_){}
 const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
 function audio(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(_){}}return AC;}
 function tone(freq,duration=.08,peak=.045,delay=0){if(muted)return;const a=audio();if(!a||a.state!=="running")return;const t=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();o.type="sine";o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+duration+.02);}
 function updateSound(){sound.textContent=muted?"🔇":"🔊";sound.classList.toggle("hint",!muted);}
 function finish(){if(finished)return;finished=true;timers.forEach(clearTimeout);try{sessionStorage.setItem("cloudyIntro","1");}catch(_){}window.dispatchEvent(new CustomEvent("cloudy:enter"));root.classList.add("is-hidden");setTimeout(()=>root.remove(),950);}
 sound.addEventListener("click",e=>{e.stopPropagation();muted=!muted;try{localStorage.setItem("cloudyMute",muted?"1":"0");}catch(_){}const a=audio();if(a&&a.state!=="running")a.resume().then(()=>tone(880,.05,.04));updateSound();});
 root.addEventListener("pointerdown",()=>{const a=audio();if(a&&a.state!=="running")a.resume().catch(()=>{});},{once:true});
 root.addEventListener("click",e=>{if(e.target!==sound)finish();});
 updateSound();
 const chars=[];[["CLOUDY","csi-white"],[" ","space"],["SHORTS","csi-blue"]].forEach(([word,kind])=>{if(kind==="space"){const span=document.createElement("span");span.className="csi-space";txt.appendChild(span);return;}[...word].forEach(ch=>{const span=document.createElement("span");span.className="csi-char "+kind;span.textContent=ch;txt.appendChild(span);chars.push(span);});});
 const caret=document.createElement("span");caret.className="csi-caret";txt.appendChild(caret);
 let t=150;chars.forEach(el=>{later(()=>{el.classList.add("on");tone(1550,.04,.025);},t);t+=28+Math.random()*14;});
 later(()=>caret.classList.add("off"),t+50);const c0=t-200;
 later(()=>{for(let i=0;i<4;i++){const trail=document.createElement("span");trail.className="csi-trail";trail.style.cssText="width:"+(60+Math.random()*60)+"px;left:"+(10+Math.random()*60)+"%;top:"+(20+i*18)+"%;animation-delay:"+(i*.08)+"s";slot.appendChild(trail);requestAnimationFrame(()=>trail.classList.add("go"));}cloud.classList.add("fly");tone(300,.45,.035);},c0);
 later(()=>{for(let i=0;i<8;i++){const puff=document.createElement("span"),size=6+Math.random()*12,angle=Math.random()*Math.PI*2,distance=50+Math.random()*70;puff.className="csi-puff";puff.style.cssText="width:"+size+"px;height:"+size+"px;left:50%;top:60%;--dx:"+(Math.cos(angle)*distance)+"px;--dy:"+(Math.sin(angle)*distance*.6)+"px";slot.appendChild(puff);requestAnimationFrame(()=>puff.classList.add("go"));}tone(520,.16,.05);},c0+950);
 later(()=>cloud.classList.add("settled"),c0+1050);
 later(()=>{const bounds=stage.getBoundingClientRect(),cb=cloud.getBoundingClientRect();stage.style.transformOrigin=(cb.left+cb.width/2-bounds.left)+"px "+(cb.top+cb.height*.55-bounds.top)+"px";const zoom=Math.max(innerWidth,innerHeight)/(cb.width*.5);stage.style.setProperty("--zs",Math.max(zoom*1.6,14));stage.classList.add("zoom");tone(220,.65,.045);later(()=>{flash.classList.add("on");[1047,1319,1568,2093].forEach((n,i)=>tone(n,.22,.035,i*.06));},600);later(finish,950);},c0+1350);
}
function refreshProfileContent(){
 if(T!==3)return;
 const screen=app.querySelector(".scr");if(!screen)return;
 const fresh=document.createElement("div");fresh.innerHTML=prof();
 [".community-profile-settings",".privacy-center-card"].forEach(selector=>{
  const current=screen.querySelector(selector),next=fresh.querySelector(selector);
  if(current&&next)current.replaceWith(next);
 });
}
function view(a=1,tabDirection=0){
 if(regionCheckPending){cloudLoader();return}
 if(regionCheckFailed){regionCheckError();return}
 roll();amb();
 if(!S.user){remoteLearningProfile=null;remoteLearningProfileUser=null;return authV()}
 if(!S.lv){if(!S.user.guest&&cloudProgressPending)return cloudLoader();return welcome()}
 SEC=LV[S.lv].s;
 const screenClass="scr tab"+T+(a?"":" na")+(tabDirection?" tab-screen":"");
 const screenMarkup=`<div class="${screenClass}"${tabDirection?` data-tab-direction="${tabDirection}"`:""}>${[learn,quests,lg,prof][T]()}</div>`;
 const existingScreen=app.querySelector(".scr");
 if(existingScreen){
  const fresh=document.createElement("div");fresh.innerHTML=screenMarkup;
  const nextScreen=fresh.firstElementChild;
  existingScreen.className=nextScreen.className;
  if(tabDirection)existingScreen.setAttribute("data-tab-direction",String(tabDirection));else existingScreen.removeAttribute("data-tab-direction");
  existingScreen.innerHTML=nextScreen.innerHTML;
  const dock=app.querySelector("nav.dock");
  if(dock){
   dock.querySelectorAll("button").forEach((button,index)=>button.classList.toggle("on",index===T));
   const currentIndex=Number(dock.style.getPropertyValue("--i"));
   if(currentIndex!==T){requestAnimationFrame(()=>requestAnimationFrame(()=>dock.style.setProperty("--i",String(T))))}
  }else app.insertAdjacentHTML("beforeend",nav());
  const fab=app.querySelector(".fab-ai");
  if(T===0&&!fab){const dockNow=app.querySelector("nav.dock");if(dockNow)dockNow.insertAdjacentHTML("afterend",'<button class="fab-ai" onclick="chat()" aria-label="Практика с Клауди">'+mascot()+'<span>Практика</span></button>')}
  else if(T!==0&&fab)fab.remove();
 }else app.innerHTML=screenMarkup+nav();
 if(T===0)void loadRemoteLearningProfile();
 if(T===3&&!S.user?.guest)void loadCommunityProfile();
}
function tab(k){if(!Number.isInteger(k)||k<0||k>3||k===T)return;const direction=k>T?1:-1;snd("tab");T=k;view(1,direction)}
const LVS=["A1","A2","B1","B2"],nxt=l=>LVS[LVS.indexOf(l)+1];
const LI={A1:["Начальный","Знаю базовые слова и фразы"],A2:["Элементарный","Могу говорить на простые темы"],B1:["Средний","Поддерживаю беседу на знакомые темы"],B2:["Выше среднего","Свободно общаюсь и читаю сложные тексты"]};
const pool=()=>LV[S.lv].s.flatMap(x=>x.l).flatMap(j=>D[j].w);
const TQ={
 A1:[
 ["Выбери правильную форму: I ___ from Russia.",["am","is","are","be"],0],
 ["She ___ a teacher.",["am","is","are","be"],1],
 ["They ___ two brothers.",["has","have","having","is"],1],
 ["What ___ your name?",["are","do","is","does"],2],
 ["I ___ coffee every morning.",["drink","drinks","drinking","to drink"],0],
 ["There ___ a book on the table.",["are","be","is","have"],2],
 ["Как образуется множественное число слова “child”?",["childs","children","childes","child"],1],
 ["Выбери правильное предложение.",["He don't like tea.","He doesn't likes tea.","He doesn't like tea.","He not like tea."],2],
 ["Does he ___ football every weekend?",["play","plays","playing","played"],0],
 ["My parents ___ in Bishkek.",["lives","living","live","to live"],2],
 ["We ___ got a dog.",["has","have","having","are"],1],
 ["___ you like apples?",["Are","Does","Do","Have"],2]
 ],
 A2:[
 ["We ___ to the museum last Saturday.",["go","went","have go","are going"],1],
 ["There isn't ___ sugar left.",["many","a few","much","several"],2],
 ["This exercise is ___ than the last one.",["easy","easier","easiest","more easy"],1],
 ["I have lived here ___ 2021.",["for","since","during","from"],1],
 ["If I have time tomorrow, I ___ you.",["called","would call","will call","call yesterday"],2],
 ["She ___ dinner when I arrived.",["cooks","was cooking","has cooked","is cook"],1],
 ["You ___ wear a seat belt. It's the law.",["might","must","could","would"],1],
 ["Выбери правильный вопрос.",["How long you have been here?","How long are you here?","How long have you been here?","How long did you been here?"],2],
 ["I ___ this film twice.",["see","saw","have seen","am seeing"],2],
 ["There are ___ apples in the basket than yesterday.",["less","fewer","much","little"],1],
 ["She is very good ___ playing the piano.",["in","on","at","for"],2],
 ["When I was a child, I ___ visit my grandparents every summer.",["use to","used to","was used","am used to"],1]
 ],
 B1:[
 ["By the time we arrived, the film ___.",["already started","had already started","has already start","was already start"],1],
 ["If I had known about the delay, I ___ earlier.",["would leave","will leave","would have left","left"],2],
 ["The new bridge ___ next year.",["will complete","will be completed","is completing","has completed"],1],
 ["She asked me where ___.",["did I live","I lived","do I live","I am live"],1],
 ["I've been waiting ___ two hours.",["since","from","for","during"],2],
 ["Despite ___ tired, he finished the report.",["be","being","was","to be"],1],
 ["The company is interested ___ expanding abroad.",["on","at","in","for"],2],
 ["Выбери подходящее слово-связку: The plan was expensive. ___, it was successful.",["Although","However","Because","Despite"],1],
 ["I wish I ___ more free time.",["have","had","will have","would have"],1],
 ["The emails ___ already been sent.",["has","have","was","is"],1],
 ["He denied ___ the window.",["break","to break","breaking","broke"],2],
 ["You need to get your car ___.",["repair","repairing","repaired","to repairing"],2]
 ],
 B2:[
 ["Not until the meeting ended ___ the scale of the problem.",["we understood","did we understand","we had understand","understood we"],1],
 ["Had I been informed earlier, I ___ the necessary arrangements.",["would make","will have made","would have made","had made"],2],
 ["The proposal, ___ merits were widely debated, was eventually approved.",["which","whose","that","who"],1],
 ["She speaks as though she ___ the entire incident herself.",["witnesses","has witnessed","had witnessed","would witness"],2],
 ["The findings are consistent ___ previous research.",["to","with","for","by"],1],
 ["Little ___ that their decision would cause such controversy.",["they knew","did they know","they had known","had they knew"],1],
 ["The manager insisted that the report ___ before Friday.",["is submitted","was submitted","be submitted","will submit"],2],
 ["Выбери наиболее близкое значение слова “to undermine”.",["to strengthen","to gradually weaken","to officially approve","to carefully examine"],1],
 ["Rarely ___ such a convincing performance.",["I have seen","have I seen","I saw","did I saw"],1],
 ["Were the company ___ its policy, the results might improve.",["change","to change","changed","changing"],1],
 ["It was the lack of funding ___ delayed the project.",["what","which","that","who"],2],
 ["The evidence is far from ___ to support that conclusion.",["conclusive enough","enough conclusive","conclusively","conclusion"],0]
 ]
};
let PT;
const dk=d=>d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(),wait=ms=>new Promise(r=>setTimeout(r,ms)),ruOf=en=>((D.flatMap(l=>l.w).find(x=>x[0]==en))||[])[1]||'';
/* ===== AUTH: verified Supabase session via the same-origin parent bridge ===== */
const authPending=new Map();
let authSequence=0;
function authRequest(action,payload={}){
 if(window.parent===window)return Promise.reject(new Error('Авторизация доступна при открытии Cloudy через основное приложение.'));
 return new Promise((resolve,reject)=>{
  const id=String(++authSequence)+'-'+Date.now();
  const timeoutMs=action==='ai-chat'||action==='learning-exam-start'||action==='learning-exam-submit'?95000:action==='tts'?40000:30000;
  const timer=setTimeout(()=>{
   const pending=authPending.get(id);
   if(!pending)return;
   authPending.delete(id);
   reject(new Error(action==='ai-chat'?'ИИ отвечает дольше обычного. Проверьте соединение и попробуйте ещё раз.':'Сервер не ответил. Проверьте соединение и попробуйте снова.'));
  },timeoutMs);
  authPending.set(id,{resolve,reject,timer});
  try{
   window.parent.postMessage({channel:'cloudy-auth',type:'request',id,action,...payload},location.origin);
  }catch(error){
   clearTimeout(timer);
   authPending.delete(id);
   reject(error instanceof Error?error:new Error('Не удалось отправить запрос серверу.'));
  }
 });
}
// Applies an authenticated cloud snapshot (session message or signIn reply) exactly once per payload;
// idempotent when the same updated_at arrives twice (signIn reply + onAuthStateChange session message).
function applyCloudSnapshot(msg){
 const nextChatAccount=String(msg.user.id||"");
 if(String(cloudUserId||"")!==nextChatAccount)resetChatHistoryState();
 cloudUserId=nextChatAccount;
 const localKey='cl2:'+msg.user.email,localExists=ls(localKey)!==null,localAt=Number(ls('cl2sync:'+msg.user.email)||0),dirtyAt=Number(ls('cl2dirty:'+msg.user.email)||0),remoteAt=msg.progress?.updated_at?Date.parse(msg.progress.updated_at):0;
 const guestState=(()=>{try{return JSON.parse(ls('cl2')||'{}')}catch(e){return {}}})();
 const profileLevel=['A1','A2','B1','B2'].includes(msg.learnerProfile?.english_level)?msg.learnerProfile.english_level:'';
 const profileTested=Boolean(msg.learnerProfile?.placement_test_completed);
 const remoteState=msg.progress?.state&&typeof msg.progress.state==='object'
  ?{...msg.progress.state,lv:profileLevel||msg.progress.state.lv||'',tested:profileTested||msg.progress.state.tested?1:0}
  :profileLevel?{lv:profileLevel,tested:profileTested?1:0}:null;
 cloudUpdatedAt=msg.progress?.updated_at||null;cloudSyncInFlight=null;cloudSyncPending=null;cloudSyncAttempts=0;cloudSyncPaused=true;
 Auth.start(msg.user.email,msg.user.name||'Ученик',!!msg.user.isAdmin,msg.user.age);
 if(msg.progressLoadFailed){cloudSyncPaused=true;toast('Не удалось загрузить облачный прогресс. Локальные данные сохранены; синхронизация повторится после восстановления связи.',false);return false}
 cloudBaseState=cloneProgressState(remoteState||{});
 if(remoteState&&(!localExists||(dirtyAt<=0&&remoteAt>localAt)||remoteAt>=dirtyAt&&dirtyAt>0)){try{clearTimeout(cloudSyncTimer);localStorage.setItem(localKey,JSON.stringify(remoteState));load(localKey);S.user={email:msg.user.email,name:msg.user.name||'Ученик',age:Number.isInteger(Number(msg.user.age))&&Number(msg.user.age)>=13&&Number(msg.user.age)<=120?Number(msg.user.age):(Number.isInteger(Number(S.user?.age))&&Number(S.user.age)>=13&&Number(S.user.age)<=120?Number(S.user.age):null),isAdmin:!!msg.user.isAdmin};save(true)}catch(e){}}
 else if(!localExists&&!remoteState&&['A1','A2','B1','B2'].includes(guestState.lv)){try{load('cl2');S.user={email:msg.user.email,name:msg.user.name||'Ученик',isAdmin:!!msg.user.isAdmin};save()}catch(e){}}
 else{queueCloudProgress()}
 if(profileLevel){S.lv=profileLevel;S.tested=profileTested||S.tested?1:0;save(true)}
 cloudSyncPaused=false;queueCloudProgress();void syncLearningEvents();
 return true;
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==window.parent||!event.data||event.data.channel!=='cloudy-auth')return;
 const msg=event.data;
 if(msg.type==='session'){
  sessionHydrating=false;
  if(sessionHydrationTimer){clearTimeout(sessionHydrationTimer);sessionHydrationTimer=0;}
  if(msg.ok&&msg.user){
   applyCloudSnapshot(msg);
   view();
  }else if(msg.ok===false){resetChatHistoryState();cloudSyncPaused=true;cloudUserId=null;toast(msg.error||'Не удалось проверить аккаунт. Проверьте соединение и попробуйте снова.',false);view()}else{resetChatHistoryState();cloudSyncPaused=false;cloudUserId=null;ls('cl2s','');load('cl2');S.user=null;view()}
  return;
 }
 if(msg.type==='progress-save-result'){
  const sent=cloudSyncInFlight;
  if(!sent||msg.syncId!==sent.id)return;
  cloudSyncInFlight=null;
  if(msg.ok&&msg.conflict&&msg.state&&typeof msg.state==='object'){
   cloudUpdatedAt=msg.updatedAt||null;const latestLocal=cloudSyncPending?.state||S;S=mergeCloudProgress(msg.state,latestLocal,cloudSyncPending?.baseState||sent.baseState||cloudBaseState||{});
   cloudBaseState=cloneProgressState(msg.state);
   try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}
   cloudSyncPending={id:++cloudSyncSeq,revision:++cloudLocalRevision,state:cloneProgressState(S),baseState:cloneProgressState(cloudBaseState)};
   if(S.user?.email)ls('cl2dirty:'+S.user.email,String(Date.now()));
   scheduleCloudRetry();return;
  }
  if(msg.ok){
   cloudUpdatedAt=msg.updatedAt||cloudUpdatedAt;cloudSyncAttempts=0;
   if(msg.state&&typeof msg.state==='object'){cloudBaseState=cloneProgressState(msg.state);S.xp=Number(msg.state.xp)||0;const wk=msg.state.wk&&typeof msg.state.wk==='object'?msg.state.wk:{};S.wk={k:String(wk.k||''),xp:Number(wk.xp)||0};try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
   if(cloudSyncPending)cloudSyncPending.baseState=cloneProgressState(cloudBaseState||sent.state);
   if(S.user?.email)ls('cl2sync:'+S.user.email,String(Date.now()));
   if(cloudLocalRevision===sent.revision&&!cloudSyncPending&&!cloudSyncTimer&&S.user?.email)ls('cl2dirty:'+S.user.email,'');
   if(cloudSyncPending)flushCloudProgress();
  }else{
   cloudSyncPending=cloudSyncPending||sent;scheduleCloudRetry();
   if(cloudSyncAttempts===3)toast(msg.error||'Нет связи с облаком. Прогресс сохранён на устройстве и будет отправлен автоматически.',false);
  }
  return;
 }
 if(msg.type==='lesson-award-result'){
  if(!msg.ok){toast(msg.error||'Не удалось начислить XP.',false);return;}
  const award=msg.result||{};
  cloudUpdatedAt=award.updated_at||cloudUpdatedAt;
  S.xp=Number(award.total_xp)||0;
  if(Number(award.awarded)>0){S.td.xp+=Number(award.awarded);track(Number(award.awarded));}
  S.wk={k:String(award.week_key||''),xp:Number(award.week_xp)||0};
  save();checkAch();
  const xpLabel=$('#xp');if(xpLabel)xpLabel.textContent='+'+(Number(award.awarded)||0);
  return;
 }
 if(msg.type!=='response'||!authPending.has(String(msg.id)))return;
 const pending=authPending.get(String(msg.id));authPending.delete(String(msg.id));
 if(pending.timer)clearTimeout(pending.timer);
 if(!msg.ok){pending.reject(new Error(msg.error||'Ошибка авторизации'));return}
 if(msg.user){cloudUserId=msg.user.id;queueCloudProgress()}
 pending.resolve(msg);
});

// Ask the iframe host for the authenticated session as soon as the bridge is ready.
if(window.parent!==window){try{window.parent.postMessage({channel:'cloudy-auth',type:'init'},location.origin)}catch(e){}}
if(sessionHydrating){sessionHydrationTimer=setTimeout(()=>{if(!sessionHydrating)return;console.warn('[cloudy-auth] session timeout fallback');sessionHydrating=false;cloudSyncPaused=true;view()},2500)}

const Auth={
 async signUp(email,pw){
  const result=await authRequest('signUp',{email,password:pw});
  if(result.needsConfirmation)return {needsConfirmation:true};
  return this.start(result.user.email,result.user.name||'',!!result.user.isAdmin,result.user.age);
 },
 async signIn(email,pw){
  cloudSyncPaused=true;cloudProgressPending=true;
  try{
   const result=await authRequest('signIn',{email,password:pw});
   if(result.user&&(result.progress!==undefined||result.learnerProfile||result.progressLoadFailed))applyCloudSnapshot(result);
   else{this.start(result.user.email,result.user.name||'Ученик',!!result.user.isAdmin,result.user.age);cloudSyncPaused=false}
   return S.user;
  }catch(e){cloudSyncPaused=false;throw e}
  finally{cloudProgressPending=false}
 },
 start(email,name,isAdmin=false,age=null){ls('cl2s',email);load('cl2:'+email);const savedAge=Number(S.user?.age);const validAge=Number.isInteger(Number(age))&&Number(age)>=13&&Number(age)<=120?Number(age):Number.isInteger(savedAge)&&savedAge>=13&&savedAge<=120?savedAge:null;S.user={email,name,age:validAge,isAdmin:!!isAdmin};save();window.CloudyAdmin?.setUser(S.user);return S.user},
 guest(){resetChatHistoryState();ls('cl2s','');load('cl2');S.user={guest:1,name:'Гость',age:null};save();window.CloudyAdmin?.setUser(S.user)},
 async signOut(){await authRequest('signOut');resetChatHistoryState();cloudUserId=null;cloudUpdatedAt=null;cloudSyncPending=null;cloudSyncInFlight=null;clearTimeout(cloudSyncTimer);clearTimeout(cloudSyncRetry);cloudSyncRetry=0;ls('cl2s','');load('cl2');S.user=null;window.CloudyAdmin?.setUser(null)}
};
let INTRO={name:'',age:18,step:0};
try{const savedIntro=JSON.parse(localStorage.getItem('cl2welcome')||'{}');INTRO={...INTRO,...savedIntro}}catch(e){}
function escIntro(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function introSave(){try{localStorage.setItem('cl2welcome',JSON.stringify(INTRO))}catch(e){}}
function introWelcome(){INTRO.step=0;introRender()}
function introRender(){
 const cloud=`<div class="welcome-cloud">${mascot()}</div>`;
 if(INTRO.step===0){
  app.innerHTML=`<div class="welcome-flow"><div class="welcome-step">${cloud}<div class="welcome-progress"><i class="on"></i><i></i></div><h1 class="welcome-copy">Привет! Как тебя зовут?</h1><p class="welcome-sub">Давай познакомимся — я Клауди, твой помощник в английском ☁️</p><label class="welcome-field"><input id="welcomeName" maxlength="32" autocomplete="given-name" placeholder="Твоё имя" value="${escIntro(INTRO.name)}"></label><div class="welcome-error" id="welcomeError"></div><button class="welcome-next" onclick="introNextName()">Далее <span>→</span></button></div></div>`;
  const input=$('#welcomeName');input?.addEventListener('keydown',e=>{if(e.key==='Enter')introNextName()});
 }else{
  const ages=Array.from({length:108},(_,i)=>i+13);
  app.innerHTML=`<div class="welcome-flow"><div class="welcome-step">${cloud}<div class="welcome-progress"><i class="on"></i><i class="on"></i></div><h1 class="welcome-copy">Сколько тебе лет?</h1><p class="welcome-sub">Подберу подходящие темы и задания для тебя</p><div class="age-wheel-wrap"><div class="age-highlight"></div><div class="age-wheel" id="ageWheel">${ages.map(age=>`<div class="age-option ${age===Number(INTRO.age)?'selected':''}" data-age="${age}">${age}</div>`).join('')}</div></div><div class="welcome-error" id="welcomeError"></div><button class="welcome-next" onclick="introFinish()">Продолжить <span>→</span></button></div></div>`;
  const wheel=$('#ageWheel');
  wheel?.addEventListener('scroll',introAgeScroll,{passive:true});
  wheel?.querySelectorAll('.age-option').forEach(el=>el.addEventListener('click',()=>{
   const age=Number(el.dataset.age);if(!Number.isInteger(age))return;
   INTRO.age=age;introSave();wheel.querySelectorAll('.age-option.selected').forEach(option=>option.classList.remove('selected'));el.classList.add('selected');
   wheel.scrollTo({top:el.offsetTop-wheel.offsetTop-wheel.clientHeight/2+el.offsetHeight/2,behavior:'smooth'});
  }));
  requestAnimationFrame(()=>setTimeout(()=>{
   if(!wheel.isConnected||wheel.clientHeight===0)return;
   const initial=wheel.querySelector('[data-age="'+Number(INTRO.age)+'"]');
   if(initial)wheel.scrollTop=initial.offsetTop-wheel.offsetTop-wheel.clientHeight/2+initial.offsetHeight/2;
   introAgeScroll();
  },50));
 }
}
function introNextName(){
 const name=$('#welcomeName')?.value.trim()||'';if(name.length<2){$('#welcomeError').textContent='Напиши имя (минимум 2 символа)';$('#welcomeName')?.focus();return}
 INTRO.name=name;INTRO.step=1;introSave();snd('go');introRender()
}
let introAgeFrame=0;
function introAgeScroll(){
 const wheel=$('#ageWheel');if(!wheel||wheel.clientHeight===0)return;
 if(introAgeFrame)cancelAnimationFrame(introAgeFrame);
 introAgeFrame=requestAnimationFrame(()=>{
  const center=wheel.scrollTop+wheel.clientHeight/2;let best=null,dist=Infinity;
  wheel.querySelectorAll('.age-option').forEach(el=>{const d=Math.abs(el.offsetTop+el.offsetHeight/2-center);if(d<dist){dist=d;best=el}});
  if(best){const age=Number(best.dataset.age);if(INTRO.age!==age){INTRO.age=age;introSave()}wheel.querySelectorAll('.age-option.selected').forEach(el=>el.classList.remove('selected'));best.classList.add('selected')}
 })
}
async function introFinish(){
 if(!INTRO.name){INTRO.step=0;introRender();return}
 const error=$('#welcomeError');
 if(!Number.isInteger(Number(INTRO.age))||Number(INTRO.age)<13||Number(INTRO.age)>120){if(error)error.textContent='Регистрация доступна с 13 лет.';return}
 try{
  if(S.user?.guest){S.user.name=INTRO.name;S.user.age=Number(INTRO.age);save();}
  else{
   const profileUpdate={name:INTRO.name};if(!Number.isInteger(Number(S.user?.age)))profileUpdate.age=Number(INTRO.age);const result=await authRequest('updateProfile',profileUpdate);
   S.user={...S.user,name:result.user?.name||INTRO.name,age:result.user?.age??Number(INTRO.age)};
   save();
  }
  introSave();try{localStorage.setItem('cl2welcomeDone','1')}catch(e){}
  snd('win');view();
 }catch(e){if(error)error.textContent=e.message||'Не удалось сохранить профиль. Попробуй ещё раз.'}
}
let AM='in',busy=0,CH=[],SM=null,chatThreads=[],activeChatId=null,chatDrawerOpen=false;let chatHistoryLoaded=false,chatHistoryAccountId=null,chatHistoryLoading=null,chatHistorySaveNotice=false,chatHistoryGeneration=0;let chatHistorySaveQueue=Promise.resolve();
function authV(){app.innerHTML=`<div class='scr res'>${mascot()}<div class='big2'>Cloudy English</div><div class='seg'><button class='${AM=='in'?'on':''}' onclick="AM='in';authV()">Вход</button><button class='${AM=='up'?'on':''}' onclick="AM='up';authV()">Регистрация</button></div><div class='fm'><label>Email<input id='ae' type='email' autocomplete='email' placeholder='you@mail.com'></label><label>Пароль<input id='ap' type='password' autocomplete='${AM=='up'?'new-password':'current-password'}' placeholder='Минимум 6 символов'></label><div class='err' id='er'></div><button class='btn' id='ab' onclick='authGo()'>${AM=='up'?'СОЗДАТЬ АККАУНТ':'ВОЙТИ'}</button></div><div class='or'>или</div><button class='btn ghost' onclick="$('#er').textContent='Вход через Google появится после подключения Supabase в Lovable'">ВОЙТИ ЧЕРЕЗ GOOGLE</button><br><br><button class='btn ghost' onclick='authG()'>ПРОДОЛЖИТЬ КАК ГОСТЬ</button><p style="margin:18px 0 0;font-size:12px;opacity:.72">Продолжая, ознакомьтесь с <a href="/legal" target="_top" style="color:#7fc2ff;text-decoration:underline">документами и правилами</a></p></div>`}
async function authGo(){const em=$('#ae').value.trim().toLowerCase(),pw=$('#ap').value,er=$('#er'),b=$('#ab'),lbl=AM=='up'?'СОЗДАТЬ АККАУНТ':'ВОЙТИ',bad=m=>{er.textContent=m;er.classList.remove('shk');void er.offsetWidth;er.classList.add('shk');snd('bad')};
 if(!em.includes('@')||!em.includes('.'))return bad('Введите корректный email');if(pw.length<6)return bad('Пароль: минимум 6 символов');
 b.classList.add('ld');b.textContent='ПОДОЖДИТЕ...';er.textContent='';
 try{
  if(AM=='up'){
   const result=await Auth.signUp(em,pw);
   if(result?.needsConfirmation){b.classList.remove('ld');b.textContent=lbl;er.classList.remove('shk');er.style.color='var(--good,#55c98a)';er.textContent='На вашу почту отправлено письмо. Подтвердите email по ссылке из письма, затем войдите в аккаунт.';return}
   INTRO={name:'',age:18,step:0};introSave();introWelcome();
  }else{
   await Auth.signIn(em,pw);
   if(!S.user?.name||S.user?.name==='Ученик'||!Number.isInteger(Number(S.user?.age))||Number(S.user.age)<13||Number(S.user.age)>120){INTRO={name:S.user?.name==='Ученик'?'':(S.user?.name||''),age:18,step:0};introWelcome()}else view()
  }
  snd('win');
 }catch(x){b.classList.remove('ld');b.textContent=lbl;bad(x.message||'Ошибка входа')}
}
function authG(){Auth.guest();snd('go');view()}
const ACH=[['first','Первый шаг','Набрать XP','bolt',()=>S.xp>0],['s3','Серия 3','3 дня подряд','flame',()=>S.streak>=3],['s7','Серия 7','7 дней подряд','flame',()=>S.streak>=7],['perf','Без ошибок','Урок без потерь','heart',()=>S.perf>0],['x1','100 XP','Набрать 100 XP','star',()=>S.xp>=100],['x5','500 XP','Набрать 500 XP','star',()=>S.xp>=500],['a1','Уровень A1','Пройти A1','check',()=>S.dn.A1>=6],['tst','Знаток','Пройти тест','target',()=>S.tested>0]];
const toast=t=>{snd('star');const d=document.createElement('div');d.className='toast';d.textContent='Достижение: '+t;document.body.appendChild(d);setTimeout(()=>d.remove(),3200)};
function checkAch(){const n=ACH.filter(a=>a[4]()&&!S.ach.includes(a[0]));if(!n.length)return;n.forEach(a=>S.ach.push(a[0]));save();setTimeout(()=>toast(n[0][1]),1200)}
function wkey(){const d=new Date(),y=new Date(d.getFullYear(),0,1);return d.getFullYear()+'w'+Math.floor(((d-y)/864e5+y.getDay())/7)}
function track(g){const t=dk(new Date());if(!S.days.includes(t)){S.days.push(t);S.days=S.days.slice(-60)}const w=wkey();if(S.wk.k!=w)S.wk={k:w,xp:0};S.wk.xp+=g;if(hp>=5&&L>=0)S.perf++}
const LG=[['Бронза',0],['Серебро',200],['Золото',600],['Сапфир',1500],['Бриллиант',3000]],LC=['#cd7f32','#c0c8d8','#ffd35a','#4db3ff','#b9f2ff'],BOTS=['Алекс','Мария','Дима','Лиза','Олег'];
function lg(){const li=LG.reduce((a,x,k)=>S.xp>=x[1]?k:a,0),c=LG[li],nx=LG[li+1],w=S.wk.k==wkey()?S.wk.xp:0,dow=(new Date().getDay()+6)%7+1,seed=[...wkey()].reduce((a,ch)=>a+ch.charCodeAt(0),0),pr=nx?Math.min((S.xp-c[1])/(nx[1]-c[1]),1):1,
 rows=BOTS.map((n,k)=>[n,Math.round(((seed*(k+3)*7919)%180+40)*dow/7),0]).concat([['Вы',w,1]]).sort((a,b)=>b[1]-a[1]);
  const pod=[1,0,2].map(q=>{const r=rows[q];return r?`<div class="pod p${q+1}${r[2]?" me":""}" style="--i:${q}"><div class="pod-av">${ic("user")}</div><b>${r[0]}</b><small>${r[1]} XP</small><div class="pod-bar"><span>${q+1}</span></div></div>`:""}).join("");
  return `<div class="pg-head"><h2>Лига: ${c[0]}</h2><button class="hud-gear" aria-label="Настройки" onclick="CloudyUI.open()">${ic("gear")}</button></div><div class="lg-hero" style="--lc:${LC[li]}"><span class="mdl" style="color:${LC[li]}">${ic("medal")}</span><div style="flex:1"><b>${nx?"До лиги "+nx[0]+": "+(nx[1]-S.xp)+" XP":"Максимальная лига"}</b><div class="pb" style="margin-top:10px"><i style="width:${pr*100}%"></i></div></div></div><div class="podium">${pod}</div><div class="card"><h3>Рейтинг недели</h3>${rows.map((r,k)=>`<div class="row lr${r[2]?" me":""}" style="animation-delay:${k*70}ms"><span><b class="rk">${k+1}</b>${r[0]}</span><b>${r[1]} XP</b></div>`).join("")}<small style="opacity:.7">Соперники учебные: пример для будущей онлайн-лиги</small></div><div class="card"><h3>Достижения</h3><div class="ag">${ACH.map(a=>`<div class="bd${S.ach.includes(a[0])?" on":""}">${ic(a[3])}<small>${a[1]}</small></div>`).join("")}</div></div>`}
function cal(){const t=new Date(),c=[];for(let k=27;k>=0;k--){const d=new Date(t);d.setDate(t.getDate()-k);const on=S.days.includes(dk(d));c.push(`<i class="cd${on?' on':''}" style="animation-delay:${(27-k)*25}ms">${on?ic('flame'):d.getDate()}</i>`)}return `<div class="card"><h3>Календарь серии</h3><div class="cal">${c.join('')}</div></div>`}
let personalExamBusy=false,PERSONAL_EXAM=null,learningSyncTimer=0,learningSyncInFlight=null,learningEventSyncTimer=0,learningEventSyncInFlight=null,remoteLearningProfile=null,remoteLearningProfileUser=null,remoteLearningProfileLoading=false,remoteExamStatus=null,remoteExamStatusUser=null,remoteExamStatusLoading=false;
const examEscape=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
function examLearnerProfile(){
 const local=window.CloudyLearning?.profile(KEY)||{version:1,attempts:0,dueCount:0,skills:[],recentEvents:[]};
 const remote=remoteLearningProfile||{attempts:0,dueCount:0,skills:[],recentEvents:[]};
 const skills=new Map((remote.skills||[]).map(skill=>[skill.id,skill]));
 for(const skill of local.skills||[]){const prior=skills.get(skill.id);if(!prior||skill.evidence>prior.evidence||(skill.evidence===prior.evidence&&skill.lastPracticed>prior.lastPracticed))skills.set(skill.id,skill)}
 // Bring forward the learner's existing mistake counter so the first exam
 // can already focus on errors made before detailed evidence was introduced.
 const legacy=Object.entries(S.mis||{}).filter(([word,count])=>String(word).trim()&&Number(count)>0).map(([word,count])=>({
  id:"vocabulary:"+String(word).toLowerCase().trim(),
  mastery:0.2,evidence:Math.min(1000,Number(count)||1),correct:0,
  incorrect:Math.min(10000,Number(count)||1),due:true,lastPracticed:Date.now()
 }));
 for(const skill of legacy){const prior=skills.get(skill.id);if(!prior||skill.evidence>prior.evidence)skills.set(skill.id,skill)}
 return {...local,attempts:Math.max(Number(local.attempts)||0,Number(remote.attempts)||0,legacy.length),dueCount:Math.max(Number(local.dueCount)||0,Number(remote.dueCount)||0),skills:[...skills.values()]};
}
async function loadRemoteExamStatus(force=false){
 if(!S.user||S.user.guest||remoteExamStatusLoading)return;
 const userId=S.user.id;
 if(!force&&remoteExamStatusUser===userId)return;
 remoteExamStatusLoading=true;
 try{
  const response=await authRequest("learning-exam-status");
  if(S.user?.id===userId){remoteExamStatus=response||{ready:false,reason:"Не удалось проверить готовность"};remoteExamStatusUser=userId;if(T===0)view(0)}
 }catch(error){
  if(S.user?.id===userId){remoteExamStatus={ready:false,reason:"Не удалось проверить готовность экзамена"};remoteExamStatusUser=userId;if(T===0)view(0)}
  console.warn("[cloudy-exam] readiness check failed");
 }finally{remoteExamStatusLoading=false}
}
async function syncLearningEvents(){
 if(!S.user||S.user.guest||!window.CloudyLearning)return;
 if(learningEventSyncInFlight)return learningEventSyncInFlight;
 const events=window.CloudyLearning.pending(KEY,50);
 if(!events.length)return;
 const userId=cloudUserId;
 if(!userId)return;
 learningEventSyncInFlight=authRequest("learning-events",{payload:{events}}).then(response=>{
  if(cloudUserId!==userId)return;
  const accepted=response?.result?.acceptedEventIds;
  if(Array.isArray(accepted))window.CloudyLearning.acknowledge(KEY,accepted);
  if(window.CloudyLearning.pending(KEY,1).length){clearTimeout(learningEventSyncTimer);learningEventSyncTimer=setTimeout(()=>void syncLearningEvents(),250);}
 }).catch(()=>{console.warn("[cloudy-learning] event sync deferred");clearTimeout(learningEventSyncTimer);learningEventSyncTimer=setTimeout(()=>void syncLearningEvents(),5000)}).finally(()=>{learningEventSyncInFlight=null});
 return learningEventSyncInFlight;
}
async function syncLearningEvidence(){
 if(!S.user||S.user.guest||!window.CloudyLearning)return;
 if(learningSyncInFlight)return learningSyncInFlight;
 const profile=examLearnerProfile();
 if(!profile.attempts)return;
 learningSyncInFlight=authRequest("learning-exam-sync",{payload:{learnerProfile:profile}}).catch(()=>{console.warn("[cloudy-learning] profile sync deferred")}).finally(()=>{learningSyncInFlight=null});
 return learningSyncInFlight;
}
async function loadRemoteLearningProfile(){
 if(!S.user||S.user.guest||remoteLearningProfileLoading)return;
 if(remoteLearningProfileUser&&remoteLearningProfileUser!==S.user.id){remoteLearningProfile=null;remoteLearningProfileUser=null}
 if(remoteLearningProfileUser===S.user.id)return;
 const userId=S.user.id;remoteLearningProfileLoading=true;
 try{
  const response=await authRequest("learning-exam-profile");
  if(S.user?.id===userId){remoteLearningProfile=response?.profile||null;remoteLearningProfileUser=userId;if(T===0)view(0)}
 }catch(error){if(S.user?.id===userId)remoteLearningProfileUser=userId;console.warn("[cloudy-learning] remote profile unavailable")}
 finally{remoteLearningProfileLoading=false;if(S.user&&!S.user.guest&&remoteLearningProfileUser!==S.user.id)void loadRemoteLearningProfile()}
}
window.addEventListener("cloudy:learning-updated",()=>{
 if(!S.user||S.user.guest)return;
 clearTimeout(learningEventSyncTimer);
 learningEventSyncTimer=setTimeout(()=>{void syncLearningEvents()},500);
 clearTimeout(learningSyncTimer);
 learningSyncTimer=setTimeout(()=>{void syncLearningEvidence()},1200);
});
const examCard=()=>{
 if(!S.user||S.user.guest)return "";
 if(remoteExamStatusUser!==S.user.id&&!remoteExamStatusLoading)void loadRemoteExamStatus();
 const ready=remoteExamStatusUser===S.user.id&&remoteExamStatus?.ready===true;
 const caption=ready?"ИИ подбирает вопросы по пройденным урокам, ответам и ошибкам.":"Проверяем готовность экзамена по твоим урокам и ответам.";
 const reason=remoteExamStatusUser===S.user.id&&!ready?remoteExamStatus?.reason:"";
 return '<div class="exam-home"><div class="exam-cloud">'+mascot()+'</div><div class="exam-copy"><b>Персональный экзамен</b><small>'+examEscape(reason||caption)+'</small></div><button class="exam-start" '+(ready?'':'disabled')+' onclick="startPersonalExam()">'+(ready?'Экзамен готов':'Экзамен не готов')+'</button></div>';
};
async function startPersonalExam(){
 if(personalExamBusy)return;
 if(!S.user||S.user.guest){toast("Войди в аккаунт, чтобы сохранить персональный экзамен.");return}
 personalExamBusy=true;
 clearTimeout(learningSyncTimer);
 await syncLearningEvents();
 await syncLearningEvidence();
 await loadRemoteExamStatus(true);
 if(!remoteExamStatus?.ready){toast(remoteExamStatus?.reason||"Экзамен пока не готов.",false);view();personalExamBusy=false;return}
 app.innerHTML='<div class="scr exam-loading"><div class="exam-cloud">'+mascot()+'</div><b>Клауди готовит твой экзамен…</b><small>Подбираю вопросы по пройденным урокам и ошибкам</small></div>';
 try{
  const profile=examLearnerProfile();
  const response=await authRequest("learning-exam-start",{payload:{level:S.lv,learnerProfile:profile}});
  if(!response?.exam?.id||!Array.isArray(response.exam.questions)||response.exam.questions.length!==6)throw new Error("Не удалось подготовить экзамен. Попробуй позже.");
  PERSONAL_EXAM={...response.exam,index:0,answers:[],selected:null};
  renderPersonalExam();
 }catch(error){toast(error?.message||"Не удалось подготовить экзамен.",false);view()}
 finally{personalExamBusy=false}
}
const examSkillLabel=(skillId)=>{
 const labels={
  "grammar:verbs:action":"ГЛАГОЛЫ ДЕЙСТВИЯ",
  "grammar:present-simple:base":"PRESENT SIMPLE",
  "grammar:present-simple:third-person":"HE · SHE · IT",
  "grammar:present-simple:questions":"ВОПРОСЫ DO / DOES",
  "grammar:present-simple:negatives":"ОТРИЦАНИЯ",
  "grammar:sentence-order":"ПОРЯДОК СЛОВ",
  "grammar:sentence-building":"ПОСТРОЕНИЕ ПРЕДЛОЖЕНИЙ"
 };
 return labels[skillId]|| (String(skillId||"").startsWith("grammar:")?"ГРАММАТИКА":"СЛОВАРЬ");
};
function renderPersonalExam(){
 const exam=PERSONAL_EXAM;if(!exam)return view();
 const q=exam.questions[exam.index],progress=exam.index/exam.questions.length*100,selected=exam.selected;
 app.innerHTML='<div class="scr exam-screen"><div class="top"><button class="x" onclick="PERSONAL_EXAM=null;view()">'+ic("x")+'</button><div class="bar"><i style="width:'+progress+'%"></i></div><b>'+(exam.index+1)+'/'+exam.questions.length+'</b></div><div class="body"><h2>Персональный экзамен · '+exam.level+'</h2><p class="exam-instruction">Вопросы подобраны по пройденным темам и твоим ответам.</p><section class="exam-question-stage"><span class="exam-skill-label">'+examEscape(examSkillLabel(q.skillId))+'</span><div class="exam-question">'+examEscape(q.prompt)+'</div><div class="exam-options">'+q.options.map((option,index)=>'<button class="opt '+(selected===index?'sel':'')+'" onclick="examChoose('+index+')">'+examEscape(option)+'</button>').join("")+'</div></section><button class="btn exam-next" '+(selected===null?'disabled':'')+' onclick="examNext()">'+(exam.index===exam.questions.length-1?'ЗАВЕРШИТЬ':'ДАЛЬШЕ')+'</button></div></div>';
}
function examChoose(index){if(!PERSONAL_EXAM||PERSONAL_EXAM.selected!==null||PERSONAL_EXAM.transitioning)return;PERSONAL_EXAM.selected=index;renderPersonalExam()}
async function examNext(){
 const exam=PERSONAL_EXAM;if(!exam||exam.selected===null||exam.transitioning)return;
 exam.answers.push({questionId:exam.questions[exam.index].id,selectedIndex:exam.selected});
 if(exam.index<exam.questions.length-1){
  const stage=document.querySelector(".exam-question-stage"),reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(stage&&!reduce){
   exam.transitioning=true;stage.classList.add("is-leaving");
   setTimeout(()=>{if(PERSONAL_EXAM!==exam)return;exam.index++;exam.selected=null;exam.transitioning=false;renderPersonalExam();snd("flip")},220);
  }else{exam.index++;exam.selected=null;renderPersonalExam();snd("flip")}
  return;
 }
 app.innerHTML='<div class="scr exam-loading"><div class="exam-cloud">'+mascot()+'</div><b>Клауди проверяет ответы…</b><small>Анализирую результат и слабые темы</small></div>';
 try{
  const response=await authRequest("learning-exam-submit",{payload:{examId:exam.id,answers:exam.answers}});
  PERSONAL_EXAM=null;renderPersonalExamResult(response.result);
 }catch(error){toast(error?.message||"Не удалось проверить экзамен.",false);view()}
}
function renderPersonalExamResult(result){
 if(!result){view();return}
 const details=Array.isArray(result.details)?result.details:[];
 const rows=details.map(item=>'<div class="exam-result-row '+(item.correctAnswer?'correct':'incorrect')+'"><b>'+(item.correctAnswer?'Верно':'Нужно повторить')+'</b><span>'+examEscape(item.prompt)+'</span>'+(item.correctAnswer?'':'<small>Правильный ответ: '+examEscape(item.correct)+'</small>')+'</div>').join("");
 app.innerHTML='<div class="scr res exam-result">'+mascot()+'<div class="big2">Экзамен завершён</div><div class="exam-score">'+result.score+' из '+result.total+'</div><div class="exam-percent">'+result.percent+'% правильных ответов · '+result.level+'</div><div class="exam-feedback">'+examEscape(result.feedback).replace(/\n/g,"<br>")+'</div><div class="exam-result-list">'+rows+'</div><button class="btn" onclick="view()">НА ГЛАВНУЮ</button></div>';
 snd(result.percent>=80?"win":"ok");
}
const rvBtn=()=>{const n=Object.keys(S.mis).length;return n?`<button class="chest" onclick="review()">${ic('redo')}<span>Ошибки: ${n}</span></button>`:''};
const AIcard=()=>`<button class="card ai" onclick="chat()">${mascot()}<div><b>Практика с Клауди</b><br><small style="opacity:.8">Диалог на уровне ${S.lv}</small></div></button>`;



function chatEscape(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function resetChatHistoryState(){
 chatHistoryGeneration++;
 chatHistoryLoaded=false;chatHistoryAccountId=null;chatHistoryLoading=null;
 chatThreads=[];CH=[];activeChatId=null;chatDrawerOpen=false;
 chatHistorySaveQueue=Promise.resolve();chatHistorySaveNotice=false;
}
function chatHistoryKey(account=cloudUserId){return account?"cloudy-ai-history:"+String(account):null;}
function readLocalChatHistory(account=cloudUserId){const key=chatHistoryKey(account);if(!key)return [];try{const raw=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(raw)?raw.filter(x=>x&&typeof x.id==="string"&&Array.isArray(x.messages)).slice(0,30):[]}catch{return []}}
async function loadChatHistory(){
 const account=String(cloudUserId||"");
 if(!account)throw new Error("Войдите в аккаунт, чтобы загрузить историю чатов.");
 if(chatHistoryLoaded&&chatHistoryAccountId===account)return;
 if(chatHistoryLoading&&chatHistoryAccountId===account)return chatHistoryLoading;
 resetChatHistoryState();
 const generation=chatHistoryGeneration;
 chatHistoryAccountId=account;
 const task=(async()=>{
  try{
   const response=await authRequest("chat-history-get",{payload:{accountId:account}});
   if(String(cloudUserId||"")!==account||chatHistoryGeneration!==generation)return;
   const remote=Array.isArray(response.result?.chats)?response.result.chats:[];
   const merged=new Map(remote.map(thread=>[thread.id,thread]));
   for(const localThread of readLocalChatHistory(account)){
    if(String(cloudUserId||"")!==account||chatHistoryGeneration!==generation)return;
    const cloudThread=merged.get(localThread.id);
    if(!cloudThread||(Number(localThread.updatedAt)||0)>(Number(cloudThread.updatedAt)||0)){
     await authRequest("chat-history-save",{payload:{accountId:account,thread:localThread}});
     if(String(cloudUserId||"")!==account||chatHistoryGeneration!==generation)return;
     merged.set(localThread.id,localThread);
    }
   }
   if(String(cloudUserId||"")!==account||chatHistoryGeneration!==generation)return;
   chatThreads=[...merged.values()].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,30);
   const key=chatHistoryKey(account);try{if(key)localStorage.setItem(key,JSON.stringify(chatThreads))}catch(e){}
   chatHistoryLoaded=true;
  }catch(error){
   if(String(cloudUserId||"")!==account||chatHistoryGeneration!==generation)return;
   // Fail closed: never substitute cached messages when the account fetch fails.
   chatThreads=[];CH=[];activeChatId=null;chatHistoryLoaded=false;
   console.warn("[cloudy-chat] cloud history unavailable",error);
   toast("Не удалось безопасно загрузить историю. Повторите попытку после восстановления соединения.",false);
   throw error;
  }
 })();
 chatHistoryLoading=task;
 try{await task}finally{if(chatHistoryGeneration===generation&&chatHistoryLoading===task)chatHistoryLoading=null}
}
function saveChatHistory(){
 if(!activeChatId||!CH.length||!chatHistoryLoaded||!cloudUserId)return;
 const firstUser=CH.find(m=>m.r==="u")?.t||"Новый диалог";
 const title=String(firstUser).replace(/\s+/g," ").trim().slice(0,42)||"Новый диалог";
 const item={id:activeChatId,title,updatedAt:Date.now(),messages:CH.slice(-80).map(m=>({r:m.r==="u"?"u":"a",t:String(m.t).slice(0,8000)}))};
 const index=chatThreads.findIndex(x=>x.id===activeChatId);
 if(index>=0)chatThreads[index]=item;else chatThreads.unshift(item);
 chatThreads.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
 chatThreads=chatThreads.slice(0,30);
 const saveAccount=String(cloudUserId||""),saveGeneration=chatHistoryGeneration,key=chatHistoryKey(saveAccount);
 if(!key||chatHistoryAccountId!==saveAccount)return;
 try{localStorage.setItem(key,JSON.stringify(chatThreads))}catch(e){}
 renderChatHistory();
 chatHistorySaveQueue=chatHistorySaveQueue.catch(()=>{}).then(()=>String(cloudUserId||"")===saveAccount&&chatHistoryGeneration===saveGeneration?authRequest("chat-history-save",{payload:{accountId:saveAccount,thread:item}}):Promise.resolve()).catch(error=>{
  console.warn("[cloudy-chat] thread save failed",error);
  if(!chatHistorySaveNotice){chatHistorySaveNotice=true;toast("Не удалось сохранить чат в аккаунте. Проверьте соединение.",false)}
 });
}
function renderChatHistory(){
 const list=$("#chatHistoryList");if(!list)return;
 if(!chatThreads.length){list.innerHTML='<div class="chat-history-empty">Диалоги появятся здесь</div>';return}
 list.innerHTML=chatThreads.map(item=>{const id=chatEscape(item.id),title=chatEscape(item.title||"Новый диалог");return '<div class="chat-history-row"><button type="button" class="chat-history-item '+(item.id===activeChatId?'active':'')+'" onclick="chatOpenThread(\''+id+'\')"><span class="chat-history-dot"></span><span>'+title+'</span></button><button type="button" class="chat-history-delete" aria-label="Удалить диалог" title="Удалить диалог" onclick="event.stopPropagation();chatDeleteThread(\''+id+'\')">'+'<svg class="i chat-trash-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>'+'</button></div>'}).join("");
}
async function chatDeleteThread(id){
 const account=String(cloudUserId||""),generation=chatHistoryGeneration;
 if(!account||chatHistoryAccountId!==account)return;
 const item=chatThreads.find(x=>x.id===id);if(!item)return;
 if(!confirm('Удалить диалог «'+String(item.title||"Новый диалог").replace(/[<>]/g,"") + '»?'))return;
 try{await authRequest("chat-history-delete",{payload:{accountId:account,threadId:id}})}
 catch(error){toast("Не удалось удалить диалог из аккаунта. Попробуйте ещё раз.",false);return}
 if(String(cloudUserId||"")!==account||chatHistoryGeneration!==generation)return;
 chatThreads=chatThreads.filter(x=>x.id!==id);
 try{localStorage.setItem(chatHistoryKey(account),JSON.stringify(chatThreads))}catch(e){}
 if(activeChatId===id){CH=[];activeChatId=String(Date.now())+"-"+Math.random().toString(36).slice(2,7);chatRender()}
 else renderChatHistory();
 snd("tab");
}
function chatRender(){
 app.innerHTML=`
<section class="chat-shell" id="chatShell">
  <aside class="chat-sidebar">
    <div class="chat-sidebar-brand"><span class="chat-brand-cloud">${mascot()}</span><span><b>Cloudy English</b><small>Учись вместе с Клауди</small></span></div>
    <button class="chat-new-button" onclick="chatStartNew()"><span>＋</span> Новый чат</button>
    <div class="chat-sidebar-label">ИСТОРИЯ ДИАЛОГОВ</div>
    <div class="chat-history-list" id="chatHistoryList"></div>
    <div class="chat-sidebar-footer"><span class="chat-footer-avatar">${ic('user')}</span><span><b>${chatEscape(S.user?.name||"Ученик")}</b><small>Уровень ${S.lv||"A1"}</small></span></div>
  </aside>
  <button class="chat-sidebar-backdrop" onclick="chatToggleDrawer()" aria-label="Закрыть меню"></button>
  <main class="chat-main">
    <header class="chat-topbar">
      <button class="chat-menu-button" onclick="chatToggleDrawer()" aria-label="Открыть историю"><span aria-hidden="true">☰</span></button>
      <div class="chat-top-title"><b>Клауди AI</b><small>Твой помощник по английскому</small></div>
      <span class="chat-level-pill">${S.lv||"A1"}</span>
      <div class="chat-flag" title="English" aria-label="Флаг Великобритании">
        <svg viewBox="0 0 60 40" width="100%" height="100%" role="img" aria-hidden="true">
          <clipPath id="chat-flag-clip"><rect width="60" height="40" rx="3"/></clipPath>
          <g clip-path="url(#chat-flag-clip)">
            <rect width="60" height="40" fill="#012169"/>
            <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="8"/>
            <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" stroke-width="4"/>
            <path d="M30,0 v40 M0,20 h60" stroke="#fff" stroke-width="12"/>
            <path d="M30,0 v40 M0,20 h60" stroke="#C8102E" stroke-width="7"/>
          </g>
        </svg>
      </div>
      <button class="chat-close-button" onclick="snd('tab');view()" aria-label="Закрыть чат">${ic('x')}</button>
    </header>
    <div id="msgs" class="chat-messages" aria-live="polite"></div>
    <div class="chat-composer-wrap">
      <div class="chat-composer">
        <div class="chat-composer-box">
          <input id="ci" placeholder="Напишите Клауди..." autocomplete="off" onkeydown="if(event.key=='Enter'){event.preventDefault();csend()}">
        </div>
        <button class="spk" aria-label="Отправить сообщение" onclick="csend()">${ic('send')}</button>
      </div>
      <div class="chat-disclaimer">Клауди помогает практиковать английский на уровне ${S.lv||"A1"}</div>
    </div>
  </main>
</section>`;
 renderChatHistory();
 if(CH.length){CH.forEach(m=>bub(m.r,m.t,false));scrollChat()}
 else{$("#msgs").innerHTML='<div class="chat-welcome"><div class="chat-welcome-mascot">'+mascot()+'</div><h2>Привет! Я Клауди.</h2><p>Давай практиковать английский. Я буду подбирать общение под твой уровень <b>'+(S.lv||"A1")+'</b>.</p><div class="chat-suggestions"><button onclick="chatSuggestion(\'Let’s practice introductions\')">Познакомимся на английском</button><button onclick="chatSuggestion(\'Help me improve my English grammar\')">Разберём грамматику</button><button onclick="chatSuggestion(\'Ask me an easy question for my level\')">Задай мне вопрос</button></div></div>'}
 const input=$("#ci");if(input)input.focus();
}
async function chat(){if(S.user?.guest){toast("Для практики с Клауди войдите в аккаунт");return authV()}const account=String(cloudUserId||"");if(!account){toast("Сначала войдите в аккаунт.",false);return authV()}if(chatHistoryAccountId!==account){resetChatHistoryState();}try{await loadChatHistory()}catch(e){toast("История скрыта до безопасной загрузки из аккаунта.",false);return}if(String(cloudUserId||"")!==account||chatHistoryAccountId!==account)return;if(!CH.length&&chatThreads.length){const latest=chatThreads[0];activeChatId=latest.id;CH=latest.messages.slice()}if(!activeChatId)activeChatId=String(Date.now())+"-"+Math.random().toString(36).slice(2,7);chatRender()}
function chatStartNew(){CH=[];activeChatId=String(Date.now())+"-"+Math.random().toString(36).slice(2,7);chatDrawerOpen=false;chatRender();snd("tab")}
function chatOpenThread(id){const item=chatThreads.find(x=>x.id===id);if(!item)return;activeChatId=item.id;CH=item.messages.slice();chatDrawerOpen=false;chatRender();snd("tab")}
function chatToggleDrawer(){chatDrawerOpen=!chatDrawerOpen;const shell=$("#chatShell");if(shell)shell.classList.toggle("drawer-open",chatDrawerOpen)}
function chatSuggestion(value){const input=$("#ci");if(input){input.value=value;csend()}}
function scrollChat(){const box=$('#msgs');if(box)box.scrollTop=box.scrollHeight}
function bub(r,t,scroll=true){const d=document.createElement('div');d.className='bub '+r;d.textContent=t;$('#msgs').appendChild(d);if(scroll)requestAnimationFrame(scrollChat);return d}
function showTyping(el){el.textContent='';el.classList.add('typ');const dots=document.createElement('span');dots.className='chat-typing';dots.innerHTML='<i></i><i></i><i></i>';el.appendChild(dots)}
async function typeChatReply(el,text){el.classList.remove('typ');el.textContent='';el.classList.add('chat-type-cursor');const step=text.length>500?3: text.length>220?2:1;for(let i=0;i<text.length;i+=step){el.textContent=text.slice(0,i+step);scrollChat();await new Promise(resolve=>setTimeout(resolve,text.length>500?9:16))}el.classList.remove('chat-type-cursor')}
async function ask(u){if(u){$('.chat-welcome')?.remove();CH.push({r:'u',t:u});bub('u',u);saveChatHistory()}const el=bub('a','',true);showTyping(el);try{const result=await authRequest('ai-chat',{payload:{message:u||'Начни разговор на английском с учеником. Поздоровайся и задай один простой вопрос.',level:S.lv||'A1',history:CH.slice(-16).map(m=>({role:m.r==='u'?'user':'assistant',content:m.t})),learnerProfile:window.CloudyLearning?.profile(KEY)||null,language:['ru','en','uk'].includes(document.documentElement.dataset.lang)?document.documentElement.dataset.lang:'ru'}});const reply=String(result.result?.answer||'').trim();if(!reply)throw new Error('ИИ вернул пустой ответ. Попробуйте ещё раз.');await typeChatReply(el,reply);CH.push({r:'a',t:reply});saveChatHistory();snd('pick')}catch(e){el.classList.remove('typ');el.textContent=e?.message||'Не удалось подключиться к ИИ. Проверьте соединение и повторите попытку.';el.classList.add('error')}scrollChat()}
async function csend(){const el=$('#ci');if(!el||busy)return;const v=el.value.trim();if(!v)return;el.value='';busy=1;snd('send');try{await ask(v)}finally{busy=0;if(el.isConnected)el.focus()}}
setInterval(()=>{try{const n=new Date(),k='rn'+dk(n),hm=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');if(S.user&&S.set.rem&&S.last!=n.toDateString()&&hm>=S.set.remT&&!ls(k)&&window.Notification&&Notification.permission=='granted'){new Notification('Cloudy English',{body:'Пора позаниматься! Не потеряйте серию.'});ls(k,1)}}catch(e){}},30000);
function amb(){const l=S.lv||"A1",a=$(".amb");document.body.dataset.lv=l;document.body.dataset.th="dark";if(a.dataset.l==l)return;a.dataset.l=l;a.innerHTML="";const n={A1:5,A2:16,B1:28,B2:4}[l],r=Math.random;for(let k=0;k<n;k++){const u=document.createElement("u"),z={A1:200+r()*220,A2:14+r()*40,B1:3+r()*6,B2:90}[l];u.style.cssText=`left:${r()*100}%;top:${r()*100}%;width:${z}px;height:${z}px;animation-delay:-${r()*12}s;animation-duration:${l=="A2"?7+r()*8:l=="B1"?2+r()*3:l=="B2"?12+r()*8:14+r()*8}s`;a.appendChild(u)}}
function splash(l){const s=document.createElement("div");s.className="spl "+l;s.innerHTML=`<div class="lc ${l}">${l}</div><h2>${LI[l][0]}</h2>`;document.body.appendChild(s);setTimeout(()=>s.remove(),1800)}
function setLv(l){if(!LVS.includes(l))return;S.lv=l;S.tested=1;save();T=0;view();splash(l);snd("go")}
function welcome(){app.innerHTML=`<div class="scr res">${mascot()}<div class="big2">Какой у вас уровень английского?</div><p style="opacity:.85;margin:0 0 18px">Выберите уровень, а затем мы проверим его коротким тестом</p>${LVS.map((l,k)=>`<button class="opt lv" style="--i:${k}" onclick="pt('${l}')"><span class="lc ${l}">${l}</span><span><b>${LI[l][0]}</b><br><small>${LI[l][1]}</small></span></button>`).join("")}<br><button class="btn" onclick="pt('')">НЕ ЗНАЮ, ОПРЕДЕЛИТЬ ТЕСТОМ</button></div>`}
function pt(c){const start=c?LVS.indexOf(c):0;PT={c,start,level:start,best:0,i:0,sc:[0,0,0,0],lk:0,q:[],total:0,stageSize:2,stageScore:0,stageAnswered:0,seen:[[],[],[],[]]};ptstage();snd("go")}
function ptstage(){const idx=PT.level,pool=sh(TQ[LVS[idx]].map((x,k)=>k).filter(k=>!PT.seen[idx].includes(k)));const count=Math.min(2,pool.length);PT.stageSize=count;PT.stageScore=0;PT.stageAnswered=0;PT.stageStart=PT.q.length;pool.slice(0,count).forEach(k=>{PT.seen[idx].push(k);const [q,o,a]=TQ[LVS[idx]][k];PT.q.push({l:idx,q,a:o[a],o:sh(o)})});PT.total+=count;PT.stageEnd=PT.q.length;ptq()}
function ptq(){const q=PT.q[PT.i];app.innerHTML=`<div class="scr"><div class="top"><button class="x" onclick="snd('tab');${S.lv?"view()":"welcome()"}">${ic("x")}</button><div class="bar"><i style="width:${PT.stageAnswered/PT.stageSize*100}%"></i></div><b>${PT.i+1}</b></div><div class="body"><h2>Проверка уровня ${LVS[PT.level]}</h2><p style="opacity:.8;margin:0 0 14px">Выбери правильный ответ. Вставь подходящее слово или выбери верный вариант.</p><div class="qq" style="font-size:24px">${q.q}</div>${q.o.map((o,k)=>`<button class="opt" style="--i:${k}" onclick="pa(${k})">${o}</button>`).join("")}<button class="opt" style="--i:4;opacity:.75" onclick="pa(-1)">Не знаю</button></div></div>`}
function ptadvance(){const idx=PT.level,passed=PT.stageScore>=2;if(passed){PT.best=Math.max(PT.best,idx);if(PT.descending||idx===3){ptr();return}PT.level=idx+1;ptstage();return}if(idx>0){PT.descending=1;PT.level=idx-1;ptstage();return}ptr()}
function pa(k){if(PT.lk)return;PT.lk=1;const q=PT.q[PT.i],g=k>=0&&q.o[k]==q.a;document.querySelectorAll(".opt").forEach((b,j)=>{if(q.o[j]==q.a)b.classList.add("good");else if(j==k)b.classList.add("wrong")});if(g){PT.sc[q.l]++;PT.stageScore++;snd("ok",PT.sc[q.l])}else if(k>=0)snd("bad");else snd("tap");PT.stageAnswered++;$(".bar i").style.width=PT.stageAnswered/PT.stageSize*100+"%";setTimeout(()=>{PT.lk=0;PT.i++;if(PT.i>=PT.stageEnd){if(PT.stageScore==1&&PT.stageSize==2){const pool=sh(TQ[LVS[PT.level]].map((x,k)=>k).filter(k=>!PT.seen[PT.level].includes(k)));if(pool.length){const k=pool[0],[q,o,a]=TQ[LVS[PT.level]][k];PT.seen[PT.level].push(k);PT.q.push({l:PT.level,q,a:o[a],o:sh(o)});PT.total++;PT.stageSize=3;PT.stageEnd++;ptq();return}}ptadvance()}else ptq()},650)}
function ptr(){const level=LVS[PT.best];S.lv=level;S.tested=1;save();checkAch();const n=PT.sc.reduce((a,b)=>a+b,0),msg=PT.best>PT.start?"Ваш уровень выше ожидаемого":PT.best<PT.start?"Мы нашли ваш комфортный уровень":"Уровень определён";app.innerHTML=`<div class="scr res">${mascot()}<div class="big2">${msg}</div><div style="display:flex;justify-content:center;margin:10px 0"><div class="lc ${level}" style="width:100px;height:100px;font-size:40px;border-radius:30px">${level}</div></div><p style="opacity:.85">${LI[level][0]}. Верных ответов: ${n} из ${PT.total}<br>Проверка адаптировалась к вашим ответам. Уровень сохранён.</p><br><button class="btn" onclick="view()">ПРОДОЛЖИТЬ С ${level}</button>${PT.c&&level!=PT.c?`<br><br><button class="btn" style="background:rgba(255,255,255,.15);color:#fff;box-shadow:none" onclick="setLv('${PT.c}')">ОСТАТЬСЯ НА ${PT.c}</button>`:""}</div>`;snd("win");conf(30)}
function learn(){
 const g=Math.max(1,Number(S.set.goal)||30),td=S.td,rdy=td.xp>=g&&!td.claim,dn=S.dn[S.lv]||0,tl=SEC.reduce((a,x)=>a+x.l.length,0),gp=Math.min(Math.max(0,Number(td.xp)||0)/g,1),C=2*Math.PI*18;let n=0;
 const secs=SEC.map((sc,si)=>{
  const start=n,len=sc.l.length,dIn=Math.max(0,Math.min(dn-start,len));
  const nodes=sc.l.map(li=>{const st=n<dn?"done":n==dn?"cur":"lock",x=Math.round(Math.sin(n*1.05)*68),d=Math.min(n-start,9)*45;n++;
   return `<div class="nw ${st}" style="--x:${x}px;--d:${d}ms">${st=="cur"?'<div class="tip">НАЧАТЬ</div>':""}<button class="node ${st}" aria-label="${D[li].t}" onclick="${st=="lock"?"snd('bad');this.classList.remove('shk');void this.offsetWidth;this.classList.add('shk')":`go(${li})`}">${st=="cur"?'<svg class="ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/></svg>':""}${ic(st=="done"?"check":st=="cur"?"star":"lock")}</button><div class="lb">${D[li].t}</div>${st=="cur"?`<div class="pal ${x>0?"l":"r"}">${mascot()}</div>`:""}</div>`}).join("");
  return `<section class="unit u${si%4}"><div class="ban"><div class="ban-t"><small>РАЗДЕЛ ${si+1}</small><h3>${sc.n}</h3><div class="ban-p"><i style="width:${dIn/len*100}%"></i></div></div><button class="gd" aria-label="Шпаргалка" onclick="guide(${si})">${ic("book")}</button></div><div class="path">${nodes}</div></section>`}).join("");
 const rv=Object.keys(S.mis).length;
 return `<header class="hud"><button class="hud-lv" aria-label="Профиль" onclick="tab(3)"><span class="lc ${S.lv}">${S.lv}</span></button><div class="hud-stats"><span class="stat s-fl">${ic("flame")}<b>${S.streak}</b></span><span class="stat s-xp">${ic("bolt")}<b>${S.xp}</b></span></div><span class="sp"></span><button class="hud-goal ${rdy?"rdy":td.claim?"got":""}" aria-label="Цель дня" onclick="claim()"><svg viewBox="0 0 44 44"><circle class="t" cx="22" cy="22" r="18"/><circle class="p" cx="22" cy="22" r="18" style="stroke-dasharray:${C};stroke-dashoffset:${C*(1-gp)}"/></svg>${ic("chest")}</button><button class="hud-gear" aria-label="Настройки" onclick="CloudyUI.open()">${ic("gear")}</button></header>
 ${rv||examCard()?`<div class="quick">${rvBtn()}${examCard()}</div>`:""}${secs}${dn>=tl&&nxt(S.lv)?`<div class="card done-card"><b>Уровень ${S.lv} пройден!</b><br><br><button class="btn" onclick="setLv('${nxt(S.lv)}')">ПЕРЕЙТИ НА ${nxt(S.lv)}</button></div>`:""}`}
function claim(){const td=S.td;if(td.xp>=S.set.goal&&!td.claim){td.claim=1;S.xp+=25;save();snd("chest");conf(50);view(0)}else snd("bad")}
function guide(si){sheet(`<h3>Шпаргалка: ${SEC[si].n}</h3>`+SEC[si].l.map(li=>`<b style="opacity:.8;font-size:13px">${D[li].t.toUpperCase()}</b>`+D[li].w.map(([e,r])=>`<div class="row"><span>${e} <span style="opacity:.65">— ${r}</span></span><button class="spk" onclick="say('${e}',1)">${ic("spk")}</button></div>`).join("")).join("")+`<br><button class="btn" onclick="closeSh()">ЗАКРЫТЬ</button>`)}
function quests(){const g=Math.max(1,Number(S.set.goal)||30),td=S.td,rdy=td.xp>=g&&!td.claim,nr=Object.keys(S.mis).length,
 Q=[["Набери "+g+" XP",td.xp,g,"bolt"],["Пройди 2 урока",td.les,2,"book"],["Дай 12 верных ответов",td.ok,12,"target"]],
 wd=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"],now=new Date(),dow=(now.getDay()+6)%7,
 week=wd.map((w,k)=>{const d=new Date(now);d.setDate(now.getDate()-dow+k);const on=S.days.includes(dk(d));return `<div class="wd${on?" on":""}${k==dow?" now":""}" style="--i:${k}"><small>${w}</small><i>${on?ic("flame"):""}</i></div>`}).join("");
 return `<div class="pg-head"><h2>Задания дня</h2><button class="hud-gear" aria-label="Настройки" onclick="CloudyUI.open()">${ic("gear")}</button></div>
 <div class="streak-card"><div class="sc-top"><span class="sc-fl">${ic("flame")}</span><div><b>${S.streak}</b><small>дней подряд</small></div></div><div class="week">${week}</div></div>
 <div class="chest-card ${rdy?"rdy":td.claim?"got":""}"><span class="cc-ic">${ic("chest")}</span><div class="cc-b"><b>Сундук дня</b><small>${td.claim?"Награда получена":Math.min(td.xp,g)+" из "+g+" XP"}</small><div class="pb"><i style="width:${Math.min(td.xp/g,1)*100}%"></i></div></div><button class="btn sm" ${rdy?"":"disabled"} onclick="claim()">${td.claim?"Получено":"Забрать"}</button></div>
 ${nr?`<div class="rv-card"><span class="rv-ic">${ic("redo")}</span><div style="flex:1"><b>Повторение ошибок</b><small>Слов для повторения: ${nr}</small></div><button class="btn sm" onclick="review()">ПОВТОРИТЬ</button></div>`:""}
 <div class="quest-list">${Q.map(([nm,v,m,icn],k)=>`<div class="qi${v>=m?" done":""}" style="--i:${k}"><span class="qi-ic">${ic(icn)}</span><div class="qi-b"><p><span>${nm}</span><b>${Math.min(v,m)}/${m}</b></p><div class="pb"><i style="width:${Math.min(v/m,1)*100}%"></i></div></div><span class="qi-ok">${ic("check")}</span></div>`).join("")}</div>`}
function shortsOpenAccountProfile(){shortsProfileUserId=null;shortsProfileData=null;shortsProfileLoading=false;shortsProfileTab="all";T=3;shortsPauseAll();view(1,-1);}
function shortsOpenMyCreatorProfile(){
 if(!S.user||S.user.guest){toast("Войди в аккаунт, чтобы открыть профиль Cloudy Shorts.",false);return;}
 const userId=S.user.id;
 shortsProfileUserId=userId;shortsProfileData=null;shortsProfileLoading=true;shortsProfileTab="all";shortsPauseAll();T=4;view(0);
 authRequest("shorts-profile-get",{payload:{authorId:userId}}).then(r=>{if(shortsProfileUserId===userId)shortsProfileData=r.result||null;}).catch(e=>toast(e.message||"Не удалось открыть профиль.",false)).finally(()=>{if(shortsProfileUserId===userId){shortsProfileLoading=false;view(0);}});
}
function shortsOpenProfile(userId){
 if(!/^[0-9a-f-]{36}$/i.test(String(userId||"")))return;
 if(userId===S.user?.id){shortsOpenAccountProfile();return;}
 shortsProfileUserId=userId;shortsProfileData=null;shortsProfileLoading=true;shortsProfileTab="all";shortsPauseAll();T=3;view(0);
 authRequest("shorts-profile-get",{payload:{authorId:userId}}).then(r=>{if(shortsProfileUserId===userId)shortsProfileData=r.result||null;}).catch(e=>toast(e.message||"Не удалось открыть профиль.",false)).finally(()=>{if(shortsProfileUserId===userId){shortsProfileLoading=false;view(0);}});
}
function shortsCloseProfile(){shortsProfileUserId=null;shortsProfileData=null;shortsProfileTab="all";T=4;view(0);}
function shortsSetProfileTab(tab){shortsProfileTab=["all","video","image","text"].includes(tab)?tab:"all";view(0);}

async function shortsToggleFollow(){
 const p=shortsProfileData?.profile;if(!p||p.isOwn||!S.user||S.user.guest)return;
 const next=!shortsProfileData.isFollowing;
 try{
  const response=await authRequest("shorts-follow-set",{payload:{authorId:p.id,follow:next}});
  if(!shortsProfileData||shortsProfileData.profile.id!==p.id)return;
  shortsProfileData.isFollowing=!!response.result?.isFollowing;
  shortsProfileData.stats={...(shortsProfileData.stats||{}),followers:Number(response.result?.followers||0),following:Number(response.result?.following||0)};
  view(0);
 }catch(error){toast(error.message||"Не удалось изменить подписку.",false);}
}
function shortsEditProfile(){
 if(!shortsProfileData?.profile?.isOwn)return;
 const p=shortsProfileData.profile;
 document.getElementById("shorts-profile-editor")?.remove();
 const modal=document.createElement("div");modal.id="shorts-profile-editor";modal.className="shorts-profile-editor";
 const avatarPreview=p.avatarUrl?'<img src="'+shortsEscapeText(p.avatarUrl)+'" alt="">':'<span>'+shortsEscapeText((p.displayName||"У").charAt(0).toUpperCase())+'</span>';
 modal.innerHTML='<div class="shorts-profile-editor-backdrop" data-profile-editor-close></div><section class="shorts-profile-editor-panel" role="dialog" aria-modal="true" aria-labelledby="shortsProfileEditorTitle"><header><h2 id="shortsProfileEditorTitle">Настройки профиля</h2><button type="button" data-profile-editor-close aria-label="Закрыть">×</button></header><label class="shorts-profile-editor-cover" style="'+(p.coverUrl?'background-image:url(&quot;'+shortsEscapeText(p.coverUrl)+'&quot;)':'')+'"><span>Обложка профиля</span><input id="shortsProfileCoverFile" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="shorts-profile-editor-avatar-row"><label class="shorts-profile-editor-avatar">'+avatarPreview+'<input id="shortsProfileAvatarFile" type="file" accept="image/jpeg,image/png,image/webp"></label><span>Нажмите на фото, чтобы сменить аватар</span></div><label class="shorts-profile-editor-field">Имя профиля<input id="shortsProfileName" maxlength="40" value="'+shortsEscapeText(p.displayName||"")+'"></label><label class="shorts-profile-editor-field">Описание<textarea id="shortsProfileBio" maxlength="240" rows="3">'+shortsEscapeText(p.bio||"")+'</textarea></label><label class="shorts-profile-editor-visibility"><input id="shortsProfilePublic" type="checkbox" '+(p.isPublic?'checked':'')+'> Открытый профиль</label><p class="shorts-profile-editor-hint">Изображения загружаются в закрытое хранилище Cloudy. В профиле отображаются только временные защищённые ссылки.</p><footer><button type="button" data-profile-editor-close>Отмена</button><button type="button" id="shortsProfileSave">Сохранить</button></footer></section>';
 document.body.appendChild(modal);
 modal.querySelectorAll("[data-profile-editor-close]").forEach(el=>el.addEventListener("click",()=>modal.remove()));
 const saveButton=modal.querySelector("#shortsProfileSave");
 saveButton.addEventListener("click",async()=>{
  const name=modal.querySelector("#shortsProfileName").value.trim(),bio=modal.querySelector("#shortsProfileBio").value.trim();
  if(!name||name.length>40){toast("Имя должно содержать от 1 до 40 символов.",false);return;}
  if(bio.length>240){toast("Описание не должно превышать 240 символов.",false);return;}
  const avatarFile=modal.querySelector("#shortsProfileAvatarFile").files[0],coverFile=modal.querySelector("#shortsProfileCoverFile").files[0];
  saveButton.disabled=true;saveButton.textContent="Сохраняем…";
  try{
   const upload=async(file,kind)=>{
    if(!file)return undefined;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5*1024*1024)throw new Error("Выберите JPG, PNG или WebP размером до 5 МБ.");
    const signed=await authRequest("shorts-profile-image-url",{payload:{kind,mimeType:file.type,fileSize:file.size}});
    const url=signed.result?.signedUrl;
    if(typeof url!=="string"||!url.startsWith("https://"))throw new Error("Не удалось подготовить загрузку изображения.");
    const response=await fetch(url,{method:"PUT",headers:{"Content-Type":file.type,"x-upsert":"true"},body:file});
    if(!response.ok)throw new Error("Не удалось загрузить изображение.");
    return signed.result.path;
   };
   const avatarPath=await upload(avatarFile,"avatar"),coverPath=await upload(coverFile,"cover");
   await authRequest("shorts-profile-update",{payload:{displayName:name,bio,isPublic:modal.querySelector("#shortsProfilePublic").checked,...(avatarPath?{avatarPath}:{}),...(coverPath?{coverPath}:{})}});
   modal.remove();toast("Профиль сохранён.");shortsProfileData=null;shortsOpenProfile(S.user.id);
  }catch(e){toast(e.message||"Не удалось сохранить профиль.",false);saveButton.disabled=false;saveButton.textContent="Сохранить";}
 });
}

async function shortsDeletePost(postId){
 if(!confirm("Удалить публикацию? Это действие нельзя отменить."))return;
 try{await authRequest("shorts-post-delete",{payload:{postId}});shortsLiveItems=shortsLiveItems.filter(x=>x.id!==postId);toast("Публикация удалена.");if(shortsProfileUserId)shortsOpenProfile(shortsProfileUserId);else view(0);}
 catch(e){toast(e.message||"Не удалось удалить публикацию.",false);}
}
function shortsCreatorProfile(){
 if(shortsProfileLoading)return '<section class="shorts-creator-profile"><div class="shorts-profile-loading">Загружаем профиль…</div></section>';
 const data=shortsProfileData;
 if(!data||!data.profile)return '<section class="shorts-creator-profile"><div class="shorts-profile-cover"><button class="shorts-profile-back" onclick="shortsCloseProfile()" aria-label="Назад">‹</button></div><div class="shorts-profile-loading">Профиль недоступен.</div></section>';
 const p=data.profile,posts=data.posts||[],stats=data.stats||{},own=!!p.isOwn;
 const initial=shortsEscapeText((p.displayName||"У").trim().charAt(0).toUpperCase());
 const avatar=p.avatarUrl?'<img src="'+shortsEscapeText(p.avatarUrl)+'" alt="" referrerpolicy="no-referrer">':'<span>'+initial+'</span>';
 const coverStyle=p.coverUrl?' style="background-image:linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.58)),url(&quot;'+shortsEscapeText(p.coverUrl)+'&quot;)"':"";
 const handle=p.username?'@'+shortsEscapeText(p.username):'Участник Cloudy Shorts';
 const visiblePosts=shortsProfileTab==="all"?posts:posts.filter(x=>x.mediaType===shortsProfileTab);
 const videoCount=posts.filter(x=>x.mediaType==="video"&&x.status==="approved").length;
 const tabs=[
  ["all",'<path d="M6 4v16M12 4v16M18 4v16"/>',"Все публикации"],
  ["video",'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',"Видео"],
  ["image",'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',"Фото"],
  ["text",'<path d="M5 5h14M5 10h14M5 15h9M5 20h7"/>',"Текст"]
 ];
 const tabHtml=tabs.map(([key,path,label])=>'<button class="shorts-profile-tab '+(shortsProfileTab===key?'active':'')+'" aria-label="'+label+'" aria-pressed="'+(shortsProfileTab===key)+'" onclick="shortsSetProfileTab(&quot;'+key+'&quot;)"><svg viewBox="0 0 24 24">'+path+'</svg></button>').join("");
 const tiles=visiblePosts.length?visiblePosts.map(x=>'<article class="shorts-profile-post" data-profile-post="'+shortsEscapeText(x.id)+'">'+(x.mediaType==="video"&&x.playbackUrl?'<video src="'+shortsEscapeText(x.playbackUrl)+'" muted playsinline preload="none"></video>':x.mediaType==="image"&&x.imageUrl?'<img src="'+shortsEscapeText(x.imageUrl)+'" alt="" loading="lazy">':'<div class="shorts-profile-text">'+shortsEscapeText(x.textContent||x.caption||"Текстовая публикация")+'</div>')+(x.status!=="approved"?'<small class="shorts-profile-pending">На проверке</small>':'')+(own?'<button class="shorts-profile-delete" onclick="shortsDeletePost(&quot;'+x.id+'&quot;)">Удалить</button>':'')+'</article>').join(""):'<div class="shorts-profile-empty"><div>▧</div><b>Публикаций пока нет</b><span>Здесь появятся видео, фото и заметки автора</span></div>';
 return '<section class="shorts-creator-profile'+(own?' own':'')+'"><header class="shorts-profile-cover"'+coverStyle+'><button class="shorts-profile-back" onclick="shortsCloseProfile()" aria-label="Назад">‹</button><span class="shorts-profile-cover-label">CLOUDY SHORTS</span></header><div class="shorts-profile-head"><div class="shorts-profile-avatar">'+avatar+'</div><div class="shorts-profile-title"><h2>'+shortsEscapeText(p.displayName||"Участник")+'</h2><span>'+handle+'</span></div>'+(own?'<button class="shorts-profile-edit" onclick="shortsEditProfile()">Редактировать</button>':(p.isPublic?'<button class="shorts-profile-follow '+(data.isFollowing?'following':'')+'" onclick="shortsToggleFollow()">'+(data.isFollowing?'Вы подписаны':'Подписаться')+'</button>':'<span class="shorts-profile-visibility">Закрытый профиль</span>'))+'</div><div class="shorts-profile-stats"><div><b>'+shortsCount(stats.posts,false)+'</b><span>Публикации</span></div><div><b>'+shortsCount(stats.followers,false)+'</b><span>Подписчики</span></div><div><b>'+shortsCount(stats.following,false)+'</b><span>Подписки</span></div></div>'+(p.bio?'<p class="shorts-profile-bio">'+shortsEscapeText(p.bio)+'</p>':'')+'<div class="shorts-profile-tabs" role="tablist" aria-label="Публикации автора">'+tabHtml+'</div><div class="shorts-profile-grid">'+tiles+'</div></section>';
}
function shortsCount(base, inc){
  const n = Number(base || 0) + (inc ? 1 : 0);
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}
// Shorts state must exist before the first render. The feed renderer reads these
// values synchronously, before shortsLoadFeed() has completed its first request.
let shortsFeedMode="for-you";
let shortsLiveItems=[];
let shortsFollowing=new Set();
let shortsFeedLoading=false;
let shortsFeedUser=null;
let shortsLiked=new Set();
let shortsSaved=new Set();

function shorts(){
 
 const items=shortsFeedMode==="following"?shortsLiveItems.filter(x=>shortsFollowing.has(x.authorId)):shortsLiveItems;
 let h='<section class="shorts-screen"><div class="shorts-topbar"><div class="shorts-tabs"><button class="'+(shortsFeedMode==="following"?"active":"")+'" onclick="shortsSetMode(\'following\')">Подписки</button><button class="'+(shortsFeedMode==="for-you"?"active":"")+'" onclick="shortsSetMode(\'for-you\')">Для вас</button></div><button class="shorts-search" aria-label="Поиск" onclick="shortsSearch()">'+shortsIcon("search")+'</button></div><div class="shorts-feed" id="shorts-feed">';
 if(!items.length)h+='<div class="shorts-empty-state">'+(shortsFeedLoading?'Загружаем публикации…':shortsFeedMode==="following"?'Здесь появятся публикации авторов, на которых ты подпишешься.':'Пока нет публикаций. Поделись первым учебным материалом!')+'</div>';
 items.forEach(x=>{
  const id=shortsEscapeText(x.id),author=shortsEscapeText(x.author),handle=shortsEscapeText(x.handle),caption=shortsEscapeText(x.caption),url=shortsEscapeText(x.videoUrl||x.imageUrl||""),initial=shortsEscapeText(x.initial);
  let media="";
  if(x.mediaType==="image")media='<div class="shorts-photo-media"><img src="'+url+'" alt="Фото публикации" loading="lazy"></div>';
  else if(x.mediaType==="text")media='<div class="shorts-text-media"><div class="shorts-text-card"><span class="shorts-text-kicker">CLOUDY ENGLISH · SHORTS</span><div class="shorts-text-copy">'+shortsEscapeText(x.textContent||x.caption)+'</div><span class="shorts-text-cloud">☁</span></div></div>';
  else media='<div class="shorts-real-media" style="position:absolute;inset:0"><video class="shorts-real-video" style="width:100%;height:100%;object-fit:cover;background:#000" src="'+url+'" playsinline muted loop preload="metadata"></video></div>';
  h+='<article class="shorts-video shorts-theme-blue shorts-post-'+(x.mediaType||"video")+'" data-short-id="'+id+'" data-search-text="'+shortsEscapeText([x.author,x.handle,x.caption,x.textContent].filter(Boolean).join(" "))+'">'+media+'<div class="shorts-shade"></div><div class="shorts-actions"><div class="shorts-author-avatar">'+(x.avatarUrl?'<img src="'+shortsEscapeText(x.avatarUrl)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':initial)+'</div>'+'<button class="shorts-action shorts-like '+(shortsLiked.has(x.id)?"liked":"")+'" aria-label="Нравится" onclick="shortsLike(\''+id+'\')"><span class="shorts-cloud-like">'+mascot(shortsLiked.has(x.id)?"h":"s")+'</span><small>'+shortsCount(x.likes,shortsLiked.has(x.id))+'</small></button><button class="shorts-action" aria-label="Комментарии" onclick="shortsComments(\''+id+'\')"><span class="shorts-action-icon">'+shortsIcon("comment")+'</span><small>'+shortsCount(x.comments,false)+'</small></button><div class="shorts-post-menu-wrap"><button type="button" class="shorts-action shorts-post-menu-trigger" aria-label="Ещё" aria-expanded="false" onclick="shortsTogglePostMenu(\''+id+'\')"><span class="shorts-action-icon">'+shortsIcon("menu")+'</span><small>Ещё</small></button></div><button class="shorts-action '+(shortsSaved.has(x.id)?"saved":"")+'" aria-label="Сохранить" onclick="shortsSave(\''+id+'\')"><span class="shorts-action-icon">'+shortsIcon("bookmark")+'</span><small>'+(shortsSaved.has(x.id)?"Сохранено":"Сохранить")+'</small></button><button class="shorts-action shorts-share" aria-label="Поделиться" onclick="shortsShare(\''+id+'\')"><span class="shorts-action-icon">'+shortsIcon("share")+'</span><small>Поделиться</small></button>'+(x.mediaType==="video"?'<button class="shorts-action sound-toggle" aria-label="Звук" onclick="shortsToggleSound()"><span class="shorts-action-icon">'+shortsIcon(shortsMuted?"muted":"volume")+'</span><small>Звук</small></button>':'')+'</div><div class="shorts-caption"><div class="shorts-author-line"><b>'+author+'</b><span>'+handle+'</span><button class="shorts-follow '+(shortsFollowing.has(x.authorId)?"following":"")+'" onclick="shortsFollow(\''+id+'\')">'+(shortsFollowing.has(x.authorId)?"Вы подписаны":"+ Подписаться")+'</button></div>'+(x.mediaType==="text"?"":'<p>'+caption+'</p>')+'<div class="shorts-audio">'+(x.mediaType==="video"?shortsIcon("music")+' Оригинальный звук · Cloudy English':x.mediaType==="image"?"Фотография · Cloudy English":"Учебная заметка · Cloudy English")+'</div></div></article>';
 });
 h+='</div><button class="shorts-create" aria-label="Создать публикацию" onclick="shortsUpload()">'+shortsIcon("plus")+'</button></section>';return h;
}
async function shortsLoadFeed(force=false){
 if(!S.user)return;
 const uid=S.user.id;if(shortsFeedLoading||(!force&&shortsFeedUser===uid))return;
 shortsFeedLoading=true;
 try{const response=await authRequest("shorts-feed-get");if(S.user?.id!==uid)return;const rows=Array.isArray(response.result?.videos)?response.result.videos:[];shortsLiveItems=rows.map(v=>({id:v.id,authorId:v.authorId||"",isOwn:v.isOwn===true,mediaType:v.mediaType||"video",author:v.authorName||"Участник",handle:"",avatarUrl:v.avatarUrl||null,initial:String(v.authorName||"У").trim().charAt(0).toUpperCase(),caption:v.caption||"",textContent:v.textContent||"",likes:Number(v.likes||0),comments:Number(v.comments||0),shares:0,isLiked:v.isLiked===true,isFollowingAuthor:v.isFollowingAuthor===true,isSaved:v.isSaved===true,videoUrl:v.playbackUrl,imageUrl:v.imageUrl,createdAt:v.publishedAt})).filter(v=>v.mediaType==="text"||v.videoUrl||v.imageUrl);shortsLiked=new Set(shortsLiveItems.filter(v=>v.isLiked).map(v=>v.id));shortsFollowing=new Set(shortsLiveItems.filter(v=>v.isFollowingAuthor).map(v=>v.authorId));shortsSaved=new Set(shortsLiveItems.filter(v=>v.isSaved).map(v=>v.id));shortsFeedUser=uid;}
 catch(error){console.warn("[cloudy-shorts] feed load failed",error);if(force)toast(error.message||"Не удалось загрузить ленту Shorts.",false);}
 finally{shortsFeedLoading=false;if(T===4&&S.user?.id===uid)view(0);}
}

function shortsIcon(name){const paths={search:'<circle cx="11" cy="11" r="7"></circle><path d="m16 16 5 5"></path>',comment:'<path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-9.5A7.5 7.5 0 0 1 10.5 4h2A7.5 7.5 0 0 1 20 11.5Z"></path>',share:'<path d="M12 19V5"></path><path d="m6 11 6-6 6 6"></path><path d="M5 15v5h14v-5"></path>',bookmark:'<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4Z"></path>',volume:'<path d="M4 10v4h4l5 4V6l-5 4Z"></path><path d="M16 9a5 5 0 0 1 0 6"></path><path d="M18.5 6.5a9 9 0 0 1 0 11"></path>',muted:'<path d="M4 10v4h4l5 4V6l-5 4Z"></path><path d="m17 9 5 6m0-6-5 6"></path>',music:'<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',menu:'<path d="M4 6h16M4 12h16M4 18h16"></path>',plus:'<path d="M12 5v14M5 12h14"></path>'};return '<svg class="shorts-svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(paths[name]||paths.plus)+'</svg>';}
function shortsSetMode(m){shortsFeedMode=m;view(0);}
function shortsPaintLike(x,animate=true){const card=document.querySelector('[data-short-id="'+x.id+'"]');if(!card)return;const btn=card.querySelector(".shorts-like");if(!btn)return;btn.classList.toggle("liked",!!x.isLiked);const cloud=btn.querySelector(".shorts-cloud-like");if(cloud){cloud.innerHTML=mascot(x.isLiked?"h":"s");if(animate){cloud.classList.remove("cloud-pop");void cloud.offsetWidth;cloud.classList.add("cloud-pop");}}const n=btn.querySelector("small");if(n)n.textContent=shortsCount(x.likes,false);}
async function shortsLike(id){const x=shortsLiveItems.find(v=>v.id===id);if(!x)return;if(!S.user||S.user.guest){toast("Войди в аккаунт, чтобы ставить лайки.",false);return;}const previousLiked=!!x.isLiked,previousLikes=Number(x.likes||0);x.isLiked=!previousLiked;x.likes=Math.max(0,previousLikes+(x.isLiked?1:-1));if(x.isLiked)shortsLiked.add(id);else shortsLiked.delete(id);shortsPaintLike(x,true);x.likeDesired=x.isLiked;if(x.likePending)return;x.likePending=true;try{while(x.likeSynced!==x.likeDesired){const target=x.likeDesired;const response=await authRequest("shorts-like-set",{payload:{videoId:id,like:target}});x.likeSynced=response.result?.isLiked===true;if(x.likeSynced!==target){x.likeDesired=x.likeSynced;break;}x.likes=Number(response.result?.likes??x.likes);if(x.likeDesired!==target)continue;}if(x.isLiked!==x.likeSynced){x.isLiked=x.likeSynced;x.likes=Math.max(0,Number(x.likes||0)+(x.isLiked?1:-1));if(x.isLiked)shortsLiked.add(id);else shortsLiked.delete(id);shortsPaintLike(x,false);}}catch(error){x.isLiked=previousLiked;x.likes=previousLikes;if(x.isLiked)shortsLiked.add(id);else shortsLiked.delete(id);shortsPaintLike(x,false);toast(error.message||"Не удалось сохранить лайк.",false);}finally{x.likePending=false;delete x.likeDesired;delete x.likeSynced;}}
async function shortsSave(id){if(!S.user||S.user.guest){toast("Войди в аккаунт, чтобы сохранять публикации.",false);return;}const item=shortsLiveItems.find(v=>v.id===id);if(!item||item.savePending)return;item.savePending=true;const desired=!shortsSaved.has(id);try{const response=await authRequest("shorts-save-set",{payload:{videoId:id,saved:desired}});if(response.result?.isSaved===true)shortsSaved.add(id);else shortsSaved.delete(id);item.isSaved=desired;const card=document.querySelector('[data-short-id="'+id+'"]');const btn=card?.querySelector('[aria-label="Сохранить"]');if(btn){btn.classList.toggle("saved",desired);const label=btn.querySelector("small");if(label)label.textContent=desired?"Сохранено":"Сохранить";}}catch(error){toast(error.message||"Не удалось изменить сохранённые публикации.",false);}finally{item.savePending=false;}}
async function shortsFollow(id){const x=shortsLiveItems.find(v=>v.id===id);if(!x?.authorId||x.isOwn)return;if(!S.user||S.user.guest){toast("Войди в аккаунт, чтобы подписываться.",false);return;}if(x.followPending)return;x.followPending=true;const authorId=x.authorId;const next=!shortsFollowing.has(authorId);try{const response=await authRequest("shorts-follow-set",{payload:{authorId,follow:next}});const isFollowing=!!response.result?.isFollowing;if(isFollowing)shortsFollowing.add(authorId);else shortsFollowing.delete(authorId);shortsLiveItems.forEach(item=>{if(item.authorId===authorId)item.isFollowingAuthor=isFollowing;});document.querySelectorAll(".shorts-video").forEach(card=>{const item=shortsLiveItems.find(post=>post.id===card.dataset.shortId);if(item?.authorId===authorId){const btn=card.querySelector(".shorts-follow");if(btn){btn.classList.toggle("following",isFollowing);btn.textContent=isFollowing?"Вы подписаны":"+ Подписаться";}}});if(shortsFeedMode==="following")view(0);}catch(error){toast(error.message||"Не удалось изменить подписку.",false);}finally{x.followPending=false;}}
let shortsPlaybackObserver=null,shortsActiveVideo=null,shortsActiveCard=null,shortsCardVisibility=new Map();
function shortsPauseAll(except=null){document.querySelectorAll(".shorts-real-video").forEach(video=>{if(video!==except){video.pause();video.closest(".shorts-video")?.classList.remove("is-playing");}});if(!except)shortsActiveVideo=null;}
function shortsStopFeedPlayback(){
 if(shortsPlaybackObserver){shortsPlaybackObserver.disconnect();shortsPlaybackObserver=null;}
 shortsCardVisibility.clear();shortsPauseAll();shortsActiveVideo=null;shortsActiveCard=null;
}
function shortsResumeFeedPlayback(){
 if(T===4&&!shortsFlowOverlay)initShortsPlayback();
}
function shortsActivateCard(card){
 if(!card||!card.isConnected)return;
 const changed=shortsActiveCard!==card;
 if(changed){shortsPauseAll();shortsActiveCard=card;}
 const video=card.querySelector(".shorts-real-video");
 if(!video){shortsPauseAll();shortsActiveVideo=null;return;}
 if(video.dataset.userPaused==="1"){video.pause();card.classList.remove("is-playing");shortsActiveVideo=null;return;}
 if(shortsActiveVideo!==video||video.paused)shortsPlayVideo(video);
}
function shortsEvaluateVisibleCard(){
 if(document.visibilityState==="hidden"){shortsPauseAll();shortsActiveVideo=null;return;}
 const feed=document.querySelector("#shorts-feed");if(!feed)return;
 const visible=Array.from(shortsCardVisibility.entries()).filter(([card,ratio])=>card.isConnected&&ratio>=0.65).sort((a,b)=>b[1]-a[1])[0];
 if(!visible){shortsPauseAll();shortsActiveVideo=null;shortsActiveCard=null;return;}
 shortsActivateCard(visible[0]);
}
function shortsPlayVideo(video){
 if(!video||!video.isConnected)return;
 const card=video.closest(".shorts-video");
 if(!card)return;
 shortsPauseAll(video);shortsActiveCard=card;video.muted=shortsMuted;
 card.classList.remove("is-paused");card.classList.add("is-playing");
 const result=video.play();
 if(result&&typeof result.catch==="function")result.catch(()=>{card.classList.remove("is-playing");if(shortsActiveVideo===video)shortsActiveVideo=null;});
 shortsActiveVideo=video;
}
function initShortsPlayback(){
 const feed=document.querySelector("#shorts-feed");if(!feed)return;
 if(shortsPlaybackObserver){shortsPlaybackObserver.disconnect();shortsPlaybackObserver=null;}
 shortsPauseAll();shortsActiveVideo=null;shortsActiveCard=null;shortsCardVisibility.clear();
 const cards=Array.from(feed.querySelectorAll(".shorts-video"));
 cards.forEach(card=>{
  const video=card.querySelector(".shorts-real-video");
  if(video){video.pause();video.muted=shortsMuted;}
  card.classList.remove("is-playing","is-paused");
 });
 if(!cards.length)return;
 if("IntersectionObserver" in window){
  shortsPlaybackObserver=new IntersectionObserver(entries=>{
   entries.forEach(entry=>shortsCardVisibility.set(entry.target,entry.isIntersecting?entry.intersectionRatio:0));
   shortsEvaluateVisibleCard();
  },{root:feed,threshold:[0,0.25,0.5,0.65,0.8,1]});
  cards.forEach(card=>shortsPlaybackObserver.observe(card));
 }else{
  const evaluate=()=>{
   const rect=feed.getBoundingClientRect(),mid=rect.top+rect.height/2;
   const card=cards.filter(x=>{const r=x.getBoundingClientRect();return r.bottom>rect.top&&r.top<rect.bottom;}).sort((a,b)=>Math.abs((a.getBoundingClientRect().top+a.getBoundingClientRect().height/2)-mid)-Math.abs((b.getBoundingClientRect().top+b.getBoundingClientRect().height/2)-mid))[0];
   if(card)shortsActivateCard(card);else{shortsPauseAll();shortsActiveCard=null;}
  };
  feed.addEventListener("scroll",evaluate,{passive:true});evaluate();
 }
 if(feed.dataset.playbackClickBound!=="1"){
  feed.dataset.playbackClickBound="1";
  feed.addEventListener("click",event=>{
   if(event.target.closest("button,a,input,textarea"))return;
   const card=event.target.closest("#shorts-feed .shorts-video"),video=card?.querySelector(".shorts-real-video");if(!video)return;
   if(video.paused){video.dataset.userPaused="0";shortsPlayVideo(video);card.classList.remove("is-paused");}
   else{video.dataset.userPaused="1";video.pause();card.classList.remove("is-playing");card.classList.add("is-paused");shortsActiveVideo=null;}
  });
 }
}
if(!window.__cloudyShortsVisibilityBound){
 window.__cloudyShortsVisibilityBound=true;
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"){shortsPauseAll();shortsActiveVideo=null;}else shortsEvaluateVisibleCard();});
}
function shortsToggleSound(){shortsMuted=!shortsMuted;if(shortsActiveVideo)shortsActiveVideo.muted=shortsMuted;document.querySelectorAll(".sound-toggle .shorts-action-icon").forEach(x=>x.innerHTML=shortsIcon(shortsMuted?"muted":"volume"));}
async function shortsShare(id){const item=shortsLiveItems.find(x=>x.id===id);const url=location.href.split("#")[0]+"#short-"+encodeURIComponent(id);try{if(navigator.share){await navigator.share({title:"Cloudy Shorts",text:item?.caption||"Посмотри видео в Cloudy Shorts",url});}else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);toast("Ссылка на видео скопирована.");}else{toast("Поделиться сейчас не удалось.",false);}}catch(error){if(error?.name!=="AbortError")toast("Не удалось поделиться видео.",false);}}
function shortsTogglePostMenu(id){const card=Array.from(document.querySelectorAll(".shorts-video")).find(item=>item.dataset.shortId===id);if(!card)return;const wrap=card.querySelector(".shorts-post-menu-wrap");if(!wrap)return;const existing=wrap.querySelector(".shorts-post-menu");if(existing){existing.remove();wrap.querySelector("button")?.setAttribute("aria-expanded","false");return;}document.querySelectorAll(".shorts-post-menu").forEach(menu=>menu.remove());document.querySelectorAll(".shorts-post-menu-trigger").forEach(button=>button.setAttribute("aria-expanded","false"));const post=shortsLiveItems.find(item=>item.id===id);const menu=document.createElement("div");menu.className="shorts-post-menu";const share=document.createElement("button");share.type="button";share.textContent="Поделиться видео";share.addEventListener("click",()=>{menu.remove();wrap.querySelector("button")?.setAttribute("aria-expanded","false");shortsShare(id);});menu.append(share);if(post?.isOwn){const remove=document.createElement("button");remove.type="button";remove.className="danger";remove.textContent="Удалить видео";remove.addEventListener("click",()=>{menu.remove();wrap.querySelector("button")?.setAttribute("aria-expanded","false");shortsDeletePost(id);});menu.append(remove);}wrap.append(menu);wrap.querySelector("button")?.setAttribute("aria-expanded","true");}
function shortsSearch(){
 const topbar=document.querySelector(".shorts-topbar"),feed=document.querySelector("#shorts-feed");
 if(!topbar||!feed)return;
 let existing=topbar.querySelector(".shorts-search-input");
 const apply=()=>{
  const query=String(existing?.value||"").trim().toLocaleLowerCase("ru");
  let visible=0;
  feed.querySelectorAll(".shorts-video").forEach(card=>{
   const match=!query||String(card.dataset.searchText||"").toLocaleLowerCase("ru").includes(query);
   card.hidden=!match;if(match)visible++;
  });
  let empty=feed.querySelector(".shorts-search-empty");
  if(query&&visible===0){
   if(!empty){empty=document.createElement("div");empty.className="shorts-search-empty";empty.textContent="Ничего не найдено. Попробуй другое слово.";feed.appendChild(empty);}
  }else empty?.remove();
 };
 if(existing){
  existing.remove();topbar.querySelector(".shorts-search-close")?.remove();
  const trigger=topbar.querySelector(".shorts-search");if(trigger)trigger.hidden=false;
  feed.querySelectorAll(".shorts-video").forEach(card=>card.hidden=false);
  feed.querySelector(".shorts-search-empty")?.remove();
  return;
 }
 const trigger=topbar.querySelector(".shorts-search");if(!trigger)return;
 trigger.hidden=true;
 trigger.insertAdjacentHTML("afterend",'<input class="shorts-search-input" type="search" inputmode="search" maxlength="80" placeholder="Найти публикацию…" aria-label="Поиск публикаций"><button type="button" class="shorts-search-close" aria-label="Закрыть поиск">×</button>');
 const input=topbar.querySelector(".shorts-search-input");
 existing=input;
 input.addEventListener("input",apply);
 input.addEventListener("keydown",event=>{if(event.key==="Escape")shortsSearch();});
 topbar.querySelector(".shorts-search-close")?.addEventListener("click",()=>shortsSearch());
 input.focus();
}
let shortsCommentLikes=new Set(),shortsCommentSort="top",shortsReplyTo=null;
let shortsLiveComments=[],shortsLiveCommentsVideoId=null,shortsLiveCommentsLoading=false,shortsLiveCommentsRequest=0;
function shortsIsLiveId(id){return /^[0-9a-f-]{36}$/i.test(String(id||""));}
function shortsEscapeText(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function shortsCommentTime(value){const d=new Date(value);return Number.isNaN(d.getTime())?"":d.toLocaleString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});}
async function shortsLoadLiveComments(id){
 const requestId=++shortsLiveCommentsRequest;
 const sheetEl=$(".sb .sh");
 if(!sheetEl)return;
 shortsLiveCommentsLoading=true;
 sheetEl.dataset.videoId=id;
 sheetEl.innerHTML='<div class="shorts-comments-panel"><div class="shorts-comments-grabber"></div><div class="shorts-comments-loading">Загружаем комментарии…</div></div>';
 const isCurrent=()=>requestId===shortsLiveCommentsRequest&&sheetEl.isConnected&&$(".sb .sh")===sheetEl&&sheetEl.dataset.videoId===id;
 try{
  const response=await authRequest("shorts-comments-get",{payload:{videoId:id}});
  if(!isCurrent())return;
  shortsLiveComments=Array.isArray(response.result?.comments)?response.result.comments:[];
  shortsLiveCommentsVideoId=id;
  shortsRenderComments(id);
 }catch(error){
  if(!isCurrent())return;
  sheetEl.innerHTML='<div class="shorts-comments-panel"><div class="shorts-comments-grabber"></div><div class="shorts-comments-empty">'+shortsEscapeText(error.message||"Не удалось загрузить комментарии.")+'</div><div class="shorts-comment-compose"><button onclick="closeSh()">Закрыть</button></div></div>';
 }finally{
  if(requestId===shortsLiveCommentsRequest)shortsLiveCommentsLoading=false;
 } 
}
function shortsRenderComments(id){
 const live=shortsIsLiveId(id);
 if(live&&shortsLiveCommentsVideoId!==id){void shortsLoadLiveComments(id);return;}
 const samples=live?[...shortsLiveComments]:[];
 samples.sort((a,b)=>shortsCommentSort==="new"?(Date.parse(b.time||"")||0)-(Date.parse(a.time||"")||0):(Number(b.likes||0)-Number(a.likes||0))||((Date.parse(a.time||"")||0)-(Date.parse(b.time||"")||0)));
 const renderRow=(c,nested=false)=>{
  const commentId=shortsEscapeText(c.id),name=shortsEscapeText(c.name||"Участник"),avatar=shortsEscapeText(c.avatar||String(c.name||"У").charAt(0)),body=shortsEscapeText(c.text),time=shortsEscapeText(shortsCommentTime(c.time));
  const actions='<div class="shorts-comment-actions"><button type="button" class="shorts-comment-like '+(c.isLiked?"liked":"")+'" onclick="shortsCommentLike(\''+commentId+'\')">♥ <span>'+shortsCount(c.likes,false)+'</span></button>'+(nested?'':'<button type="button" onclick="shortsReply(\''+commentId+'\')">Ответить</button>')+'</div>';
  return '<div class="shorts-comment-row'+(nested?' nested':'')+'" data-comment-id="'+commentId+'"><div class="shorts-comment-avatar">'+avatar+'</div><div class="shorts-comment-main"><div class="shorts-comment-user">'+name+'</div><p>'+body+'</p><div class="shorts-comment-meta">'+time+'</div>'+actions+'</div></div>';
 };
 const roots=samples.filter(c=>!c.parentId);
 const rows=roots.map(root=>renderRow(root)+samples.filter(reply=>reply.parentId===root.id).map(reply=>renderRow(reply,true)).join("")).join("");
 const sheetEl=$(".sb .sh");
 if(sheetEl){
  sheetEl.dataset.videoId=id;
  sheetEl.innerHTML='<div class="shorts-comments-panel"><div class="shorts-comments-grabber"></div><header class="shorts-comments-header"><div><b>Комментарии</b><span>'+shortsCount(samples.length,false)+'</span></div><button aria-label="Закрыть" onclick="closeSh()">'+shortsIcon("plus")+'</button></header>'+(live?'<div class="shorts-comments-sort"><button class="'+(shortsCommentSort==="top"?"active":"")+'" onclick="shortsSortComments(\'top\',\''+id+'\')">Популярные</button><button class="'+(shortsCommentSort==="new"?"active":"")+'" onclick="shortsSortComments(\'new\',\''+id+'\')">Сначала новые</button></div>':'')+'<div class="shorts-comments-scroll">'+(rows||'<div class="shorts-comments-empty">'+(live?'Пока нет комментариев. Будь первым!':'Комментарии появятся вместе с реальными публикациями.')+'</div>')+'</div>'+(live?'<div class="shorts-comment-compose"><div class="shorts-compose-avatar">☁</div><input id="shorts-comment-input" maxlength="500" placeholder="'+(shortsReplyTo?'Ответ для '+shortsEscapeText(shortsReplyTo.name)+'…':'Добавить комментарий…')+'" onkeydown="if(event.key===\'Enter\')shortsSendComment()"><button aria-label="Отправить комментарий" onclick="shortsSendComment()">'+shortsIcon("share")+'</button>'+(shortsReplyTo?'<button type="button" aria-label="Отменить ответ" onclick="shortsReplyTo=null;shortsRenderComments(\''+id+'\')">×</button>':'')+'</div>':'')+'</div>';
  shortsBindCommentSheetDismiss();
 }
}
function shortsBindCommentSheetDismiss(){
 const sheetEl=$(".sb .sh"),grabber=sheetEl?.querySelector(".shorts-comments-grabber"),header=sheetEl?.querySelector(".shorts-comments-header");
 if(!sheetEl||!grabber||grabber.dataset.dismissBound==="1")return;
 grabber.dataset.dismissBound="1";
 const surfaces=[grabber,header].filter(Boolean);
 let startY=0,lastY=0,lastTime=0,dragging=false,pointerId=null;
 const begin=event=>{
  if(event.pointerType==="mouse"&&event.button!==0)return;
  if(event.target?.closest("button"))return;
  startY=lastY=event.clientY;lastTime=performance.now();dragging=true;pointerId=event.pointerId;
  sheetEl.style.transition="none";
  try{event.currentTarget.setPointerCapture(event.pointerId)}catch(_){}
 };
 const move=event=>{
  if(!dragging||event.pointerId!==pointerId)return;
  const delta=Math.max(0,event.clientY-startY);
  sheetEl.style.transform="translateY("+delta+"px)";
 };
 const finish=event=>{
  if(!dragging||event.pointerId!==pointerId)return;
  const now=performance.now(),delta=Math.max(0,event.clientY-startY);
  const velocity=Math.max(0,(event.clientY-lastY)/Math.max(1,now-lastTime));
  dragging=false;pointerId=null;
  sheetEl.style.transition="transform .22s cubic-bezier(.2,.8,.2,1)";
  if(delta>72||velocity>.45){closeSh();return;}
  sheetEl.style.transform="";
  const reset=()=>{sheetEl.style.transition="";sheetEl.removeEventListener("transitionend",reset)};
  sheetEl.addEventListener("transitionend",reset);
 };
 const cancel=event=>{
  if(!dragging||event.pointerId!==pointerId)return;
  dragging=false;pointerId=null;sheetEl.style.transition="transform .2s ease";sheetEl.style.transform="";
 };
 surfaces.forEach(surface=>{
  surface.style.touchAction="none";
  surface.addEventListener("pointerdown",begin);
  surface.addEventListener("pointermove",move);
  surface.addEventListener("pointerup",finish);
  surface.addEventListener("pointercancel",cancel);
 });
}
function shortsComments(id){shortsLiveCommentsRequest++;shortsLiveCommentsLoading=false;shortsCommentSort="top";shortsReplyTo=null;shortsLiveCommentsVideoId=null;shortsLiveComments=[];sheet('<div class="shorts-comments-panel"><div class="shorts-comments-grabber"></div><header class="shorts-comments-header"><div><b>Комментарии</b><span>'+shortsCount((shortsLiveItems.find(v=>v.id===id)||{}).comments||0,false)+'</span></div><button aria-label="Закрыть" onclick="closeSh()">'+shortsIcon("plus")+'</button></header><div class="shorts-comments-loading">Загружаем обсуждение…</div></div>');shortsRenderComments(id);}
function shortsSortComments(sort,id){shortsCommentSort=sort;shortsRenderComments(id);}
async function shortsCommentLike(id){
 const comment=shortsLiveComments.find(item=>item.id===id);if(!comment||comment.likePending)return;
 if(!S.user||S.user.guest){toast("Войди в аккаунт, чтобы оценивать комментарии.",false);return;}
 const previous=!!comment.isLiked,previousCount=Number(comment.likes||0),desired=!previous;
 comment.isLiked=desired;comment.likes=Math.max(0,previousCount+(desired?1:-1));comment.likePending=true;
 shortsRenderComments($(".sb .sh")?.dataset?.videoId||"");
 try{
  const response=await authRequest("shorts-comment-like-set",{payload:{commentId:id,like:desired}});
  comment.isLiked=response.result?.isLiked===true;comment.likes=Number(response.result?.likes??comment.likes);
 }catch(error){comment.isLiked=previous;comment.likes=previousCount;toast(error.message||"Не удалось сохранить лайк комментария.",false);}
 finally{comment.likePending=false;shortsRenderComments($(".sb .sh")?.dataset?.videoId||"");}
}
function shortsReply(id){const comment=shortsLiveComments.find(item=>item.id===id);if(!comment)return;shortsReplyTo={id,name:String(comment.name||"Участник")};const input=$("#shorts-comment-input");if(input){input.placeholder="Ответ для "+shortsReplyTo.name+"…";input.focus();}}
function shortsToggleReplies(id){const el=$("#shorts-replies-"+id);if(el)el.classList.toggle("open");}
async function shortsSendComment(){
 const input=$("#shorts-comment-input"),body=String(input?.value||"").trim(),videoId=$(".sb .sh")?.dataset?.videoId||"";
 if(!body)return;
 if(!shortsIsLiveId(videoId)){toast("Это демонстрационный ролик. Отправка комментариев появится после подключения реальных видео.",false);return;}
 const button=$(".shorts-comment-compose button");if(button){button.disabled=true;button.textContent="…";}
 try{
  const response=await authRequest("shorts-comment-create",{payload:{videoId,body,...(shortsReplyTo?.id?{parentCommentId:shortsReplyTo.id}:{})}});
  if(input)input.value="";
  shortsReplyTo=null;
  toast(response.result?.status==="published"?"Комментарий опубликован.":"Комментарий отправлен.");
  const post=shortsLiveItems.find(item=>item.id===videoId);if(post)post.comments=Number(post.comments||0)+1;
  const countButton=document.querySelector('[data-short-id="'+videoId+'"] .shorts-action[aria-label="Комментарии"] small');if(countButton&&post)countButton.textContent=shortsCount(post.comments,false);
  shortsLiveCommentsVideoId=null;await shortsLoadLiveComments(videoId);
 }catch(error){toast(error.message||"Не удалось отправить комментарий.",false);}
 finally{if(button){button.disabled=false;button.innerHTML=shortsIcon("share");}}
}
function shortsFormatSize(bytes){if(!Number.isFinite(bytes)||bytes<0)return "—";return bytes>=1024*1024?(bytes/1024/1024).toFixed(1)+" МБ":Math.max(1,Math.round(bytes/1024))+" КБ";}
function shortsFormatDuration(seconds){if(!Number.isFinite(seconds)||seconds<0)return "—";const total=Math.round(seconds),m=Math.floor(total/60),s=total%60;return m+":"+String(s).padStart(2,"0");}
let shortsCaptureMode=15;
let shortsFlowFrame=null,shortsFlowOverlay=null,shortsFlowFile=null;
function shortsFlowClose(resumeFeed=true){
 if(shortsFlowFrame){try{shortsFlowFrame.src="about:blank";}catch(_){}}
 shortsFlowOverlay?.remove();shortsFlowFrame=null;shortsFlowOverlay=null;shortsFlowFile=null;
 if(resumeFeed)shortsResumeFeedPlayback();
}
function shortsUpload(){
 if(T!==4){toast("Сначала открой Shorts.",false);return;}
 try{
  shortsStopFeedPlayback();
  shortsDisposeUpload();
  if(shortsFlowOverlay)shortsFlowClose(false);
  const overlay=document.createElement("div");
  overlay.id="cloudy-shorts-fullscreen";
  overlay.style.cssText="position:fixed;inset:0;z-index:2147483000;background:#050c24;overflow:hidden";
  const frame=document.createElement("iframe");
  frame.title="Cloudy Shorts — съёмка";
  frame.allow="camera;microphone;autoplay";
  frame.referrerPolicy="same-origin";
  frame.style.cssText="display:block;width:100%;height:100%;border:0;background:#050c24";
  frame.addEventListener("error",()=>{toast("Не удалось открыть камеру Shorts. Попробуй ещё раз.",false);shortsFlowClose();},{once:true});
  overlay.appendChild(frame);document.body.appendChild(overlay);
  shortsFlowOverlay=overlay;shortsFlowFrame=frame;
  frame.src="/cloudy-shorts-capture.html";
 }catch(error){console.error("Shorts create flow failed",error);shortsFlowClose();toast("Не удалось открыть публикацию. Попробуй ещё раз.",false);}
}
if(!window.__cloudyShortsFlowNavigation){
 window.__cloudyShortsFlowNavigation=true;
 window.addEventListener("cloudy:captured",event=>{
  const detail=event?.detail;if(!detail?.file||!shortsFlowFrame)return;
  event.preventDefault();
  shortsFlowFile=detail.file;
  const frame=shortsFlowFrame;frame.onload=()=>{
   try{frame.contentWindow.cloudyPublishOpen(shortsFlowFile,detail.type,detail.duration||detail.durationSeconds||0);}
   catch(error){toast("Не удалось открыть экран публикации.",false);console.warn(error);}
   shortsBindCommentSheetDismiss();
  };
  frame.src="/cloudy-shorts-publish.html";
 });
 window.addEventListener("cloudy:back",event=>{
  if(!shortsFlowFrame)return;
  event.preventDefault();
  const frame=shortsFlowFrame;frame.onload=()=>{shortsFlowFile=null;};
  frame.src="/cloudy-shorts-capture.html";
 });
 window.addEventListener("cloudy:close",event=>{event.preventDefault();shortsFlowClose();});
 window.addEventListener("cloudy:published",event=>{event.preventDefault();shortsFlowClose();});
}
function shortsSetComposerMode(mode){
 if(!["video","image","text"].includes(mode))return;
 shortsComposerMode=mode;
 document.querySelectorAll(".shorts-create-tabs button").forEach(button=>button.classList.toggle("active",button.dataset.mode===mode));
 [".shorts-composer-video",".shorts-composer-image",".shorts-composer-text"].forEach((selector,index)=>{const el=$(selector);if(el)el.hidden=["video","image","text"][index]!==mode;});
}
function shortsSetCaptureMode(seconds,button){
 shortsCaptureMode=seconds;
 document.querySelectorAll(".shorts-camera-modes button").forEach(item=>item.classList.toggle("active",Number(item.dataset.limit)===seconds));
 if(shortsUploadMeta&&shortsUploadMeta.duration>seconds+.5){shortsRemoveFile();toast("Видео длиннее выбранного режима. Выбери более длинный режим.");}
}
function shortsCaptionCount(){const input=$("#shorts-upload-caption"),count=$("#shorts-caption-count");if(count&&input)count.textContent=input.value.length+" / 180";}
function shortsDisposeUpload(){
 const video=$("#shorts-upload-video");
 if(video){try{video.pause();video.removeAttribute("src");video.load();}catch(_){}}
 if(shortsSelectedUrl){try{URL.revokeObjectURL(shortsSelectedUrl);}catch(_){}}
 if(shortsSelectedImageUrl){try{URL.revokeObjectURL(shortsSelectedImageUrl);}catch(_){}}
 shortsSelectedUrl="";shortsSelectedFile=null;shortsUploadMeta=null;
 shortsSelectedImageUrl="";shortsSelectedImageFile=null;
}
function shortsUploadError(message){
 const p=$("#shorts-upload-preview");if(p)p.innerHTML='<div class="shorts-upload-error">'+shortsIcon("plus")+'<span>'+shortsEscapeText(message)+'</span></div>';
 const b=$("#shorts-upload-submit");if(b){b.disabled=true;b.textContent="Исправь видео, чтобы продолжить";}
}
function shortsChooseFile(input,source="gallery"){
 const f=input?.files?.[0];if(!f)return;
 shortsDisposeUpload();
 if(input)input.value="";
 const allowed=/\.(mp4|mov|webm)$/i.test(f.name||"")||/^video\/(mp4|quicktime|webm)$/i.test(f.type||"");
 if(!allowed){shortsUploadError("Поддерживаются только MP4, MOV и WebM.");return;}
 if(f.size>100*1024*1024){shortsUploadError("Файл больше 100 МБ. Выбери видео меньшего размера.");return;}
 const fileUrl=URL.createObjectURL(f);
 shortsSelectedFile=f;shortsSelectedUrl=fileUrl;shortsUploadMeta=null;
 const p=$("#shorts-upload-preview"),info=$("#shorts-upload-file-info");
 if(p)p.innerHTML='<video id="shorts-upload-video" controls playsinline preload="metadata" src="'+fileUrl+'"></video>';
 const video=$("#shorts-upload-video");
 const button=$("#shorts-upload-submit");
 if(button){button.disabled=true;button.textContent="Подготавливаем видео…";}
 if(info)info.textContent=shortsFormatSize(f.size)+" · Определяем длительность…";
 if(!video){shortsUploadError("Не удалось открыть предпросмотр видео.");shortsDisposeUpload();return;}
 const fail=(message)=>{
  if(shortsSelectedUrl!==fileUrl)return;
  shortsDisposeUpload();
  shortsUploadError(message);
 };
 video.onloadedmetadata=()=>{
  if(shortsSelectedUrl!==fileUrl)return;
  const duration=Number(video.duration||0);
  if(!Number.isFinite(duration)||duration<=0){fail("Не удалось определить длительность видео. Выбери другой файл.");return;}
  const limit=shortsCaptureMode;
  if(duration>limit+.5){fail("Видео длиннее выбранного режима ("+shortsFormatDuration(limit)+"). Выбери более длинный режим.");return;}
  if(!video.videoWidth||!video.videoHeight){fail("Не удалось определить размер видео. Попробуй другой файл.");return;}
  const ratio=video.videoWidth/video.videoHeight,vertical=ratio>0&&ratio<.9;
  shortsUploadMeta={duration,width:video.videoWidth,height:video.videoHeight,vertical,limit,source};
  if(info)info.textContent=shortsFormatSize(f.size)+" · "+video.videoWidth+" × "+video.videoHeight+" · "+shortsFormatDuration(duration);
  if(!vertical&&p){const note=document.createElement("small");note.className="shorts-upload-ratio-note";note.textContent="Горизонтальное видео тоже можно опубликовать; вертикальный формат лучше подходит для Shorts.";p.appendChild(note);}
  if(button){button.disabled=false;button.textContent="Опубликовать видео";}
 };
 video.onerror=()=>fail("Не удалось открыть этот файл для предпросмотра. Попробуй другое видео.");
}
function shortsRemoveFile(){
 shortsDisposeUpload();
 ["#shorts-upload-camera","#shorts-upload-gallery"].forEach(selector=>{const input=$(selector);if(input)input.value="";});
 const p=$("#shorts-upload-preview");if(p)p.innerHTML='<div class="shorts-camera-hero">'+mascot("h")+'<b>Твой следующий Shorts начинается здесь</b><small>Сними ролик или выбери его из галереи</small></div>';
 const info=$("#shorts-upload-file-info");if(info)info.textContent="MP4, MOV или WebM · до 100 МБ";
 const b=$("#shorts-upload-submit");if(b){b.disabled=true;b.textContent="Сначала сними или выбери видео";}
}

function shortsChooseImage(input){
 const file=input?.files?.[0];if(!file)return;
 if(shortsSelectedImageUrl)URL.revokeObjectURL(shortsSelectedImageUrl);
 shortsSelectedImageUrl="";shortsSelectedImageFile=null;
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)){toast("Поддерживаются JPG, PNG и WebP.",false);input.value="";return;}
 if(file.size>15*1024*1024){toast("Фотография должна быть не больше 15 МБ.",false);input.value="";return;}
 shortsSelectedImageFile=file;shortsSelectedImageUrl=URL.createObjectURL(file);
 const preview=$("#shorts-image-preview");if(preview)preview.innerHTML='<div class="shorts-image-preview-wrap"><img class="shorts-image-preview" src="'+shortsSelectedImageUrl+'" alt="Предпросмотр фотографии"></div>';
 const button=$("#shorts-image-submit");if(button){button.disabled=false;button.textContent="Опубликовать фото";}
 input.value="";
}
function shortsTextCount(){const field=$("#shorts-text-content"),counter=$("#shorts-text-count"),button=$("#shorts-text-submit");const length=String(field?.value||"").trim().length;if(counter)counter.textContent=String(field?.value||"").length+" / 500";if(button)button.disabled=length<1;}
async function shortsSubmitImage(){
 if(!shortsSelectedImageFile){toast("Сначала выбери фотографию.",false);return;}
 if(!S.user||S.user.guest){toast("Войди в аккаунт, чтобы опубликовать фото.",false);return;}
 const file=shortsSelectedImageFile,caption=String($("#shorts-image-caption")?.value||"").trim(),button=$("#shorts-image-submit");
 if(button){button.disabled=true;button.textContent="Готовим фото…";}
 try{
  const started=await authRequest("shorts-upload-start",{payload:{mediaType:"image",fileName:file.name,mimeType:file.type||(/\\.png$/i.test(file.name)?"image/png":/\\.webp$/i.test(file.name)?"image/webp":"image/jpeg"),sizeBytes:file.size,caption,durationSeconds:0}});
  const ticket=started?.result;if(!ticket?.signedUrl||!ticket?.publishableKey||!ticket?.contentUrl)throw new Error("Сервер не подготовил защищённую загрузку.");
  if(button)button.textContent="Загружаем фото…";
  const uploadUrl=new URL(ticket.signedUrl,ticket.contentUrl).toString();
  const response=await fetch(uploadUrl,{method:"PUT",headers:{apikey:ticket.publishableKey,Authorization:"Bearer "+ticket.publishableKey,"Content-Type":file.type||"application/octet-stream","x-upsert":"false"},body:file});
  if(!response.ok)throw new Error("Не удалось загрузить фотографию.");
  if(button)button.textContent="Проверяет Cloudy AI…";
  const finalized=await authRequest("shorts-upload-image-finalize",{payload:{videoId:ticket.videoId}});
  const published=finalized?.result?.published===true;
  await shortsLoadFeed(true);
  if(published){toast("Фотография опубликована в Shorts!");shortsDisposeUpload();closeSh();}
  else{if(button){button.disabled=true;button.textContent="Отправлено на проверку";}toast("Фото ожидает проверки Cloudy AI или модератора.");}
 }catch(error){if(button){button.disabled=false;button.textContent="Повторить загрузку";}toast(error.message||"Не удалось опубликовать фото.",false);}
}
async function shortsSubmitTextPost(){
 const text=String($("#shorts-text-content")?.value||"").trim(),button=$("#shorts-text-submit");
 if(!text){toast("Добавь текст публикации.",false);return;}
 if(!S.user||S.user.guest){toast("Войди в аккаунт, чтобы опубликовать текст.",false);return;}
 if(button){button.disabled=true;button.textContent="Проверяет Cloudy AI…";}
 try{
  const response=await authRequest("shorts-text-create",{payload:{caption:text}});
  await shortsLoadFeed(true);
  const result=response?.result||{};
  if(result.published){toast("Текстовая публикация добавлена в Shorts!");shortsDisposeUpload();closeSh();}
  else{if(button){button.disabled=true;button.textContent="Отправлено на проверку";}toast("Публикация ожидает проверки Cloudy AI или модератора.");}
 }catch(error){if(button){button.disabled=false;button.textContent="Повторить";}toast(error.message||"Не удалось опубликовать текст.",false);}
}
async function shortsSubmitUpload(){
 if(!shortsSelectedFile){toast("Сначала выбери видео.",false);return;}
 const caption=String($("#shorts-upload-caption")?.value||"").trim();
 if(!caption){toast("Добавь описание видео.",false);$("#shorts-upload-caption")?.focus();return;}
 if(!S.user||S.user.guest){toast("Войди в аккаунт, чтобы отправить видео на проверку.",false);return;}
 if(!shortsUploadMeta||!Number.isFinite(shortsUploadMeta.duration)||shortsUploadMeta.duration<=0){toast("Дождись окончания подготовки предпросмотра видео.",false);return;}
 const file=shortsSelectedFile,button=$("#shorts-upload-submit"),notice=document.querySelector(".shorts-ai-notice");
 if(button){button.disabled=true;button.textContent="Готовим защищённую загрузку…";}
 if(notice)notice.innerHTML='<span class="shorts-ai-cloud">'+mascot("h")+'</span><div><b>Подготавливаем загрузку</b><small>Проверяем аккаунт и создаём приватный черновик. После проверки 18+ видео сразу появится в общей ленте.</small></div>';
 try{
  const started=await authRequest("shorts-upload-start",{payload:{fileName:file.name,mimeType:file.type||(/\.webm$/i.test(file.name)?"video/webm":/\.mov$/i.test(file.name)?"video/quicktime":"video/mp4"),sizeBytes:file.size,caption,durationSeconds:Math.max(1,Math.round(shortsUploadMeta.duration))}});
  const ticket=started?.result;
  if(!ticket?.signedUrl||!ticket?.publishableKey||!ticket?.contentUrl||!ticket?.token)throw new Error("Сервер не выдал защищённую ссылку для загрузки.");
  if(button)button.textContent="Загружаем видео…";
  if(notice)notice.querySelector("small").textContent="Загружаем видео в приватное хранилище. Не закрывай это окно.";
  const uploadUrl=new URL(ticket.signedUrl,ticket.contentUrl).toString();
  
  const response=await fetch(uploadUrl,{method:"PUT",headers:{"apikey":ticket.publishableKey,"Authorization":"Bearer "+ticket.publishableKey,"Content-Type":file.type||"video/mp4","x-upsert":"false"},body:file});
  if(!response.ok){let detail="";try{detail=(await response.json()).message||"";}catch{}throw new Error(detail||"Не удалось загрузить видео в защищённое хранилище.");}
  if(button)button.textContent="Отправляем на проверку…";
  const finalized=await authRequest("shorts-upload-finalize",{payload:{videoId:ticket.videoId}});
  if(!finalized?.result?.ok)throw new Error("Не удалось подтвердить загрузку видео.");
  const published=finalized.result.published===true;
  await shortsLoadFeed(true);
  shortsRemoveFile();
  const captionField=$("#shorts-upload-caption");if(captionField)captionField.value="";shortsCaptionCount();
  if(notice)notice.innerHTML='<span class="shorts-ai-cloud">'+mascot("h")+'</span><div><b>'+(published?"Видео опубликовано в Shorts":"Видео ожидает проверки 18+")+'</b><small>'+(published?"Ролик уже доступен в общей ленте. Дополнительная ручная проверка может пройти позже.":"Cloudy AI обнаружил явный контент 18+. Видео осталось приватным и передано модератору.")+'</small></div>';
  if(button){button.disabled=true;button.textContent=published?"Опубликовано":"Ожидает проверки 18+";}
  toast(published?"Видео опубликовано в ленте Shorts!":"Видео осталось приватным и отправлено на проверку.");
 }catch(error){
  const message=error?.message||"Не удалось отправить видео.";
  if(notice)notice.innerHTML='<span class="shorts-ai-cloud">'+mascot("h")+'</span><div><b>Не удалось отправить видео</b><small>'+String(message).replace(/[&<>"']/g,"")+'</small></div>';
  if(button){button.disabled=false;button.textContent="Повторить загрузку";}
  toast(message,false);
 }
}


/**
 * Receives the File produced by the original full-screen Shorts publishing HTML.
 * The event is cancelled synchronously so its demo/fallback publisher never runs.
 */
let shortsExternalPublishInProgress=false;
async function shortsPublishExternal(detail){
 const file=detail?.file,type=detail?.type==="video"?"video":"image";
 if(!file||typeof file.size!=="number"||file.size<1||typeof file.slice!=="function")throw new Error("Не удалось получить выбранный файл.");
 if(!S.user||S.user.guest)throw new Error("Войди в аккаунт, чтобы опубликовать Shorts.");
 const image=type==="image",caption=String(detail?.caption||"").trim().slice(0,500);
 const fallbackMime=image?"image/jpeg":(/\.mov$/i.test(file.name||"")?"video/quicktime":/\.webm$/i.test(file.name||"")?"video/webm":"video/mp4");
 const mimeType=String(file.type||fallbackMime).toLowerCase();
 const allowed=image?["image/jpeg","image/png","image/webp"]:["video/mp4","video/webm","video/quicktime"];
 const maxBytes=image?15*1024*1024:100*1024*1024;
 if(!allowed.includes(mimeType))throw new Error(image?"Поддерживаются JPG, PNG и WebP.":"Поддерживаются MP4, MOV и WebM.");
 if(file.size>maxBytes)throw new Error(image?"Фотография должна быть не больше 15 МБ.":"Видео должно быть не больше 100 МБ.");
 const progress=value=>{try{const frame=shortsFlowFrame?.contentWindow;if(typeof frame?.cloudyPublishProgress==="function")frame.cloudyPublishProgress(value);}catch(_){}};
 progress(3);
 const started=await authRequest("shorts-upload-start",{payload:{
  mediaType:image?"image":"video",
  fileName:String(file.name|| (image?"cloudy-short.jpg":"cloudy-short.mp4")).slice(0,180),
  mimeType,sizeBytes:file.size,caption,
  durationSeconds:image?0:Math.max(0,Math.round(Number(detail?.durationSeconds||detail?.duration||0)))
 }});
 const ticket=started?.result;
 if(!ticket?.signedUrl||!ticket?.publishableKey||!ticket?.contentUrl||!ticket?.videoId||!ticket?.token)throw new Error("Сервер не подготовил защищённую загрузку.");
 progress(12);
 const uploadUrl=new URL(ticket.signedUrl,ticket.contentUrl).toString();
 const response=await fetch(uploadUrl,{method:"PUT",headers:{apikey:ticket.publishableKey,Authorization:"Bearer "+ticket.publishableKey,"Content-Type":mimeType,"x-upsert":"false"},body:file});
 if(!response.ok){let message="";try{message=(await response.json()).message||"";}catch(_){}throw new Error(message||"Не удалось загрузить файл в защищённое хранилище.");}
 progress(78);
 const finalized=await authRequest(image?"shorts-upload-image-finalize":"shorts-upload-finalize",{payload:{videoId:ticket.videoId}});
 if(!finalized?.result?.ok)throw new Error("Не удалось завершить публикацию.");
 progress(100);
 try{await shortsLoadFeed(true);}catch(feedError){console.warn("[cloudy-shorts] feed refresh after publish failed",feedError);}
 try{const frame=shortsFlowFrame?.contentWindow;if(typeof frame?.cloudyPublishDone==="function")frame.cloudyPublishDone(finalized.result);}catch(_){}
 toast(finalized.result.published?(image?"Фотография опубликована в Shorts!":"Видео опубликовано в Shorts!"):"Публикация отправлена на проверку Cloudy AI.");
 return finalized.result;
}
if(!window.__cloudyShortsPublishBridge){
 window.__cloudyShortsPublishBridge=true;
 window.addEventListener("cloudy:publish",event=>{
  const detail=event?.detail;
  if(!detail?.file)return;
  event.preventDefault();
  if(shortsExternalPublishInProgress)return;
  shortsExternalPublishInProgress=true;
  shortsPublishExternal(detail).catch(error=>{
   const message=error?.message||"Не удалось опубликовать Shorts.";
   try{const frame=shortsFlowFrame?.contentWindow;if(typeof frame?.cloudyPublishError==="function")frame.cloudyPublishError(message);}catch(_){}
   toast(message,false);
   console.warn("[cloudy-shorts] external publish failed",error);
  }).finally(()=>{shortsExternalPublishInProgress=false;});
 });
}


let communityProfile=null,communityProfileUser=null,communityProfileLoading=false,communityProfileSaving=false,communityProfileError="";
let privacyCenter=null,privacyCenterUser=null,privacyCenterLoading=false,privacyCenterSaving=false;
let communityFeed=[],communityFeedLoading=false,communityFeedUser=null,communityPostSaving=false;
let communityInteractions={comments:[],reactions:[]},communityInteractionsLoading=false;
function formatCommunityDate(value){const d=new Date(value);return Number.isNaN(d.getTime())?"":d.toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"});}
async function loadCommunityFeed(force=false){
 if(!S.user||S.user.guest||!communityProfile?.is_public)return;
 const uid=S.user.id;if(communityFeedLoading||(!force&&communityFeedUser===uid))return;
 communityFeedLoading=true;
 try{const response=await authRequest("community-feed-get");if(S.user?.id!==uid)return;communityFeed=Array.isArray(response.result)?response.result:[];communityFeedUser=uid;void loadCommunityInteractions();}
 catch(error){communityFeedUser=uid;toast(error.message||"Не удалось загрузить ленту.",false);}
 finally{communityFeedLoading=false;if(S.user?.id===uid&&T===4)view(0);}
}
async function loadCommunityInteractions(){
 const ids=communityFeed.filter(post=>post.status==="published").map(post=>post.id);if(!ids.length){communityInteractions={comments:[],reactions:[]};return;}
 if(communityInteractionsLoading)return;communityInteractionsLoading=true;const uid=S.user?.id;
 try{const response=await authRequest("community-interactions-get",{payload:{postIds:ids}});if(S.user?.id!==uid)return;communityInteractions={comments:Array.isArray(response.result?.comments)?response.result.comments:[],reactions:Array.isArray(response.result?.reactions)?response.result.reactions:[]};}
 catch(error){toast(error.message||"Не удалось загрузить комментарии.",false);}
 finally{communityInteractionsLoading=false;if(S.user?.id===uid&&T===4)view(0);}
}
async function createCommunityComment(postId){
 const field=$("#community-comment-"+postId),body=String(field?.value||"").trim();if(!body||body.length>1000)return;
 try{await authRequest("community-comment-create",{payload:{postId,body}});await loadCommunityInteractions();toast("Комментарий добавлен.");}
 catch(error){toast(error.message||"Не удалось добавить комментарий.",false);}
}
async function deleteCommunityComment(commentId){
 if(!confirm("Удалить комментарий?"))return;
 try{await authRequest("community-comment-delete",{payload:{commentId}});await loadCommunityInteractions();toast("Комментарий удалён.");}
 catch(error){toast(error.message||"Не удалось удалить комментарий.",false);}
}
async function toggleCommunityReaction(postId){
 try{await authRequest("community-reaction-toggle",{payload:{postId}});await loadCommunityInteractions();}
 catch(error){toast(error.message||"Не удалось изменить реакцию.",false);}
}
async function reportCommunityContent(type,id){
 const reasonText=prompt("Причина жалобы: спам, травля, личные данные, неподходящий контент или другое","спам");if(!reasonText)return;
 const normalized=reasonText.trim().toLowerCase();
 const reason=normalized.includes("трав")||normalized.includes("harass")?"harassment":normalized.includes("лич")||normalized.includes("персон")?"personal_data":normalized.includes("спам")||normalized.includes("spam")?"spam":normalized.includes("непод")||normalized.includes("inappropriate")?"inappropriate":"other";
 const details=prompt("Дополнительные сведения (необязательно)","")||"";
 try{await authRequest("community-report-create",{payload:{[type==="post"?"postId":"commentId"]:id,reason,details}});toast("Жалоба отправлена. Спасибо за помощь в поддержании безопасного сообщества.");}
 catch(error){toast(error.message||"Не удалось отправить жалобу.",false);}
}
async function createCommunityPost(){
 const field=$("#community-post-body"),body=String(field?.value||"").trim();
 if(!body||body.length>2000||communityPostSaving)return;
 communityPostSaving=true;
 try{await authRequest("community-post-create",{payload:{body}});communityFeedUser=null;await loadCommunityFeed(true);toast("Публикация добавлена.");}
 catch(error){toast(error.message||"Не удалось опубликовать запись.",false);}
 finally{communityPostSaving=false;if(T===4)view(0);}
}
async function deleteCommunityPost(id){
 if(!/^[0-9a-f-]{36}$/i.test(String(id)))return;
 if(!confirm("Удалить публикацию? Это действие нельзя отменить."))return;
 try{await authRequest("community-post-delete",{payload:{postId:id}});communityFeedUser=null;await loadCommunityFeed(true);toast("Публикация удалена.");}
 catch(error){toast(error.message||"Не удалось удалить публикацию.",false);}
}

async function loadCommunityProfile(force=false){
 if(!S.user||S.user.guest)return;
 const uid=S.user.id;if(communityProfileLoading||(!force&&communityProfileUser===uid))return;
 communityProfileLoading=true;communityProfileError="";
 try{const result=await authRequest("community-profile-get");if(S.user?.id!==uid)return;communityProfile={is_public:result.result?.is_public===true,bio:String(result.result?.bio||"").slice(0,240)};communityProfileUser=uid;communityFeedUser=null;communityFeed=[];communityInteractions={comments:[],reactions:[]};}
 catch(error){communityProfile=null;communityProfileUser=uid;communityProfileError=error.message||"Не удалось загрузить настройки публичного профиля.";toast(communityProfileError,false);}
 finally{communityProfileLoading=false;if(S.user?.id===uid){if(T===3)refreshProfileContent();if(T===4){view(0);if(communityProfile?.is_public)void loadCommunityFeed();}}}
}
async function saveCommunityProfile(patch){
 if(!S.user||S.user.guest||!communityProfile||communityProfileSaving)return;
 const uid=S.user.id;const next={...communityProfile,...patch};communityProfileSaving=true;
 try{const response=await authRequest("community-profile-update",{payload:{is_public:next.is_public,bio:next.bio}});if(S.user?.id!==uid)return;communityProfile={is_public:response.result?.is_public===true,bio:String(response.result?.bio||"").slice(0,240)};toast("Настройки профиля сохранены.");}
 catch(error){toast(error.message||"Не удалось сохранить профиль.",false);}
 finally{communityProfileSaving=false;if(S.user?.id===uid&&T===3)refreshProfileContent();}
}
function toggleCommunityPublic(){if(!communityProfile)return;snd("tap");void saveCommunityProfile({is_public:!communityProfile.is_public});}
function saveCommunityBio(value){if(!communityProfile)return;const bio=String(value||"").trim().slice(0,240);if(bio===communityProfile.bio)return;void saveCommunityProfile({bio});}
async function loadPrivacyCenter(force=false){
 if(!S.user||S.user.guest)return;
 const uid=S.user.id;if(privacyCenterLoading||(!force&&privacyCenterUser===uid))return;
 privacyCenterLoading=true;
 try{const response=await authRequest("privacy-center-get");if(S.user?.id!==uid)return;privacyCenter=response.result||{aiTrainingConsent:false,requests:[]};privacyCenterUser=uid;}
 catch(error){privacyCenter={error:error.message||"Не удалось загрузить настройки конфиденциальности.",aiTrainingConsent:false,requests:[]};privacyCenterUser=uid;}
 finally{privacyCenterLoading=false;if(S.user?.id===uid&&T===3)refreshProfileContent();}
}
function privacyCenterCard(){
 if(!S.user||S.user.guest)return '<div class="card"><h3>Конфиденциальность</h3><p>Войдите в аккаунт, чтобы управлять согласиями и запросами по персональным данным.</p></div>';
 const loading=privacyCenterLoading||!privacyCenter||privacyCenterUser!==S.user.id;
 const enabled=privacyCenter?.aiTrainingConsent===true;
 const requests=Array.isArray(privacyCenter?.requests)?privacyCenter.requests:[];
 const status={received:"Получен",verifying:"Проверяется",in_progress:"В работе",completed:"Завершён",declined:"Отклонён"};
 const types={access_export:"Доступ / экспорт данных",correction:"Исправление данных",deletion:"Удаление аккаунта и данных",withdraw_optional_consent:"Отзыв необязательного согласия"};
 return '<div class="card privacy-center-card"><h3>Конфиденциальность и данные</h3><p>Обязательная обработка для работы приложения отделена от необязательного использования переписок для улучшения ИИ.</p><div class="row"><span>Разрешить использовать мои диалоги для дополнительного улучшения ИИ</span><button class="sw '+(enabled?'on':'')+'" type="button" aria-label="Согласие на дополнительное использование диалогов для улучшения ИИ" aria-pressed="'+(enabled?'true':'false')+'" '+(loading||privacyCenterSaving?'disabled':'')+' onclick="toggleAiTrainingConsent()"><i></i></button></div><small>По умолчанию выключено. Отказ не ограничивает обычную работу Cloudy AI. Изменение сохраняется в истории согласий.</small>'+
 (privacyCenter?.error?'<p>'+examEscape(privacyCenter.error)+'</p>':'')+
 '<div class="privacy-request-actions"><button class="btn ghost" type="button" '+(loading||privacyCenterSaving?'disabled':'')+' onclick="downloadPrivacyData()">Скачать копию данных</button><button class="btn ghost" type="button" '+(loading?'disabled':'')+' onclick="submitPrivacyRequest(\'correction\')">Исправить данные</button><button class="btn ghost" type="button" '+(loading?'disabled':'')+' onclick="submitPrivacyRequest(\'deletion\')">Запросить удаление данных</button></div>'+
 '<small>Копия включает данные из основной базы Cloudy English. Данные внешних поставщиков и отдельных инфраструктурных проектов могут потребовать отдельного запроса в поддержку. Запрос на удаление отправляется на рассмотрение и не удаляет аккаунт автоматически.</small>'+
 (requests.length?'<div class="privacy-request-list"><b>Мои запросы</b>'+requests.map(r=>'<div><span>'+examEscape(types[r.type]||r.type)+'</span><small>'+examEscape(status[r.status]||r.status)+' · '+examEscape(new Date(r.createdAt).toLocaleDateString("ru-RU"))+'</small></div>').join("")+'</div>':'')+
 '</div>';
}
async function downloadPrivacyData(){
 if(privacyCenterSaving)return;
 privacyCenterSaving=true;
 try{
  const response=await authRequest("privacy-data-export");
  if(response.result?.ok!==true||!response.result?.data)throw new Error("Не удалось сформировать копию данных.");
  const blob=new Blob([JSON.stringify(response.result.data,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="cloudy-personal-data-"+new Date().toISOString().slice(0,10)+".json";
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast("Копия данных подготовлена и скачивается.");
  await loadPrivacyCenter(true);
 }catch(error){toast(error.message||"Не удалось скачать данные.",false);}
 finally{privacyCenterSaving=false;if(T===3)view(0);}
}
async function toggleAiTrainingConsent(){
 if(privacyCenterSaving||!privacyCenter)return;
 const next=privacyCenter.aiTrainingConsent!==true;
 if(!confirm(next?'Разрешить дополнительное использование ваших диалогов для улучшения ИИ? Это необязательно, согласие можно отозвать.':'Отозвать согласие на дополнительное использование диалогов для улучшения ИИ?'))return;
 privacyCenterSaving=true;
 try{const response=await authRequest("privacy-consent-set",{payload:{enabled:next}});if(response.result?.ok!==true)throw new Error("Не удалось сохранить согласие.");privacyCenter={...privacyCenter,aiTrainingConsent:next};toast(next?'Согласие сохранено.':'Согласие отозвано.');}
 catch(error){toast(error.message||"Не удалось изменить согласие.",false);}
 finally{privacyCenterSaving=false;if(T===3)view(0);}
}
async function submitPrivacyRequest(type){
 if(!["access_export","correction","deletion"].includes(type))return;
 let details="";
 if(type==="correction"){details=String(prompt("Опишите, какие данные нужно исправить:")||"").trim();if(!details)return;if(details.length>2000){toast("Описание не должно превышать 2 000 символов.",false);return;}}
 if(type==="deletion"&&!confirm("Отправить запрос на удаление аккаунта и связанных данных? Это только заявка: аккаунт не будет удалён автоматически."))return;
 try{const response=await authRequest("privacy-request-create",{payload:{requestType:type,details}});if(response.result?.ok!==true)throw new Error("Не удалось отправить запрос.");toast("Запрос отправлен. Сохраните его статус в разделе конфиденциальности.");await loadPrivacyCenter(true);}
 catch(error){toast(error.message||"Не удалось отправить запрос.",false);}
}
function prof(){if(S.user&&!S.user.guest&&privacyCenterUser!==S.user.id&&!privacyCenterLoading)void loadPrivacyCenter();const g=Math.max(1,Number(S.set.goal)||30),C=2*Math.PI*40,p=Math.min(Math.max(0,Number(S.td.xp)||0)/g,1),s=S.set,a=S.acc[1]?Math.round(S.acc[0]/S.acc[1]*100):0;
 
 const sw=k=>`<button class="sw ${s[k]?"on":""}" onclick="tg(this,'${k}')"><i></i></button>`;
 return `<div class="pg-head"><h2>Профиль</h2><button class="hud-gear" aria-label="Настройки" onclick="CloudyUI.open()">${ic("gear")}</button></div><div class="hero"><div class="hero-ms">${mascot()}</div><div class="hero-t"><h2>${S.user.name||'Ученик'}</h2><p>${S.user.email||'Режим гостя'}</p><span class="lc ${S.lv}">${S.lv}</span></div></div><button class="menu-card" onclick="CloudyUI.open()"><span class="mc-ic">${ic("gear")}</span><span class="mc-t"><b>Настройки</b><small>Шрифт, язык, анимации, звук</small></span><i>›</i></button>
 <div class="grid">${[["flame",S.streak,"дней подряд"],["bolt",S.xp,"XP всего"],["check",Object.values(S.dn).reduce((a,b)=>a+b,0),"уроков"],["target",a+"%","точность"]].map(([i,v,l])=>`<div class="card">${ic(i)}<div><b>${v}</b><small>${l}</small></div></div>`).join("")}</div>
 <div class="card"><div class="goal"><svg class="gr" viewBox="0 0 100 100"><circle class="t" cx="50" cy="50" r="40"/><circle class="p" cx="50" cy="50" r="40" style="--c:${C};stroke-dasharray:${C};stroke-dashoffset:${C*(1-p)}"/></svg><div><b>Цель на сегодня</b><br><small style="opacity:.8">${Math.min(S.td.xp,g)} из ${g} XP</small></div></div><div class="seg">${[10,20,30,50].map(n=>`<button class="${g==n?"on":""}" onclick="goal(${n})">${n}</button>`).join("")}</div></div>
 ${cal()}${!S.user?.guest?`<div class="card community-profile-settings"><div class="community-settings-head"><div><h3>Публичный профиль</h3><small>Управляйте тем, что смогут увидеть другие участники</small></div><span class="community-private-pill">${communityProfile?.is_public?"Открыт":"Закрыт"}</span></div><div class="row"><span>Показывать мой профиль</span><button class="sw ${communityProfile?.is_public?"on":""}" type="button" aria-label="Публичный профиль" aria-pressed="${communityProfile?.is_public?"true":"false"}" ${communityProfile===null||communityProfileSaving?"disabled":""} onclick="toggleCommunityPublic()"><i></i></button></div><p class="community-privacy-note">${communityProfile?.is_public?"Ваше имя и описание видны в сообществе. Email, возраст и учебный прогресс не публикуются.":"Профиль скрыт. Другие участники не увидят его в сообществе."}</p><label class="community-bio-label" for="community-bio">О себе <small>до 240 символов</small></label><textarea id="community-bio" class="community-bio-input" maxlength="240" placeholder="Расскажите немного о своём изучении английского" ${communityProfile===null||communityProfileSaving?"disabled":""} onblur="saveCommunityBio(this.value)">${examEscape(communityProfile?.bio||"")}</textarea><small class="community-settings-foot">Публичность выключена по умолчанию. Изменения можно отменить в любой момент.</small></div>`:`<div class="card"><h3>Публичный профиль</h3><p>Войдите в аккаунт, чтобы настроить профиль сообщества.</p></div>`}${privacyCenterCard()}<div class="card"><h3>Аккаунт</h3><div class="row"><span>${S.user.guest?'Режим гостя':S.user.email}</span></div><div class="row"><span>Возраст</span><span>${Number.isInteger(Number(S.user.age))&&Number(S.user.age)>=13&&Number(S.user.age)<=120?Number(S.user.age)+' лет':'Не указан'}</span><a class="btn ghost sm" href="https://t.me/cloudysupportt_bot" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center">ИЗМЕНИТЬ</a></div><button class="btn ghost" onclick="Auth.signOut().then(()=>view()).catch(e=>toast(e.message||'Не удалось выйти из аккаунта. Попробуйте ещё раз.',false))">${S.user.guest?'ВОЙТИ ИЛИ РЕГИСТРАЦИЯ':'ВЫЙТИ'}</button></div>${(!S.user?.guest&&(S.user?.isAdmin===true||String(S.user?.email||"").trim().toLowerCase()==="lajonlipcik@gmail.com"))?`<div class="card"><h3>Управление приложением</h3><p style="opacity:.8;margin:0 0 14px">Пользователи и AI-провайдеры</p><button class="btn" type="button" onclick="if(window.CloudyAdmin&&typeof window.CloudyAdmin.open==='function'){window.CloudyAdmin.open(S.user)}else{alert('Модуль админ-панели не загрузился. Обновите страницу.')}">⚙ Админ-панель</button></div>`:""}<div class="card"><h3>Уровень английского</h3><div class="seg">${LVS.map(l=>`<button class="${S.lv==l?"on":""}" onclick="setLv('${l}')">${l}</button>`).join("")}</div><br><button class="btn" onclick="pt('${S.lv}')">ПРОЙТИ ТЕСТ УРОВНЯ</button></div><div class="card"><h3>Помощь и документы</h3><p style="opacity:.8;margin:0 0 14px">Правила, конфиденциальность и поддержка Cloudy English</p><button class="btn ghost" type="button" onclick="window.parent.location.href='/legal'">ДОКУМЕНТЫ И ПОДДЕРЖКА</button></div>`}
function requestAgeChange(){window.open('https://t.me/cloudysupportt_bot','_blank','noopener')}
function tg(el,k){S.set[k]=S.set[k]?0:1;el.classList.toggle("on");save();snd("tap");if(k=="rem"&&S.set.rem)try{Notification.requestPermission()}catch(e){}}
function goal(n){S.set.goal=n;save();snd("pick");view(0)}
function rst(){sheet(`<h3>Сбросить прогресс?</h3><p style="opacity:.85">Уроки, XP и серия обнулятся. Настройки сохранятся.</p><button class="btn" onclick="doRst()">СБРОСИТЬ</button><br><br><button class="btn" onclick="closeSh()">ОТМЕНА</button>`)}
function doRst(){const s=S.set;S=DEF();S.set=s;save();closeSh();T=0;view()}

bootCloudy();
