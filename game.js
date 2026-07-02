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
    // Награда = ТОЛЬКО информация/подсказка/косметика (не исход и не метрика), поэтому
    // выдаём её с одного тапа ВСЕГДА: покажем ролик, если он есть; нет рекламы/отказ — всё равно даём.
    // Иначе (как было) при отсутствии филла VK награда не срабатывала → «долбить несколько раз».
    let done=false; const grant=()=>{ if(!done){ done=true; try{ onReward(); }catch(e){} } };
    try{
      if(window.vkBridge && window.vkBridge.send){
        // .then = ролик реально показали → обновляем таймер интерстишела, чтобы 2-я реклама подряд не вылезла
        window.vkBridge.send('VKWebAppShowNativeAds',{ad_format:'reward'}).then(()=>{ Ads._lastInter=Date.now(); grant(); }).catch(grant);
      } else { grant(); }
    }catch(e){ grant(); }
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

/* Короткий «клик» как WAV data-URI (для HTMLAudio — переживает видео-сессию iOS, в отличие от WebAudio) */
function _wavDataURI(freq, ms, vol){
  const sr=11025, n=Math.floor(sr*ms/1000), data=new Int16Array(n);
  for(let i=0;i<n;i++){ const t=i/sr, env=Math.exp(-t*38); data[i]=Math.round(Math.sin(2*Math.PI*freq*t)*env*(vol||0.5)*32767); }
  const hb=new ArrayBuffer(44), dv=new DataView(hb), ws=(o,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(o+i,s.charCodeAt(i));};
  ws(0,'RIFF'); dv.setUint32(4,36+n*2,true); ws(8,'WAVE'); ws(12,'fmt '); dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,1,true); dv.setUint32(24,sr,true); dv.setUint32(28,sr*2,true); dv.setUint16(32,2,true); dv.setUint16(34,16,true); ws(36,'data'); dv.setUint32(40,n*2,true);
  const bytes=new Uint8Array(44+n*2); bytes.set(new Uint8Array(hb),0); bytes.set(new Uint8Array(data.buffer),44);
  let bin=''; for(let i=0;i<bytes.length;i++) bin+=String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,'+btoa(bin);
}

