/* VKWebAppInit как можно раньше — снимает вечную загрузку ВК */
(function(){function i(){try{parent.postMessage({handler:'VKWebAppInit',params:{},type:'vk-connect'},'*');}catch(e){}try{if(window.vkBridge)window.vkBridge.send('VKWebAppInit',{});}catch(e){}}i();document.addEventListener('DOMContentLoaded',i);window.addEventListener('load',i);})();


/* ============================================================
   ДЕВЯТЬ ЖИЗНЕЙ — движок (data-driven). Глава = объект EVENTS.
   ============================================================ */
const START = { cap:50, rep:50, mor:60, soul:60 };
const METRIC_NAMES = { cap:'💰', rep:'⭐', mor:'❤️', soul:'🔮' };
const ASSET_DIR = './assets/scenes/ch1/';
const CLIP_DIR  = './assets/clips/';

/* === Реклама === VK Bridge при деплое в VK; вне VK (тест) — reward выдаёт сразу.
   Принцип: реклама = информация/удобство/косметика/ретрай, НИКОГДА не моральный исход или метрика. */
const Ads = {
  _lastInter:0, MIN_GAP:180000,                 // частотный кап интерстишела: 3 мин
  interstitial(){
    const now=Date.now();
    if(now - this._lastInter < this.MIN_GAP) return;
    this._lastInter = now;
    try{ if(window.vkBridge) window.vkBridge.send('VKWebAppShowNativeAds',{ad_format:'interstitial'}); }catch(e){}
  },
  rewarded(onReward){                            // показываем только по желанию игрока
    try{
      if(window.vkBridge){ window.vkBridge.send('VKWebAppShowNativeAds',{ad_format:'reward'}).then(r=>{ if(r&&r.result) onReward(); }).catch(()=>{}); }
      else { onReward(); }                        // тест вне VK — выдаём награду, чтобы проверять механику
    }catch(e){ onReward(); }
  }
};

/* === Ежедневный стрик === считает дни подряд (награды-UI — следующим шагом) */
const Streak = {
  KEY:'devyat9_streak',
  check(){
    const today=new Date().toDateString();
    let s={}; try{ s=JSON.parse(localStorage.getItem(this.KEY))||{}; }catch(e){}
    if(s.last===today) return s.count||1;
    const yest=new Date(Date.now()-86400000).toDateString();
    s.count=(s.last===yest)?((s.count||0)+1):1;
    s.last=today;
    try{ localStorage.setItem(this.KEY,JSON.stringify(s)); }catch(e){}
    return s.count;
  }
};

