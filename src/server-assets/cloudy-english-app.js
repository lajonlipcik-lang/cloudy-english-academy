
const { D, LV, ALL, P } = window.CloudyCatalog;
let SEC=[];
const DEF=()=>({xp:0,streak:0,last:"",done:0,lv:"",dn:{A1:0,A2:0,B1:0,B2:0},acc:[0,0],mis:{},days:[],ach:[],wk:{k:"",xp:0},perf:0,tested:0,user:null,set:{snd:1,vol:.7,voice:1,goal:30,mic:1,th:"dark",rem:0,remT:"19:00"},td:{d:"",xp:0,les:0,ok:0,claim:0}});
let S=DEF(),T=0;
let KEY="cl2";
const ls=(k,v)=>{try{return v===undefined?localStorage.getItem(k):localStorage.setItem(k,v)}catch(e){return null}};
function load(key){KEY=key;S=DEF();try{const j=JSON.parse(ls(key)||"{}");S=Object.assign(DEF(),j);S.set=Object.assign(DEF().set,j.set);S.td=Object.assign(DEF().td,j.td);S.dn=Object.assign(DEF().dn,j.dn);if(!j.dn&&j.done&&j.lv===undefined){S.dn.A1=j.done;S.lv="A1"}if(!["A1","A2","B1","B2"].includes(S.lv))S.lv=""}catch(e){}}
load(ls("cl2s")?"cl2:"+ls("cl2s"):"cl2");
let cloudUserId=null,cloudSyncTimer=0,cloudSyncRetry=0,cloudSyncInFlight=null,cloudSyncPending=null,cloudSyncSeq=0,cloudLocalRevision=0,cloudSyncAttempts=0,cloudUpdatedAt=null,cloudSyncPaused=false,cloudBaseState=null;
// Embedded mode waits for the parent bridge; direct/PWA mode has no parent session to await.
let sessionHydrating=window.parent!==window;
let sessionHydrationTimer=0;
let cloudProgressPending=false;
function cloudLoader(){app.innerHTML=`<div style="min-height:100svh;display:grid;place-items:center;background:var(--bg,#0b1020);color:var(--text,#fff);font:600 15px system-ui"><div style="text-align:center"><div style="font-size:42px;margin-bottom:12px">☁️</div>Загружаем твой прогресс…</div></div>`}
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
const requestCloudSession=()=>{if(cloudUserId&&!S.user?.guest&&cloudSyncPaused)window.parent.postMessage({channel:'cloudy-auth',type:'init'},location.origin)};
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
  const u=new SpeechSynthesisUtterance(text);u.lang="en-US";u.rate=.92;
  const voices=speechSynthesis.getVoices(),male=cloudySelectMaleAmericanVoice(voices);if(male)u.voice=male;
  speechSynthesis.speak(u);
 }catch(e){}
}
async function say(t,f){
 if(!f&&!S.set.voice)return;
 const text=String(t||"").replace(/\s+/g," ").trim();if(!text)return;
 const request=++cloudySpeechRequest;
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
function closeSh(){const s=$(".sb");if(!s)return;s.classList.add("out");setTimeout(()=>s.remove(),300)}
const nav=()=>`<nav>${["Учёба","Задания","Лига","Профиль"].map((n,k)=>`<button class="${T==k?"on":""}" onclick="tab(${k})">${ic(["home","target","medal","user"][k])}<span>${n}</span></button>`).join("")}</nav>`;

const isAppleMobile=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isInstalledCloudy=()=>window.navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches;
function renderInstallGate(){
 const safari=/Safari/i.test(navigator.userAgent)&&!/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/i.test(navigator.userAgent);
 app.innerHTML=`<div class="install-gate"><section class="install-panel"><div class="install-cloud">${mascot()}</div><h1 class="install-title">Давай установим Cloudy!</h1><p class="install-lead">Добавь Cloudy на главный экран iPhone — и открывай его как настоящее приложение. Это займёт всего несколько секунд ☁️</p><div class="install-steps"><div class="install-step"><span class="install-number">1</span><div><strong>Нажми «Поделиться»</strong><small>${safari?'Внизу Safari нажми квадрат со стрелкой вверх.':'Открой этот сайт в Safari, затем нажми квадрат со стрелкой вверх.'}</small></div><span class="install-share-icon" aria-hidden="true">↥</span></div><div class="install-step"><span class="install-number">2</span><div><strong>Выбери «На экран Домой»</strong><small>Прокрути меню вниз, выбери этот пункт и оставь включённым «Открывать как веб-приложение», если появится переключатель.</small></div><span class="install-share-icon">＋</span></div><div class="install-step"><span class="install-number">3</span><div><strong>Нажми «Добавить»</strong><small>Затем вернись на главный экран и открой иконку Cloudy.</small></div><span class="install-share-icon">☁️</span></div></div><p class="install-note" id="installNote">${safari?'После добавления открой Cloudy именно с главного экрана iPhone.':'Для установки потребуется Safari. Встроенный браузер приложения не поддерживает этот способ.'}</p><button class="install-action" onclick="checkCloudyInstall()">Я добавил Cloudy — проверить</button><span class="install-browser">Cloudy English · Твой путь к английскому</span></section></div>`;
}
function checkCloudyInstall(){if(isInstalledCloudy()){try{localStorage.setItem('cloudyHomeInstalled','1')}catch(e){}view();return}const note=$('#installNote');if(note)note.textContent='Пока Cloudy открыт во вкладке Safari. Вернись на главный экран iPhone и запусти Cloudy с новой иконки — тогда установка подтвердится.';const panel=$('.install-panel');if(panel){panel.classList.remove('shk');void panel.offsetWidth;panel.classList.add('shk')}}
function ensureCloudyInstallGate(){if(!isAppleMobile()||isInstalledCloudy())return;if(!document.querySelector('#app .install-gate'))renderInstallGate()}
function bootCloudy(){if(isAppleMobile()&&!isInstalledCloudy()){renderInstallGate();setInterval(ensureCloudyInstallGate,20000);window.addEventListener('pageshow',ensureCloudyInstallGate);window.addEventListener('focus',ensureCloudyInstallGate);document.addEventListener('visibilitychange',()=>{if(!document.hidden)ensureCloudyInstallGate()});return}if(sessionHydrating){cloudLoader();return}view()}
function view(a=1){roll();amb();if(!S.user){remoteLearningProfile=null;remoteLearningProfileUser=null;return authV()}if(!S.lv){if(!S.user.guest&&cloudProgressPending)return cloudLoader();return welcome()}SEC=LV[S.lv].s;app.innerHTML=`<div class="scr${a?"":" na"}">${[learn,quests,lg,prof][T]()}</div>`+nav();if(T===0)void loadRemoteLearningProfile()}
function tab(k){if(k!=T){snd("tab");T=k;view()}}
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
 cloudUserId=msg.user.id;
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
 cloudSyncPaused=false;queueCloudProgress();
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
  }else if(msg.ok===false){cloudSyncPaused=true;cloudUserId=null;toast(msg.error||'Не удалось проверить аккаунт. Проверьте соединение и попробуйте снова.',false);view()}else{cloudSyncPaused=false;cloudUserId=null;ls('cl2s','');load('cl2');S.user=null;view()}
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
 guest(){ls('cl2s','');load('cl2');S.user={guest:1,name:'Гость',age:null};save();window.CloudyAdmin?.setUser(S.user)},
 async signOut(){await authRequest('signOut');cloudUserId=null;cloudUpdatedAt=null;cloudSyncPending=null;cloudSyncInFlight=null;clearTimeout(cloudSyncTimer);clearTimeout(cloudSyncRetry);cloudSyncRetry=0;ls('cl2s','');load('cl2');S.user=null;window.CloudyAdmin?.setUser(null)}
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
let AM='in',busy=0,CH=[],SM=null;
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
 return `<h2 style="margin-top:12px">Лига: ${c[0]}</h2><div class="card lgc"><span class="mdl" style="color:${LC[li]}">${ic('medal')}</span><div style="flex:1"><b>${nx?'До лиги '+nx[0]+': '+(nx[1]-S.xp)+' XP':'Максимальная лига'}</b><div class="pb" style="margin-top:8px"><i style="width:${pr*100}%"></i></div></div></div><div class="card"><h3>Рейтинг недели</h3>${rows.map((r,k)=>`<div class="row lr${r[2]?' me':''}" style="animation-delay:${k*70}ms"><span><b style="display:inline-block;width:26px">${k+1}</b>${r[0]}</span><b>${r[1]} XP</b></div>`).join('')}<small style="opacity:.7">Соперники учебные: пример для будущей онлайн-лиги</small></div><div class="card"><h3>Достижения</h3><div class="ag">${ACH.map(a=>`<div class="bd${S.ach.includes(a[0])?' on':''}">${ic(a[3])}<small>${a[1]}</small></div>`).join('')}</div></div>`}
