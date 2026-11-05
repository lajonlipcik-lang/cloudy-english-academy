/* Cloudy English exercise runtime.
 * Browser-side exercise generation mirrors the typed Cloudy learning logic.
 */
const addMis=en=>{if(!en)return;S.mis[en]=(S.mis[en]||0)+1;if(!lm.includes(en))lm.push(en);save()};
const cq=(en,ru,m)=>{const o=sh([[en,ru],...sh(pool().filter(x=>x[0]!=en)).slice(0,3)]);return m==2?{k:'l',a:en,en,o:o.map(x=>x[0]),title:'Что вы слышите?'}:{k:'c',q:m?en:ru,a:m?ru:en,en,spk:!!m,o:o.map(x=>m?x[1]:x[0]),title:m?'Что это значит?':'Переведите на английский'}};
function review(){const w=Object.keys(S.mis).slice(0,8).map(en=>[en,ruOf(en)]).filter(x=>x[1]);if(!w.length)return snd('bad');snd('go');rv=1;rt=1;lm=[];L=-1;if(window.CloudyLearning)CloudyLearning.beginSession(KEY,{level:S.lv,lessonIndex:-1,sessionType:'review'});ex=mk({w,s:[]});i=0;hp=5;cmb=0;ok=0;tot=0;draw()}
function again(){rv?review():go(L)}
const PB=e=>`<h2>Скажите вслух</h2><div class="qq">${e.en}<button class="spk" onclick="say('${e.en}',1)">${ic('spk')}</button></div><button class="big" id="mic" onclick="rec()">${ic('mic')}</button><p id="rs" style="text-align:center;opacity:.85">Нажмите и произнесите слово</p><button class="btn ghost" onclick="skipP()">ПРОПУСТИТЬ</button>`;
function skipP(){if(done)return;if(window.CloudyLearning)CloudyLearning.track(KEY,'question_skipped',{exerciseType:'p',questionIndex:i});fx(true,'Пропущено')}
let cloudyRecognition=null,cloudyRecognitionTimer=0,cloudyVoiceRetryTimer=0,cloudyVoiceRetryCount=0,cloudyVoiceHandled=false,lastVoiceTranscript='';
const { normalizeSpeechText, speechDistance, speechMatches } = window.CloudySpeech;
function clearCloudyRecognition(active=cloudyRecognition){
 clearTimeout(cloudyRecognitionTimer);cloudyRecognitionTimer=0;
 if(active&&cloudyRecognition===active)cloudyRecognition=null;
 if(active){
  active.onresult=active.onerror=active.onend=active.onstart=null;
  try{if(typeof active.abort==='function')active.abort();else active.stop()}catch(e){}
 }
 const mic=$('#mic');if(mic)mic.classList.remove('rec');
}
function finishCloudyRecognition(active,message){
 if(!active||cloudyRecognition!==active)return;
 clearCloudyRecognition(active);
 if(message){const status=$('#rs');if(status)status.textContent=message;}
}
function rec(autoRetry=false){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){toast('Голосовой ввод не поддерживается этим браузером. Можно продолжить упражнение вручную.',false);return;}
 if(done)return;
 if(cloudyRecognition){
  const active=cloudyRecognition;
  cloudyVoiceHandled=true;cloudyVoiceRetryCount=0;clearTimeout(cloudyVoiceRetryTimer);cloudyVoiceRetryTimer=0;
  finishCloudyRecognition(active,'Прослушивание остановлено. Нажмите на микрофон, чтобы попробовать снова.');
  return;
 }
 const exercise=ex[i],mic=$('#mic'),status=$('#rs');
 if(!exercise||!mic)return;
 if(!autoRetry){cloudyVoiceRetryCount=0;cloudyVoiceHandled=false;snd('pick');}
 clearTimeout(cloudyVoiceRetryTimer);cloudyVoiceRetryTimer=0;
 const recognition=new SR();cloudyRecognition=recognition;
 recognition.lang='en-US';recognition.maxAlternatives=5;recognition.continuous=false;recognition.interimResults=false;
 if(status)status.textContent=autoRetry?'Слушаю ещё раз…':'Слушаю… Говорите чётко';
 mic.classList.add('rec');
 recognition.onstart=()=>{if(cloudyRecognition===recognition&&status)status.textContent='Слушаю… Говорите чётко';};
 recognition.onresult=ev=>{
  if(cloudyRecognition!==recognition||cloudyVoiceHandled||done)return;
  const alternatives=[];
  for(let index=ev.resultIndex||0;index<ev.results.length;index++){
   const result=ev.results[index];if(!result.isFinal)continue;
   for(let alt=0;alt<result.length;alt++)alternatives.push({text:result[alt].transcript,confidence:Number(result[alt].confidence)||0});
  }
  if(!alternatives.length)return;
  cloudyVoiceHandled=true;
  const best=alternatives.sort((x,y)=>y.confidence-x.confidence).find(x=>speechMatches(x.text,exercise.en));
  const heard=alternatives[0].text;lastVoiceTranscript=heard;
  clearCloudyRecognition(recognition);
  if(best){
   if(window.CloudyLearning)CloudyLearning.record(KEY,exercise,true,{retry:!!rt,responseSeconds:(Date.now()-questionStartedAt)/1000,questionIndex:i,selectedAnswer:heard,correctAnswer:exercise.en});
   ok++;tot++;cmb++;snd('ok',cmb);fx(true,'Отлично! Распознано: '+best.text);
  }else{
   if(window.CloudyLearning)CloudyLearning.record(KEY,exercise,false,{retry:!!rt,responseSeconds:(Date.now()-questionStartedAt)/1000,questionIndex:i,selectedAnswer:heard,correctAnswer:exercise.en});
   addMis(exercise.en);miss();fx(false,'Распознано: '+heard+'. Нужно сказать: '+exercise.en);
  }
 };
 recognition.onerror=ev=>{
  if(cloudyRecognition!==recognition||cloudyVoiceHandled)return;
  const error=ev.error||'unknown';
  if(error==='no-speech'&&cloudyVoiceRetryCount<1){
   cloudyVoiceRetryCount++;if(status)status.textContent='Не услышал голос. Повторяю попытку…';return;
  }
  const message=error==='not-allowed'||error==='service-not-allowed'?'Нет доступа к микрофону — разрешите его в настройках браузера.':
   error==='audio-capture'?'Микрофон не найден или занят другим приложением.':
   error==='network'?'Проблема с соединением при распознавании. Проверьте интернет.':
   error==='no-speech'?'Не услышал голос. Нажмите на микрофон и попробуйте ещё раз.':
   'Не удалось распознать речь. Попробуйте ещё раз.';
  cloudyVoiceHandled=true;finishCloudyRecognition(recognition,message);
  if(error!=='aborted')toast(message,false);
 };
 recognition.onend=()=>{
  if(cloudyRecognition!==recognition)return;
  clearTimeout(cloudyRecognitionTimer);cloudyRecognitionTimer=0;cloudyRecognition=null;
  if(mic)mic.classList.remove('rec');
  if(cloudyVoiceHandled||done)return;
  if(cloudyVoiceRetryCount===1){
   cloudyVoiceRetryCount=2;
   if(status)status.textContent='Повторная попытка…';
   cloudyVoiceRetryTimer=setTimeout(()=>{
    cloudyVoiceRetryTimer=0;
    if(!done&&!cloudyRecognition&&ex[i]===exercise)rec(true);
   },350);
   return;
  }
  if(status)status.textContent='Готово. Нажмите на микрофон, чтобы попробовать снова.';
 };
 try{
  recognition.start();
  cloudyRecognitionTimer=setTimeout(()=>{
   if(cloudyRecognition!==recognition)return;
   cloudyVoiceHandled=true;
   finishCloudyRecognition(recognition,'Время прослушивания истекло. Нажмите на микрофон и попробуйте ещё раз.');
  },15000);
 }catch(error){
  cloudyVoiceHandled=true;finishCloudyRecognition(recognition,'Не удалось запустить микрофон. Проверьте разрешение и попробуйте снова.');
  toast('Не удалось запустить распознавание речи.',false);
 }
}