/* === Звуки === WebAudio-тоны для акцентов; тап — на HTMLAudio (надёжно после видео). */
const SFX={
  ctx:null, on:true, _tapPool:null, _tapURI:null, _tapIdx:0,
  _htmlTap(){
    try{
      if(!this._tapURI) this._tapURI=_wavDataURI(520,55,0.5);
      if(!this._tapPool){ this._tapPool=[0,1,2].map(()=>{ const a=new Audio(this._tapURI); a.volume=0.4; return a; }); }
      const a=this._tapPool[this._tapIdx=(this._tapIdx+1)%this._tapPool.length];
      a.currentTime=0; a.play().catch(()=>{});
    }catch(e){ try{ this.tone(500,0.045,'triangle',0.05); }catch(_){} }
  },
  _c(){
    // iOS после видео/рекламы уводит контекст в closed/interrupted и resume его не оживляет —
    // в этих состояниях пересоздаём контекст заново (вызывается на каждом тапе-жесте).
    if(this.ctx && (this.ctx.state==='closed' || this.ctx.state==='interrupted')){
      try{ this.ctx.close(); }catch(e){} this.ctx=null;
    }
    if(!this.ctx){ try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
    if(this.ctx && this.ctx.state!=='running'){ try{ this.ctx.resume(); }catch(e){} }
    return this.ctx;
  },
  tone(f,d,type,vol,delay){ if(!this.on)return; const c=this._c(); if(!c)return; const t=c.currentTime+(delay||0); const o=c.createOscillator(),g=c.createGain(); o.type=type||'sine'; o.frequency.value=f; g.gain.setValueAtTime(vol||0.05,t); o.connect(g); g.connect(c.destination); o.start(t); g.gain.exponentialRampToValueAtTime(0.0001,t+d); o.stop(t+d); },
  click(){ this.tone(430,0.07,'triangle',0.045); },
  tap(){ if(!this.on)return; this._htmlTap(); },
  step(){ this.tone(640,0.05,'square',0.03); },
  confirm(){ this.tone(560,0.1,'sine',0.05); this.tone(760,0.12,'sine',0.05,0.07); },
  good(){ this.tone(620,0.12,'sine',0.06); this.tone(820,0.13,'sine',0.06,0.09); this.tone(1040,0.16,'sine',0.05,0.19); },
  bad(){ this.tone(300,0.18,'sawtooth',0.045); this.tone(200,0.22,'sawtooth',0.045,0.11); },
  tick(){ this.tone(900,0.04,'square',0.035); }
};

const EVENTS = {
  company:{ loc:'КОТОПОЛИС · «ДЕВЯТЬ»', emoji:'🏙️', tag:'«Девять»', video:'vid_company.mp4', vtype:'loop',
    title:'«Девять»',
    text:'Маркетплейс и супер-апп Котополиса: здесь покупают всё, заказывают любой сервис и живут онлайн. Миллионы котоморфов каждый день. Это — компания, которую тебе сейчас передадут.',
    choices:[{label:'Войти в компанию →',sub:'Барон ждёт',next:'intro'}] },
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
    cam:{video:'vid_cam_03.mp4', flag:'sawCam03', cap:'Камера поймала момент: Феликс, думая, что один в переговорке, садится в кресло Барона и примеряет власть. Его амбиции — не просто слова. Держи это в уме.'},
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
    cam:{video:'vid_cam_02.mp4', flag:'sawCam02', cap:'На камере: ещё до разговора с тобой Багира что-то шепчет младшему сотруднику — тот бледнеет и кивает. Она вербует людей в свою тень. Её «сделка» — не спонтанная.'},
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
    cam:{video:'vid_cam_01.mp4', flag:'sawCam01', cap:'Камера мельком поймала Василису и Марселя в коридоре — на миг они замерли ближе, чем просто коллеги. Между ними будто тлеет старая искра. Пока — просто наблюдение. Запомни его.'},
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
    cam:{video:'vid_cam_05.mp4', flag:'sawCam05', cap:'Камера подсмотрела: тихий Тиша украдкой оставляет Соне записку и кофе — и убегает, пока не заметила. За гением-интровертом прячется что-то тёплое.'},
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
    choices:[{label:'Сесть за стол переговоров →',sub:'Закрыть сделку',puzzle:'nego'}] },

  /* ===== ГЛАВА 3 · Трещины ===== */
  ch3_intro:{ loc:'ОПЕНСПЕЙС · ТРЕВОГА', emoji:'🚨', tag:'Утечка', img:'ch3_01_leak.jpg',
    title:'Трещины',
    text:'Утро начинается с сирены: система засекла утечку. Часть клиентской базы ушла наружу. Василиса бледна, Барон звонит с одним вопросом: «Кто?». Первый ход — за тобой.',
    choices:[
      {label:'Поднять всех, искать крота открыто.',sub:'Жёстко и быстро',fx:{rep:+3,mor:-5,soul:-2},rel:{vasilisa:+1},set:{huntOpen:true},next:'ch3_bagira'},
      {label:'Тихое расследование, без паники.',sub:'Аккуратно',fx:{soul:+3,cap:-2},rel:{tisha:+2},set:{huntQuiet:true},next:'ch3_bagira'},
      {label:'Замять: «Никакой утечки не было».',sub:'Спасти лицо',fx:{rep:+5,soul:-8},rel:{sonya:-3},set:{coverUp:true},next:'ch3_bagira'} ] },

  ch3_bagira:{ loc:'СТЕКЛЯННАЯ ПЕРЕГОВОРКА', emoji:'🖤', tag:'Багира', img:'ch3_02_bagira.jpg', video:'vid_ch3_bagira.mp4', vtype:'tap',
    cam:{video:'vid_cam_10.mp4', flag:'sawCam10', cap:'Камера засекла Багиру в кафе с человеком конкурента — доверительная беседа явно не по работе, и чужие интересы ей будто ближе твоих. Возможно, крот — это она. Но прямых доказательств пока нет.'},
    title:'Первое подозрение',
    text:'Все взгляды — на Багиру. Слишком много совпадений: доступы, связи, амбиции. Она стоит перед тобой, спокойная и дерзкая: «Думаешь, это я? Докажи».',
    choices:[
      {label:'Предъявить встречу с конкурентом.',sub:'Ты видел её в кафе',fx:{rep:+6,soul:+2},rel:{bagira:-6},set:{accuseBagira:true,bagiraEnemy:true},if:'sawCam10',next:'ch3_cleo'},
      {label:'Надавить без доказательств.',sub:'Рискованно',fx:{rep:-2,mor:-3},rel:{bagira:-4},set:{accuseBagira:true},next:'ch3_cleo'},
      {label:'Поверить ей и искать дальше.',sub:'Доверие или наивность',fx:{soul:+4},rel:{bagira:+3},set:{trustBagira:true},next:'ch3_cleo'},
      {label:'Втихую усилить слежку за ней.',sub:'Холодный расчёт',fx:{cap:+2,soul:-4},rel:{tisha:+1},set:{watchBagira:true},next:'ch3_cleo'} ] },

  ch3_cleo:{ loc:'КОНТЕНТ-СТУДИЯ', emoji:'✨', tag:'Клео', img:'ch3_03_cleo.jpg',
    cam:{video:'vid_cam_06.mp4', flag:'sawCam06', cap:'Камера в пустой уборной: Клео опускает телефон после идеального селфи — улыбка гаснет, катится слеза: «Улыбайся… всем плевать, что внутри». За глянцем прячется совсем другое.'},
    title:'Скандал в ленте',
    text:'Пока ты ищешь крота, в сеть сливают личную переписку Клео — лицо бренда трещит по швам. Телефон разрывается от негатива. Она в панике: «Сделай что-нибудь!».',
    choices:[
      {label:'Прикрыть Клео всей мощью PR.',sub:'−деньги, +человек',fx:{cap:-6,mor:+6,soul:+5},rel:{cleo:+4,murka:+1},set:{cleoProtected:true},next:'ch3_tisha'},
      {label:'Пожертвовать ей ради компании.',sub:'Слить как балласт',fx:{rep:+4,soul:-9},rel:{cleo:-6,sonya:-2},set:{cleoThrown:true},next:'ch3_tisha'},
      {label:'Обратить скандал в пиар.',sub:'Цинично, но выгодно',fx:{cap:+5,rep:+3,soul:-4},rel:{cleo:+1},set:{scandalSpin:true},next:'ch3_tisha'} ] },

  ch3_tisha:{ loc:'СЕРВЕРНАЯ · ОХОТА', emoji:'💻', tag:'Тиша', img:'ch3_04_tisha_hunt.jpg',
    cam:{video:'vid_cam_11.mp4', flag:'sawCam11', cap:'Камера у серверной: Тиша и Соня застряли вдвоём в тесном проходе. Он смущённо: «Ой… извини, тесно тут». Между твоим тихим гением и стажёркой что-то теплится.'},
    title:'След в логах',
    text:'Тиша не спал двое суток и нашёл зацепку — аномальные ночные доступы. «Дай карт-бланш на аудит всех логов — вычислю крота. Но это значит читать всё, что делали люди».',
    choices:[
      {label:'Дать полный доступ к логам.',sub:'Поймать любой ценой',fx:{cap:+3,soul:-6},rel:{tisha:+2},set:{fullAudit:true},next:'ch3_week'},
      {label:'Только по подозреваемым.',sub:'Баланс',fx:{soul:+3,rep:+2},rel:{tisha:+1,sonya:+1},set:{limitedAudit:true},next:'ch3_week'},
      {label:'Свернуть охоту — слишком дорого.',sub:'Замять окончательно',fx:{soul:-2,rep:-4},set:{dropHunt:true},next:'ch3_week'} ] },

  ch3_week:{ loc:'НОЧНОЙ ОФИС · АУДИТ', emoji:'🔎', tag:'Аудит', img:'ch3_05_audit.jpg', video:'vid_ch3_leak.mp4', vtype:'loop',
    title:'Ночь аудита',
    text:'Офис пуст. На столе — распечатки доступов за неделю. Где-то здесь прячется крот: один вход выбивается из всех — ночь, чужие данные, гигабайты наружу. Найди его.',
    choices:[{label:'Открыть журнал доступов →',sub:'Вычислить крота',puzzle:'anomaly'}] },

  /* ===================== ГЛАВА 4 · Цена роста ===================== */
  ch4_intro:{ loc:'ОПЕНСПЕЙС · РОСТ', emoji:'📈', tag:'Рост', img:'ch4_01_growth.jpg',
    cam:{video:'vid_cam_18.mp4', flag:'sawCam18', cap:'Камера: сотрудники сбились в кучки и полушёпотом обсуждают тебя и твои решения. Одни восхищаются, другие качают головой — офис уже живёт слухами.'},
    title:'Цена роста',
    text:'«Девять» прёт вверх: новые столы, новые лица, поток заказов. Но люди трещат по швам — расширяться нужно вчера, а касса не резиновая. С чего начнёшь?',
    choices:[
      {label:'Гнать рост — нанимать всех подряд.',sub:'Скорость важнее',fx:{cap:+8,mor:-6,soul:-4},rel:{felix:+2},set:{growthFast:true},next:'ch4_murka'},
      {label:'Расти аккуратно, беречь людей.',sub:'−темп, +команда',fx:{cap:-3,mor:+7,soul:+5},rel:{murka:+3,vasilisa:+1},set:{growthCare:true},next:'ch4_murka'},
      {label:'Заморозить найм, выжать своих.',sub:'Экономия на пределе',fx:{cap:+5,mor:-9,soul:-5},rel:{grisha:-2,murka:-2},set:{growthSqueeze:true},next:'ch4_murka'} ] },

  ch4_murka:{ loc:'HR-УГОЛОК', emoji:'🧡', tag:'Мурка', img:'ch4_02_murka.jpg', video:'vid_ch4_murka.mp4', vtype:'tap',
    cam:{video:'vid_cam_09.mp4', flag:'sawCam09', cap:'Камера: Мурка тайком доделывает завал уставшего коллеги и оставляет записку «Держись, ты не один». Она тянет чужую боль молча — и сама уже на исходе.'},
    title:'Мурка на пределе',
    text:'Мурка кладёт на стол стопку заявлений: «Люди выгорают. Ещё немного — и я их не удержу. Дай мне рычаги, или мы потеряем лучших».',
    choices:[
      {label:'Ввести день отдыха и заботу о команде.',sub:'−деньги, +душа',fx:{cap:-6,mor:+9,soul:+7},rel:{murka:+4,grisha:+2},set:{careProgram:true},next:'ch4_grisha'},
      {label:'Дать премию за переработки.',sub:'Купить лояльность',fx:{cap:-4,mor:+4},rel:{murka:+1},next:'ch4_grisha'},
      {label:'«Сейчас не время для нежностей».',sub:'Терпи',fx:{cap:+3,mor:-7,soul:-5},rel:{murka:-4},set:{ignoredBurnout:true},next:'ch4_grisha'} ] },

  ch4_grisha:{ loc:'ОТДЕЛ ЛОГИСТИКИ · ЗАВАЛ', emoji:'📦', tag:'Гриша', img:'ch4_03_grisha.jpg',
    cam:{video:'vid_cam_14.mp4', flag:'sawCam14', cap:'Камера поймала тёплый неловкий момент между Муркой и Гришей за поздним кофе. Кажется, здесь зреет не только рабочая дружба.'},
    title:'Гриша тонет в заказах',
    text:'Гриша не уходил домой третьи сутки: «Я вывезу, босс. Но дети меня уже забывают». Он не жалуется — но ты видишь, чего это стоит.',
    choices:[
      {label:'Силой отправить его домой, прикрыть смену.',sub:'Человек важнее',fx:{mor:+6,soul:+6,cap:-3},rel:{grisha:+4},set:{grishaSaved:true},next:'ch4_hire'},
      {label:'Автоматизировать склад алгоритмом Тиши.',sub:'Эффективно, но людей под нож',fx:{cap:+8,soul:-6},rel:{tisha:+2,grisha:-2},set:{autoWarehouse:true},next:'ch4_hire'},
      {label:'«Ещё рывок, потом отдохнёшь».',sub:'Выжать',fx:{cap:+4,mor:-6,soul:-4},rel:{grisha:-4},set:{grishaBroken:true},next:'ch4_hire'} ] },

  ch4_hire:{ loc:'ПЕРЕГОВОРКА · НАЙМ', emoji:'🤝', tag:'Найм', img:'ch4_04_hire.jpg',
    cam:{video:'vid_cam_20.mp4', flag:'sawCam20', cap:'Камера в пустом коридоре: Мурка тихо, себе под нос: «Я всё время спасаю всех… а меня — кто?». За её улыбкой прячется большая усталость.'},
    title:'Кого впустить в команду',
    text:'Перед тобой финалист на ключевую роль: блестящий, но с репутацией «человека-конфликта». Василиса против, Феликс — за. Решать тебе.',
    choices:[
      {label:'Взять звезду — талант решает.',sub:'Риск ради силы',fx:{cap:+7,rep:+3,mor:-3},rel:{felix:+2,vasilisa:-2},set:{hiredShark:true},next:'ch4_week'},
      {label:'Взять надёжного командного игрока.',sub:'Культура важнее',fx:{mor:+5,soul:+4},rel:{vasilisa:+2,murka:+2},set:{hiredTeam:true},next:'ch4_week'},
      {label:'Никого — рано раздувать штат.',sub:'Осторожность',fx:{cap:+4,rep:-2},next:'ch4_week'} ] },

  ch4_week:{ loc:'ОФИС · КОНЕЦ НЕДЕЛИ', emoji:'🗓️', tag:'Смены', img:'ch4_05_shifts.jpg', video:'vid_ch4_growth.mp4', vtype:'loop',
    title:'Собери смену',
    text:'Пик заказов, а людей впритык. Нужно закрыть все слоты недели — и не спалить команду переработками. Раскидай смены с умом.',
    choices:[{label:'Свести график смен →',sub:'Логистика на пределе',puzzle:'shifts'}] },

  /* ===================== ГЛАВА 5 · Точка невозврата ===================== */
  ch5_intro:{ loc:'БОРДРУМ · ИНВЕСТОР', emoji:'💼', tag:'Инвестор', img:'ch5_01_investor.jpg', video:'vid_ch5_investor.mp4', vtype:'tap',
    cam:{video:'vid_cam_25.mp4', flag:'sawCam25', cap:'Камера застала острый момент: двое из твоих на грани — то ли признание, то ли разрыв. Личные драмы кипят прямо под рабочим лоском.'},
    title:'Точка невозврата',
    text:'Крупный инвестор кладёт на стол деньги, каких «Девять» не видела. Но условия жёсткие: контроль, сокращения, его люди в совете. Один росчерк — и назад пути нет.',
    choices:[
      {label:'Взять деньги на его условиях.',sub:'Мощь ценой свободы',fx:{cap:+16,soul:-8,mor:-4},rel:{vasilisa:-2},set:{tookInvestor:true},next:'ch5_marsel'},
      {label:'Торговаться за мягкие условия.',sub:'Баланс',fx:{cap:+7,rep:+2},rel:{vasilisa:+1},set:{softInvestor:true},next:'ch5_marsel'},
      {label:'Отказать — расти на свои.',sub:'Свобода дороже',fx:{cap:-4,soul:+7,mor:+3},rel:{baron:+2,murka:+1},set:{refusedInvestor:true},next:'ch5_marsel'} ] },

  ch5_marsel:{ loc:'У ОКНА · СУМЕРКИ', emoji:'🥃', tag:'Марсель', img:'ch5_02_marsel.jpg',
    cam:{video:'vid_cam_07.mp4', flag:'sawCam07', cap:'Камера: Марсель достаёт из стола старое фото с Василисой и шепчет «Сколько лет прошло…». Он так и не отпустил.'},
    title:'Марсель на распутье',
    text:'Марсель, звезда продаж в кризисе среднего возраста, боится оказаться за бортом при новом инвесторе: «Дай мне большой контракт. Мне надо доказать, что я ещё в игре».',
    choices:[
      {label:'Доверить ему ва-банк-сделку.',sub:'Шанс воскреснуть',fx:{cap:+6,rep:+2},rel:{marsel:+4},set:{trustMarsel:true},next:'ch5_vasilisa'},
      {label:'Поддержать по-человечески, без ставки.',sub:'Тепло, но без риска',fx:{soul:+5,mor:+2},rel:{marsel:+2},next:'ch5_vasilisa'},
      {label:'Намекнуть, что его время уходит.',sub:'Жёстко и честно',fx:{cap:+2,soul:-4},rel:{marsel:-5},set:{marselCrushed:true},next:'ch5_vasilisa'} ] },

  ch5_vasilisa:{ loc:'КОРИДОР · ПОЗДНО', emoji:'💞', tag:'Василиса', img:'ch5_03_marsel_vasilisa.jpg', video:'vid_ch5_corridor.mp4', vtype:'tap',
    cam:{video:'vid_cam_16.mp4', flag:'sawCam16', cap:'Камера засекла: Марсель и Василиса ужинают вдвоём при свечах далеко от офиса. Это уже не про работу — между твоими топами настоящий роман.'},
    title:'Тайна двоих',
    text:'Ты случайно застаёшь Марселя и Василису вместе — между ними явно не только прошлое. Роман двух ключевых топов может стать и силой, и бомбой. Как поступишь?',
    choices:[
      {label:'Благословить — пусть будут счастливы.',sub:'Человечность',fx:{soul:+6,mor:+4},rel:{vasilisa:+3,marsel:+3},set:{blessRomance:true,romanceMV:true},next:'ch5_doubt'},
      {label:'Сделать вид, что не заметил.',sub:'Не лезть',fx:{soul:+1},set:{romanceMV:true},next:'ch5_doubt'},
      {label:'Запретить: «Личное мешает делу».',sub:'Холодный расчёт',fx:{cap:+3,soul:-6,mor:-4},rel:{vasilisa:-4,marsel:-3},set:{banRomance:true},next:'ch5_doubt'} ] },

  ch5_doubt:{ loc:'ТЁМНЫЙ ОФИС · НОЧЬ', emoji:'🌃', tag:'Развилка', img:'ch5_04_doubt.jpg',
    title:'Ночь без сна',
    text:'Один на один с городом за стеклом ты чувствуешь: это точка невозврата. Каким боссом ты станешь дальше — решается сегодня.',
    choices:[
      {label:'Клятва: люди — не расходник.',sub:'Путь души (закрывает «Империю»)',fx:{soul:+9,mor:+6,cap:-4},set:{vowSoul:true},next:'ch5_week'},
      {label:'Клятва: победа любой ценой.',sub:'Путь силы (закрывает «Тёплый дом»)',fx:{cap:+10,rep:+5,soul:-9},set:{vowPower:true},next:'ch5_week'},
      {label:'Не зарекаться — плыть по ситуации.',sub:'Канатоходец',fx:{rep:+2},set:{vowNone:true},next:'ch5_week'} ] },

  ch5_week:{ loc:'КАБИНЕТ · СЕЙФ', emoji:'🔐', tag:'Сейф', img:'ch5_05_safe.jpg',
    title:'Шифр сейфа',
    text:'Условия сделки заперты в сейфе Барона — он оставил тебе только подсказки к коду. Вскрой его прежде, чем истечёт срок предложения.',
    choices:[{label:'Подобрать код →',sub:'Дедукция под таймер',puzzle:'safe'}] },

  /* ===================== ГЛАВА 6 · Бунт зреет ===================== */
  ch6_intro:{ loc:'КОРПОРАЦИЯ · СТАДИЯ 3', emoji:'🔥', tag:'Феликс', img:'ch6_01_felix.jpg', video:'vid_ch6_felix.mp4', vtype:'tap',
    cam:{video:'vid_cam_08.mp4', flag:'sawCam08', cap:'Камера: Феликс собирает молодых в углу — «Старики боятся, а мы нет. Со мной?». Он сколачивает свою фракцию прямо у тебя под носом.'},
    title:'Бунт зреет',
    text:'Компания выросла в корпорацию — и Феликс почувствовал силу. Он открыто спорит с тобой на планёрке, за ним тянется молодёжь. Ставки на лидерство растут.',
    choices:[
      {label:'Дать Феликсу больше власти.',sub:'Приручить амбицию',fx:{cap:+7,rep:+3,soul:-3},rel:{felix:+4,vasilisa:-2},set:{gaveFelix:true},next:'ch6_split'},
      {label:'Поставить его на место при всех.',sub:'Показать, кто босс',fx:{rep:+2,mor:-3},rel:{felix:-5},set:{crushedFelix:true},next:'ch6_split'},
      {label:'Поговорить один на один, по-честному.',sub:'Наставник',fx:{soul:+5,mor:+3},rel:{felix:+1},set:{mentoredFelix:true},next:'ch6_split'} ] },

  ch6_split:{ loc:'ОПЕНСПЕЙС · РАСКОЛ', emoji:'⚔️', tag:'Раскол', img:'ch6_02_split.jpg',
    cam:{video:'vid_cam_13.mp4', flag:'sawCam13', cap:'Камера: Феликс за твоей спиной закатывает глаза и едко шепчет своим. Его лояльность — только на словах.'},
    title:'Два лагеря',
    text:'Офис расколот: одни за старую гвардию Василисы, другие — за молодых Феликса. Каждый смотрит, чью сторону примешь ты.',
    choices:[
      {label:'Опереться на опытную Василису.',sub:'Стабильность',fx:{rep:+4,cap:+2},rel:{vasilisa:+4,felix:-3},set:{sideVasilisa:true},next:'ch6_baron'},
      {label:'Сделать ставку на молодых.',sub:'Кровь и драйв',fx:{cap:+5,soul:-2},rel:{felix:+3,vasilisa:-4},set:{sideFelix:true},next:'ch6_baron'},
      {label:'Держать обе стороны в балансе.',sub:'Канатоходец',fx:{soul:+3,rep:+1},set:{sideBalance:true},next:'ch6_baron'} ] },

  ch6_baron:{ loc:'КАБИНЕТ БАРОНА', emoji:'🎩', tag:'Барон', img:'ch6_03_baron.jpg',
    cam:{video:'vid_cam_12.mp4', flag:'sawCam12', cap:'Камера подсмотрела секрет Барона: он хранит папку с грехами компании прошлых лет. У основателя есть свои скелеты — и он знает про тебя больше, чем говорит.'},
    title:'Совет основателя',
    text:'Барон приходит с виски и тихой мудростью: «Бунт — не про Феликса. Он про то, верят ли в тебя. Реши, кем ты хочешь остаться в их памяти».',
    choices:[
      {label:'Прислушаться и обнять команду.',sub:'+доверие',fx:{soul:+6,mor:+5},rel:{baron:+3,murka:+2},set:{heedBaron:true},next:'ch6_meeting'},
      {label:'Поблагодарить, но идти своим путём.',sub:'Своя воля',fx:{rep:+2},rel:{baron:-1},next:'ch6_meeting'},
      {label:'Отмахнуться: «Ваше время прошло».',sub:'Сжечь мост',fx:{cap:+2,soul:-5},rel:{baron:-5},set:{spurnedBaron:true},next:'ch6_meeting'} ] },

  ch6_meeting:{ loc:'ПЕРЕГОВОРКА · НОЧЬ', emoji:'🕯️', tag:'Заговор', img:'ch6_04_secret_meeting.jpg', video:'vid_ch6_tension.mp4', vtype:'loop',
    cam:{video:'vid_cam_23.mp4', flag:'sawCam23', cap:'Камера: Феликс с ядром своих чертит план на доске и стирает при звуке шагов. Переворот зреет всерьёз — вопрос лишь, когда.'},
    title:'Тайная сходка',
    text:'Тебе доносят: сегодня ночью в переговорке собираются «недовольные». Клубок интриг затягивается — пора распутать, кто дёргает за нити.',
    choices:[{label:'Разобраться в схеме заговора →',sub:'Найти зачинщика',puzzle:'maze'}] },

  /* ===================== ГЛАВА 7 · Предательство ===================== */
  ch7_intro:{ loc:'КРИЗИСНОЕ СОВЕЩАНИЕ', emoji:'🎯', tag:'Разоблачение', img:'ch7_01_reveal.jpg',
    cam:{video:'vid_cam_24.mp4', flag:'sawCam24', cap:'Камера засекла крота за передачей данных наружу. Лицо в тени — но теперь ясно: утечка идёт изнутри, и это кто-то из своих.'},
    title:'Предательство',
    text:'Тиша выводит на экран улику: крот всё это время был внутри. В зале — шок. Все ждут, что ты сделаешь с предателем.',
    choices:[
      {label:'Публично разоблачить и уволить.',sub:'Жёстко и показательно',fx:{rep:+6,mor:-4,soul:-3},rel:{tisha:+2},set:{publicPurge:true},next:'ch7_bagira'},
      {label:'Разобраться тихо, без крови.',sub:'Сохранить лицо компании',fx:{soul:+4,rep:+2},rel:{vasilisa:+2},set:{quietPurge:true},next:'ch7_bagira'},
      {label:'Дать предателю второй шанс.',sub:'Милосердие или слабость',fx:{soul:+6,rep:-5},rel:{murka:+2,felix:-2},set:{spareMole:true},next:'ch7_bagira'} ] },

  ch7_bagira:{ loc:'СТЕКЛЯННЫЙ КАБИНЕТ', emoji:'🖤', tag:'Багира', img:'ch7_02_bagira.jpg', video:'vid_ch7_bagira.mp4', vtype:'tap',
    cam:{video:'vid_cam_19.mp4', flag:'sawCam19', cap:'Камера: Багира подбрасывает улику в стол Феликса и довольно усмехается. Кто-то станет её козлом отпущения — и это не она.'},
    title:'Ход Багиры',
    text:'Багира наносит удар: у неё компромат, способный обрушить и тебя, и половину совета. «Мы можем договориться. Или можем воевать. Выбирай».',
    choices:[
      {label:'Ударить первым — сорвать ей маску.',sub:'Ты знаешь про подставу Феликса',fx:{rep:+5,soul:+2},rel:{bagira:-6,felix:+2},set:{exposeBagira:true},if:'sawCam19',next:'ch7_leave'},
      {label:'Пойти на сделку с ней.',sub:'Грязно, но выживешь',fx:{cap:+8,soul:-9,rep:-3},rel:{bagira:+3},set:{dealBagira:true},next:'ch7_leave'},
      {label:'Воевать в открытую, без гарантий.',sub:'Принципы против компромата',fx:{soul:+6,rep:-4},rel:{bagira:-5},set:{warBagira:true},next:'ch7_leave'} ] },

  ch7_leave:{ loc:'КОРИДОР · ПРОЩАНИЕ', emoji:'📦', tag:'Уход', img:'ch7_03_leave.jpg', video:'vid_ch7_leave.mp4', vtype:'loop',
    cam:{video:'vid_cam_04.mp4', flag:'sawCam04', cap:'Камера: Багира глубокой ночью листает чужие папки и фотографирует документы. Она давно собирала компромат — терпеливо и на всех сразу.'},
    title:'Кто-то уходит',
    text:'Цена этой недели — живой человек. Один из твоих собирает коробку и идёт к выходу. Ты можешь остановить его — или отпустить.',
    choices:[
      {label:'Догнать и удержать любой ценой.',sub:'Никого не бросаю',fx:{cap:-5,mor:+7,soul:+6},rel:{murka:+2,grisha:+2},set:{keptEveryone:true},next:'ch7_week'},
      {label:'Отпустить с достоинством.',sub:'Тёплое прощание',fx:{soul:+3,mor:+1},set:{lostOne:true},next:'ch7_week'},
      {label:'Пусть уходит — слабым не место.',sub:'Холод',fx:{cap:+3,mor:-6,soul:-5},rel:{murka:-3},set:{coldFarewell:true,lostOne:true},next:'ch7_week'} ] },

  ch7_week:{ loc:'СЕРВЕРНАЯ · АУДИТ-СЕТКА', emoji:'🧮', tag:'Аудит', img:'ch7_05_grid.jpg',
    title:'Аудит-сетка',
    text:'Чтобы закрыть дыру навсегда, надо перекрёстно свести журналы: кто, когда и к чему тянулся. Найди в сетке единственный след, что выдаёт сообщника крота.',
    choices:[{label:'Открыть аудит-сетку →',sub:'Свести улики',puzzle:'grid'}] },

  /* ===================== ГЛАВА 8 · На грани ===================== */
  ch8_intro:{ loc:'ВАР-РУМ · CRITICAL', emoji:'🚨', tag:'Кризис', img:'ch8_01_crisis.jpg', video:'vid_ch8_crisis.mp4', vtype:'loop',
    cam:{video:'vid_cam_17.mp4', flag:'sawCam17', cap:'Камера: Тиша молча встал между Соней и тем, кто повысил на неё голос. Тихий гений умеет быть щитом — когда дело касается её.'},
    title:'На грани',
    text:'Всё сходится в одну ночь: графики рушатся, инвестор давит, конкурент почуял кровь. «Девять» на грани. Нужен ход — ва-банк.',
    choices:[
      {label:'Резать косты по-живому.',sub:'+касса, −люди',fx:{cap:+10,mor:-8,soul:-5},rel:{murka:-2,grisha:-2},set:{deepCuts:true},next:'ch8_romance'},
      {label:'Сплотить команду и держать удар вместе.',sub:'−касса, +дух',fx:{cap:-5,mor:+9,soul:+6},rel:{vasilisa:+2,murka:+2},set:{rallyTeam:true},next:'ch8_romance'},
      {label:'Рискнуть всем на один большой контракт.',sub:'Орёл или решка',fx:{rep:+4,soul:-2},set:{betBig:true},next:'ch8_romance'} ] },

  ch8_romance:{ loc:'У ОКНА · ТИХИЙ МИГ', emoji:'💗', tag:'Тиша и Соня', img:'ch8_02_romance.jpg',
    cam:{video:'vid_cam_22.mp4', flag:'sawCam22', cap:'Камера подсмотрела первый несмелый поцелуй Тиши и Сони у серверной. Посреди хаоса между ними — по-настоящему.'},
    title:'Свет посреди бури',
    text:'В разгар аврала Тиша и Соня находят тихий угол и минуту тепла. Это хрупко — и очень человечно. Заметишь ли ты живых людей за цифрами?',
    choices:[
      {label:'По-тихому поддержать их.',sub:'Пусть будет свет',fx:{soul:+7,mor:+5},rel:{tisha:+3,sonya:+3},set:{romanceTS:true,blessTS:true},next:'ch8_nego'},
      {label:'Не вмешиваться — их дело.',sub:'Уважение',fx:{soul:+2},set:{romanceTS:true},next:'ch8_nego'},
      {label:'Осадить: «Не на работе».',sub:'Сушь',fx:{cap:+1,soul:-5,mor:-3},rel:{tisha:-3,sonya:-3},set:{banTS:true},next:'ch8_nego'} ] },

  ch8_nego:{ loc:'ПЕРЕГОВОРНЫЙ СТОЛ · НОЧЬ', emoji:'🤝', tag:'Ва-банк', img:'ch8_03_negotiation.jpg', video:'vid_ch8_partner.mp4', vtype:'tap',
    cam:{video:'vid_cam_15.mp4', flag:'sawCam15', cap:'Камера: Клео тайком встречается с кем-то из чужой команды и передаёт конверт. Её блеск скрывает собственную игру — на чьей она стороне?'},
    title:'Решающая сделка',
    text:'Оппонент прижал тебя к стене: одна ошибка — и от «Девять» ничего не останется. Пора за стол — жёстче, чем когда-либо.',
    choices:[{label:'Сесть за стол ва-банк →',sub:'Переговоры на грани',puzzle:'nego2'}] },

  /* ===================== ГЛАВА 9 · Расплата ===================== */
  ch9_intro:{ loc:'ГАЛЕРЕЯ ДОСТИЖЕНИЙ', emoji:'⚖️', tag:'Расплата', img:'ch9_01_consequences.jpg', video:'vid_ch9_reckoning.mp4', vtype:'loop',
    cam:{video:'vid_cam_21.mp4', flag:'sawCam21', cap:'Камера: Василиса и Багира тихо жмут руки в тёмной переговорке. Две сильнейшие женщины офиса о чём-то договорились — вопрос лишь, против кого.'},
    title:'Всё возвращается',
    text:'Барон ведёт тебя вдоль стены с вехами компании: «Каждое твоё решение оставило след. Сегодня они все возвращаются за ответом». Пора держать его.',
    choices:[
      {label:'Принять всё, что сделал — и хорошее, и грязь.',sub:'Честность с собой',fx:{soul:+7,rep:+2},rel:{baron:+2},set:{ownedIt:true},next:'ch9_emotional'},
      {label:'Оправдать себя результатом.',sub:'Цель оправдала средства',fx:{cap:+3,soul:-4},set:{justified:true},next:'ch9_emotional'},
      {label:'Свалить вину на обстоятельства.',sub:'Не моя вина',fx:{soul:-6},rel:{baron:-2,sonya:-2},set:{blameShift:true},next:'ch9_emotional'} ] },

  ch9_emotional:{ loc:'КАБИНЕТ · РАЗБОР', emoji:'💔', tag:'Клео', img:'ch9_02_emotional.jpg',
    cam:{video:'vid_cam_26.mp4', flag:'sawCam26', cap:'Камера: Клео стирает макияж и смотрит в зеркало на настоящую себя — без фильтров и блеска. Она устала быть витриной.'},
    title:'Счёт от своих',
    text:'Клео срывается: «Ты использовал моё лицо, мой хайп — а меня саму хоть раз спросил?». За месяцы накопилось у многих. Что ответишь?',
    choices:[
      {label:'Искренне извиниться и услышать.',sub:'+душа, +люди',fx:{soul:+7,mor:+4},rel:{cleo:+4,murka:+2},set:{madeAmends:true},next:'ch9_team'},
      {label:'Признать вину, но напомнить о деле.',sub:'Баланс',fx:{soul:+2,rep:+1},rel:{cleo:+1},next:'ch9_team'},
      {label:'Отрезать: «Бизнес не про чувства».',sub:'Лёд',fx:{cap:+2,soul:-7},rel:{cleo:-5},set:{coldToCleo:true},next:'ch9_team'} ] },

  ch9_team:{ loc:'АТРИУМ · КОМАНДА', emoji:'👥', tag:'Команда', img:'ch9_04_team.jpg',
    cam:{video:'vid_cam_27.mp4', flag:'sawCam27', cap:'Камера: команда разбилась на два лагеря — одни за тебя горой, другие точат ножи. Скоро выбор станет их, а не твоим.'},
    title:'Команда ждёт',
    text:'Ключевые люди собрались и смотрят на тебя. Через неделю решится судьба «Девять» — и они хотят знать, за кем идти. Что ты им дашь?',
    choices:[
      {label:'Честную правду и общий план.',sub:'Доверие',fx:{soul:+5,mor:+6,rep:+2},rel:{vasilisa:+2,murka:+2,grisha:+1},set:{gaveTruth:true},next:'ch9_week'},
      {label:'Вдохновляющую, но полуправду.',sub:'Пиар',fx:{rep:+4,soul:-2},rel:{cleo:+1},set:{gaveSpin:true},next:'ch9_week'},
      {label:'Приказ без объяснений.',sub:'Власть',fx:{cap:+2,mor:-5,soul:-3},rel:{felix:-1},set:{gaveOrders:true},next:'ch9_week'} ] },

  ch9_week:{ loc:'КАБИНЕТ · ВЕСЫ', emoji:'⚖️', tag:'Весы', img:'ch9_05_scales.jpg',
    title:'Весы решений',
    text:'Перед финалом — последний холодный расчёт. На одной чаше прибыль, на другой — люди и душа компании. Найди баланс, с которым сможешь жить.',
    choices:[{label:'Взвесить решения →',sub:'Прибыль против души',puzzle:'scales'}] },

  /* ===================== ГЛАВА 10 · Кто поведёт (финал) ===================== */
  ch10_intro:{ loc:'БОРДРУМ · СОВЕТ', emoji:'👑', tag:'Финал', img:'ch10_01_council.jpg', video:'vid_ch9_baron.mp4', vtype:'tap',
    cam:{video:'vid_cam_28.mp4', flag:'sawCam28', cap:'Камера раскрыла истинный мотив Багиры: за всеми интригами — не жадность, а старая рана и месть. Теперь ты видишь её насквозь.'},
    title:'Кто поведёт «Девять»',
    text:'Совет в сборе. Все линии сошлись: инвестор, Феликс, Багира, команда — все ждут твоего последнего слова о будущем компании.',
    choices:[
      {label:'Оставить компанию людям и себе.',sub:'Курс на душу',fx:{soul:+6,mor:+4},set:{finalSoul:true},next:'ch10_key'},
      {label:'Отдать штурвал сильнейшему ради роста.',sub:'Курс на власть',fx:{cap:+6,rep:+3,soul:-4},set:{finalPower:true},next:'ch10_key'},
      {label:'Ещё не решил — пусть решит финал.',sub:'Открытый путь',fx:{rep:+1},next:'ch10_key'} ] },

  ch10_key:{ loc:'БОРДРУМ · КЛЮЧ', emoji:'🗝️', tag:'Барон', img:'ch10_02_key.jpg', video:'vid_ch10_baron.mp4', vtype:'tap',
    cam:{video:'vid_cam_29.mp4', flag:'sawCam29', cap:'Камера: Барон пишет тебе письмо-завещание и прячет в сейф: «Если читаешь это — значит, пора». Он всё решил про тебя давно.'},
    title:'Передача ключа',
    text:'Барон кладёт тебе в ладонь золотой ключ от «Девять»: «Компания теперь твоя. Помни — за каждой цифрой стоит живой кот». Остался один, последний выбор.',
    choices:[
      {label:'Принять ключ и всё, что с ним.',sub:'Твоя ответственность',fx:{soul:+3},rel:{baron:+2},set:{tookKey:true},next:'ch10_final'},
      {label:'Принять — и мысленно уже отпустить.',sub:'Устал, как когда-то Барон',fx:{soul:+1,mor:-1},set:{wearyKey:true},next:'ch10_final'} ] },

  ch10_final:{ loc:'БОРДРУМ · РАССВЕТ', emoji:'🌅', tag:'Развязка', img:'ch10_03_choice.jpg', video:'vid_ch10_ending.mp4', vtype:'loop',
    cam:{video:'vid_cam_30.mp4', flag:'sawCam30', cap:'Камера сводит всё воедино: каждый в офисе занял свою сторону. Финал близко — и он будет полностью твоим.'},
    title:'Последнее слово',
    text:'Рассвет над Котополисом. Пустой бордрум, золотой ключ в руке и вся история за спиной. Каким боссом ты вошёл в этот кабинет — таким его и покинешь.',
    choices:[{label:'Произнести финальное решение →',sub:'Узнать свою концовку',puzzle:'finale'}] }
};