/* === Звуки === лёгкие WebAudio-тоны, без файлов. Включаются на жестах игрока. */
const SFX={
  ctx:null, on:true,
  _c(){ if(!this.ctx){ try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(this.ctx&&this.ctx.state==='suspended'){ this.ctx.resume(); } return this.ctx; },
  tone(f,d,type,vol,delay){ if(!this.on)return; const c=this._c(); if(!c)return; const t=c.currentTime+(delay||0); const o=c.createOscillator(),g=c.createGain(); o.type=type||'sine'; o.frequency.value=f; g.gain.setValueAtTime(vol||0.05,t); o.connect(g); g.connect(c.destination); o.start(t); g.gain.exponentialRampToValueAtTime(0.0001,t+d); o.stop(t+d); },
  click(){ this.tone(430,0.07,'triangle',0.045); },
  step(){ this.tone(640,0.05,'square',0.03); },
  confirm(){ this.tone(560,0.1,'sine',0.05); this.tone(760,0.12,'sine',0.05,0.07); },
  good(){ this.tone(620,0.12,'sine',0.06); this.tone(820,0.13,'sine',0.06,0.09); this.tone(1040,0.16,'sine',0.05,0.19); },
  bad(){ this.tone(300,0.18,'sawtooth',0.045); this.tone(200,0.22,'sawtooth',0.045,0.11); },
  tick(){ this.tone(900,0.04,'square',0.035); }
};

const EVENTS = {
  intro:{ loc:'КАМОРКА · СТАРТОВЫЙ ОФИС', emoji:'🔑', tag:'Барон', img:'ev01_baron_keys.jpg', video:'vid_ev01_baron.mp4', vtype:'tap',
    title:'Ключи от «Девяти»',
    text:'Барон кладёт перед тобой ключ-карту и тяжело смотрит. «Я построил это с нуля. Теперь компания твоя. Не угробь то, ради чего я жил». За дверью — команда, долги и амбиции.',
    choices:[
      {label:'«Сохраню всё, что вы создали».',sub:'Уважение к наследию',fx:{soul:+5,mor:+4},rel:{baron:+2},next:'sonya'},
      {label:'«Я выведу нас на новый уровень».',sub:'Ставка на рост',fx:{cap:+5,soul:-3},rel:{baron:-1,felix:+1},next:'sonya'},
      {label:'«Сначала разберусь в цифрах».',sub:'Холодный расчёт',fx:{rep:+3,soul:-2},rel:{vasilisa:+2},next:'sonya'},
    ]},
  sonya:{ loc:'КАМОРКА · ОПЕНСПЕЙС', emoji:'📋', tag:'Соня', img:'ev02_sonya_welcome.jpg',
    title:'Новенькая',
    text:'Стажёрка Соня нервно протягивает папку: «Я подготовила сводку по отделам… извините, если что-то не так». Видно, что старалась полночи. Команда смотрит, как ты обойдёшься с самым младшим.',
    choices:[
      {label:'Поблагодарить и разобрать вместе.',sub:'+доверие команды',fx:{mor:+6,soul:+5},rel:{sonya:+3},set:{sonyaMentor:true},next:'felix'},
      {label:'Бегло кивнуть: «Потом гляну».',sub:'Дела важнее',fx:{mor:-3},rel:{sonya:-2},next:'felix'},
      {label:'Указать на ошибку при всех.',sub:'Дисциплина',fx:{rep:+2,mor:-6,soul:-4},rel:{sonya:-4},next:'felix'},
    ]},
  felix:{ loc:'КАМОРКА · У ОКНА', emoji:'🚀', tag:'Феликс', img:'ev03_felix_plan.jpg',
    title:'План захвата рынка',
    text:'Феликс врывается с презентацией: «Удвоим выручку за квартал. Демпинг, выжимаем поставщиков, режем лишнее. Старики осторожничают — а нам надо рвать». Глаза горят.',
    choices:[
      {label:'Дать зелёный свет.',sub:'Рост любой ценой',fx:{cap:+12,soul:-8,mor:-5},rel:{felix:+3,baron:-2},set:{felixPlan:true},next:'grisha'},
      {label:'Взять идею, убрать жёсткость.',sub:'Баланс',fx:{cap:+5,rep:+2},rel:{felix:+1},next:'grisha'},
      {label:'Притормозить: «Не сейчас».',sub:'Осторожность',fx:{soul:+3,cap:-2},rel:{felix:-3},next:'grisha'},
    ]},
  grisha:{ loc:'КАМОРКА · ОТДЕЛ ЛОГИСТИКИ', emoji:'📦', tag:'Гриша', img:'ev04_grisha_burnout.jpg', video:'vid_ev04_grisha.mp4', vtype:'loop',
    title:'На пределе',
    text:'Гриша держит логистику один за троих. «Шеф, я не вывожу. Дома двое котят, я их неделю не видел. Дай людей — или я сломаюсь». Усталость настоящая.',
    choices:[
      {label:'Нанять людей в отдел.',sub:'−деньги, +команда',fx:{cap:-8,mor:+8,soul:+7},rel:{grisha:+4,murka:+2},set:{grishaHelped:true},next:'vasilisa'},
      {label:'Автоматизировать отдел ИИ Тиши.',sub:'Эффективно, но людей под нож',fx:{cap:+6,soul:-7},rel:{tisha:+2,grisha:-2},set:{automated:true},next:'vasilisa'},
      {label:'«Потерпи, сейчас не время».',sub:'Выжать ещё',fx:{cap:+3,mor:-7,soul:-5},rel:{grisha:-4},set:{grishaPushed:true},next:'vasilisa'},
    ]},
  vasilisa:{ loc:'КАМОРКА · ПЕРЕГОВОРКА', emoji:'📉', tag:'Василиса', img:'ev05_vasilisa_cut.jpg',
    title:'Денег в обрез',
    text:'Василиса раскладывает отчёт: «Подушки нет. Либо режем косты, либо ищем деньги. Решай, но решай как взрослый». Холодно, по делу, по-честному.',
    choices:[
      {label:'Срезать премии команде.',sub:'+касса, −мораль',fx:{cap:+9,mor:-9,soul:-4},rel:{vasilisa:+2,murka:-2},next:'bagira'},
      {label:'Урезать свои привилегии первым.',sub:'Личный пример',fx:{cap:+3,mor:+7,soul:+6},rel:{vasilisa:+1,grisha:+2,sonya:+2},next:'bagira'},
      {label:'Взять рискованный кредит.',sub:'Деньги сейчас, долг потом',fx:{cap:+14,rep:-3},set:{loan:true},rel:{vasilisa:-2},next:'bagira'},
    ]},
  bagira:{ loc:'КАМОРКА · ПОЗДНИЙ ВЕЧЕР', emoji:'🖤', tag:'Багира', img:'ev06_bagira_offer.jpg', video:'vid_ev06_bagira.mp4', vtype:'tap',
    title:'Шёпот в полумраке',
    text:'Багира прикрывает дверь. «У меня есть слив по конкуренту. Сольём — заберём их клиента до конца месяца. Никто не узнает. Играем по-взрослому?»',
    choices:[
      {label:'Принять. Бизнес есть бизнес.',sub:'Грязно, но прибыльно',fx:{cap:+11,soul:-12,rep:-4},rel:{bagira:+3},set:{dirtyDeal:true},next:'cleo'},
      {label:'Отказаться наотрез.',sub:'Принципы',fx:{soul:+8},rel:{bagira:-3,baron:+2},next:'cleo'},
      {label:'Пресечь и предупредить совет.',sub:'Чисто, но наживаешь врага',fx:{rep:+6,soul:+5},rel:{bagira:-5},set:{bagiraEnemy:true},next:'cleo'},
    ]},
  cleo:{ loc:'КАМОРКА · КОНТЕНТ-УГОЛОК', emoji:'✨', tag:'Клео', img:'ev07_cleo_pr.jpg',
    title:'Хайп или репутация',
    text:'Клео машет телефоном: «Есть идея вирусной акции. Рискованно, на грани, но взорвём ленты! Или сыграем безопасно и скучно. Решай, босс».',
    choices:[
      {label:'Запускаем вирусную, на грани.',sub:'Качели репутации',fx:{rep:+10,soul:-3},set:{riskyPR:true},rel:{cleo:+3},next:'week'},
      {label:'Безопасно и стабильно.',sub:'Без сюрпризов',fx:{rep:+3,cap:+2},rel:{cleo:-1},next:'week'},
      {label:'Честная история о команде.',sub:'Душевно',fx:{rep:+5,soul:+6,mor:+3},rel:{cleo:+1,murka:+2},next:'week'},
    ]},
  week:{ loc:'КАМОРКА · КОНЕЦ НЕДЕЛИ', emoji:'🌙', tag:'Итог недели', video:'vid_ev08_night.mp4', vtype:'loop',
    title:'Первая неделя позади', text:'',
    choices:[{label:'Перейти к задаче недели →',sub:'Свёрстать бюджет компании',puzzle:'budget'}] },

  /* ===== ГЛАВА 2 · Первая буря ===== */
  ch2_intro:{ loc:'ОПЕНСПЕЙС · ПОНЕДЕЛЬНИК', emoji:'⚡', tag:'Василиса', img:'ch2_01_vasilisa.jpg',
    title:'Конкурент пошёл в атаку',
    text:'Василиса кладёт отчёт: «Конкурент демпингует и уводит наших клиентов. Не ответим за неделю — потеряем ключевого партнёра». В воздухе паника.',
    choices:[
      {label:'Ответить демпингом — ценой ниже.',sub:'Война цен',fx:{cap:-6,rep:+4},rel:{felix:+2,vasilisa:-1},set:{priceWar:true},next:'ch2_grisha'},
      {label:'Держать цену, бить качеством сервиса.',sub:'Игра вдолгую',fx:{soul:+4,rep:+3},rel:{vasilisa:+1,murka:+1},set:{qualityPlay:true},next:'ch2_grisha'},
      {label:'Тянуть время, собрать данные.',sub:'Осторожность',fx:{cap:+2,rep:-3},rel:{tisha:+1},next:'ch2_grisha'},
    ]},
  ch2_grisha:{ loc:'ОТДЕЛ ЛОГИСТИКИ', emoji:'📦', tag:'Гриша', img:'ch2_02_grisha.jpg',
    title:'Отдача за прошлую неделю', text:'',
    choices:[
      {label:'Разрулить лично, по-человечески.',sub:'+мораль',fx:{mor:+6,soul:+4},rel:{grisha:+3},next:'ch2_felix'},
      {label:'Передать вопрос Мурке (HR).',sub:'Делегировать',fx:{mor:+1},rel:{murka:-1,grisha:-1},next:'ch2_felix'},
      {label:'Жёстко: «Работаем, эмоции потом».',sub:'Дисциплина',fx:{cap:+3,mor:-5,soul:-4},rel:{grisha:-3},next:'ch2_felix'},
    ]},
  ch2_felix:{ loc:'У ОКНА · ВЕЧЕР', emoji:'🚀', tag:'Феликс', img:'ch2_03_felix.jpg',
    title:'Феликс рвётся в бой',
    text:'Феликс предлагает дерзкий ход: «Перекупим их топового менеджера — заберём клиентов вместе с ним. Жёстко, но сработает». Глаза горят азартом.',
    choices:[
      {label:'Дать добро на перекуп.',sub:'Агрессия',fx:{cap:+8,soul:-6,rep:-2},rel:{felix:+3,baron:-2},set:{poaching:true},next:'ch2_tisha'},
      {label:'Смягчить: партнёрство, не война.',sub:'Баланс',fx:{rep:+3},rel:{vasilisa:+1},next:'ch2_tisha'},
      {label:'Осадить Феликса при всех.',sub:'Поставить на место',fx:{soul:+2,mor:-2},rel:{felix:-4},next:'ch2_tisha'},
    ]},
  ch2_tisha:{ loc:'СЕРВЕРНАЯ', emoji:'💻', tag:'Тиша', img:'ch2_04_tisha.jpg', video:'vid_ch2_tisha.mp4', vtype:'tap',
    title:'Тиша выходит из тени',
    text:'Тиша впервые говорит уверенно: «Я собрал систему, что предскажет, каких клиентов уведут. Но ей нужны данные людей — без их ведома. Включаем?»',
    choices:[
      {label:'Включить — данные решают.',sub:'Эффективность vs этика',fx:{cap:+9,rep:+3,soul:-7},rel:{tisha:+2},set:{surveillance:true},next:'ch2_week'},
      {label:'Только с согласия людей.',sub:'Честно, но медленно',fx:{soul:+6,mor:+3,cap:-2},rel:{tisha:+1,sonya:+1},next:'ch2_week'},
      {label:'Свернуть — слишком рискованно.',sub:'Стоп',fx:{rep:-2},rel:{tisha:-2},next:'ch2_week'},
    ]},
  ch2_week:{ loc:'ПЕРЕГОВОРКА · НОЧЬ', emoji:'🤝', tag:'Сделка', img:'ch2_05_deal.jpg', video:'vid_ch2_deal.mp4', vtype:'loop',
    title:'Решающие переговоры',
    text:'Партнёр на проводе. От этой сделки зависит, удержишь ли ты ключевого клиента. Время торговаться.',
    choices:[{label:'Сесть за стол переговоров →',sub:'Закрыть сделку',puzzle:'nego'}] }
};

/* Карта глав: weekNum → стартовое событие. 3–7 добавим по мере наполнения. */
const CHAPTERS={ 1:{start:'intro'}, 2:{start:'ch2_intro'} };
const MAX_CHAPTER=2;

/* ===== Движок ===== */
const SAVE_KEY='devyat9_slice_save';
let state=null;
const $=id=>document.getElementById(id);
const clamp=v=>Math.max(0,Math.min(100,v));
function fresh(){return{cur:'intro',m:{...START},flags:{},rel:{},weekNum:1};}
function load(){try{return JSON.parse(localStorage.getItem(SAVE_KEY));}catch(e){return null;}}
function save(){if(state)localStorage.setItem(SAVE_KEY,JSON.stringify(state));flashSaved();}

function show(id){
  // уходя с игрового экрана — глушим и останавливаем видео сцены
  if(id!=='screen-game'){ try{const v=$('scene-vid'); v.pause(); v.muted=true; v.removeAttribute('src'); v.load&&v.load();}catch(e){} }
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');
}

function renderMetrics(){for(const k of['cap','rep','mor','soul']){$('v-'+k).textContent=Math.round(state.m[k]);$('b-'+k).style.width=clamp(state.m[k])+'%';}}

const NAME={baron:'Барон',sonya:'Соня',felix:'Феликс',grisha:'Гриша',vasilisa:'Василиса',bagira:'Багира',cleo:'Клео',murka:'Мурка',tisha:'Тиша',marsel:'Марсель'};
function showFloats(fx,rel){const box=$('floats');box.innerHTML='';const items=[];if(fx)for(const k in fx)items.push(`${METRIC_NAMES[k]} ${fx[k]>0?'+':''}${fx[k]}`);if(rel)for(const r in rel)items.push(`${NAME[r]||r} ${rel[r]>0?'+':''}${rel[r]}`);items.forEach((t,i)=>{const el=document.createElement('div');el.className='float';el.textContent=t;el.style.animationDelay=(i*0.12)+'s';box.appendChild(el);});}

function applyChoice(ch){
  SFX.click();
  if(ch.fx)for(const k in ch.fx)state.m[k]=clamp(state.m[k]+ch.fx[k]);
  if(ch.rel)for(const r in ch.rel)state.rel[r]=(state.rel[r]||0)+ch.rel[r];
  if(ch.set)for(const f in ch.set)state.flags[f]=ch.set[f];
  showFloats(ch.fx,ch.rel); renderMetrics();
  if(ch.puzzle)return startPuzzle(ch.puzzle);
  if(ch.end)return endSlice();
  state.cur=ch.next; save(); setTimeout(renderEvent,400);
}

function weekText(){const f=state.flags;let p=['Команда расходится по домам. Ты впервые один в тёмном офисе и подводишь итог.'];
  if(f.grishaHelped)p.push('Гриша впервые за неделю уехал к котятам вовремя — кивнул тебе с благодарностью.');
  if(f.grishaPushed)p.push('Гриша молча гасит свет последним. Он на грани — это аукнется.');
  if(f.automated)p.push('Алгоритм Тиши уже заменяет часть логистов. Эффективно. И немного жутко.');
  if(f.dirtyDeal)p.push('Сделка Багиры принесёт деньги — но осадок остался, и не только у тебя.');
  if(f.loan)p.push('Кредит закрыл дыру. Долг теперь тикает где-то на фоне.');
  if(f.riskyPR)p.push('Вирусная акция Клео уже разлетается по лентам — пристегнись.');
  return p.join(' ');}

function ch2GrishaText(){const f=state.flags;
  if(f.grishaPushed) return 'Гриша кладёт на стол заявление: «Я предупреждал. Так больше не могу». Уйдёт — логистика встанет.';
  if(f.grishaHelped) return 'Гриша сияет: «Те ребята, что ты дал — золото, отдел тянет вдвое больше». Но просит закрепить успех.';
  if(f.automated) return 'Гриша мрачен: «Твой алгоритм режет смены. Люди шепчутся, кто следующий». Напряжение растёт.';
  return 'Гриша держится, но по отделу видно — прошлая неделя выжала всех. Нужно решение, куда дальше.';
}
function soulVerdict(){const s=state.m.soul;
  if(s>=70)return'Пока ты строишь компанию, где людей <b>ценят как людей</b>. Это твоя сила — и твой риск.';
  if(s<=35)return'Пока ты строишь <b>машину для прибыли</b>, где люди — функции. Цифры довольны. А Барон бы поморщился.';
  return'Ты балансируешь между <b>людьми и эффективностью</b>. Куда качнёшь — решат следующие недели.';}

function renderEvent(){
  const ev=EVENTS[state.cur];
  const scene=$('scene'), vid=$('scene-vid'), img=$('scene-img');
  const ctls=$('scene-ctls'), pauseBtn=$('scene-pause'), soundBtn=$('scene-sound');
  // --- сброс сцены ---
  try{vid.pause();}catch(e){} vid.removeAttribute('src'); vid.load&&vid.load();
  vid.style.opacity=0; ctls.classList.remove('on'); pauseBtn.onclick=null; soundBtn.onclick=null;
  scene.classList.remove('vmode'); img.style.opacity=0;
  const ph=document.querySelector('#scene .placeholder');
  ph.querySelector('.emoji').textContent=ev.emoji||'🏢';
  ph.querySelector('.loc').textContent=ev.loc||'';
  $('scene-tag').textContent=ev.tag||'';
  // постер-фото только для фото-событий (видео само закрывает кадр)
  if(ev.img && !ev.video){img.onload=()=>img.style.opacity=1;img.onerror=()=>img.style.opacity=0;img.src=ASSET_DIR+ev.img+'?v=3';}
  // видео-вставка: полный кадр 9:16, играет сразу немым лупом
  if(ev.video){
    scene.classList.add('vmode');
    vid.loop=true; vid.muted=true; vid.setAttribute('muted','');
    vid.src=CLIP_DIR+ev.video+'?v=3'; vid.style.opacity=1;
    vid.play().catch(()=>{});
    ctls.classList.add('on');
    pauseBtn.textContent='⏸';
    pauseBtn.onclick=()=>{ if(vid.paused){vid.play().catch(()=>{}); pauseBtn.textContent='⏸';} else {vid.pause(); pauseBtn.textContent='▶';} };
    soundBtn.classList.remove('hidden'); soundBtn.textContent='🔊';
    soundBtn.onclick=()=>{ vid.muted=!vid.muted; soundBtn.textContent=vid.muted?'🔊':'🔇'; vid.play().catch(()=>{}); };
  }
  $('title-ev').textContent=ev.title;
  $('text').innerHTML=(state.cur==='week')?weekText():(state.cur==='ch2_grisha')?ch2GrishaText():ev.text;
  const box=$('choices');box.innerHTML='';
  ev.choices.forEach(ch=>{const b=document.createElement('button');b.className='choice';b.innerHTML=ch.label+(ch.sub?`<small>${ch.sub}</small>`:'');b.onclick=()=>applyChoice(ch);box.appendChild(b);});
}

function outcome(){
  const s=state.m.soul, mor=state.m.mor, cap=state.m.cap;
  if(s>=68 && mor>=58) return {t:'«Тёплый дом»', d:'Ты строишь компанию, где людей ценят как людей. Команда пойдёт за тобой в огонь — но конкуренты уже точат зубы на «мягкого» босса.'};
  if(s<=38) return {t:'«Бездушная машина»', d:'Цифры блестят, культура мертва, люди стали функциями. Эффективно — пока кто-то не сломается первым.'};
  if(cap>=62 && mor<=48) return {t:'«Рост на костях»', d:'Деньги пошли, но за счёт людей. Касса довольна, офис — нет, и это бомба замедленного действия.'};
  return {t:'«Канатоходец»', d:'Ты балансируешь между людьми и прибылью. Пока держишься — но канат натянут до предела.'};
}
function consequenceLines(){
  const f=state.flags, w=state.weekNum||1, L=[];
  if(w===1){
    if(f.felixPlan) L.push('🚀 Ставка на план Феликса разогнала выручку — но команда напряглась, а рынок насторожился.');
    if(f.grishaHelped) L.push('📦 Ты дал Грише людей: отдел ожил, и команда увидела, что о ней заботятся.');
    if(f.grishaPushed) L.push('🔥 Ты выжал Гришу досуха — он на грани ухода, и это видят остальные.');
    if(f.automated) L.push('🤖 Автоматизация срезала косты, но по офису пополз страх: «кто следующий под замену?».');
    if(f.loan) L.push('💳 Кредит закрыл дыру в кассе — теперь долг тикает где-то на фоне.');
    if(f.dirtyDeal) L.push('🖤 Грязная сделка Багиры принесла куш — и первую трещину в твоей совести.');
    if(f.bagiraEnemy) L.push('⚔️ Ты пошёл против Багиры — нажил умного и опасного врага.');
    if(f.riskyPR) L.push('✨ Вирусная акция Клео взлетела — шуму много, репутация на качелях.');
    if(f.sonyaMentor) L.push('📋 Ты поверил в Соню — преданный союзник на годы вперёд.');
  } else {
    if(f.priceWar) L.push('⚔️ Ты ответил демпингом — клиентов держишь ценой, но касса худеет.');
    if(f.qualityPlay) L.push('💎 Ставка на качество — медленно, зато репутация крепнет.');
    if(f.poaching) L.push('🎯 Перекуп чужого топа сработал — деньги пришли, но осадок и враг нажиты.');
    if(f.surveillance) L.push('👁️ Слежка за данными людей дала предсказания — и трещину в доверии.');
  }
  if(f.puzzleLine) L.push(f.puzzleLine);
  if(!L.length) L.push('Ты прошёл неделю осторожно, не качнув ни одну чашу весов. Иногда это тоже выбор.');
  return L;
}
function standings(){
  const loyal=[],cold=[];
  for(const r in state.rel){ if(state.rel[r]>=2) loyal.push(NAME[r]||r); else if(state.rel[r]<=-2) cold.push(NAME[r]||r); }
  return {loyal,cold};
}
function score(){ return Math.round(state.m.cap+state.m.rep+state.m.mor+state.m.soul); }
function shareWeek(){
  const o=outcome(), sc=score();
  const text=`Моя компания «Девять»: ${o.t} · Скор недели ${sc}/400 (💰${Math.round(state.m.cap)} ⭐${Math.round(state.m.rep)} ❤️${Math.round(state.m.mor)} 🔮${Math.round(state.m.soul)}). А каким боссом станешь ты?`;
  try{
    if(window.vkBridge){ window.vkBridge.send('VKWebAppShare',{link:location.href}).catch(()=>{}); }
    else if(navigator.share){ navigator.share({title:'9 Жизней',text,url:location.href}).catch(()=>{}); }
    else { try{navigator.clipboard.writeText(text);}catch(e){} alert('Результат скопирован:\n\n'+text); }
  }catch(e){}
}
/* ===== Головоломка недели №1: «Распредели бюджет» ===== */
let pzTimer=null;
const DEPTS=[
  {key:'log', name:'Логистика', icon:'📦'},
  {key:'mkt', name:'Маркетинг', icon:'✨'},
  {key:'dev', name:'Разработка', icon:'💻'},
  {key:'hr',  name:'Команда',    icon:'❤️'},
];
const BUDGET=100, STEP=5;
function genNeeds(){
  let raw=DEPTS.map(()=>2+Math.floor(Math.random()*5));
  let sum=raw.reduce((a,b)=>a+b,0);
  let needs=raw.map(w=>Math.round(BUDGET*w/sum/STEP)*STEP);
  needs[0]+=BUDGET-needs.reduce((a,b)=>a+b,0);
  if(needs[0]<0){ needs[1]+=needs[0]; needs[0]=0; }
  return needs;
}
function deptHint(i){
  const p=state.puzzle, n=p.needs[i], avg=BUDGET/DEPTS.length;
  if(p.reveal[i]) return `нужно ровно ${n}`;
  if(n>=avg*1.3) return 'на пределе — просит много';
  if(n<=avg*0.7) return 'перебьётся малым';
  return 'нужно умеренно';
}
function allocSum(){ return state.puzzle.alloc.reduce((a,b)=>a+b,0); }
function setAlloc(i,d){
  const p=state.puzzle; let v=p.alloc[i]+d;
  if(v<0) v=0;
  if(allocSum()-p.alloc[i]+v > BUDGET) v=BUDGET-(allocSum()-p.alloc[i]);
  p.alloc[i]=v; SFX.step(); renderPuzzle();
}
function startPuzzle(name){
  if(name==='nego') return startNego();
  return startBudget();
}
function startBudget(){
  state.puzzle={needs:genNeeds(), alloc:DEPTS.map(()=>0), reveal:DEPTS.map(()=>false), timeLeft:30};
  renderPuzzle(); show('screen-puzzle'); startPuzzleTimer();
}

/* ===== Головоломка №2: «Переговоры» (push-your-luck) ===== */
function startNego(){
  state.nego={round:0, pot:20, patience:3+Math.floor(Math.random()*4)};
  renderNego(); show('screen-puzzle');
}
function negoMood(){
  const left=state.nego.patience-state.nego.round;
  if(left>=3) return 'партнёр доволен — можно дожимать';
  if(left===2) return 'партнёр спокоен, но следит за тоном';
  if(left===1) return 'партнёр напрягся — дальше рискованно';
  return 'партнёр на пределе — пора закрывать';
}
function renderNego(){
  const n=state.nego;
  $('screen-puzzle').innerHTML=`<div class="pz-wrap">
      <div class="end-kicker">Задача недели</div>
      <h2>🤝 Переговоры</h2>
      <p>Дожимай условия — каждая надбавка повышает куш, но партнёр может встать и уйти. Вовремя ударь по рукам.</p>
      <div class="pz-budget ok">Текущий куш: ${n.pot}</div>
      <div class="pz-hint" style="font-size:13.5px;margin:0 0 16px;">${negoMood()}</div>
      <button class="btn" style="min-width:230px;margin-bottom:10px;" onclick="raiseNego()">📈 Поднять ставку</button>
      <button class="btn btn-primary" style="min-width:230px;" onclick="closeNego()">🤝 Ударить по рукам</button>
    </div>`;
}
function raiseNego(){
  const n=state.nego; n.round++; SFX.step();
  if(n.round>n.patience) return negoResult('collapse');
  n.pot += 12 + Math.floor(Math.random()*8);
  renderNego();
}
function closeNego(){ negoResult('close'); }
function negoResult(mode){
  const n=state.nego; let tier,fx,msg;
  if(mode==='collapse'){ tier='Провал'; fx={cap:-6,rep:-4}; msg='Передавил — партнёр встал и ушёл. Сделка сорвана, клиент потерян.'; state.flags.dealFail=true; SFX.bad(); }
  else if(n.round===n.patience){ tier='Блестяще'; fx={cap:10,rep:4}; msg=`Выжал максимум — ${n.pot} и крепкое рукопожатие. Партнёр уважает.`; state.flags.dealGreat=true; SFX.good(); }
  else { tier='Норма'; const g=Math.round(n.pot/5); fx={cap:g,rep:2}; msg=`Сделка закрыта на ${n.pot}. Надёжно, без жадности.`; SFX.good(); }
  for(const k in fx) state.m[k]=clamp(state.m[k]+fx[k]);
  state.flags.puzzleLine='🤝 Переговоры — '+tier+': '+msg;
  const icon=tier==='Блестяще'?'🏆':tier==='Норма'?'👍':'⚠️';
  $('screen-puzzle').innerHTML=`<div class="pz-wrap">
      <div class="end-kicker">Результат — ${tier}</div>
      <h2>${icon} Переговоры</h2>
      <p>${msg}</p>
      <div class="stat-row">${Object.keys(fx).map(k=>`${METRIC_NAMES[k]} ${fx[k]>0?'+':''}${fx[k]}`).join(' · ')}</div>
      <button class="btn btn-primary" style="min-width:230px;" onclick="endSlice()">Дальше → итоги недели</button>
    </div>`;
}
function startPuzzleTimer(){
  clearInterval(pzTimer);
  pzTimer=setInterval(()=>{
    if(!state.puzzle){ clearInterval(pzTimer); return; }
    state.puzzle.timeLeft--;
    const el=$('pz-timer');
    if(el){ el.textContent=state.puzzle.timeLeft+' с'; if(state.puzzle.timeLeft<=5) el.classList.add('low'); }
    if(state.puzzle.timeLeft<=5 && state.puzzle.timeLeft>0) SFX.tick();
    if(state.puzzle.timeLeft<=0){ clearInterval(pzTimer); submitPuzzle(true); }
  },1000);
}
function renderPuzzle(){
  const p=state.puzzle, rem=BUDGET-allocSum();
  const rows=DEPTS.map((d,i)=>`
    <div class="pz-row">
      <div class="pz-info"><span class="pz-ic">${d.icon}</span><div><div class="pz-name">${d.name}</div><div class="pz-hint">${deptHint(i)}</div></div></div>
      <div class="pz-stepper"><button onclick="setAlloc(${i},-${STEP})">−</button><span class="pz-val">${p.alloc[i]}</span><button onclick="setAlloc(${i},${STEP})">+</button></div>
    </div>`).join('');
  $('screen-puzzle').innerHTML=`<div class="pz-wrap">
      <div class="end-kicker">Задача недели</div>
      <div class="pz-timer ${state.puzzle.timeLeft<=5?'low':''}" id="pz-timer">${state.puzzle.timeLeft} с</div>
      <h2>Бюджет недели</h2>
      <p>Раскидай бюджет по отделам — слушай намёки. Успей за 30 секунд: <b>нераспределённое сгорает</b>.</p>
      <div class="pz-budget ${rem===0?'ok':''}">Осталось распределить: ${rem} / ${BUDGET}</div>
      ${rows}
      <button class="btn" style="min-width:230px;margin:8px 0 10px;" onclick="puzzleHint()">💡 Подсказка (реклама)</button>
      <button class="btn btn-primary" style="min-width:230px;" ${rem===0?'':'disabled'} onclick="submitPuzzle()">Утвердить бюджет →</button>
    </div>`;
}
function puzzleHint(){
  Ads.rewarded(()=>{
    const p=state.puzzle, hidden=p.reveal.map((r,i)=>r?-1:i).filter(i=>i>=0);
    if(hidden.length){ p.reveal[hidden[Math.floor(Math.random()*hidden.length)]]=true; renderPuzzle(); }
  });
}
function submitPuzzle(force){
  clearInterval(pzTimer);
  const p=state.puzzle;
  if(!force && allocSum()!==BUDGET) return;
  const dev=p.alloc.reduce((a,v,i)=>a+Math.abs(v-p.needs[i]),0) + (BUDGET-allocSum());
  let tier,fx,msg;
  if(dev<=20){ tier='Блестяще'; fx={cap:8,mor:5}; msg='Бюджет лёг идеально — отделы довольны, деньги работают.'; state.flags.budgetGreat=true; }
  else if(dev<=50){ tier='Норма'; fx={cap:3}; msg='Бюджет свёрстан сносно — без провалов, но и без блеска.'; }
  else { tier='Провал'; fx={cap:-5,mor:-4}; msg='Деньги ушли не туда (или сгорели) — отделы недовольны, касса просела.'; state.flags.budgetFail=true; }
  if(tier==='Провал') SFX.bad(); else SFX.good();
  for(const k in fx) state.m[k]=clamp(state.m[k]+fx[k]);
  state.flags.puzzleLine='🧩 Бюджет недели — '+tier+': '+msg;
  const icon=tier==='Блестяще'?'🏆':tier==='Норма'?'👍':'⚠️';
  $('screen-puzzle').innerHTML=`<div class="pz-wrap">
      <div class="end-kicker">Результат — ${tier}</div>
      <h2>${icon} Бюджет недели</h2>
      <p>${msg}</p>
      <div class="stat-row">${Object.keys(fx).map(k=>`${METRIC_NAMES[k]} ${fx[k]>0?'+':''}${fx[k]}`).join(' · ')}</div>
      <button class="btn btn-primary" style="min-width:230px;" onclick="endSlice()">Дальше → итоги недели</button>
    </div>`;
}

function endSlice(){
  const o=outcome(), st=standings(), wk=state.weekNum||1, more=wk<MAX_CHAPTER;
  const cons=consequenceLines().map(l=>`<div class="cons">${l}</div>`).join('');
  let stand='';
  if(st.loyal.length||st.cold.length){
    stand=`<div class="stand"><b>Команда о тебе:</b><br>`+
      (st.loyal.length?`💚 За тебя — ${st.loyal.join(', ')}. `:'')+
      (st.cold.length?`🔻 Затаили обиду — ${st.cold.join(', ')}.`:'')+
      `<div class="cant">Для всех хорошим не будешь — и это нормально.</div></div>`;
  }
  const note = more
    ? 'Твои решения уже тянут последствия в следующую неделю. Дальше — сложнее.'
    : 'В полной игре каждое решение ведёт к одной из 5–6 разных концовок. Пока готовы 2 главы.';
  const mainBtn = more
    ? `<button class="btn btn-primary" style="min-width:240px;" onclick="nextChapter()">Глава ${wk+1} →</button>`
    : `<button class="btn btn-primary" style="min-width:240px;" onclick="hardReset()">↺ Пройти заново</button>`;
  $('screen-end').innerHTML=`
    <video class="end-bg" playsinline muted loop autoplay src="${CLIP_DIR}vid_ev08_night.mp4?v=3"></video>
    <div class="end-wrap">
      <div class="end-kicker">Итоги недели ${wk} · что ты построил</div>
      <h2>${o.t}</h2>
      <p>${o.d}</p>
      ${cons}
      ${stand}
      <div class="stat-row">💰 ${Math.round(state.m.cap)} · ⭐ ${Math.round(state.m.rep)} · ❤️ ${Math.round(state.m.mor)} · 🔮 ${Math.round(state.m.soul)}</div>
      <div class="end-score">Скор: <b>${score()}</b> / 400</div>
      <p class="end-note">${note}</p>
      <button class="btn" style="min-width:240px;margin-bottom:10px;" onclick="shareWeek()">↗ Поделиться итогом</button>
      ${mainBtn}
    </div>`;
  if(more) save(); else localStorage.removeItem(SAVE_KEY);
  show('screen-end');
}
function nextChapter(){
  state.weekNum=(state.weekNum||1)+1;
  Ads.interstitial();                 // мягкий интерстишел на стыке глав
  const ch=CHAPTERS[state.weekNum];
  state.cur = ch ? ch.start : 'intro';
  save(); renderMetrics(); renderEvent(); show('screen-game');
}

function flashSaved(){const s=$('saved');s.style.opacity=1;setTimeout(()=>s.style.opacity=0,800);}
function startGame(){state=fresh();try{state.streak=Streak.check();}catch(e){}renderMetrics();renderEvent();show('screen-game');save();}
function hardReset(){startGame();}

/* INTRO sequence */
function playIntro(){
  show('screen-intro');
  const lines=['c1','c2','c3'];
  lines.forEach((id,i)=>setTimeout(()=>$(id).classList.add('show'), 400+i*1500));
  setTimeout(()=>{const cta=$('intro-cta');cta.style.opacity=1;cta.classList.add('btn-primary');}, 400+lines.length*1500+200);
}

/* Particles */
(function(){const box=$('particles');for(let i=0;i<26;i++){const p=document.createElement('div');p.className='pt';const s=2+Math.random()*4;p.style.left=Math.random()*100+'%';p.style.width=p.style.height=s+'px';p.style.animationDuration=(9+Math.random()*12)+'s';p.style.animationDelay=(-Math.random()*15)+'s';box.appendChild(p);}})();

/* Wire up */
$('btn-start').onclick=playIntro;
$('intro-cta').onclick=startGame;
$('restart').onclick=hardReset;
$('btn-continue').onclick=()=>{state=load()||fresh();renderMetrics();renderEvent();show('screen-game');};

/* continue button if save exists */
if(load()){$('btn-continue').style.display='block';}

/* VK Bridge init — внутри ВК активирует мост и рекламу; вне ВК тихо игнорится */
try{ if(window.vkBridge) window.vkBridge.send('VKWebAppInit'); }catch(e){}