function cal(){const t=new Date(),c=[];for(let k=27;k>=0;k--){const d=new Date(t);d.setDate(t.getDate()-k);const on=S.days.includes(dk(d));c.push(`<i class="cd${on?' on':''}" style="animation-delay:${(27-k)*25}ms">${on?ic('flame'):d.getDate()}</i>`)}return `<div class="card"><h3>Календарь серии</h3><div class="cal">${c.join('')}</div></div>`}
let personalExamBusy=false,PERSONAL_EXAM=null,learningSyncTimer=0,learningSyncInFlight=null,remoteLearningProfile=null,remoteLearningProfileUser=null,remoteLearningProfileLoading=false;
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
 clearTimeout(learningSyncTimer);
 learningSyncTimer=setTimeout(()=>{void syncLearningEvidence()},1200);
});
const examCard=()=>{
 if(!S.user)return "";
 if(S.user.guest)return '<div class="exam-home"><div class="exam-cloud">'+mascot()+'</div><div class="exam-copy"><b>Персональный экзамен</b><small>Войди в аккаунт, чтобы ИИ учитывал твои уроки, ответы и ошибки.</small></div><button class="exam-start" onclick="authV()">Войти</button></div>';
 const profile=examLearnerProfile(),ready=(S.dn[S.lv]||0)>0&&(profile.attempts||0)>0;
 const caption=ready?"Экзамен составлен ИИ по твоим урокам, ответам и ошибкам.":"Пройди урок и ответь на задания — Cloudy подготовит твой экзамен.";
 return '<div class="exam-home"><div class="exam-cloud">'+mascot()+'</div><div class="exam-copy"><b>Персональный экзамен</b><small>'+caption+'</small></div><button class="exam-start" '+(ready?'':'disabled')+' onclick="startPersonalExam()">'+(ready?'Начать':'Пройди урок')+'</button></div>';
};
async function startPersonalExam(){
 if(personalExamBusy)return;
 if(!S.user||S.user.guest){toast("Войди в аккаунт, чтобы сохранить персональный экзамен.");return}
 personalExamBusy=true;
 clearTimeout(learningSyncTimer);
 await syncLearningEvidence();
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
function renderPersonalExam(){
 const exam=PERSONAL_EXAM;if(!exam)return view();
 const q=exam.questions[exam.index],progress=exam.index/exam.questions.length*100,selected=exam.selected;
 app.innerHTML='<div class="scr exam-screen"><div class="top"><button class="x" onclick="PERSONAL_EXAM=null;view()">'+ic("x")+'</button><div class="bar"><i style="width:'+progress+'%"></i></div><b>'+(exam.index+1)+'/'+exam.questions.length+'</b></div><div class="body"><h2>Персональный экзамен · '+exam.level+'</h2><p class="exam-instruction">Выбери один правильный ответ.</p><div class="exam-question">'+examEscape(q.prompt)+'</div><div class="exam-options">'+q.options.map((option,index)=>'<button class="opt '+(selected===index?'sel':'')+'" onclick="examChoose('+index+')">'+examEscape(option)+'</button>').join("")+'</div><button class="btn exam-next" '+(selected===null?'disabled':'')+' onclick="examNext()">'+(exam.index===exam.questions.length-1?'ЗАВЕРШИТЬ':'ДАЛЬШЕ')+'</button></div></div>';
}
function examChoose(index){if(!PERSONAL_EXAM||PERSONAL_EXAM.selected!==null)return;PERSONAL_EXAM.selected=index;renderPersonalExam()}
async function examNext(){
 const exam=PERSONAL_EXAM;if(!exam||exam.selected===null)return;
 exam.answers.push({questionId:exam.questions[exam.index].id,selectedIndex:exam.selected});
 if(exam.index<exam.questions.length-1){exam.index++;exam.selected=null;renderPersonalExam();snd("flip");return}
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

function theme(t){S.set.th=t;save();snd('tab');view(0)}
async function chat(){if(S.user?.guest){toast("Для практики с Клауди войдите в аккаунт");return authV()}app.innerHTML=`
<section class="chat-shell">
  <div class="top" style="display:flex;align-items:center;justify-content:space-between">
    <button class="x" onclick="snd('tab');view()">${ic('x')}</button>
    <div class="chat-top-center">
      ${mascot()}
      <span class="pill" style="padding:4px 9px;font-size:12px;opacity:.9">${S.lv||'A1'}</span>
    </div>
    <div class="chat-flag" title="English" aria-label="Flag of the United Kingdom">
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
  </div>
  <div id="msgs" class="chat-messages" aria-live="polite"></div>
  <div class="chat-composer">
    <div class="chat-composer-box">
      <input id="ci" placeholder="Напишите по-английски..." autocomplete="off" onkeydown="if(event.key=='Enter'){event.preventDefault();csend()}">
    </div>
    <button class="spk" aria-label="Отправить сообщение" onclick="csend()">${ic('send')}</button>
  </div>
</section>`;CH.forEach(m=>bub(m.r,m.t,false));if(!CH.length)await ask();const input=$('#ci');if(input)input.focus()}
function scrollChat(){const box=$('#msgs');if(box)box.scrollTop=box.scrollHeight}
function bub(r,t,scroll=true){const d=document.createElement('div');d.className='bub '+r;d.textContent=t;$('#msgs').appendChild(d);if(scroll)requestAnimationFrame(scrollChat);return d}
function showTyping(el){el.textContent='';el.classList.add('typ');const dots=document.createElement('span');dots.className='chat-typing';dots.innerHTML='<i></i><i></i><i></i>';el.appendChild(dots)}
async function typeChatReply(el,text){el.classList.remove('typ');el.textContent='';el.classList.add('chat-type-cursor');const step=text.length>500?3: text.length>220?2:1;for(let i=0;i<text.length;i+=step){el.textContent=text.slice(0,i+step);scrollChat();await new Promise(resolve=>setTimeout(resolve,text.length>500?9:16))}el.classList.remove('chat-type-cursor')}
async function ask(u){if(u){CH.push({r:'u',t:u});bub('u',u)}const el=bub('a','',true);showTyping(el);try{const result=await authRequest('ai-chat',{payload:{message:u||'Начни разговор на английском с учеником. Поздоровайся и задай один простой вопрос.',level:S.lv||'A1',history:CH.slice(-16).map(m=>({role:m.r==='u'?'user':'assistant',content:m.t})),learnerProfile:window.CloudyLearning?.profile(KEY)||null}});const reply=String(result.result?.answer||'').trim();if(!reply)throw new Error('ИИ вернул пустой ответ. Попробуйте ещё раз.');await typeChatReply(el,reply);CH.push({r:'a',t:reply});snd('pick')}catch(e){el.classList.remove('typ');el.textContent=e?.message||'Не удалось подключиться к ИИ. Проверьте соединение и повторите попытку.';el.classList.add('error')}scrollChat()}
async function csend(){const el=$('#ci');if(!el||busy)return;const v=el.value.trim();if(!v)return;el.value='';busy=1;snd('send');try{await ask(v)}finally{busy=0;if(el.isConnected)el.focus()}}
setInterval(()=>{try{const n=new Date(),k='rn'+dk(n),hm=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');if(S.user&&S.set.rem&&S.last!=n.toDateString()&&hm>=S.set.remT&&!ls(k)&&window.Notification&&Notification.permission=='granted'){new Notification('Cloudy English',{body:'Пора позаниматься! Не потеряйте серию.'});ls(k,1)}}catch(e){}},30000);
function amb(){const l=S.lv||"A1",a=$(".amb");document.body.dataset.lv=l;document.body.dataset.th=S.set.th||"dark";if(a.dataset.l==l)return;a.dataset.l=l;a.innerHTML="";const n={A1:5,A2:16,B1:28,B2:4}[l],r=Math.random;for(let k=0;k<n;k++){const u=document.createElement("u"),z={A1:200+r()*220,A2:14+r()*40,B1:3+r()*6,B2:90}[l];u.style.cssText=`left:${r()*100}%;top:${r()*100}%;width:${z}px;height:${z}px;animation-delay:-${r()*12}s;animation-duration:${l=="A2"?7+r()*8:l=="B1"?2+r()*3:l=="B2"?12+r()*8:14+r()*8}s`;a.appendChild(u)}}
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
 const g=S.set.goal,td=S.td,rdy=td.xp>=g&&!td.claim,dn=S.dn[S.lv]||0,tl=SEC.reduce((a,s)=>a+s.l.length,0);let n=0;
 const secs=SEC.map((s,si)=>{
  const nodes=s.l.map(li=>{const st=n<dn?"done":n==dn?"cur":"lock",x=Math.round(Math.sin(n*1.15)*60),d=n*70;n++;
   return `<div class="nw" style="--x:${x}px;--d:${d}ms">${st=="cur"?'<div class="tip">НАЧАТЬ</div>':""}<button class="node ${st}" onclick="${st=="lock"?"snd('bad')":`go(${li})`}">${st=="cur"?'<svg class="ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/></svg>':""}${ic(st=="done"?"check":st=="cur"?"star":"lock")}</button><div class="lb">${D[li].t}</div></div>`}).join("");
  return `<div class="ban"><div><small>РАЗДЕЛ ${si+1}</small><h3>${s.n}</h3></div><button class="gd" onclick="guide(${si})">${ic("book")}</button></div><div class="path">${nodes}<div class="deco">${mascot()}</div></div>`}).join("");
 return `<div class="stats"><button class="av" onclick="tab(3)">${ic("user")}</button><span class="pill"><b class="en" onclick="tab(3)">${S.lv}</b></span><span class="sp"></span><span class="pill">${ic("flame")}${S.streak}</span><span class="pill">${ic("bolt")}${S.xp}</span></div>
 <div class="home-actions"><button class="chest ${rdy?"rdy":td.claim?"got":""}" onclick="claim()">${ic("chest")}<span>${td.claim?"Получено":rdy?"Забрать":Math.min(td.xp,g)+"/"+g+" XP"}</span></button>${rvBtn()}</div>${examCard()}${AIcard()}${secs}${dn>=tl&&nxt(S.lv)?`<div class="card" style="text-align:center"><b>Уровень ${S.lv} пройден!</b><br><br><button class="btn" onclick="setLv('${nxt(S.lv)}')">ПЕРЕЙТИ НА ${nxt(S.lv)}</button></div>`:""}`}
function claim(){const td=S.td;if(td.xp>=S.set.goal&&!td.claim){td.claim=1;S.xp+=25;save();snd("chest");conf(50);view(0)}else snd("bad")}
function guide(si){sheet(`<h3>Шпаргалка: ${SEC[si].n}</h3>`+SEC[si].l.map(li=>`<b style="opacity:.8;font-size:13px">${D[li].t.toUpperCase()}</b>`+D[li].w.map(([e,r])=>`<div class="row"><span>${e} <span style="opacity:.65">— ${r}</span></span><button class="spk" onclick="say('${e}',1)">${ic("spk")}</button></div>`).join("")).join("")+`<br><button class="btn" onclick="closeSh()">ЗАКРЫТЬ</button>`)}
function quests(){const g=S.set.goal,td=S.td,Q=[["Набери "+g+" XP",td.xp,g],["Пройди 2 урока",td.les,2],["Дай 12 верных ответов",td.ok,12]];
 return `<h2 style="margin-top:12px">Задания дня</h2>${Object.keys(S.mis).length?`<div class="card" style="display:flex;align-items:center;gap:14px"><span style="font-size:40px;display:flex">${ic('redo')}</span><div style="flex:1"><b>Повторение ошибок</b><br><small style="opacity:.8">Слов для повторения: ${Object.keys(S.mis).length}</small></div><button class="btn sm" onclick="review()">ПОВТОРИТЬ</button></div>`:''}<div class="card">${Q.map(([n,v,m])=>`<div class="q"><p><span>${n}</span><span>${Math.min(v,m)}/${m}</span></p><div class="pb"><i style="width:${Math.min(v/m,1)*100}%"></i></div></div>`).join("")}</div><div class="card" style="display:flex;gap:14px;align-items:center"><span style="font-size:48px;display:flex">${ic("chest")}</span><div><b>Сундук дня</b><br><small style="opacity:.8">Достигни цели ${g} XP и забери награду на главном экране</small></div></div>`}
function prof(){const g=S.set.goal,C=2*Math.PI*40,p=Math.min(S.td.xp/g,1),s=S.set,a=S.acc[1]?Math.round(S.acc[0]/S.acc[1]*100):0;
 const sw=k=>`<button class="sw ${s[k]?"on":""}" onclick="tg(this,'${k}')"><i></i></button>`;
 return `<div class="pc">${mascot()}<h2>${S.user.name||'Ученик'}</h2><p>${S.user.email||'Режим гостя'}</p></div>
 <div class="grid">${[["flame",S.streak,"дней подряд"],["bolt",S.xp,"XP всего"],["check",Object.values(S.dn).reduce((a,b)=>a+b,0),"уроков"],["target",a+"%","точность"]].map(([i,v,l])=>`<div class="card">${ic(i)}<div><b>${v}</b><small>${l}</small></div></div>`).join("")}</div>
 <div class="card"><div class="goal"><svg class="gr" viewBox="0 0 100 100"><circle class="t" cx="50" cy="50" r="40"/><circle class="p" cx="50" cy="50" r="40" style="--c:${C};stroke-dasharray:${C};stroke-dashoffset:${C*(1-p)}"/></svg><div><b>Цель на сегодня</b><br><small style="opacity:.8">${Math.min(S.td.xp,g)} из ${g} XP</small></div></div><div class="seg">${[10,20,30,50].map(n=>`<button class="${g==n?"on":""}" onclick="goal(${n})">${n}</button>`).join("")}</div></div>
 ${cal()}<div class="card"><h3>Аккаунт</h3><div class="row"><span>${S.user.guest?'Режим гостя':S.user.email}</span></div><div class="row"><span>Возраст</span><span>${Number.isInteger(Number(S.user.age))&&Number(S.user.age)>=13&&Number(S.user.age)<=120?Number(S.user.age)+' лет':'Не указан'}</span><a class="btn ghost sm" href="https://t.me/cloudysupportt_bot" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center">ИЗМЕНИТЬ</a></div><button class="btn ghost" onclick="Auth.signOut().then(()=>view()).catch(e=>toast(e.message||'Не удалось выйти из аккаунта. Попробуйте ещё раз.',false))">${S.user.guest?'ВОЙТИ ИЛИ РЕГИСТРАЦИЯ':'ВЫЙТИ'}</button></div>${(!S.user?.guest&&(S.user?.isAdmin===true||String(S.user?.email||"").trim().toLowerCase()==="lajonlipcik@gmail.com"))?`<div class="card"><h3>Управление приложением</h3><p style="opacity:.8;margin:0 0 14px">Пользователи и AI-провайдеры</p><button class="btn" type="button" onclick="if(window.CloudyAdmin&&typeof window.CloudyAdmin.open==='function'){window.CloudyAdmin.open(S.user)}else{alert('Модуль админ-панели не загрузился. Обновите страницу.')}">⚙ Админ-панель</button></div>`:""}<div class="card"><h3>Уровень английского</h3><div class="seg">${LVS.map(l=>`<button class="${S.lv==l?"on":""}" onclick="setLv('${l}')">${l}</button>`).join("")}</div><br><button class="btn" onclick="pt('${S.lv}')">ПРОЙТИ ТЕСТ УРОВНЯ</button></div><div class="card"><h3>Настройки</h3><div class="row"><span>Звуковые эффекты</span>${sw("snd")}</div><div class="row"><span>Громкость</span><input type="range" min="0.1" max="1" step="0.05" value="${s.vol}" oninput="S.set.vol=+this.value;save()" onchange="snd('ok')"></div><div class="row"><span>Автоозвучка слов</span>${sw("voice")}</div><div class="row"><span>Практика произношения</span>${sw('mic')}</div><div class="row"><span>Напоминание</span>${sw('rem')}</div><div class="row"><span>Время напоминания</span><input type="time" class="ti" value="${s.remT}" onchange="S.set.remT=this.value;save()"></div><div class="row"><span>Тема</span><div class="seg" style="width:180px">${[['dark','Тёмная'],['light','Светлая']].map(([k,n])=>`<button class="${(s.th||'dark')==k?'on':''}" onclick="theme('${k}')">${n}</button>`).join('')}</div></div><div class="row"><span>Сбросить прогресс</span><button class="btn ghost sm" type="button" onclick="rst()">Сброс</button></div></div><div class="card"><h3>Помощь и документы</h3><p style="opacity:.8;margin:0 0 14px">Правила, конфиденциальность и поддержка Cloudy English</p><button class="btn ghost" type="button" onclick="window.parent.location.href='/legal'">ДОКУМЕНТЫ И ПОДДЕРЖКА</button></div>`}
function requestAgeChange(){window.open('https://t.me/cloudysupportt_bot','_blank','noopener')}
function tg(el,k){S.set[k]=S.set[k]?0:1;el.classList.toggle("on");save();snd("tap");if(k=="rem"&&S.set.rem)try{Notification.requestPermission()}catch(e){}}
function goal(n){S.set.goal=n;save();snd("pick");view(0)}
function rst(){sheet(`<h3>Сбросить прогресс?</h3><p style="opacity:.85">Уроки, XP и серия обнулятся. Настройки сохранятся.</p><button class="btn" onclick="doRst()">СБРОСИТЬ</button><br><br><button class="btn" onclick="closeSh()">ОТМЕНА</button>`)}
function doRst(){const s=S.set;S=DEF();S.set=s;save();closeSh();T=0;view()}

bootCloudy();