let ex,i,hp,sel,built,done,ml,mc,cmb,ok,tot,L,rv=0,lm=[],rt=0,questionStartedAt=Date.now();
function mk(l){const r=[];
 const titles={
  ru:["Переведите на английский","Как сказать это по-английски?","Выберите английский перевод"],
  en:["Что это значит?","Выберите перевод слова","Как переводится это слово?"],
  listen:["Что вы услышали?","Прослушайте и выберите слово","Какое слово произнесено?"],
  bank:["Составьте предложение на английском","Переведите фразу на английский","Соберите правильный перевод"]
 };
 l.w.forEach(([en,ru],k)=>{const m=k%3,o=sh([[en,ru],...sh(pool().filter(x=>x[0]!=en)).slice(0,3)]);
  if(m==2)r.push({k:"l",a:en,en,o:o.map(x=>x[0]),title:titles.listen[Math.random()*titles.listen.length|0]});
  else r.push({k:"c",q:m?en:ru,a:m?ru:en,en,spk:!!m,o:o.map(x=>m?x[1]:x[0]),title:(m?titles.en:titles.ru)[Math.random()*(m?titles.en:titles.ru).length|0]})});
 const p=sh(l.w).slice(0,4);r.push({k:"m",L:sh(p.map(x=>[x[0],x[0]])),R:sh(p.map(x=>[x[1],x[0]])),title:"Найдите пары"});
 l.s.forEach(([ru,en],sentenceIndex)=>{
  const correctTokens=en.split(" "),normalizeToken=token=>token.toLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu,"");
  const used=new Set(correctTokens.map(normalizeToken).filter(Boolean));
  const candidates=[
   ...l.w.map(([word])=>word).filter(word=>!/\s/.test(word)),
   ...l.s.filter((_,index)=>index!==sentenceIndex).flatMap(([,sentence])=>sentence.split(" "))
  ].filter(token=>{
   const normalized=normalizeToken(token),unpunctuated=token.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu,"");
   return token&&normalized&&token===unpunctuated&&!used.has(normalized)&&!/[.,!?]/.test(token);
  });
  const distractors=[...new Map(candidates.map(token=>[normalizeToken(token),token])).values()].slice(0,2);
  r.push({k:"b",q:ru,a:en,o:sh([...correctTokens,...distractors]),title:titles.bank[Math.random()*titles.bank.length|0]});
 });
 if(l.w.length&&(window.SpeechRecognition||window.webkitSpeechRecognition)&&S.set.mic)r.push({k:"p",en:sh(l.w)[0][0]});return sh(r)}
