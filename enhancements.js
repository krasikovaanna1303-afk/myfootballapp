/* ПОЛЕ — карта России, статусы доступа и анкеты. Без сервера общие игры пока недоступны. */
(() => {
'use strict';
const seed = (window.POLE_SEED_FIELDS || []).map(f => ({...f, sourceVerified:!!f.source, access:f.access || (f.paid===true?'paid':'unknown')}));
const config = window.POLE_SUPABASE || {};
const backend = !!(config.url && config.anonKey && window.supabase?.createClient);
const sb = backend ? window.supabase.createClient(config.url, config.anonKey) : null;
const cityList = [
['Санкт-Петербург',59.9343,30.3351,12],['Москва',55.7558,37.6173,12],
['Казань',55.7961,49.1064,12],['Нижний Новгород',56.2965,43.9361,12],
['Великий Новгород',58.5215,31.2755,12],['Псков',57.8194,28.3318,12],
['Тверь',56.8587,35.9176,12],['Выборг',60.7102,28.7494,12],
['Сортавала',61.7023,30.6919,13],['Малая Вишера',58.8458,32.2232,13],
['Новоселицы (Новгородская область)',58.69,31.57,13],
['Мурманск',68.9707,33.0749,12],['Архангельск',64.5393,40.5187,12],
['Петрозаводск',61.7850,34.3469,12],['Екатеринбург',56.8389,60.6057,12],
['Новосибирск',55.0302,82.9204,12],['Самара',53.1959,50.1002,12],
['Краснодар',45.0355,38.9753,12],['Сочи',43.6028,39.7342,12],
['Ростов-на-Дону',47.2357,39.7015,12],['Уфа',54.7388,55.9721,12],
['Владивосток',43.1155,131.8855,12]
];
const city = document.querySelector('#city');
if (city) {
  city.innerHTML = '<option value="">Выбери город или посёлок</option>' + cityList.map((c,i)=>'<option value="'+i+'">'+E(c[0])+'</option>').join('');
  city.onchange = () => {
    if (city.value === '' || city.value === 'custom' || !map) return;
    const c=cityList[Number(city.value)]; if(!c)return;
    map.setView([c[1],c[2]],c[3]===12?11:c[3]);
    document.querySelector('#search').value='';
    toast('Загружаем площадки: '+c[0]);
  };
}
const cityForm = document.querySelector('#city-search');
if (cityForm) cityForm.addEventListener('submit',async event => {
  event.preventDefault();
  const term=cityForm.elements.cityName.value.trim();
  if(term.length<2)return toast('Укажи название населённого пункта');
  try {
    const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),9000);
    const response=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(term)+'&count=5&language=ru&countryCode=RU',{signal:ac.signal});clearTimeout(timer);
    if(!response.ok)throw new Error('Невозможно выполнить поиск');
    const result=await response.json();
    let place=result.results?.[0];
    if(!place){
      // Редкий посёлок может отсутствовать в GeoNames. Запрос по инициативе пользователя в OSM Nominatim.
      const backup=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ru&limit=1&q='+encodeURIComponent(term));
      if(backup.ok){const list=await backup.json();const x=list?.[0];if(x)place={name:x.display_name?.split(',')[0]||term,latitude:Number(x.lat),longitude:Number(x.lon)}}
    }
    if(!place) return toast('Населённый пункт не найден. Уточни запрос');
    const label=[place.name,place.admin1].filter(Boolean).join(', ');
    city.insertAdjacentHTML('beforeend','<option selected value="custom">'+E(label)+'</option>');
    document.querySelector('#search').value='';
    map.setView([place.latitude,place.longitude],13);
    toast('Показываем: '+label+'. Данные OSM');
  }catch {toast('Поиск города временно недоступен')}
});
const status = f => {
  if (f.access==='private')return {name:'Доступ ограничен',key:'private'};
  if (f.access==='free')return {name:f.custom?'Бесплатно · по словам игрока':f.sourceVerified?'Бесплатно по условиям источника':'Бесплатно и доступно по OSM · проверь',key:'free'};
  if (f.access==='free_tag')return {name:'Без платы по OSM · доступ не подтверждён',key:'free'};
  if (f.access==='paid'||f.paid===true)return {name:'Платная · условия уточни',key:'paid'};
  if (f.custom && f.paid===false)return {name:'Бесплатно · по словам автора',key:'free'};
  return {name:'Условия доступа неизвестны',key:'unknown'};
};
const allFields=()=>{
  const byId=new Map();
  for(const f of [...osm,...seed,...fields]){
    if(Number.isFinite(Number(f.lat))&&Number.isFinite(Number(f.lon)))byId.set(String(f.id),f);
  }
  return [...byId.values()];
};
function safeOsmLink(f){
  if(f.sourceVerified && f.source && /^https:\/\//.test(f.source)) return f.source;
  const match=String(f.id||'').match(/^osm-(node|way|relation)-(\d+)$/);
  return match?'https://www.openstreetmap.org/'+match[1]+'/'+match[2]:null;
}
function fieldHTML(f){
  const s=status(f);const tags=[
    '<span class="tag '+(s.key==='free'?'free':'')+'">'+E(s.name)+'</span>',
    '<span class="tag">'+E(f.surface||'Покрытие не указано')+'</span>',
    f.lit===true?'<span class="tag">💡 Есть освещение</span>':'',
    f.sourceVerified?'<span class="tag">🔗 Есть источник</span>':'',
    f.custom?'<span class="tag">Добавлено игроком</span>':'',
    f.potential?'<span class="tag candidate">⚠ Не подтверждено для футбола</span>':'<span class="tag">⚽ Футбольный объект</span>'
  ].join('');
  return '<div class="item"><div class="muted">'+E(f.city|| (f.potential?'Универсальная/дворовая площадка':'Футбольная площадка'))+'</div><h3>'+E(f.name)+'</h3><div class="tags">'+tags+'</div><p>'+E(f.address||f.description||'Источник: OpenStreetMap')+'</p><div class="actions"><button class="secondary" data-focus="'+E(f.id)+'">На карте</button><button class="secondary" data-field="'+E(f.id)+'">Подробнее</button></div></div>';
}
renderFields=function(){
  const q=String(document.querySelector('#search')?.value||'').toLowerCase().trim();
  const filter=document.querySelector('#filter')?.value||'all';
  const allowPotential=document.querySelector('#include-multisport')?.checked ?? true;
  const viewport=map?.getBounds()?.pad(0.12);
  let visible=allFields().filter(f=>!viewport||viewport.contains([Number(f.lat),Number(f.lon)]));
  const countAll=visible.length, confirmed=visible.filter(f=>!f.potential).length;
  const filtered=visible.filter(f=>(allowPotential||!f.potential) && [f.name,f.city,f.address].join(' ').toLowerCase().includes(q) &&
    (filter==='all' || (filter==='free' && status(f).key==='free') || (filter==='paid' && status(f).key==='paid') ||
     (filter==='lit' && f.lit===true) || (filter==='unknown' && status(f).key==='unknown')));
  const weight=f=>(status(f).key==='free'?0:status(f).key==='unknown'?1:2)+(f.potential?3:0);
  filtered.sort((a,b)=>weight(a)-weight(b));
  document.querySelector('#count').textContent=filtered.length+' найдено · '+confirmed+' футбол · '+countAll+' всего в области';
  const out=document.querySelector('#field-list');
  out.innerHTML=filtered.slice(0,500).map(fieldHTML).join('')||'<p>В этой области по фильтрам пока нет полей. Убери фильтры, включи универсальные площадки или передвинь карту.</p>';
  if(filtered.length>500)out.insertAdjacentHTML('beforeend','<p class="notice">В списке первые 500. Приблизь район или воспользуйся поиском, чтобы найти остальные.</p>');
  if(markers){
    markers.clearLayers();
    for(const f of filtered.slice(0,4000)){
      const s=status(f);
      const m=L.marker([Number(f.lat),Number(f.lon)],{title:String(f.name)});
      m.bindPopup('<b>'+E(f.name)+'</b><br>'+E(f.potential?'⚠ Для футбола не подтверждено':s.name)+'<br><button class="map-detail" data-map-field="'+E(f.id)+'">Подробнее</button>');
      markers.addLayer(m);
    }
  }
};
document.addEventListener('click',e=>{let b=e.target.closest('[data-map-field]');if(b)window.showField(b.dataset.mapField)});
window.showField=function(id){
  const f=allFields().find(x=>x.id===id);if(!f)return;
  const s=status(f),link=safeOsmLink(f);
  modal(f.name,'<p>'+E(f.address||f.city||'')+'</p><div class="tags"><span class="tag">'+E(s.name)+'</span><span class="tag">'+E(f.surface||'Покрытие неизвестно')+'</span><span class="tag">'+(f.lit?'💡 Освещение есть':'Освещение не подтверждено')+'</span></div><p>'+E(f.description||'')+'</p>'+
    (link?'<p><a href="'+E(link)+'" target="_blank" rel="noopener noreferrer">Источник сведений ↗</a></p>':'<p class="notice">Данные добавлены пользователем, независимо не подтверждены.</p>')+
    '<p class="notice">'+(f.potential?'Это универсальная или дворовая спортплощадка: наличие футбольных ворот и возможность играть не подтверждены. ':'')+'Проверь доступность, аренду и безопасность перед игрой. Открытая карта не гарантирует разрешение на посещение.</p>'+
    '<h3>Отзывы</h3>'+((f.reviews||[]).map(r=>'<p>⭐ '+E(r.rating)+'/5 · <b>'+E(r.author)+'</b><br>'+E(r.text)+'</p>').join('')||'<p>Пока нет отзывов</p>')+
    '<button class="primary" id="field-game">Создать здесь игру</button> '+(f.custom?'<button class="secondary" id="field-review">Оставить отзыв</button>':''));
  document.querySelector('#field-game').onclick=()=>{
    document.querySelector('#modal').close();add('game');
    const sel=document.querySelector('#gameform select[name=field]');
    if(sel){if(![...sel.options].some(o=>o.value===f.name))sel.add(new Option(f.name,f.name));sel.value=f.name}
  };
  if(f.custom)document.querySelector('#field-review').onclick=()=>{
    if(!needUser())return;
    modal('Отзыв о поле','<form id="reviewform"><input type="hidden" name="id" value="'+E(f.id)+'"><label>Оценка<select name="rating">'+[5,4,3,2,1].map(n=>'<option value="'+n+'">'+n+' / 5</option>').join('')+'</select></label><label>Комментарий<textarea name="review" required maxlength="1000"></textarea></label><button class="primary">Опубликовать</button></form>');
  };
};
// Расширенный поиск спортивных и дворовых площадок из OSM.
// В отличие от фиксированного списка точек, запрос строится для выбранного района.
// Для неизвестного вида спорта используем отдельный признак potential=true.
const OSM_SERVERS=[
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];
let lastLoadedBounds=null, latest=0, currentAbort=null;
const osmStore=new Map(), memoryLimit=3500;
try {
  const cache=JSON.parse(localStorage.getItem('pole_osm_v4')||'null');
  if(cache && Date.now()-cache.time<7*86400000 && Array.isArray(cache.items)){
    for(const item of cache.items.slice(0,memoryLimit))osmStore.set(item.id,item);
    osm=[...osmStore.values()];
  }
} catch {}
let dataState='Поиск площадок в выбранной области карты';
function infoState(message){
  dataState=message;
  const e=document.querySelector('#field-data-state');if(e)e.textContent=message;
}
function geoEntry(x){
  const t=x.tags||{};
  const lat=Number(x.lat??x.center?.lat),lon=Number(x.lon??x.center?.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
  const a=t.access||'';
  const forbidden=['private','no','customers','permit'].includes(a);
  const sport=String(t.sport||'').toLowerCase();
  const name=String(t.name||'');
  const soccer=/soccer|futsal|mini_soccer|association_football|футбол/.test(sport) || /футбол|soccer|mini.football/i.test(name);
  const potential=!soccer;
  // Поле sport=multi либо без указания спорта: гипотеза, а не достоверная футбольная площадка.
  // fee=no без явного access=yes также не означает гарантированный проход.
  let access=forbidden?'private':t.fee==='yes'?'paid':
    t.fee==='no'?(['yes','public','permissive'].includes(a)?'free':'free_tag'):'unknown';
  const labels=[t['addr:street'],t['addr:housenumber']].filter(Boolean);
  return {
    id:'osm-'+x.type+'-'+x.id,
    name:name || (potential?'Спортплощадка — уточнить футбол':'Футбольная площадка'),
    city:t['addr:city']||'', address:labels.join(', '),
    lat,lon,lit:t.lit==='yes'?true:t.lit==='no'?false:null,
    surface:t.surface||'Не указано',
    paid:t.fee==='yes'?true:t.fee==='no'?false:null,access,potential,
    description:(potential?'Универсальная/дворовая спортивная площадка (футбол не указан). ':'')+
      'Метка OpenStreetMap. Тип поля, свободный вход, ворота, часы и состояние требуют проверки.',
    source:'https://www.openstreetmap.org/'+x.type+'/'+x.id,
    reviews:[]
  };
}
function osmQuery(bbox){
  const B='('+bbox+')';
  return '[out:json][timeout:30];('+
    'nwr["leisure"="pitch"]["sport"~"soccer|futsal|mini_soccer|football",i]'+B+';'+
    'nwr["leisure"="practice_pitch"]["sport"~"soccer|futsal",i]'+B+';'+
    'nwr["leisure"="sports_centre"]["sport"~"soccer|futsal",i]'+B+';'+
    'nwr["leisure"="stadium"]["sport"~"soccer|futsal",i]'+B+';'+
    'nwr["leisure"="pitch"]["sport"="multi"]'+B+';'+
    'nwr["leisure"="pitch"][!"sport"]'+B+';'+
  ');out center 5000;';
}
async function queryOverpass(query,signal){
  let error;
  for(const endpoint of OSM_SERVERS){
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    const requestSignal=AbortSignal.any?AbortSignal.any([signal,AbortSignal.timeout(19000)]):signal;
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
        body:'data='+encodeURIComponent(query),signal:requestSignal});
      if(!response.ok)throw Error('HTTP '+response.status);
      const data=await response.json();
      if(!Array.isArray(data.elements))throw Error('Неверный ответ');
      return data.elements;
    }catch(e){error=e;if(signal.aborted)throw e;}
  }
  throw error||Error('Нет ответа от Overpass');
}
loadOSM=async function(){
  if(!map)return;
  const view=map.getBounds();
  if(map.getZoom()<9){infoState('Приблизь карту до уровня города для загрузки площадок');renderFields();return}
  if(lastLoadedBounds&&lastLoadedBounds.contains(view)){renderFields();return}
  // Запрашиваем видимую область плюс запас, чтобы при небольшом сдвиге не обращаться снова к серверу.
  const bounds=view.pad(.24);
  const area=(bounds.getNorth()-bounds.getSouth())*(bounds.getEast()-bounds.getWest());
  if(area>2.6){infoState('Область слишком велика: приблизь карту');renderFields();return}
  const bbox=[bounds.getSouth(),bounds.getWest(),bounds.getNorth(),bounds.getEast()].map(v=>v.toFixed(5)).join(',');
  const request=++latest;
  if(currentAbort)currentAbort.abort();
  const controller=new AbortController();currentAbort=controller;
  infoState('Ищем футбольные и дворовые спортплощадки в OpenStreetMap…');
  renderFields();
  try{
    let elements;
    try{
      elements=await queryOverpass(osmQuery(bbox),controller.signal);
    }catch(fullError){
      if(controller.signal.aborted)throw fullError;
      infoState('Подробный запрос не прошёл — пробуем только футбольные поля...');
      const basic='[out:json][timeout:20];(nwr["sport"~"soccer|futsal|mini_soccer",i]('+bbox+'););out center 3000;';
      elements=await queryOverpass(basic,controller.signal);
    }
    if(request!==latest||controller.signal.aborted)return;
    const newItems=elements.map(geoEntry).filter(Boolean);
    for(const item of newItems)osmStore.set(item.id,item);
    while(osmStore.size>memoryLimit)osmStore.delete(osmStore.keys().next().value);
    osm=[...osmStore.values()];
    lastLoadedBounds=bounds;
    infoState('Загружено '+newItems.length+' объектов OSM для этой области (среди них могут быть универсальные спортплощадки).');
    try{localStorage.setItem('pole_osm_v4',JSON.stringify({time:Date.now(),items:osm}))}catch{}
    renderFields();
  }catch(err){
    if(request!==latest||controller.signal.aborted)return;
    infoState('Сервис OSM временно не ответил; показываются известные площадки и ранее загруженные данные. Повтори поиск, передвинув карту.');
    renderFields();
    toast('Загрузка полей не удалась. Перемести карту или попробуй позднее.');
  }
};
const filter=document.querySelector('#filter');
if(filter){
  filter.innerHTML='<option value="all">Все площадки</option><option value="free">🟢 Отмечены бесплатными</option><option value="unknown">Доступ не уточнён</option><option value="paid">Платные</option><option value="lit">С освещением</option>';
  filter.value='all';
}
document.querySelector('#search').placeholder='Название поля, район или адрес';
document.querySelector('#search').oninput=()=>renderFields();
document.querySelector('#filter').onchange=()=>renderFields();
document.querySelector('#include-multisport').onchange=()=>renderFields();
document.querySelector('#refresh-pitches').onclick=()=>{lastLoadedBounds=null;loadOSM()};
const formBits=(u={},withCredentials=false)=> {
  const val=(k)=>E(u[k]||'');
  return (withCredentials?'<label>Электронная почта<input type="email" name="email" autocomplete="email" required></label><label>Пароль (минимум 8 символов)<input type="password" name="password" autocomplete="new-password" minlength="8" required></label>':'')+
  '<label>Имя или никнейм<input name="name" autocomplete="nickname" maxlength="40" minlength="2" required value="'+val('name')+'"></label>'+
  '<label>Возраст (лет)<input name="age" type="number" min="16" max="100" required value="'+val('age')+'"></label>'+
  '<label>Пол (можно не указывать)<select name="gender"><option value="">Не указывать</option><option value="female">Женский</option><option value="male">Мужской</option><option value="other">Другой</option></select></label>'+
  '<label>Уровень игры<select name="skill" required><option value="new">Новичок</option><option value="amateur">Любитель</option><option value="confident">Уверенно играю</option><option value="advanced">Продвинутый</option></select></label>'+
  '<label>Предпочитаемая позиция<select name="position"><option value="">Не важно</option><option value="gk">Вратарь</option><option value="def">Защитник</option><option value="mid">Полузащитник</option><option value="fwd">Нападающий</option></select></label>'+
  '<label>Город<input name="city" maxlength="80" required value="'+val('city')+'" placeholder="Например, Санкт-Петербург"></label>'+
  '<label>Любимый формат<select name="format"><option value="any">Любой</option><option value="5v5">5 на 5</option><option value="7v7">7 на 7</option><option value="11v11">11 на 11</option></select></label>'+
  '<label class="checkline"><input type="checkbox" name="trips" '+(u.trips?'checked':'')+'> Интересны футбольные поездки в другие города</label>';
};
function hydrateProfile(f,d){
  for(const n of ['gender','skill','position','format']){if(f.elements[n] && d[n]!=null)f.elements[n].value=d[n]}
}
function demoAccount(){
  modal('Анкета игрока · демо','<p class="notice">Сейчас эта анкета сохраняется только в твоём браузере, без паролей и общего аккаунта.</p><form id="pole-demo-profile">'+formBits(user||{},false)+'<button class="primary" style="margin-top:18px">Сохранить анкету</button></form>');
  hydrateProfile(document.querySelector('#pole-demo-profile'),user||{});
}
function authAccount(mode='login'){
  if(!sb)return demoAccount();
  if(user){
    modal('Мой аккаунт','<p><b>'+E(user.name)+'</b></p><p>Твой профиль привязан к электронной почте через Supabase Auth.</p><button class="secondary" id="pole-logout">Выйти из аккаунта</button>');
    document.querySelector('#pole-logout').onclick=async()=>{await sb.auth.signOut();user=null;save();document.querySelector('#account').textContent='Войти';document.querySelector('#modal').close();toast('Вы вышли из аккаунта')};
    return;
  }
  modal(mode==='signup'?'Регистрация в ПОЛЕ':'Вход в ПОЛЕ',
    '<div class="auth-tabs"><button class="secondary" id="switch-login">Войти</button> <button class="secondary" id="switch-signup">Зарегистрироваться</button></div>'+
    '<form id="pole-auth-form" data-mode="'+mode+'">'+(mode==='signup'?formBits({},true):
      '<label>Электронная почта<input name="email" type="email" autocomplete="email" required></label><label>Пароль<input name="password" type="password" autocomplete="current-password" required></label>')+
    '<button class="primary" style="margin-top:18px">'+(mode==='signup'?'Зарегистрироваться':'Войти')+'</button><p class="notice" id="pole-auth-message"></p></form>');
  document.querySelector('#switch-login').onclick=()=>authAccount('login');
  document.querySelector('#switch-signup').onclick=()=>authAccount('signup');
}
const account=document.querySelector('#account');
account.onclick=()=>backend?authAccount():demoAccount();
document.addEventListener('submit',async ev=>{
  const id=ev.target.id;
  if(id!=='pole-demo-profile'&&id!=='pole-auth-form')return;
  ev.preventDefault();const f=ev.target,d=Object.fromEntries(new FormData(f).entries());
  if(id==='pole-demo-profile'){
    user={id:user?.id||uid(),name:d.name.trim(),age:+d.age,gender:d.gender,skill:d.skill,position:d.position,city:d.city.trim(),format:d.format,trips:d.trips==='on'};
    save();account.textContent=user.name.slice(0,12);
    document.querySelector('#modal').close();toast('Демо-анкета сохранена только в этом браузере');return;
  }
  const message=document.querySelector('#pole-auth-message');
  const button=f.querySelector('button[type=submit],button.primary');button.disabled=true;
  try {
    if(f.dataset.mode==='signup'){
      const payload={nickname:d.name.trim(),age:+d.age,gender:d.gender,skill:d.skill,position:d.position,city:d.city.trim(),format:d.format,trips:d.trips==='on'};
      const {data,error}=await sb.auth.signUp({email:d.email,password:d.password,options:{data:payload}});
      if(error)throw error;
      if(!data.session){message.textContent='Проверь почту и подтверди регистрацию. После этого войди в аккаунт.';return}
    }else{
      const {error}=await sb.auth.signInWithPassword({email:d.email,password:d.password});
      if(error)throw error;
    }
    await syncAccount();document.querySelector('#modal').close();toast('Добро пожаловать в ПОЛЕ!');
  }catch(err){message.textContent='Ошибка: '+(err.message||'проверь данные и настройки Supabase')}
  finally{button.disabled=false}
});
async function syncAccount(){
  if(!sb)return;
  const {data:{user:authUser},error}=await sb.auth.getUser();
  if(error||!authUser){user=null;save();account.textContent='Войти';return}
  const meta=authUser.user_metadata||{};
  const {data:profile}=await sb.from('profiles').select('nickname,age_years_at_registration,gender,skill,position,city,format,trips').eq('id',authUser.id).maybeSingle();
  user={id:authUser.id,name:profile?.nickname||meta.nickname||'Игрок',age:profile?.age_years_at_registration||meta.age,gender:profile?.gender||meta.gender,skill:profile?.skill||meta.skill,position:profile?.position||meta.position,city:profile?.city||meta.city,format:profile?.format||meta.format,trips:profile?.trips??meta.trips};
  save();account.textContent=user.name.slice(0,12);
}
if(sb){user=null;save();syncAccount();sb.auth.onAuthStateChange(()=>setTimeout(syncAccount,0));}
if(typeof map!=='undefined' && map){renderFields();loadOSM();}
})();