/* Карта глав: weekNum → стартовое событие. 3–7 добавим по мере наполнения. */
const CHAPTERS={ 1:{start:'intro'}, 2:{start:'ch2_intro'}, 3:{start:'ch3_intro'},
  4:{start:'ch4_intro'}, 5:{start:'ch5_intro'}, 6:{start:'ch6_intro'}, 7:{start:'ch7_intro'},
  8:{start:'ch8_intro'}, 9:{start:'ch9_intro'}, 10:{start:'ch10_intro'} };
const MAX_CHAPTER=10;

/* ===== Движок ===== */
const SAVE_KEY='devyat9_slice_save';
let state=null;
const $=id=>document.getElementById(id);
const clamp=v=>Math.max(0,Math.min(100,v));
function fresh(){return{cur:'company',m:{...START},flags:{},rel:{},weekNum:1,awaitingNext:false,lockArmedFor:null};}
function load(){try{return JSON.parse(localStorage.getItem(SAVE_KEY));}catch(e){return null;}}
function save(){ if(state)localStorage.setItem(SAVE_KEY,JSON.stringify(state)); cloudSave(); flashSaved(); }

function show(id){
  // уходя с игрового экрана — глушим и останавливаем видео сцены
  if(id!=='screen-game'){ try{const v=$('scene-vid'); v.pause(); v.muted=true; v.removeAttribute('src'); v.load&&v.load();}catch(e){} }
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $(id).classList.add('active');
  // страницу скроллит body — просто прокручиваем в начало нового экрана
  try{ window.scrollTo(0,0); }catch(e){}
}