function verbPath(n){
 const lessons={
  24:[
   {q:"Я хочу воды.",a:"I want water.",o:["I","want","water.","We","go","home"],skillId:"grammar:verbs:action"},
   {q:"Мы идём домой.",a:"We go home.",o:["We","go","home.","I","want","water."],skillId:"grammar:verbs:action"}
  ],
  25:[
   {q:"Я просыпаюсь рано.",a:"I wake up early.",o:["I","wake","up","early.","She","wakes"],skillId:"grammar:present-simple:base"},
   {q:"Они изучают английский.",a:"They study English.",o:["They","study","English.","He","studies","I"],skillId:"grammar:present-simple:base"}
  ],
  26:[
   {q:"Она любит чай.",a:"She likes tea.",o:["She","likes","tea.","I","like","coffee."],skillId:"grammar:present-simple:third-person"},
   {q:"Он работает каждый день.",a:"He works every day.",o:["He","works","every","day.","They","work"],skillId:"grammar:present-simple:third-person"}
  ],
  27:[
   {q:"Ты говоришь по-английски?",a:"Do you speak English?",o:["Do","you","speak","English?","Does","she","speaks"],skillId:"grammar:present-simple:questions"},
   {q:"Она работает здесь?",a:"Does she work here?",o:["Does","she","work","here?","Do","works","they"],skillId:"grammar:present-simple:questions"}
  ],
  28:[
   {q:"Я не знаю.",a:"I don't know.",o:["I","don't","know.","He","doesn't","knows"],skillId:"grammar:present-simple:negatives"},
   {q:"Он не любит кофе.",a:"He doesn't like coffee.",o:["He","doesn't","like","coffee.","I","don't","likes"],skillId:"grammar:present-simple:negatives"}
  ],
  29:[
   {q:"Она читает книгу дома.",a:"She reads a book at home.",o:["She","reads","a","book","at","home.","I","read"],skillId:"grammar:sentence-order"},
   {q:"Мы изучаем английский каждый день.",a:"We study English every day.",o:["We","study","English","every","day.","She","studies"],skillId:"grammar:sentence-order"}
  ]
 };
 return (lessons[n]||[]).map(item=>({k:"b",q:item.q,a:item.a,o:sh(item.o),title:"Собери предложение",skillId:item.skillId}));
}
function go(n){snd("go");rv=0;lm=[];rt=0;L=n;if(window.CloudyLearning)CloudyLearning.beginSession(KEY,{level:S.lv,lessonIndex:n,sessionType:"lesson"});const practice=window.CloudyLearning?CloudyLearning.prioritize(KEY,mk(D[n])):mk(D[n]);const intro=window.CloudyCatalog?.F?.[n];const vocabulary={k:"v",words:D[n].w};const recall=sh(D[n].w).slice(0,Math.min(3,D[n].w.length)).map(([en,ru])=>({k:"r",q:ru,a:en,en,title:"Вспомни слово без подсказок"}));const guided=verbPath(n);ex=intro?[{k:"t",...intro},vocabulary,...guided,...recall,...practice]:[vocabulary,...guided,...recall,...practice];i=0;hp=5;cmb=0;ok=0;tot=0;draw()}
const opts=e=>e.o.map((o,k)=>`<button class="opt" style="--i:${k}" onclick="pick(${k})">${o}</button>`).join("");
function draw(){const e=ex[i];questionStartedAt=Date.now();if(e.k!=="t"&&e.k!=="v"&&window.CloudyLearning)CloudyLearning.track(KEY,"question_opened",{exercise:e,questionIndex:i});sel=null;built=[];done=false;ml=null;mc=0;let b;
 if(e.k=="v")b=`<section class="vocab-lesson"><div class="study-heading-row"><div><span class="study-kicker">ЛЕКСИКА · A1</span><h2>Познакомься со словами</h2></div><span class="vocab-count">${e.words.length} слов</span></div><p class="study-description">Сначала посмотри на значение и произношение каждого слова. Затем попробуешь вспомнить его самостоятельно.</p><div class="vocab-grid">${e.words.map(([en,ru],index)=>`<article class="vocab-card" style="--card-index:${index}"><span class="vocab-index">${String(index+1).padStart(2,"0")}</span><div class="vocab-word">${en}</div><div class="vocab-translation">${ru}</div><button class="vocab-speak" aria-label="Прослушать ${en}" data-word="${en}" onclick="say(this.dataset.word,1)">${ic("spk")}</button></article>`).join("")}</div></section>`;else if(e.k=="t")b=`<section class="grammar-lesson"><span class="study-kicker">ГРАММАТИКА · A1</span><h2 class="study-title">${e.title}</h2><p class="study-description">${e.body}</p>${L===0?`<div class="pronoun-section"><div class="study-section-label">ЛИЧНЫЕ МЕСТОИМЕНИЯ</div><div class="pronoun-grid">${[["I","Я"],["You","Ты / Вы"],["He","Он"],["She","Она"],["It","Оно / это"],["We","Мы"],["They","Они"]].map(([en,ru],index)=>`<article class="pronoun-card" style="--card-index:${index}"><span class="pronoun-en">${en}</span><span class="pronoun-ru">${ru}</span></article>`).join("")}</div></div>`:""}<div class="grammar-example-grid">${e.examples.map(([en,ru],index)=>`<article class="grammar-example-card" style="--card-index:${index}"><span class="grammar-example-index">ПРИМЕР 0${index+1}</span><strong class="grammar-example-en">${en}</strong><span class="grammar-example-ru">${ru}</span></article>`).join("")}</div><div class="grammar-tip"><span>ЗАПОМНИ</span><p>${e.tip}</p></div></section>`;else if(e.k=="r")b=`<h2>${e.title}</h2><div class="qq" style="font-size:25px;line-height:1.35">${e.q}</div><p style="font-size:14px;opacity:.72;margin:10px 0 14px">Введи английское слово самостоятельно. Вариантов ответа не будет.</p><input id="recallAnswer" type="text" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Напиши по-английски…" aria-label="Английское слово" style="display:block;width:100%;box-sizing:border-box;padding:15px 16px;border:1px solid rgba(120,195,255,.5);border-radius:14px;background:rgba(255,255,255,.1);color:inherit;font:inherit;font-size:18px;outline:none" oninput="document.getElementById(&quot;go&quot;).disabled=!this.value.trim()" onkeydown="if(event.key===&quot;Enter&quot;&amp;&amp;!document.getElementById(&quot;go&quot;).disabled)check()">`;else if(e.k=="c")b=`<h2>${e.title}</h2><div class="qq">${e.q}${e.spk?`<button class="spk" onclick="say('${e.en}',1)">${ic("spk")}</button>`:""}</div>${opts(e)}`;
 else if(e.k=="l")b=`<h2>${e.title}</h2><button class="big" onclick="say('${e.en}',1)">${ic("spk")}</button>${opts(e)}`;
 else if(e.k=="b")b=`<h2>${e.title}</h2><div class="qq" style="font-size:24px">${e.q}</div><div class="ans" id="ans"></div><div class="bank">${e.o.map((o,k)=>`<button class="chip" id="c${k}" onclick="tog(${k})">${o}</button>`).join("")}</div>`;
 else if(e.k=="p")b=PB(e);else b=`<h2>${e.title||"Найдите пары"}</h2><div class="mt"><div>${e.L.map(([t,id],k)=>`<button class="opt" style="--i:${k}" onclick="mp(0,'${id}',this)">${t}</button>`).join("")}</div><div>${e.R.map(([t,id],k)=>`<button class="opt" style="--i:${k}" onclick="mp(1,'${id}',this)">${t}</button>`).join("")}</div></div>`;
 const studyScreen=e.k==="t"||e.k==="v";app.innerHTML=`<div class="scr ${studyScreen?"study-screen":""}"><div class="top"><button class="x" onclick="exitExercise()">${ic("x")}</button><div class="bar"><i style="width:${i/ex.length*100}%"></i></div><span class="hp" id="hp">${ic("heart")}${hp}</span></div><div class="body ${studyScreen?"study-stage study-stage-enter":""}">${b}</div></div>`+(e.k=="m"||e.k=="p"?'<div class="foot" id="ft" style="display:none"></div>':e.k=="t"||e.k=="v"?'<div class="foot" id="ft"><button class="btn" onclick="next()">ПОНЯТНО, ДАЛЬШЕ</button></div>':`<div class="foot" id="ft"><button class="btn" id="go" ${e.k==="r"?"disabled":""} onclick="check()">ПРОВЕРИТЬ</button></div>`);
 requestAnimationFrame(()=>{const f=$(".bar i");if(f)f.style.width=i/ex.length*100+"%";
  const target=$(".body");if(!target)return;const rect=target.getBoundingClientRect();
  const footer=$(".foot"),visibleBottom=window.innerHeight-(footer&&footer.style.display!=="none"?footer.getBoundingClientRect().height:0)-12;
  let delta=0;if(rect.top<8)delta=rect.top-8;else if(rect.bottom>visibleBottom)delta=rect.bottom-visibleBottom;
  if(Math.abs(delta)>24){const reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;window.scrollTo({top:Math.max(0,window.scrollY+delta),behavior:reduce?"auto":"smooth"});}
 });
 if(e.k=="l")setTimeout(()=>say(e.en,1),400);if(e.k=="c"&&e.spk)setTimeout(()=>say(e.en),400)}
function pick(k){if(done)return;sel=k;snd("pick");document.querySelectorAll(".opt").forEach((b,j)=>b.classList.toggle("sel",j==k));$("#go").disabled=false}
function tog(k){if(done)return;snd("tap");const p=built.indexOf(k);p>-1?built.splice(p,1):built.push(k);const e=ex[i];$("#ans").innerHTML=built.map(j=>`<button class="chip" onclick="tog(${j})">${e.o[j]}</button>`).join("");e.o.forEach((_,j)=>$("#c"+j).classList.toggle("gone",built.includes(j)));$("#go").disabled=!built.length}
function miss(){hp--;cmb=0;tot++;snd("bad");const h=$("#hp");h.innerHTML=ic("heart")+hp;h.classList.remove("hit");void h.offsetWidth;h.classList.add("hit");if(navigator.vibrate)try{navigator.vibrate(60)}catch(e){}}
let cloudySuccessAdvanceTimer=0;
function cloudyPlaySwoosh(){
 if(!S.set.snd)return;
 try{
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  if(!AC){AC=new C();MG=AC.createGain();MG.connect(AC.destination)}
  if(AC.state==="suspended")AC.resume();
  const now=AC.currentTime,duration=.95,length=Math.floor(AC.sampleRate*duration);
  const buffer=AC.createBuffer(1,length,AC.sampleRate),data=buffer.getChannelData(0);
  for(let n=0;n<length;n++){const fade=Math.sin(Math.PI*n/length)*Math.pow(1-n/length,.7);data[n]=(Math.random()*2-1)*fade}
  const source=AC.createBufferSource(),filter=AC.createBiquadFilter(),gain=AC.createGain();
  source.buffer=buffer;filter.type="lowpass";filter.Q.value=.35;
  filter.frequency.setValueAtTime(520,now);filter.frequency.exponentialRampToValueAtTime(1450,now+.48);filter.frequency.exponentialRampToValueAtTime(680,now+duration);
  gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(.065*S.set.vol,now+.28);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  source.connect(filter);filter.connect(gain);gain.connect(AC.destination);source.start(now);source.stop(now+duration);
 }catch(e){}
}
function showCloudySuccess(){
 const styleId="cloudy-success-reaction-style";
 if(!document.getElementById(styleId)){
  const style=document.createElement("style");style.id=styleId;style.textContent=`
   .cloudy-success-reaction{position:fixed;inset:0;z-index:10050;display:grid;place-content:center;justify-items:center;gap:10px;pointer-events:none;background:radial-gradient(ellipse at center,rgba(38,160,230,.13),transparent 58%);animation:cloudy-success-backdrop .3s ease-out both}
   .cloudy-success-cloud{position:relative;width:min(62vw,250px);animation:cloudy-success-cloud-in .48s cubic-bezier(.18,.82,.25,1.2) both,cloudy-success-float .55s .48s ease-in-out infinite}
   .cloudy-success-cloud .ms{display:block;width:100%;height:auto;filter:drop-shadow(0 10px 22px rgba(63,174,255,.25))}
   .cloudy-success-reaction strong{font:800 clamp(27px,7vw,38px)/1.1 system-ui,sans-serif;letter-spacing:.01em;color:#42baff;text-shadow:0 2px 14px rgba(46,171,255,.25);animation:cloudy-success-text .6s .35s cubic-bezier(.2,.8,.2,1) both}
   @keyframes cloudy-success-backdrop{from{opacity:0}to{opacity:1}}
   @keyframes cloudy-success-cloud-in{0%{opacity:0;transform:translateY(38px) scale(.72)}65%{opacity:1;transform:translateY(-6px) scale(1.04)}100%{opacity:1;transform:translateY(0) scale(1)}}
   @keyframes cloudy-success-float{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-7px) rotate(1deg)}}
   }
   @keyframes cloudy-success-text{from{opacity:0;transform:translateY(16px) scale(.86)}to{opacity:1;transform:translateY(0) scale(1)}}
   .cloudy-success-reaction.is-leaving .cloudy-success-cloud{animation:cloudy-success-fly-away .52s cubic-bezier(.45,0,.9,.45) forwards}
   .cloudy-success-reaction.is-leaving strong{animation:cloudy-success-text-away .35s ease-in forwards}
   @keyframes cloudy-success-fly-away{0%{opacity:1;transform:translateY(0) scale(1) rotate(0)}35%{transform:translateY(-24px) scale(1.06) rotate(-5deg)}100%{opacity:0;transform:translateY(-115vh) scale(.48) rotate(12deg)}}
   @keyframes cloudy-success-text-away{to{opacity:0;transform:translateY(-18px)}}
   @media(prefers-reduced-motion:reduce){.cloudy-success-reaction,.cloudy-success-reaction *{animation:none!important}}
  `;document.head.appendChild(style);
 }
 document.querySelector(".cloudy-success-reaction")?.remove();
 const reaction=document.createElement("div");reaction.className="cloudy-success-reaction";reaction.setAttribute("aria-live","polite");
 reaction.innerHTML='<div class="cloudy-success-cloud">'+mascot()+'</div><strong>Молодец!</strong>';
 document.body.appendChild(reaction);
 setTimeout(()=>{if(reaction.isConnected){reaction.classList.add("is-leaving");cloudyPlaySwoosh();setTimeout(()=>reaction.remove(),820)}},1050);
}
function fx(good,msg){done=true;const ft=$("#ft"),e=ex[i];const speechWord=String(e?.en||(/[A-Za-z]/.test(String(e?.a??""))&&!/[А-Яа-яЁё]/.test(String(e?.a??""))?e.a:"")).trim();const safeSpeech=speechWord.replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/\r?\n/g,"\\n").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");ft.style.display="";ft.className="foot "+(good?"ok":"bad");ft.innerHTML=`<div class="ft-head"><p>${msg}</p>${speechWord?`<button class="spk sm" aria-label="Озвучить" onclick="say('${safeSpeech}', 1)">${ic("spk")}</button>`:""}</div><button class="btn" style="margin-bottom:9px" onclick="next()">ДАЛЬШЕ</button><button class="btn ghost sm" onclick="askExerciseCoach()">РАЗОБРАТЬ С CLOUDY</button><div id="exerciseCoachReply" style="margin-top:10px;font-weight:600;line-height:1.45"></div>`;if(good){$(".bar i").style.width=(i+1)/ex.length*100+"%";showCloudySuccess();clearTimeout(cloudySuccessAdvanceTimer);cloudySuccessAdvanceTimer=setTimeout(()=>{if(done&&ft.isConnected)next()},1650)}}
async function askExerciseCoach(){
 clearTimeout(cloudySuccessAdvanceTimer);cloudySuccessAdvanceTimer=0;
 const box=$("#exerciseCoachReply"),e=ex[i];if(!box||!e||box.dataset.loading)return;
 box.dataset.loading="1";box.textContent="Cloudy разбирает задание…";
 const target=String(e.a??e.en??"");
 const pairTarget=e.k==="m"?(e.L||[]).map(([left,id])=>String(left)+" → "+String((e.R||[]).find(([,rightId])=>rightId===id)?.[0]??"")).join("; "):"";
 const response=e.k==="p"?lastVoiceTranscript:e.k==="b"?built.map(j=>e.o[j]).join(" "):e.k==="m"?"Упражнение на сопоставление завершено":e.k==="c"||e.k==="l"?String(e.o?.[sel]??""):"";
 const exerciseContext={type:e.k==="p"?"pronunciation":e.k==="b"?"sentence-building":e.k==="m"?"matching":e.k==="l"?"listening":"vocabulary",question:String(e.q??e.title??"").slice(0,180),target:(pairTarget||target).slice(0,500),learnerAnswer:String(response).slice(0,160),level:S.lv||"A1"};
 try{
  const result=await authRequest("ai-chat",{payload:{message:"Сделай завершённый разбор только что выполненного упражнения для ученика. Объясни, что проверялось, почему правильный ответ верен, и почему выбранный ответ был неверным (если была ошибка). Если ответ верный — кратко подтверди правило и объясни его. Приведи один короткий пример с переводом только как иллюстрацию, но НЕ превращай его в задание. Это режим разбора, а не чат: НЕ задавай пользователю вопросов, НЕ предлагай отвечать, НЕ давай упражнений, тестов, домашней работы или заданий для продолжения. Не заканчивай фразами-приглашениями к диалогу. Заверши разбор кратким итогом правила. Учитывай уровень ученика.",level:S.lv||"A1",history:[],learnerProfile:window.CloudyLearning?.profile(KEY)||null,exerciseContext}});
  box.textContent=String(result.result?.answer||"Cloudy не смог подготовить разбор. Попробуйте позже.");
 }catch(error){box.textContent=error?.message||"Не удалось получить разбор от Cloudy."}
 delete box.dataset.loading;
}
function check(){if(done)return;const e=ex[i];
 const typed=e.k==="r"?String(document.getElementById("recallAnswer")?.value||"").trim().toLocaleLowerCase().replace(/[.!?]+$/g,"").replace(/\s+/g," "):"";const good=e.k==="r"?typed===String(e.a).toLocaleLowerCase():e.k=="b"?built.map(j=>e.o[j]).join(" ").toLowerCase()==e.a.toLowerCase():e.o[sel]==e.a;
 if(window.CloudyLearning)CloudyLearning.record(KEY,e,good,{retry:!!rt,responseSeconds:(Date.now()-questionStartedAt)/1000,questionIndex:i,selectedAnswer:e.k==="r"?typed:e.k==="b"?built.map(j=>e.o[j]).join(" "):e.o[sel],correctAnswer:e.a});
 if(e.k!=="b"&&e.k!=="r")document.querySelectorAll(".opt").forEach((b,j)=>{if(e.o[j]==e.a)b.classList.add("good");else if(j==sel)b.classList.add("wrong")});
 if(good){ok++;tot++;cmb++;snd("ok",cmb);if(rv&&e.en&&S.mis[e.en]){if(--S.mis[e.en]<=0)delete S.mis[e.en];save()}if(cmb>=3){const t=$(".top");if(!$(".cb"))t.insertAdjacentHTML("beforeend",'<span class="cb"></span>');$(".cb").textContent="x"+cmb}}else{addMis(e.en);miss();$(".cb")&&$(".cb").remove()}
 fx(good,good?["Отлично!","Верно!","Супер!","Так держать!"][Math.random()*4|0]:"Правильный ответ: "+e.a)}