/* Зоны метрик: во время главы показываем СЛОВО, а не точное число (интрига + меньше мин-макса) */
function metricZone(v){
  if(v>=60) return {w:'крепко',   c:'#4bbf87'};
  if(v>=40) return {w:'норма',    c:'#D4AF6A'};
  if(v>=20) return {w:'шатко',    c:'#e0954a'};
  return              {w:'на грани', c:'#e0555f'};
}
function renderMetrics(){
  for(const k of['cap','rep','mor','soul']){
    const v=state.m[k], z=metricZone(v), vs=$('v-'+k), b=$('b-'+k);
    vs.textContent=z.w; vs.style.color=z.c; vs.style.fontSize='11.5px'; vs.style.fontFamily="'Oswald',sans-serif"; vs.style.letterSpacing='.3px';
    b.style.width=clamp(v)+'%'; b.style.background=z.c;
    const card=vs.parentNode && vs.parentNode.parentNode ? vs.parentNode.parentNode : null;
    if(card){ if(v<20) card.classList.add('danger'); else card.classList.remove('danger'); }
  }
}

const NAME={baron:'Барон',sonya:'Соня',felix:'Феликс',grisha:'Гриша',vasilisa:'Василиса',bagira:'Багира',cleo:'Клео',murka:'Мурка',tisha:'Тиша',marsel:'Марсель'};
function showFloats(fx,rel){const box=$('floats');box.innerHTML='';const items=[];if(fx)for(const k in fx)items.push(`${METRIC_NAMES[k]} ${fx[k]>0?'+':''}${fx[k]}`);if(rel)for(const r in rel)items.push(`${NAME[r]||r} ${rel[r]>0?'+':''}${rel[r]}`);items.forEach((t,i)=>{const el=document.createElement('div');el.className='float';el.textContent=t;el.style.animationDelay=(i*0.12)+'s';box.appendChild(el);});}

const NEG_AMP=1.35, POS_DAMP=0.7;   // минусы бьют сильнее, плюсы скромнее → метрики не упираются в 100, трейд-офф реальный
function applyFx(fx){ const eff={}; for(const k in (fx||{})){ let v=fx[k]; v = v<0 ? Math.round(v*NEG_AMP) : Math.max(1,Math.round(v*POS_DAMP)); eff[k]=v; state.m[k]=clamp(state.m[k]+v); } return eff; }
function applyChoice(ch){
  const eff=applyFx(ch.fx);                        // фактически применённые изменения (для флоатов)
  if(ch.rel)for(const r in ch.rel)state.rel[r]=(state.rel[r]||0)+ch.rel[r];
  if(ch.set)for(const f in ch.set)state.flags[f]=ch.set[f];
  showFloats(eff,ch.rel); renderMetrics();
  // мягкий проигрыш: метрика упала в 0 → тематический Game Over (только с 3-й главы; гл.1–2 — зацепка)
  const dead=deadMetric();
  if(dead && (state.weekNum||1)>=3) return setTimeout(()=>gameOver(dead),450);
  if(ch.puzzle)return startPuzzle(ch.puzzle);
  if(ch.end)return endSlice();
  state.cur=ch.next; save(); setTimeout(renderEvent,400);
}
function deadMetric(){ for(const k of['cap','rep','mor','soul']) if(state.m[k]<=0) return k; return null; }
function gameOver(k){
  try{SFX.bad();}catch(e){}
  const L={
    cap:{t:'💥 Банкротство', vid:'vid_lose_cap.mp4', d:'Касса пуста. «Девять» не может платить по счетам — совет объявляет банкротство и снимает тебя с поста. Игра окончена.'},
    rep:{t:'📉 Крах репутации', vid:'vid_lose_rep.mp4', d:'Имя компании уничтожено, клиенты и партнёры бегут. Совет срочно ищет замену — и это уже не ты. Игра окончена.'},
    mor:{t:'🔥 Бунт', vid:'vid_lose_mor.mp4', d:'Команда выгорела и восстала. Люди уходят пачками, оставшиеся требуют твоей отставки. Тебя свергают. Игра окончена.'},
    soul:{t:'🕳️ Бездушная машина', vid:'vid_lose_soul.mp4', d:'От компании осталась пустая оболочка без души и доверия. Совет ставит другого «эффективного» — а ты уходишь ни с чем. Игра окончена.'}
  }[k];
  localStorage.removeItem(SAVE_KEY);
  $('screen-end').innerHTML=`<div class="end-wrap">
    <div class="end-kicker">Глава ${state.weekNum||1} · проигрыш</div>
    <video class="cam-video" playsinline autoplay loop muted src="${CLIP_DIR}${L.vid}?v=1" style="max-height:34vh;margin:0 auto 14px;" onerror="this.style.display='none'"></video>
    <h2>${L.t}</h2>
    <p>${L.d}</p>
    <div class="stat-row">💰 ${Math.round(state.m.cap)} · ⭐ ${Math.round(state.m.rep)} · ❤️ ${Math.round(state.m.mor)} · 🔮 ${Math.round(state.m.soul)}</div>
    <p class="end-note">Баланс — это всё. Одну чашу нельзя топить ради другой.</p>
    <button class="btn" style="min-width:240px;margin-bottom:10px;" onclick="Ads.rewarded(replayChapter)">🔄 Переиграть неделю (реклама)</button>
    <button class="btn btn-primary" style="min-width:240px;" onclick="hardReset()">↺ Начать заново</button>
  </div>`;
  const v=$('screen-end').querySelector('video'); if(v) v.play().catch(()=>{});
  show('screen-end');
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
  try{ window.scrollTo(0,0); }catch(e){}   // каждая новая сцена — сверху, с шапки и метрик
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
  $('week').textContent='Неделя '+(state.weekNum||1);
  $('title-ev').textContent=ev.title;
  $('text').innerHTML=(state.cur==='week')?weekText():(state.cur==='ch2_grisha')?ch2GrishaText():ev.text;
  const box=$('choices');box.innerHTML='';
  ev.choices.filter(ch=>!ch.if || state.flags[ch.if]).forEach(ch=>{const b=document.createElement('button');b.className='choice';b.innerHTML=ch.label+(ch.sub?`<small>${ch.sub}</small>`:'');b.onclick=()=>applyChoice(ch);box.appendChild(b);});
  if(ev.cam && !state.flags[ev.cam.flag]){
    const cb=document.createElement('button'); cb.className='choice cam-btn';
    cb.innerHTML='🎥 Заглянуть в камеру<small>реклама · подсмотреть тайную сцену</small>';
    cb.onclick=()=>{ Ads.rewarded(()=>openCam(ev.cam)); };
    box.appendChild(cb);
  }
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
  } else if(w===2){
    if(f.priceWar) L.push('⚔️ Ты ответил демпингом — клиентов держишь ценой, но касса худеет.');
    if(f.qualityPlay) L.push('💎 Ставка на качество — медленно, зато репутация крепнет.');
    if(f.poaching) L.push('🎯 Перекуп чужого топа сработал — деньги пришли, но осадок и враг нажиты.');
    if(f.surveillance) L.push('👁️ Слежка за данными людей дала предсказания — и трещину в доверии.');
  } else if(w===3){
    if(f.coverUp) L.push('🙈 Ты замял утечку — тишина купила время, но правда любит всплывать.');
    if(f.huntOpen) L.push('🚨 Открытая охота на крота встряхнула офис — и посеяла страх среди своих.');
    if(f.accuseBagira) L.push('🖤 Ты обвинил Багиру — если ошибся, нажил умного врага; если прав, отвёл удар.');
    if(f.trustBagira) L.push('🤝 Ты поверил Багире — она это запомнит. Вопрос лишь, во благо ли.');
    if(f.cleoProtected) L.push('✨ Ты закрыл Клео собой — она предана тебе, но это стоило денег.');
    if(f.cleoThrown) L.push('💔 Ты слил Клео ради компании — команда увидела, что ты умеешь предавать.');
    if(f.scandalSpin) L.push('🎭 Ты обратил скандал в пиар — цинично, но охваты и касса выросли.');
    if(f.fullAudit) L.push('👁️ Тотальный аудит логов ловит крота — и подтачивает доверие в офисе.');
    if(f.dropHunt) L.push('🚪 Ты свернул охоту — крот остался внутри. Бомба замедленного действия.');
  } else if(w===4){
    if(f.careProgram) L.push('🧡 Ты ввёл заботу о команде — выгорание отступило, люди дышат.');
    if(f.ignoredBurnout) L.push('🔥 Ты отмахнулся от выгорания — лучшие уже поглядывают на выход.');
    if(f.grishaSaved) L.push('📦 Ты отправил Гришу к семье — он вернулся с новой силой и преданностью.');
    if(f.grishaBroken) L.push('💔 Ты выжал Гришу до конца — он держится на честном слове.');
    if(f.autoWarehouse) L.push('🤖 Склад автоматизирован — быстро и дёшево, но люди напряглись.');
    if(f.hiredShark) L.push('🦈 Ты взял скандальную звезду — талант есть, мир в офисе под вопросом.');
    if(f.hiredTeam) L.push('🤝 Ты взял командного игрока — культура крепнет.');
  } else if(w===5){
    if(f.tookInvestor) L.push('💼 Ты впустил инвестора на его условиях — деньги пришли, свобода ушла.');
    if(f.refusedInvestor) L.push('🕊️ Ты отказал инвестору — растёшь на свои, но медленнее.');
    if(f.romanceMV) L.push('💞 Роман Марселя и Василисы вышел из тени — сила это или трещина, покажет время.');
    if(f.banRomance) L.push('🚫 Ты запретил их роман — двое ключевых топов затаили обиду.');
    if(f.vowSoul) L.push('🔮 Ты поклялся: люди — не расходник. Путь души выбран.');
    if(f.vowPower) L.push('⚡ Ты поклялся: победа любой ценой. Путь силы выбран.');
  } else if(w===6){
    if(f.gaveFelix) L.push('🚀 Ты дал Феликсу власть — приручил амбицию или вырастил соперника.');
    if(f.crushedFelix) L.push('⚔️ Ты осадил Феликса при всех — послушен внешне, опасен внутри.');
    if(f.mentoredFelix) L.push('🧭 Ты стал Феликсу наставником — ставка на доверие.');
    if(f.sideVasilisa) L.push('🛡️ Ты сделал ставку на старую гвардию — стабильность против драйва.');
    if(f.sideFelix) L.push('🔥 Ты сделал ставку на молодых — драйв против опыта.');
    if(f.spurnedBaron) L.push('🎩 Ты отмахнулся от Барона — сжёг мост с основателем.');
  } else if(w===7){
    if(f.publicPurge) L.push('🎯 Ты показательно казнил предателя — дисциплина ценой страха.');
    if(f.spareMole) L.push('🤍 Ты пощадил крота — милосердие, которое сочли слабостью.');
    if(f.exposeBagira) L.push('🖤 Ты сорвал маску с Багиры — умный враг повержен.');
    if(f.dealBagira) L.push('🤝 Ты пошёл на сделку с Багирой — выжил, но теперь ей должен.');
    if(f.keptEveryone) L.push('🫂 Ты не дал уйти никому — команда это запомнила.');
    if(f.coldFarewell) L.push('🧊 Ты холодно отпустил уходящего — осадок у всех.');
  } else if(w===8){
    if(f.deepCuts) L.push('✂️ Ты резал косты по-живому — касса спасена, люди в шоке.');
    if(f.rallyTeam) L.push('🔥 Ты сплотил команду против кризиса — дух крепче стали.');
    if(f.romanceTS) L.push('💗 Роман Тиши и Сони расцвёл — свет посреди бури.');
    if(f.banTS) L.push('🚫 Ты запретил Тише и Соне — погасил редкий тёплый огонёк.');
  } else if(w===9){
    if(f.madeAmends) L.push('🙏 Ты повинился перед своими — многое прощено.');
    if(f.coldToCleo) L.push('🧊 Ты отрезал Клео — «бизнес не про чувства» дорого стоит.');
    if(f.gaveTruth) L.push('🕯️ Ты дал команде честную правду — за таким идут.');
    if(f.gaveOrders) L.push('📢 Ты дал приказ без объяснений — власть без доверия.');
    if(f.balanced) L.push('⚖️ Ты нашёл баланс прибыли и души — редкая мудрость.');
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
const VK_APP_LINK='https://vk.com/app54658940';
/* Рисуем сторис-картинку 1080×1920 с результатом (скор + 4 метрики + бренд) */
function buildStoryImage(){
  const W=1080,H=1920,c=document.createElement('canvas'); c.width=W;c.height=H; const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,'#1a1c2b'); g.addColorStop(.55,'#12131d'); g.addColorStop(1,'#0b0c12');
  x.fillStyle=g; x.fillRect(0,0,W,H);
  const rg=x.createRadialGradient(W/2,H*0.26,0,W/2,H*0.26,W*0.75); rg.addColorStop(0,'rgba(212,162,74,.20)'); rg.addColorStop(1,'rgba(212,162,74,0)'); x.fillStyle=rg; x.fillRect(0,0,W,H);
  const sc=score(), title=(state.flags.endingKey?computeEnding().t:outcome().t), m=state.m;
  x.textAlign='center';
  x.fillStyle='#D9B978'; x.font='700 84px "Playfair Display",Georgia,serif'; x.fillText('9 ЖИЗНЕЙ', W/2, 320);
  x.fillStyle='#b7bccb'; x.font='600 30px Manrope,Arial,sans-serif'; x.fillText('СИМУЛЯТОР УПРАВЛЕНИЯ КОМПАНИЕЙ', W/2, 384);
  x.fillStyle='#F3ECDD'; x.font='700 78px "Playfair Display",Georgia,serif';
  (function(){ const words=String(title).split(' '); let line='',lines=[]; words.forEach(w=>{ const t=line?line+' '+w:w; if(x.measureText(t).width>900){ lines.push(line); line=w; } else line=t; }); if(line)lines.push(line); const sy=560-(lines.length-1)*44; lines.forEach((l,i)=>x.fillText(l,W/2,sy+i*88)); })();
  x.fillStyle='#9aa0b3'; x.font='700 34px Manrope,Arial,sans-serif'; x.fillText('С К О Р', W/2, 780);
  x.fillStyle='#D9B978'; x.font='800 150px Manrope,Arial,sans-serif'; x.fillText(sc+' / 400', W/2, 920);
  const rows=[['💰 Капитал',Math.round(m.cap)],['⭐ Репутация',Math.round(m.rep)],['❤️ Мораль',Math.round(m.mor)],['🔮 Душа',Math.round(m.soul)]];
  x.font='600 46px Manrope,Arial,sans-serif'; let yy=1130;
  rows.forEach(r=>{ x.textAlign='left'; x.fillStyle='#e7e2d4'; x.fillText(r[0],210,yy); x.textAlign='right'; x.fillStyle='#D9B978'; x.fillText(String(r[1]),870,yy); yy+=96; });
  x.textAlign='center'; x.fillStyle='#F3ECDD'; x.font='italic 700 50px "Playfair Display",Georgia,serif'; x.fillText('А каким боссом станешь ты?', W/2, 1660);
  x.fillStyle='#8a8f9e'; x.font='600 32px Manrope,Arial,sans-serif'; x.fillText('vk.com/app54658940', W/2, 1770);
  return c.toDataURL('image/jpeg',0.86);
}
function shareLink(){
  try{
    if(window.vkBridge && window.vkBridge.send){ window.vkBridge.send('VKWebAppShare',{link:VK_APP_LINK}).catch(()=>{}); }
    else if(navigator.share){ navigator.share({title:'9 Жизней',url:VK_APP_LINK}).catch(()=>{}); }
    else { try{navigator.clipboard.writeText(VK_APP_LINK);}catch(e){} }
  }catch(e){}
}
function shareWeek(){
  // Публикуем РЕЗУЛЬТАТ в истории (с цифрами на картинке). Отмена/ошибка → шэр ссылки.
  let img=null; try{ img=buildStoryImage(); }catch(e){}
  try{
    if(window.vkBridge && window.vkBridge.send && img){
      window.vkBridge.send('VKWebAppShowStoryBox',{
        background_type:'image', blob:img,
        attachment:{ text:'go_to', type:'url', url:VK_APP_LINK }
      }).catch(()=>{ shareLink(); });   // юзер закрыл историю → предлагаем ссылку
    } else { shareLink(); }
  }catch(e){ shareLink(); }
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
  if(name==='nego2') return startNego(true);
  if(name==='anomaly') return startAnomaly();
  if(name==='grid') return startAnomaly('grid');
  if(name==='shifts') return startShifts();
  if(name==='safe') return startSafe();
  if(name==='maze') return startMaze();
  if(name==='scales') return startScales();
  if(name==='finale') return startFinale();
  return startBudget();
}
function startBudget(){
  state.puzzle={needs:genNeeds(), alloc:DEPTS.map(()=>0), reveal:DEPTS.map(()=>false), timeLeft:30};
  renderPuzzle(); show('screen-puzzle'); startPuzzleTimer();
}