function mp(side,id,el){if(done||el.classList.contains("good"))return;
 if(side==0){snd("pick");ml=[id,el];document.querySelectorAll(".mt .opt").forEach(b=>b.classList.remove("sel"));el.classList.add("sel");return}
 if(!ml)return;const l=ml[1];
 if(ml[0]==id){if(window.CloudyLearning)CloudyLearning.record(KEY,{k:"c",en:id},true,{retry:!!rt,responseSeconds:(Date.now()-questionStartedAt)/1000,questionIndex:i,selectedAnswer:id,correctAnswer:id});l.classList.remove("sel");l.classList.add("good");el.classList.add("good");snd("match");ml=null;if(++mc==ex[i].L.length){ok++;tot++;cmb++;setTimeout(()=>{snd("ok",cmb);fx(true,"Все пары найдены!")},350)}}
 else{if(window.CloudyLearning)CloudyLearning.record(KEY,{k:"c",en:ml[0]},false,{retry:!!rt,responseSeconds:(Date.now()-questionStartedAt)/1000,questionIndex:i,selectedAnswer:id,correctAnswer:ml[0]});[l,el].forEach(b=>{b.classList.add("wrong");setTimeout(()=>b.classList.remove("wrong"),500)});l.classList.remove("sel");addMis(ml[0]);ml=null;miss();if(hp<=0)setTimeout(fail,800)}}