/* ===== Головоломка №2: «Переговоры» (тактика: куш vs терпение) ===== */
function startNego(hard){
  const h=!!hard;
  state.nego={ profit:0, patience:h?62:80, rounds:0, maxRounds:h?5:6, timeLeft:pzTime(h?32:40), reveal:false, lastTxt:'', hard:h };
  renderNego(); show('screen-puzzle'); startNegoTimer();
}
function startNegoTimer(){
  clearInterval(pzTimer);
  pzTimer=setInterval(()=>{
    if(!state.nego){ clearInterval(pzTimer); return; }
    state.nego.timeLeft--;
    const el=$('pz-timer'); if(el){ el.textContent=state.nego.timeLeft+' с'; if(state.nego.timeLeft<=8) el.classList.add('low'); }
    if(state.nego.timeLeft<=8 && state.nego.timeLeft>0) SFX.tick();
    if(state.nego.timeLeft<=0){ clearInterval(pzTimer); negoResult('time'); }
  },1000);
}
function negoMood(){
  const p=state.nego.patience;
  if(state.nego.reveal) return `терпение партнёра: ${Math.round(p)} / 100`;
  if(p>=70) return 'партнёр расположен — можно дожимать';
  if(p>=45) return 'партнёр спокоен, но считает каждый шаг';
  if(p>=22) return 'партнёр напрягся — на грани';
  return 'партнёр вот-вот встанет и уйдёт';
}
function negoAct(type){
  const n=state.nego; if(n.rounds>=n.maxRounds) return;
  let txt='';
  if(type==='raise'){ n.profit+=14+Math.floor(Math.random()*7); n.patience-=22+Math.floor(Math.random()*9); txt='📈 Поднял цену'; SFX.step(); }
  else if(type==='concede'){ n.profit=Math.max(0,n.profit-(4+Math.floor(Math.random()*3))); n.patience=Math.min(100,n.patience+12+Math.floor(Math.random()*7)); txt='🤝 Уступил мелочь'; SFX.step(); }
  else if(type==='push'){ if(n.patience>=35){ n.profit+=9+Math.floor(Math.random()*5); n.patience-=10+Math.floor(Math.random()*5); txt='💬 Дожал аргументом'; SFX.step(); } else { n.patience-=24; txt='💬 Передавил — партнёр оскорбился!'; SFX.bad(); } }
  else if(type==='bluff'){ if(Math.random()<0.5){ n.profit+=22+Math.floor(Math.random()*7); txt='🎲 Блеф удался!'; SFX.good(); } else { n.patience-=34; txt='🎲 Блеф раскусили!'; SFX.bad(); } }
  n.rounds++; n.lastTxt=txt;
  if(n.patience<=0){ n.patience=0; return negoResult('collapse'); }
  if(n.rounds>=n.maxRounds){ return negoResult('rounds'); }
  renderNego();
}
function negoHint(){ Ads.rewarded(()=>{ if(state.nego){ state.nego.reveal=true; renderNego(); } }); }
function closeNego(){ negoResult('close'); }
function renderNego(){
  const n=state.nego, pw=Math.max(0,Math.min(100,n.patience));
  $('screen-puzzle').innerHTML=`<div class="pz-wrap">
    <div class="end-kicker">Задача недели · ход ${n.rounds}/${n.maxRounds}</div>
    <div class="pz-timer ${n.timeLeft<=8?'low':''}" id="pz-timer">${n.timeLeft} с</div>
    <h2>🤝 Переговоры</h2>
    <p>Выжми из сделки максимум, не доведя партнёра до ухода.${n.lastTxt?'<br><b>'+n.lastTxt+'</b>':''}</p>
    <div class="nego-stat">💰 Куш: <b>${n.profit}</b></div>
    <div class="pz-hint" style="margin:4px 0 6px;">${negoMood()}</div>
    <div class="bar" style="margin-bottom:16px;"><i style="width:${pw}%; background:linear-gradient(90deg,#b0405e,#5AA9E6); box-shadow:0 0 10px rgba(90,169,230,.5);"></i></div>
    <button class="btn" style="min-width:250px;margin-bottom:8px;" onclick="negoAct('raise')">📈 Поднять цену<small>куш сильно↑ · терпение сильно↓</small></button>
    <button class="btn" style="min-width:250px;margin-bottom:8px;" onclick="negoAct('push')">💬 Дожать аргументом<small>куш↑ · терпение↓ · на грани backfire</small></button>
    <button class="btn" style="min-width:250px;margin-bottom:8px;" onclick="negoAct('concede')">🤝 Уступить мелочь<small>куш↓ · терпение↑</small></button>
    <button class="btn" style="min-width:250px;margin-bottom:8px;" onclick="negoAct('bluff')">🎲 Блеф<small>50/50: большой куш или −терпение</small></button>
    <button class="btn" style="min-width:250px;margin:6px 0 8px;" onclick="negoHint()">💡 Раскрыть терпение (реклама)</button>
    <button class="btn btn-primary" style="min-width:250px;" onclick="closeNego()">✅ Ударить по рукам</button>
  </div>`;
}
function negoResult(mode){
  clearInterval(pzTimer);
  const n=state.nego; let tier,fx,msg;
  if(mode==='collapse'){ tier='Провал'; fx={cap:-6,rep:-4}; msg='Передавил — партнёр встал и ушёл. Сделка сорвана, клиент потерян.'; state.flags.dealFail=true; SFX.bad(); }
  else {
    const p=n.profit;
    if(p>=75){ tier='Блестяще'; fx={cap:12,rep:5}; msg=`Ты выжал ${p} и сохранил отношения — мастерская сделка.`; state.flags.dealGreat=true; SFX.good(); }
    else if(p>=45){ tier='Норма'; fx={cap:Math.round(p/6),rep:2}; msg=`Сделка на ${p}. Крепко, по делу.`; SFX.good(); }
    else { tier='Норма'; fx={cap:Math.round(p/7)+1,rep:1}; msg=`Сделка на ${p}. Скромно, но в плюс.`; SFX.good(); }
    if(mode==='time') msg='Время вышло. '+msg;
  }
  if(puzzleFailed(tier)) return puzzleFailChapter();
  applyFx(fx);
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
  if(puzzleFailed(tier)) return puzzleFailChapter();
  if(tier==='Провал') SFX.bad(); else SFX.good();
  applyFx(fx);
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

/* ===== Головоломка «Найди аномалию» (аудит доступов; mode: audit / grid) ===== */
function startAnomaly(mode){
  const staff=[
    {name:'Логистика · Р. Ковач',  own:'маршруты доставки'},
    {name:'Бухгалтерия · Л. Дейн',  own:'платёжные ведомости'},
    {name:'Маркетинг · И. Соул',    own:'рекламные метрики'},
    {name:'Продажи · Т. Марло',     own:'воронка сделок'},
    {name:'Поддержка · Э. Нур',     own:'тикеты клиентов'},
    {name:'Склад · Г. Пайк',        own:'остатки товара'}
  ];
  const n=staff.length, mole=Math.floor(Math.random()*n);
  const others=[...Array(n).keys()].filter(i=>i!==mole);
  for(let i=others.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[others[i],others[j]]=[others[j],others[i]];}
  const dNight=others[0], dForeign=others[1], dBig=others[2];
  const nightT=['03:12','02:47','04:05','01:58'], dayT=['10:22','14:38','16:10','11:45','15:03','09:37'];
  const bigV=['2.4 ГБ','1.8 ГБ','3.1 ГБ'], normV=['48 МБ','120 МБ','16 МБ','75 МБ','210 МБ'];
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const rows=staff.map((s,i)=>{
    const night=(i===mole||i===dNight), foreign=(i===mole||i===dForeign), big=(i===mole||i===dBig);
    return { name:s.name, time:night?pick(nightT):pick(dayT), target:foreign?'клиентская база':s.own, vol:big?pick(bigV):pick(normV), cleared:false };
  });
  state.anomaly={ rows, answer:mole, picked:null, timeLeft:pzTime(mode==='grid'?30:35), done:false, mode:(mode||'audit') };
  renderAnomaly(); show('screen-puzzle'); startAnomalyTimer();
}
function startAnomalyTimer(){
  clearInterval(pzTimer);
  pzTimer=setInterval(()=>{
    if(!state.anomaly||state.anomaly.done){ clearInterval(pzTimer); return; }
    state.anomaly.timeLeft--;
    const el=$('pz-timer'); if(el){ el.textContent=state.anomaly.timeLeft+' с'; if(state.anomaly.timeLeft<=6) el.classList.add('low'); }
    if(state.anomaly.timeLeft<=6 && state.anomaly.timeLeft>0) SFX.tick();
    if(state.anomaly.timeLeft<=0){ clearInterval(pzTimer); anomalyResult(-1,true); }
  },1000);
}
function anomalyHint(){
  Ads.rewarded(()=>{
    const a=state.anomaly; if(!a||a.done) return;
    const decoys=a.rows.map((r,i)=>i).filter(i=>i!==a.answer && !a.rows[i].cleared);
    if(decoys.length){ a.rows[decoys[Math.floor(Math.random()*decoys.length)]].cleared=true; renderAnomaly(); }
  });
}
function pickSuspect(i){ if(state.anomaly && !state.anomaly.done) anomalyResult(i,false); }
function renderAnomaly(){
  const a=state.anomaly;
  const rows=a.rows.map((r,i)=>`
    <button class="anom-row ${r.cleared?'cleared':''}" ${r.cleared?'disabled':''} onclick="pickSuspect(${i})">
      <div class="anom-who">${r.name}${r.cleared?' · <span class="anom-ok">✓ чисто</span>':''}</div>
      <div class="anom-chips"><span>🕐 ${r.time}</span><span>📂 ${r.target}</span><span>📦 ${r.vol}</span></div>
    </button>`).join('');
  const grid=a.mode==='grid';
  $('screen-puzzle').innerHTML=`<div class="pz-wrap">
      <div class="end-kicker">Задача недели · ${grid?'аудит-сетка':'аудит доступов'}</div>
      <div class="pz-timer ${a.timeLeft<=6?'low':''}" id="pz-timer">${a.timeLeft} с</div>
      <h2>${grid?'🧮 Найди сообщника':'🔎 Найди крота'}</h2>
      <p>${grid?'Сообщник крота выдаёт себя <b>тремя признаками разом</b>':'Крот выдаёт себя <b>тремя признаками разом</b>'}: вход <b>ночью</b>, доступ к <b>чужим данным</b> (клиентская база) и <b>аномальный объём</b>. У остальных сходится максимум один. Вычисли и ткни.</p>
      ${rows}
      <button class="btn" style="min-width:230px;margin:10px 0;" onclick="anomalyHint()">💡 Исключить одного (реклама)</button>
    </div>`;
}
function anomalyResult(pick,timeout){
  clearInterval(pzTimer);
  const a=state.anomaly; a.done=true; a.picked=pick;
  const grid=a.mode==='grid', who=grid?'сообщника':'крота';
  const correct=(pick===a.answer), fast=a.timeLeft>=15;
  let tier,fx,msg;
  if(correct && fast){ tier='Блестяще'; fx={rep:8,soul:3}; msg=`Ты вычислил ${who} мгновенно: ночной вход, чужая база, гигабайты наружу. Дыру перекрыли, данные спасли.`; state.flags.moleCaught=true; }
  else if(correct){ tier='Норма'; fx={rep:4}; msg=`Ты нашёл ${who} — но пока думал, часть базы уже утекла. Дыру закрыли, осадок остался.`; state.flags.moleCaught=true; }
  else { tier='Провал'; fx={rep:-6,soul:-2}; msg=timeout?`Время вышло — ${who} успел уйти вместе с базой. Дыру не закрыли.`:`Ты указал не на того. Настоящий ${who} тихо ушёл, прихватив данные.`; state.flags.moleEscaped=true; }
  if(puzzleFailed(tier)) return puzzleFailChapter();
  if(tier==='Провал') SFX.bad(); else SFX.good();
  applyFx(fx);
  renderMetrics();
  state.flags.puzzleLine=(grid?'🧮 Аудит-сетка — ':'🔎 Аудит доступов — ')+tier+': '+msg;
  const icon=tier==='Блестяще'?'🏆':tier==='Норма'?'👍':'⚠️';
  const win=a.rows[a.answer];
  const reveal=`${grid?'Сообщник':'Крот'} был: <b>${win.name}</b> — ${win.time} · клиентская база · ${win.vol}.`;
  $('screen-puzzle').innerHTML=`<div class="pz-wrap">
      <div class="end-kicker">Результат — ${tier}</div>
      <h2>${icon} Найди ${who}</h2>
      <p>${msg}</p>
      <div class="anom-reveal">${reveal}</div>
      <div class="stat-row">${Object.keys(fx).map(k=>`${METRIC_NAMES[k]} ${fx[k]>0?'+':''}${fx[k]}`).join(' · ')}</div>
      <button class="btn btn-primary" style="min-width:230px;" onclick="endSlice()">Дальше → итоги недели</button>
    </div>`;
}

/* ===== helper ===== */
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* ===== Головоломка «Собери смену» (гл.4) — раскидай смены по дням ===== */
function startShifts(){
  const DAYS=['Пн','Вт','Ср','Чт','Пт']; const TOTAL=12;
  let raw=DAYS.map(()=>1+Math.floor(Math.random()*4)), s=raw.reduce((a,b)=>a+b,0);
  let need=raw.map(w=>Math.max(1,Math.round(TOTAL*w/s)));
  let diff=TOTAL-need.reduce((a,b)=>a+b,0); need[0]+=diff; if(need[0]<1){ need[1]+=need[0]-1; need[0]=1; }
  state.shifts={ days:DAYS, need, alloc:DAYS.map(()=>0), reveal:DAYS.map(()=>false), total:TOTAL, timeLeft:pzTime(30), done:false };
  renderShifts(); show('screen-puzzle'); startSimpleTimer('shifts',()=>submitShifts(true));
}
function shiftsSum(){ return state.shifts.alloc.reduce((a,b)=>a+b,0); }
function setShift(i,d){ const p=state.shifts; if(p.done)return; let v=p.alloc[i]+d; if(v<0)v=0; if(shiftsSum()-p.alloc[i]+v>p.total) v=p.total-(shiftsSum()-p.alloc[i]); p.alloc[i]=v; SFX.step(); renderShifts(); }
function shiftHint(i){ const p=state.shifts, n=p.need[i]; if(p.reveal[i]) return 'нужно '+n; if(n>=4) return 'аврал — людей много'; if(n<=1) return 'спокойный день'; return 'средняя нагрузка'; }
function shiftsHintAd(){ Ads.rewarded(()=>{ const p=state.shifts; if(!p||p.done)return; const h=p.reveal.map((r,i)=>r?-1:i).filter(i=>i>=0); if(h.length){ p.reveal[h[Math.floor(Math.random()*h.length)]]=true; renderShifts(); } }); }
function renderShifts(){
  const p=state.shifts, rem=p.total-shiftsSum();
  const rows=p.days.map((d,i)=>`<div class="pz-row"><div class="pz-info"><span class="pz-ic">📅</span><div><div class="pz-name">${d}</div><div class="pz-hint">${shiftHint(i)}</div></div></div>
    <div class="pz-stepper"><button onclick="setShift(${i},-1)">−</button><span class="pz-val">${p.alloc[i]}</span><button onclick="setShift(${i},1)">+</button></div></div>`).join('');
  $('screen-puzzle').innerHTML=`<div class="pz-wrap"><div class="end-kicker">Задача недели · график смен</div>
    <div class="pz-timer ${p.timeLeft<=5?'low':''}" id="pz-timer">${p.timeLeft} с</div>
    <h2>🗓️ Собери смену</h2><p>Раскидай <b>${p.total}</b> смен по дням — слушай намёки, лови авралы. Нераспределённое = дыры в графике.</p>
    <div class="pz-budget ${rem===0?'ok':''}">Осталось смен: ${rem} / ${p.total}</div>${rows}
    <button class="btn" style="min-width:230px;margin:8px 0 10px;" onclick="shiftsHintAd()">💡 Подсказка (реклама)</button>
    <button class="btn btn-primary" style="min-width:230px;" ${rem===0?'':'disabled'} onclick="submitShifts()">Утвердить график →</button></div>`;
}
function submitShifts(force){
  const p=state.shifts; if(!force && shiftsSum()!==p.total) return; clearInterval(pzTimer); p.done=true;
  const dev=p.alloc.reduce((a,v,i)=>a+Math.abs(v-p.need[i]),0)+(p.total-shiftsSum());
  let tier,fx,msg;
  if(dev<=2){ tier='Блестяще'; fx={mor:7,cap:3}; msg='График лёг идеально — авралы закрыты, никто не перегружен.'; }
  else if(dev<=6){ tier='Норма'; fx={mor:2}; msg='График сносный — где-то пусто, где-то густо, но команда вывезла.'; }
  else { tier='Провал'; fx={mor:-6,cap:-3}; msg='Смены вразнобой — авралы, переработки, злые лица.'; state.flags.shiftsFail=true; }
  simpleResult('🗓️ Смены',tier,fx,msg);
}

/* ===== Головоломка «Шифр сейфа» (гл.5) — дедукция кода ===== */
function startSafe(){
  const pool=shuffle([1,2,3,4,5,6]); const code=pool.slice(0,3);
  state.safe={ code, guess:[1,2,3], history:[], max:6, timeLeft:pzTime(64), done:false, revealed:null };
  renderSafe(); show('screen-puzzle'); startSimpleTimer('safe',()=>safeResult(false,true));
}
function safeStep(i,d){ const s=state.safe; if(s.done)return; let v=s.guess[i]+d; if(v<1)v=6; if(v>6)v=1; s.guess[i]=v; SFX.step(); renderSafe(); }
function safeHint(){ Ads.rewarded(()=>{ const s=state.safe; if(!s||s.done)return; if(s.revealed==null) s.revealed=Math.floor(Math.random()*3); renderSafe(); }); }
function safeSubmit(){
  const s=state.safe; if(s.done)return; const g=s.guess.slice(), code=s.code; let green=0,yellow=0;
  g.forEach((v,i)=>{ if(v===code[i]) green++; else if(code.includes(v)) yellow++; });
  s.history.push({g:g.slice(), green, yellow});
  if(green===3){ SFX.good(); return safeResult(true); }
  if(s.history.length>=s.max){ SFX.bad(); return safeResult(false); }
  SFX.click(); renderSafe();
}
function renderSafe(){
  const s=state.safe;
  const slots=s.guess.map((v,i)=>`<div class="safe-slot"><button onclick="safeStep(${i},1)">▲</button><div class="safe-dig ${s.revealed===i?'rev':''}">${v}</div><button onclick="safeStep(${i},-1)">▼</button></div>`).join('');
  const hist=s.history.map(h=>`<div class="safe-hrow"><span>${h.g.join(' ')}</span><span class="safe-pegs">${'🟢'.repeat(h.green)}${'🟡'.repeat(h.yellow)}${'⚫'.repeat(3-h.green-h.yellow)}</span></div>`).reverse().join('');
  const rev=s.revealed!=null?`<div class="safe-clue">💡 Позиция ${s.revealed+1} — цифра <b>${s.code[s.revealed]}</b></div>`:'';
  $('screen-puzzle').innerHTML=`<div class="pz-wrap"><div class="end-kicker">Задача недели · шифр сейфа</div>
    <div class="pz-timer ${s.timeLeft<=8?'low':''}" id="pz-timer">${s.timeLeft} с</div>
    <h2>🔐 Шифр сейфа</h2><p>Код — 3 разные цифры (1–6). 🟢 цифра на месте · 🟡 есть, но не там · ⚫ нет. Попыток: <b>${s.history.length}/${s.max}</b>.</p>
    <div class="safe-slots">${slots}</div>${rev}
    <button class="btn btn-primary" style="min-width:230px;margin:6px 0 8px;" onclick="safeSubmit()">Проверить код →</button>
    <button class="btn" style="min-width:230px;margin-bottom:10px;" onclick="safeHint()">💡 Открыть цифру (реклама)</button>
    <div class="safe-hist">${hist}</div></div>`;
}
function safeResult(win,timeout){
  const s=state.safe; clearInterval(pzTimer); s.done=true;
  let tier,fx,msg;
  if(win && s.history.length<=3){ tier='Блестяще'; fx={cap:8,rep:4}; msg='Сейф вскрыт с ходу — условия сделки у тебя раньше срока.'; }
  else if(win){ tier='Норма'; fx={cap:4,rep:1}; msg='Сейф поддался под конец — сделку успел закрыть впритык.'; }
  else { tier='Провал'; fx={cap:-5}; msg=timeout?'Время вышло — сейф заперт, предложение сгорело.':'Код не поддался — часть условий утекла к инвестору.'; state.flags.safeFail=true; }
  simpleResult('🔐 Шифр сейфа',tier,fx,msg,'Код был: <b>'+state.safe.code.join(' ')+'</b>');
}

/* ===== Головоломка «Лабиринт интриги» (гл.6) — вычисли зачинщика ===== */
function startMaze(){
  const people=['Феликс','«Тень» из продаж','Юниор-разработчик','Дерзкий аналитик','Амбициозный стажёр'];
  const n=people.length, boss=Math.floor(Math.random()*n), others=shuffle([...Array(n).keys()].filter(i=>i!==boss));
  const dMeet=others[0],dRec=others[1],dMot=others[2];
  const rows=people.map((nm,i)=>({ name:nm, meet:(i===boss||i===dMeet), rec:(i===boss||i===dRec), mot:(i===boss||i===dMot), cleared:false }));
  state.maze={ rows, answer:boss, timeLeft:pzTime(30), done:false };
  renderMaze(); show('screen-puzzle'); startSimpleTimer('maze',()=>mazeResult(-1,true));
}
function mazeHint(){ Ads.rewarded(()=>{ const m=state.maze; if(!m||m.done)return; const d=m.rows.map((r,i)=>i).filter(i=>i!==m.answer && !m.rows[i].cleared); if(d.length){ m.rows[d[Math.floor(Math.random()*d.length)]].cleared=true; renderMaze(); } }); }
function pickMaze(i){ if(state.maze && !state.maze.done) mazeResult(i,false); }
function renderMaze(){
  const m=state.maze;
  const rows=m.rows.map((r,i)=>`<button class="anom-row ${r.cleared?'cleared':''}" ${r.cleared?'disabled':''} onclick="pickMaze(${i})">
    <div class="anom-who">${r.name}${r.cleared?' · <span class="anom-ok">✓ вне игры</span>':''}</div>
    <div class="anom-chips"><span>🕯️ Сходки: ${r.meet?'да':'—'}</span><span>🗣️ Вербует: ${r.rec?'да':'—'}</span><span>🎯 Мотив: ${r.mot?'да':'—'}</span></div></button>`).join('');
  $('screen-puzzle').innerHTML=`<div class="pz-wrap"><div class="end-kicker">Задача недели · лабиринт интриги</div>
    <div class="pz-timer ${m.timeLeft<=6?'low':''}" id="pz-timer">${m.timeLeft} с</div>
    <h2>🕸️ Найди зачинщика</h2><p>Настоящий зачинщик сходится по <b>всем трём</b>: ходит на сходки, вербует людей и имеет мотив. У остальных — максимум два. Вычисли и ткни.</p>
    ${rows}<button class="btn" style="min-width:230px;margin:10px 0;" onclick="mazeHint()">💡 Исключить одного (реклама)</button></div>`;
}
function mazeResult(pick,timeout){
  const m=state.maze; clearInterval(pzTimer); m.done=true; const correct=(pick===m.answer), fast=m.timeLeft>=12;
  let tier,fx,msg;
  if(correct&&fast){ tier='Блестяще'; fx={rep:6,soul:2}; msg='Ты вычислил зачинщика мгновенно — заговор рассыпался, не начавшись.'; state.flags.plotCrushed=true; }
  else if(correct){ tier='Норма'; fx={rep:3}; msg='Зачинщик найден, но слухи уже пошли по офису.'; state.flags.plotCrushed=true; }
  else { tier='Провал'; fx={rep:-5,mor:-3}; msg=timeout?'Время вышло — заговор дозрел в тени.':'Ты обвинил невиновного — зачинщик усилился, обиженный ушёл к нему.'; state.flags.plotGrew=true; }
  simpleResult('🕸️ Лабиринт интриги',tier,fx,msg,'Зачинщик: <b>'+m.rows[m.answer].name+'</b>.');
}

/* ===== Головоломка «Весы решений» (гл.9) — сбалансируй чаши ===== */
function startScales(){
  state.scales={ left:Math.round(state.m.cap/12), right:Math.round(state.m.soul/12), moves:8, timeLeft:pzTime(30), done:false };
  renderScales(); show('screen-puzzle'); startSimpleTimer('scales',()=>scalesResult());
}
function addWeight(side){ const s=state.scales; if(s.done||s.moves<=0)return; if(side==='left')s.left++; else s.right++; s.moves--; SFX.step(); if(s.moves<=0){ renderScales(); return; } renderScales(); }
function renderScales(){
  const s=state.scales, max=Math.max(s.left,s.right,6);
  const bar=(v,cls)=>`<div class="sc-bar"><i class="${cls}" style="height:${Math.min(100,v/max*100)}%"></i></div>`;
  const diff=Math.abs(s.left-s.right);
  $('screen-puzzle').innerHTML=`<div class="pz-wrap"><div class="end-kicker">Задача недели · весы решений</div>
    <div class="pz-timer ${s.timeLeft<=5?'low':''}" id="pz-timer">${s.timeLeft} с</div>
    <h2>⚖️ Взвесь решения</h2><p>Приведи чаши <b>к балансу</b> — ни прибыль, ни душа не должны перевесить. Ходов: <b>${s.moves}</b>.</p>
    <div class="sc-wrap"><div class="sc-col">${bar(s.left,'sc-cap')}<div class="sc-lbl">💰 Прибыль<br><b>${s.left}</b></div><button class="btn" onclick="addWeight('left')">+ прибыль</button></div>
    <div class="sc-col">${bar(s.right,'sc-soul')}<div class="sc-lbl">🔮 Душа<br><b>${s.right}</b></div><button class="btn" onclick="addWeight('right')">+ душа</button></div></div>
    <div class="pz-budget ${diff<=1?'ok':''}">Перекос: ${diff}</div>
    <button class="btn btn-primary" style="min-width:230px;margin-top:8px;" onclick="scalesResult()">Зафиксировать →</button></div>`;
}
function scalesResult(){
  const s=state.scales; clearInterval(pzTimer); s.done=true; const diff=Math.abs(s.left-s.right);
  let tier,fx,msg;
  if(diff<=1){ tier='Блестяще'; fx={soul:5,mor:5,rep:2}; msg='Идеальный баланс — ты держишь и цифры, и людей. Мудрый капитан.'; state.flags.balanced=true; }
  else if(diff<=3){ tier='Норма'; fx={soul:2,mor:1}; msg='Почти ровно — небольшой перекос, но компания устойчива.'; }
  else { tier='Провал'; fx={mor:-4,soul:-3}; msg='Чаши перекосило — одна сторона задавила другую. Это аукнется в финале.'; state.flags.imbalanced=true; }
  simpleResult('⚖️ Весы решений',tier,fx,msg);
}

/* ===== общий таймер и результат простых головоломок ===== */
function startSimpleTimer(key,onOut){
  clearInterval(pzTimer);
  pzTimer=setInterval(()=>{
    const p=state[key]; if(!p||p.done){ clearInterval(pzTimer); return; }
    p.timeLeft--; const el=$('pz-timer'); if(el){ el.textContent=p.timeLeft+' с'; if(p.timeLeft<=6) el.classList.add('low'); }
    if(p.timeLeft<=6 && p.timeLeft>0) SFX.tick();
    if(p.timeLeft<=0){ clearInterval(pzTimer); onOut(); }
  },1000);
}
/* Сложность растёт по главам: меньше времени к финалу (не ниже 14с) */
function pzTime(base){ return Math.max(14, Math.round(base - ((state.weekNum||1)-1)*1.4)); }
/* Провал задачи недели (с 3-й главы) = проигрыш → переиграть главу с начала */
function puzzleFailChapter(){
  try{SFX.bad();}catch(e){} clearInterval(pzTimer);
  $('screen-puzzle').innerHTML=`<div class="pz-wrap"><div class="end-kicker">Провал · Глава ${state.weekNum||1}</div>
    <h2>⚠️ Задача не решена</h2>
    <p>Ты не справился с задачей недели — без неё главу не закрыть. Придётся переиграть её с начала.</p>
    <button class="btn btn-primary" style="min-width:230px;margin-bottom:10px;" onclick="replayChapter()">🔄 Переиграть главу</button>
    <button class="btn" style="min-width:230px;" onclick="hardReset()">↺ Начать заново</button></div>`;
  show('screen-puzzle');
}
function puzzleFailed(tier){ return tier==='Провал' && (state.weekNum||1)>=3; }

function simpleResult(name,tier,fx,msg,extra){
  if(puzzleFailed(tier)) return puzzleFailChapter();
  if(tier==='Провал') SFX.bad(); else SFX.good();
  applyFx(fx); renderMetrics();
  state.flags.puzzleLine=name+' — '+tier+': '+msg;
  const icon=tier==='Блестяще'?'🏆':tier==='Норма'?'👍':'⚠️';
  $('screen-puzzle').innerHTML=`<div class="pz-wrap"><div class="end-kicker">Результат — ${tier}</div>
    <h2>${icon} ${name}</h2><p>${msg}</p>${extra?`<div class="anom-reveal">${extra}</div>`:''}
    <div class="stat-row">${Object.keys(fx).map(k=>`${METRIC_NAMES[k]} ${fx[k]>0?'+':''}${fx[k]}`).join(' · ')}</div>
    <button class="btn btn-primary" style="min-width:230px;" onclick="endSlice()">Дальше → итоги недели</button></div>`;
}

/* ===== ФИНАЛ · 6 концовок + эпилоги ===== */
function lostCount(){ let n=0; for(const r in state.rel){ if(state.rel[r]<=-3) n++; } const f=state.flags; ['grishaBroken','marselCrushed','coldFarewell','coldToCleo','banRomance','banTS'].forEach(k=>{ if(f[k]) n++; }); return n; }
function loyalCount(){ let n=0; for(const r in state.rel){ if(state.rel[r]>=3) n++; } return n; }
function computeEnding(){
  const m=state.m, f=state.flags, loyal=loyalCount(), lost=lostCount();
  const felixPath=f.gaveFelix||f.sideFelix||f.felixPlan||f.poaching;
  if(m.cap<=0||m.rep<=0||m.mor<=0||m.soul<=0||m.cap<25)
    return {key:'crash', t:'💥 Крах', art:'ch8_01_crisis.jpg', video:'vid_lose_cap.mp4',
      d:'«Девять» не выдержала. Метрики просели в ноль, компания разваливается на глазах, а ты остаёшься на пепелище того, что построил Барон. Иногда амбиции стоят всего.'};
  if(felixPath && m.mor<45)
    return {key:'revolution', t:'🔥 Революция', art:'ch6_01_felix.jpg', video:'vid_ch6_felix.mp4',
      d:'Ты вырастил Феликса — и он вырос через твою голову. При низком боевом духе молодые пошли за ним, а не за тобой. Совет выбирает его. Ты уходишь, аплодируя чужой победе.'};
  if(m.soul>=75 && m.mor>=70 && m.cap>=60 && loyal>=5)
    return {key:'home', t:'🏆 Тёплый дом', art:'ch10_04_ending.jpg', video:'vid_win_home.mp4', video2:'vid_ch10_ending.mp4',
      d:'Ты сделал невозможное: компания-семья, где людей ценят как людей — и при этом крепкий, устойчивый успех. Команда пойдёт за тобой в огонь. Барон смотрит с гордостью: ты превзошёл его.'};
  if(m.cap>=80 && m.rep>=70 && m.soul<50)
    return {key:'empire', t:'🏙️ Империя', art:'ch10_05_ending_cold.jpg', video:'vid_ch10_ending.mp4',
      d:'Ты построил гиганта. Капитал и репутация на вершине — но душу компании ты продал по дороге. Стоишь один над сияющим городом-империей. Успех оглушительный. И оглушительно одинокий.'};
  if(m.cap>=60 && (lost>=3 || (f.dirtyDeal&&f.surveillance) || f.dealBagira))
    return {key:'pyrrhic', t:'⚔️ Пиррова победа', art:'ch7_02_bagira.jpg', video:'vid_ch7_bagira.mp4',
      d:'Ты выиграл — но поле боя усеяно теми, кем ты пожертвовал. Компания жива, счета в плюсе, а рядом почти никого не осталось. Победа, вкус которой — пепел.'};
  return {key:'quiet', t:'🌫️ Тихий уход', art:'ch9_03_fork.jpg', video:'vid_ch9_reckoning.mp4',
    d:'Ты провёл «Девять» сквозь бури, не сорвавшись ни в одну крайность — но и не зажёгшись. Компания живёт дальше. А ты тихо отдаёшь ключ и уходишь, уставший, как когда-то Барон. Круг замкнулся.'};
}
function heroEpilogues(){
  const r=state.rel, f=state.flags, L=[];
  const ep=(id,warm,cold,neu)=>{ const v=r[id]||0; L.push(`<b>${NAME[id]}:</b> ${v>=2?warm:v<=-2?cold:neu}`); };
  ep('sonya','поверила в тебя и выросла в сильного лидера — твоя школа не прошла даром.','разочаровалась и ушла искать место, где в людей ещё верят.','осталась милой стажёркой, тихо делающей своё дело.');
  ep('felix', f.mentoredFelix?'стал твоей правой рукой — амбиция, направленная в дело.':'получил свою власть и теперь играет уже свою партию.','затаил обиду и при первом случае ушёл к конкуренту.','остался ярким, но так и не приручённым талантом.');
  ep('grisha', f.grishaSaved?'благодарен по гроб — ты спас его семью и здоровье.':'тянет лямку дальше, преданный, как и был.', f.grishaBroken?'сломался и уволился — тихо, без упрёков, как и жил.':'выгорел, но остался, потому что больше некуда.','держит логистику, незаметный и незаменимый.');
  ep('vasilisa','твоя главная опора — с ней «Девять» устоит перед чем угодно.','ушла, забрав с собой половину сильной команды.','осталась профессионалом на дистанции.');
  ep('bagira', f.exposeBagira?'разоблачена и повержена — её игра окончена.':(f.dealBagira?'осталась рядом — опасный союзник, которому ты теперь должен.':'исчезла так же красиво, как появилась, затаив своё.'),'стала твоим злейшим врагом — и это надолго.','так и осталась загадкой, чью сторону выбрала.');
  ep('cleo', f.madeAmends?'сняла маску и стала настоящей — благодарна, что ты увидел человека.':'блестит дальше, лицо бренда без трещин.','ушла, унеся свой хайп и обиду к конкурентам.','осталась глянцевой витриной компании.');
  ep('murka', f.careProgram?'счастлива: ты построил компанию, где людей берегут — её мечта сбылась.':'тянет всех на себе, тихо надеясь, что однажды спасут и её.','выгорела и ушла — душа коллектива погасла.','остаётся тем, к кому идут за теплом.');
  ep('tisha', f.romanceTS?'нашёл с Соней тихое счастье — гений наконец улыбается.':'построил тебе лучшую платформу в отрасли.','замкнулся и ушёл в стартап, где его слышат.','молчит и держит всю технологию на своих плечах.');
  ep('marsel', f.romanceMV?'снова счастлив с Василисой — второй шанс, который ты подарил.':(f.trustMarsel?'воскрес как звезда продаж — ты в него поверил не зря.':'нашёл своё место, уже без страха оказаться лишним.'),'сломлен — ты добил то, что и так трещало.','доигрывает свою партию с достоинством.');
  ep('baron','уходит на покой спокойным: он не ошибся, отдав тебе «Девять».','качает головой — не таким он видел наследника.','наблюдает издалека, оставляя тебе твой путь.');
  return L;
}
function startFinale(){
  const e=computeEnding(); state.flags.endingKey=e.key;
  localStorage.removeItem(SAVE_KEY);
  const eps=heroEpilogues().map(l=>`<div class="cons">${l}</div>`).join('');
  const vid1 = e.video ? `<video class="cam-video" playsinline autoplay loop muted src="${CLIP_DIR}${e.video}?v=3" style="max-height:34vh;margin:0 auto 10px;" onerror="this.style.display='none'"></video>` : '';
  const vid2 = e.video2 ? `<video class="cam-video" playsinline autoplay loop muted src="${CLIP_DIR}${e.video2}?v=3" style="max-height:26vh;margin:0 auto 14px;" onerror="this.style.display='none'"></video>` : '';
  const art = (e.video||e.video2)
    ? (vid1+vid2)
    : `<img src="${ASSET_DIR}${e.art}?v=3" style="width:100%;max-height:34vh;object-fit:cover;border-radius:16px;margin-bottom:14px;">`;
  $('screen-end').innerHTML=`<div class="end-wrap">
      <div class="end-kicker">Финал · Глава 10 · твоя концовка</div>
      ${art}
      <h2>${e.t}</h2>
      <p>${e.d}</p>
      <div class="stat-row">💰 ${Math.round(state.m.cap)} · ⭐ ${Math.round(state.m.rep)} · ❤️ ${Math.round(state.m.mor)} · 🔮 ${Math.round(state.m.soul)}</div>
      <div class="end-score">Скор: <b>${score()}</b> / 400 · лояльных: ${loyalCount()} · потеряно: ${lostCount()}</div>
      <div class="stand"><b>Что стало с командой:</b></div>
      ${eps}
      <div class="cant">Ты прожил девять судеб. Такова цена кресла.</div>
      <button class="btn" style="min-width:240px;margin:14px 0 10px;" onclick="shareWeek()">↗ Поделиться финалом</button>
      <button class="btn btn-primary" style="min-width:240px;" onclick="hardReset()">↺ Прожить заново — другим боссом</button>
    </div>`;
  $('screen-end').querySelectorAll('video').forEach(v=>{ v.play().catch(()=>{}); });
  show('screen-end');
}

/* ===== Ежедневный гейт глав (с 3-й) ===== */
const LOCK_KEY='devyat9_unlock', LOCK_MS=20*3600*1000;   // ~сутки
function chapterLocked(nextCh){ if(nextCh<3) return false; const u=+localStorage.getItem(LOCK_KEY)||0; return Date.now()<u; }
function lockRemain(){ const u=+localStorage.getItem(LOCK_KEY)||0; return Math.max(0,u-Date.now()); }
function fmtRemain(ms){ const h=Math.floor(ms/3600000), m=Math.floor(ms%3600000/60000); return (h>0?h+' ч ':'')+m+' мин'; }
let lockTimer=null;
function startLockCountdown(nextCh){
  clearInterval(lockTimer);
  lockTimer=setInterval(()=>{ const el=$('lock-c'); if(!el){ clearInterval(lockTimer); return; }
    const r=lockRemain(); if(r<=0){ clearInterval(lockTimer); endSlice(); return; } el.textContent='через '+fmtRemain(r); },30000);
}
function openNextNow(){ localStorage.removeItem(LOCK_KEY); state.lockArmedFor=null; clearInterval(lockTimer); nextChapter(true); }  /* true = без интерстишела: reward-ролик уже показали */

/* ===== Разбор метрик в итогах ===== */
function metricRevealBlock(){
  const M=[['cap','💰 Капитал'],['rep','⭐ Репутация'],['mor','❤️ Мораль'],['soul','🔮 Душа']];
  const rows=M.map(([k,nm])=>{ const v=Math.round(state.m[k]), z=metricZone(v);
    return `<div class="mrev-row"><span>${nm}</span><span style="color:${z.c};font-family:'Oswald'">${v} · ${z.w}</span></div>`; }).join('');
  return `<div class="mrev">${rows}</div>
    <div class="mhint">💰 выживание · ⭐ рынок и клиенты · ❤️ дух команды · 🔮 человечность и «хорошие» финалы. <b>Любая метрика в 0 — проигрыш.</b></div>`;
}
function redWarnings(){
  const W={cap:'💰 Капитал на грани — ещё удар, и банкротство.',rep:'⭐ Репутация на грани — ещё скандал, и тебя снимут.',
    mor:'❤️ Мораль на грани — ещё нажим, и команда взбунтуется.',soul:'🔮 Душа почти на нуле — компания стынет в бездушную машину.'};
  const L=[]; for(const k of['cap','rep','mor','soul']) if(state.m[k]<20) L.push(W[k]); return L;
}

function endSlice(){
  const dead=deadMetric(); if(dead && (state.weekNum||1)>=3) return gameOver(dead);   // страховка: смерть и после головоломки (с 3-й главы)
  const o=outcome(), st=standings(), wk=state.weekNum||1, more=wk<MAX_CHAPTER;
  const cons=consequenceLines().map(l=>`<div class="cons">${l}</div>`).join('');
  let stand='';
  if(st.loyal.length||st.cold.length){
    stand=`<div class="stand"><b>Команда о тебе:</b><br>`+
      (st.loyal.length?`💚 За тебя — ${st.loyal.join(', ')}. `:'')+
      (st.cold.length?`🔻 Затаили обиду — ${st.cold.join(', ')}.`:'')+
      `<div class="cant">Для всех хорошим не будешь — и это нормально.</div></div>`;
  }
  const warn=redWarnings();
  const warnBlock = warn.length ? `<div class="warnbox"><b>⚠️ Опасная зона:</b>${warn.map(w=>`<div>${w}</div>`).join('')}</div>` : '';
  const traj = `<div class="traj">📈 Держишь курс на концовку: <b>${computeEnding().t}</b></div>`;

  // ежедневный замок: армируем один раз при завершении главы, для глав 3+
  if(more && wk>=2 && state.lockArmedFor!==wk){ state.lockArmedFor=wk; if((wk+1)>=3) localStorage.setItem(LOCK_KEY, Date.now()+LOCK_MS); }
  let nextArea;
  if(more){
    if(chapterLocked(wk+1)){
      nextArea=`<div class="lockp">
        <div class="lock-t">🔒 Глава ${wk+1} откроется завтра</div>
        <div class="lock-c" id="lock-c">через ${fmtRemain(lockRemain())}</div>
        <div class="lock-s">Заходи каждый день за новой главой — или открой сейчас за рекламу.</div>
        <button class="btn btn-primary" style="min-width:250px;" onclick="Ads.rewarded(openNextNow)">▶ Открыть Главу ${wk+1} сейчас (реклама)</button>
      </div>`;
    } else {
      nextArea=`<button class="btn btn-primary" style="min-width:240px;" onclick="nextChapter()">Глава ${wk+1} →</button>`;
    }
    state.awaitingNext=true;
  } else {
    nextArea=`<button class="btn btn-primary" style="min-width:240px;" onclick="hardReset()">↺ Пройти заново</button>`;
  }
  $('screen-end').innerHTML=`
    <div class="end-wrap">
      <div class="end-kicker">Итоги недели ${wk} · что ты построил</div>
      <h2>${o.t}</h2>
      <p>${o.d}</p>
      ${cons}
      ${stand}
      ${metricRevealBlock()}
      ${warnBlock}
      ${traj}
      <div class="end-score">Скор: <b>${score()}</b> / 400</div>
      <button class="btn" style="min-width:240px;margin:6px 0 10px;" onclick="shareWeek()">↗ Поделиться итогом</button>
      <button class="btn" style="min-width:240px;margin-bottom:10px;" onclick="Ads.rewarded(replayChapter)">🔄 Переиграть неделю (реклама)</button>
      ${nextArea}
    </div>`;
  if(more) save(); else localStorage.removeItem(SAVE_KEY);
  show('screen-end');
  if(more && chapterLocked(wk+1)) startLockCountdown(wk+1);
}
function nextChapter(skipInter){
  state.awaitingNext=false;
  state.weekNum=(state.weekNum||1)+1;
  if(!skipInter) Ads.interstitial();  // мягкий интерстишел на стыке глав; НЕ показываем, если главу открыли за reward-рекламу (не 2 подряд)
  const ch=CHAPTERS[state.weekNum];
  state.cur = ch ? ch.start : 'intro';
  snapshot();
  save(); renderMetrics(); renderEvent(); show('screen-game');
}

function flashSaved(){const s=$('saved');s.style.opacity=1;setTimeout(()=>s.style.opacity=0,800);}
function startGame(){state=fresh();try{state.streak=Streak.check();}catch(e){}snapshot();renderMetrics();renderEvent();show('screen-game');save();}
function hardReset(){startGame();}
function snapshot(){ try{ state._snap=JSON.stringify({m:state.m,flags:state.flags,rel:state.rel,weekNum:state.weekNum,cur:state.cur}); }catch(e){} }
function replayChapter(){
  if(!state||!state._snap) return hardReset();
  const s=JSON.parse(state._snap);
  state.m={...s.m}; state.flags={...s.flags}; state.rel={...s.rel}; state.weekNum=s.weekNum; state.cur=s.cur;
  save(); renderMetrics(); renderEvent(); show('screen-game');
}
/* ===== Камеры офиса (reward) ===== */
function openCam(cam){
  const el=$('screen-cam');
  el.innerHTML=`<div class="cam-wrap">
    <div class="cam-kicker">🎥 Камера офиса — что происходит</div>
    <div class="cam-videowrap">
      <video class="cam-video" playsinline autoplay loop muted src="${CLIP_DIR}${cam.video}?v=3"></video>
      <div class="scene-ctls on">
        <button class="scene-ctl" id="cam-pause" aria-label="Пауза">⏸</button>
        <button class="scene-ctl" id="cam-sound" aria-label="Звук">🔊</button>
      </div>
    </div>
    <div class="cam-cap">${cam.cap}</div>
    <button class="btn btn-primary" style="min-width:220px;" onclick="closeCam('${cam.flag}')">Понятно →</button>
  </div>`;
  const v=el.querySelector('video'), pb=$('cam-pause'), sb=$('cam-sound');
  if(v){ v.muted=true; v.play().catch(()=>{}); }
  if(pb) pb.onclick=()=>{ if(v.paused){ v.play().catch(()=>{}); pb.textContent='⏸'; } else { v.pause(); pb.textContent='▶'; } };
  if(sb) sb.onclick=()=>{ v.muted=!v.muted; sb.textContent=v.muted?'🔊':'🔇'; v.play().catch(()=>{}); };
  show('screen-cam');
}
function closeCam(flag){
  if(flag) state.flags[flag]=true;
  try{ const v=$('screen-cam').querySelector('video'); if(v) v.pause(); }catch(e){}
  save(); show('screen-game'); renderEvent();
}

/* ===== Досье команды (HR-глоссарий) ===== */
const HERO_DIR = './assets/heroes/';
const ROSTER = [
  { id:'baron',    name:'Барон',    role:'Основатель · экс-CEO',        img:'baron.jpg',
    tag:'Наблюдает со стороны',
    bio:'Легенда Котополиса — собрал «Девять» практически из гаража. Выгорел и однажды просто отдал тебе ключи с одной фразой: «Для всех хорошим не будешь». Ушёл, но следит за каждым твоим шагом.' },
  { id:'sonya',    name:'Соня',     role:'Стажёрка · твои глаза',       img:'sonya.jpg',
    tag:'Совесть команды',
    bio:'Пришла вчера и ещё верит, что бизнес может быть честным. Её глазами ты видишь офис — и она первой заметит, если ты начнёшь меняться не в ту сторону.' },
  { id:'vasilisa', name:'Василиса', role:'Операционный директор',        img:'vasilisa.jpg',
    tag:'Опора или угроза',
    bio:'Держит всю компанию на плечах, пока другие интригуют. Сильная, прямая, слабости не прощает — но её лояльность стоит десяти чужих. Между ней и Марселем — давняя недосказанность.' },
  { id:'marsel',   name:'Марсель',  role:'Коммерческий директор',        img:'marsel.jpg',
    tag:'Уязвим — потому опасен',
    bio:'Когда-то звезда продаж, теперь боится, что молодые его обходят. Кризис среднего возраста с дорогими часами. Готов рискнуть всем, лишь бы снова стать первым.' },
  { id:'felix',    name:'Феликс',   role:'Продакт-лид',                  img:'felix.jpg',
    tag:'Союзник или мятеж',
    bio:'Молодой, дерзкий, реально талантливый — и уверен, что это кресло должно быть его. Дашь расти — получишь гения. Прижмёшь — получишь бунт.' },
  { id:'grisha',   name:'Гриша',    role:'Руководитель логистики',       img:'grisha.jpg',
    tag:'Держит склад и совесть',
    bio:'Работяга и семьянин: двое детей, ипотека, ни одной жалобы. Не подведёт никогда — но и ломается тихо, без слов. Легко не заметить, что он давно на пределе.' },
  { id:'bagira',   name:'Багира',   role:'Директор по развитию',         img:'bagira.jpg',
    tag:'Козырь или крот',
    bio:'Femme fatale офиса: сделки, слияния и чужие секреты — её стихия. Красива, умна, играет вдолгую. Ты никогда не знаешь наверняка, на чьей она стороне.' },
  { id:'cleo',     name:'Клео',     role:'Директор по маркетингу',       img:'cleo.jpg',
    tag:'Репутация на лезвии',
    bio:'Лицо бренда «Девять», миллионы подписчиков, идеальная картинка. Но за фильтрами — страх, что однажды хайп обернётся против неё. И этот день ближе, чем кажется.' },
  { id:'murka',    name:'Мурка',    role:'HR-директор',                  img:'murka.jpg',
    tag:'Пульс морали',
    bio:'Душа коллектива: помнит дни рождения и чужие беды. К ней идут выговориться — и она знает про всех всё. Пока ты гонишься за цифрами, она считает людей.' },
  { id:'tisha',    name:'Тиша',     role:'Технический директор (CTO)',   img:'tisha.jpg',
    tag:'Знает, кто крот',
    bio:'Тихий гений, построивший всю платформу «Девять». Говорит редко, видит всё — включая утечки и тех, кто за ними стоит. Молчаливый, но совсем не слепой.' },
];
function openDossier(){
  const grid=$('dossier-grid');
  grid.innerHTML=ROSTER.map(h=>`
    <button class="dossier-tile" onclick="openHero('${h.id}')">
      <img loading="lazy" src="${HERO_DIR}${h.img}" alt="${h.name}">
      <div class="dt-fade"></div>
      <div class="dt-meta"><b>${h.name}</b><small>${h.role}</small></div>
    </button>`).join('');
  $('dossier-detail').classList.remove('show');
  show('screen-dossier');
}
function openHero(id){
  const h=ROSTER.find(x=>x.id===id); if(!h) return;
  try{SFX.click();}catch(e){}
  $('dossier-detail').innerHTML=`
    <div class="hero-card">
      <img class="hero-img" src="${HERO_DIR}${h.img}" alt="${h.name}">
      <div class="hero-body">
        <div class="hero-name">${h.name}</div>
        <div class="hero-role">${h.role}</div>
        <div class="hero-tag">${h.tag}</div>
        <p class="hero-bio">${h.bio}</p>
        <button class="btn" onclick="closeHero()">← К команде</button>
      </div>
    </div>`;
  $('dossier-detail').classList.add('show');
  $('dossier-detail').scrollTop=0;
}
function closeHero(){ $('dossier-detail').classList.remove('show'); }

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
/* Единый тап-звук на ВСЕ кнопки/карточки (меню, досье, головоломки, итоги…).
   Степперы бюджета звучат своим SFX.step, поэтому их исключаем, чтобы не двоило. */
document.addEventListener('click',e=>{
  const t=e.target.closest('button, .choice, .anom-row, .dossier-tile');
  if(!t || t.disabled || t.closest('.pz-stepper')) return;
  try{ SFX.tap(); }catch(err){}
},true);

/* Скролл теперь естественный — страницу скроллит BODY (экраны в обычном потоке, только активный
   виден). Это надёжно на iOS, поэтому все прежние костыли (зажим #app, буфер границы, репейнт при
   возврате, одноразовая подсказка) удалены за ненадобностью. */

/* ===== ОБЛАЧНЫЕ СЕЙВЫ (VK Bridge Storage) =====
   localStorage в iframe ВК на iOS может стираться → дублируем сейв/замок/стрик в облако ВК.
   Без этого после захода на след. день прогресс и открытая глава могли пропасть. */
const CLOUD_KEYS=['devyat9_slice_save','devyat9_unlock','devyat9_streak'];
let cloudReady=false, _cloudT=null;
function cloudInit(cb){
  if(!(window.vkBridge && window.vkBridge.send)){ cloudReady=true; return cb&&cb(); }   // вне ВК — localStorage
  try{
    window.vkBridge.send('VKWebAppStorageGet',{keys:CLOUD_KEYS}).then(r=>{
      try{ (r.keys||[]).forEach(kv=>{
        if(kv && kv.value && kv.value.length){
          if(kv.key==='devyat9_slice_save' && localStorage.getItem('devyat9_slice_save')) return; // не затираем свежую локальную сессию
          try{ localStorage.setItem(kv.key, kv.value); }catch(e){}
        }
      }); }catch(e){}
      cloudReady=true; cb&&cb();
    }).catch(()=>{ cloudReady=true; cb&&cb(); });
  }catch(e){ cloudReady=true; cb&&cb(); }
}
function cloudSave(){                                   // дебаунс, чтобы не спамить VK Storage на каждый выбор
  if(!cloudReady || !(window.vkBridge && window.vkBridge.send)) return;
  clearTimeout(_cloudT);
  _cloudT=setTimeout(()=>{ CLOUD_KEYS.forEach(k=>{ const v=localStorage.getItem(k); if(v!=null){ try{ window.vkBridge.send('VKWebAppStorageSet',{key:k, value:String(v)}).catch(()=>{}); }catch(e){} } }); }, 700);
}

/* Умная кнопка «Продолжить»: сама сообщает, готова ли новая глава */
function refreshContinue(){
  const s=load(), cont=$('btn-continue'), start=$('btn-start');
  if(s){
    let label;
    if(s.awaitingNext){
      const nx=(s.weekNum||1)+1;
      label = chapterLocked(nx) ? ('▸ Продолжить · Глава '+nx+' через '+fmtRemain(lockRemain())) : ('✦ Глава '+nx+' открыта — играть!');
    } else { label='▸ Продолжить · Глава '+(s.weekNum||1); }
    cont.textContent=label; cont.className='btn btn-primary btn-glow'; cont.style.cssText='min-width:250px; display:block; margin-bottom:12px;';
    start.textContent='Новая игра'; start.className='ctrl'; start.style.cssText='margin-top:2px;';
  } else {
    cont.style.display='none';
    start.textContent='Принять «Девять» →'; start.className='btn btn-primary'; start.style.minWidth='230px';
  }
}

$('btn-start').onclick=()=>{ if(load() && !confirm('Начать заново? Текущий прогресс сбросится.')) return; playIntro(); };
$('intro-cta').onclick=startGame;
$('restart').onclick=hardReset;
$('btn-dossier').onclick=openDossier;
$('dossier-back').onclick=()=>show('screen-title');
$('btn-continue').onclick=()=>{ state=load()||fresh(); renderMetrics();
  if(state.awaitingNext){ endSlice(); }               // вернулся, пока ждём открытия след. главы — снова экран итогов (замок пересчитается)
  else { renderEvent(); show('screen-game'); } };

/* VK Bridge init + чтение облака ПЕРЕД показом кнопки «Продолжить» */
try{ if(window.vkBridge) window.vkBridge.send('VKWebAppInit'); }catch(e){}
cloudInit(refreshContinue);