let studyTransitionTimer=0;
function advanceExercise(){clearTimeout(cloudySuccessAdvanceTimer);cloudySuccessAdvanceTimer=0;document.querySelector(".cloudy-success-reaction")?.remove();if(hp<=0)return fail();snd("flip");if(++i>=ex.length&&!rt&&lm.length){rt=1;lm.slice(0,3).forEach(en=>ex.push(cq(en,ruOf(en),Math.random()*2|0)))}if(i>=ex.length)return fin();window.scrollTo({top:0,behavior:"instant"});draw()}
function next(){
 if(studyTransitionTimer)return;
 const current=ex[i];
 if(current&&(current.k==="t"||current.k==="v")){
  const stage=$(".study-stage"),reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(stage&&!reduce){stage.classList.remove("study-stage-enter");stage.classList.add("is-leaving");studyTransitionTimer=setTimeout(()=>{studyTransitionTimer=0;advanceExercise()},270);return;}
 }
 advanceExercise();
}
function exitExercise(){clearTimeout(studyTransitionTimer);studyTransitionTimer=0;if(window.CloudyLearning)CloudyLearning.endSession(KEY,"lesson_abandoned");snd("tab");view()}
function fail(){if(window.CloudyLearning)CloudyLearning.endSession(KEY,"lesson_failed");snd("bad");app.innerHTML=`<div class="scr res">${mascot("s")}<div class="big2">Жизни закончились</div><p style="opacity:.85">Ничего страшного, попробуем ещё раз.</p><br><button class="btn" onclick="again()">ПОПРОБОВАТЬ СНОВА</button><br><br><button class="btn" onclick="view()" style="background:rgba(255,255,255,.15);color:#fff;box-shadow:none">НА ГЛАВНУЮ</button></div>`}
function fin(){if(window.CloudyLearning)CloudyLearning.endSession(KEY,"lesson_completed");roll();const t=new Date().toDateString(),y=new Date(Date.now()-864e5).toDateString(),gain=cloudUserId?24:15+hp*3,st=hp>=5?3:hp>=3?2:1,acc=Math.round(ok/Math.max(tot,1)*100);
 if(S.last!=t){S.streak=S.last==y?S.streak+1:1;S.last=t}
 if(!cloudUserId){S.xp+=gain;S.td.xp+=gain;track(gain)}
 S.td.les++;S.td.ok+=ok;S.acc[0]+=ok;S.acc[1]+=tot;const ps=SEC.flatMap(s=>s.l);if(ps.indexOf(L)==S.dn[S.lv]&&S.dn[S.lv]<ps.length)S.dn[S.lv]++;save();if(!cloudUserId)checkAch();
 app.innerHTML=`<div class="scr res">${mascot()}<div class="big2">Урок пройден!</div><div class="stars">${[0,1,2].map(k=>`<span style="animation-delay:${.3+k*.3}s;display:block">${ic(k<st?"starg":"stard")}</span>`).join("")}</div><div class="rs"><div style="animation-delay:.2s"><span id="xp">+0</span><small>XP</small></div><div style="animation-delay:.35s">${acc}%<small>точность</small></div><div style="animation-delay:.5s">${S.streak}<small>серия</small></div></div><button class="btn" onclick="snd('tab');T=0;view()">ПРОДОЛЖИТЬ</button></div>`;
 snd("win");conf();for(let k=0;k<st;k++)setTimeout(()=>snd("star"),300+k*300);
 if(cloudUserId){window.parent.postMessage({channel:'cloudy-auth',type:'lesson-complete',lessonIndex:L,level:S.lv},location.origin);return}
 const el=$("#xp"),s0=performance.now();(function f(n){const p=Math.min((n-s0)/1000,1);el.textContent="+"+Math.round(gain*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(f)})(s0)}
