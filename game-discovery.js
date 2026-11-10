/* ПОЛЕ: карточки матчей, поиск и структурированные параметры новых игр.
   Старые матчи без этих данных отображаются без выдуманных характеристик. */
(() => {
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const formats=[['3v3','3×3'],['4v4','4×4'],['5v5','5×5'],['6v6','6×6'],['7v7','7×7'],['8v8','8×8'],['11v11','11×11'],['any','Любой']];
const skills=[['new','Новичок'],['amateur','Любитель'],['confident','Уверенный'],['advanced','Продвинутый'],['any','Любой уровень']];
const groups=[['female','Женский'],['male','Мужской'],['mixed','Смешанный'],['any','Без ограничений']];
const ages=[['under18','До 18 лет'],['18-24','18–24 года'],['25-34','25–34 года'],['35-44','35–44 года'],['45+','45 лет и старше'],['any','Без ограничений по возрасту']];
const fm=Object.fromEntries(formats),sm=Object.fromEntries(skills),gm=Object.fromEntries(groups),am=Object.fromEntries(ages);
const option=(value,label)=>'<option value="'+esc(value)+'">'+esc(label)+'</option>';
const opts=(values,initial='')=>option('',initial||'Все варианты')+values.map(([v,n])=>option(v,n)).join('');
const formatLocalDate=raw=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raw||''))return raw||'Дата уточняется';
 const [year,month,day]=raw.split('-').map(Number);
 return new Date(year,month-1,day).toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'long'});
};
const localToday=()=>{
 const d=new Date(),pad=n=>String(n).padStart(2,'0');
 return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
};

function gameCatalog(){
 const byId=new Map();
 for(const f of [...(window.POLE_PERMANENT_FIELDS||[]),...(window.POLE_SEED_FIELDS||[]),...osm,...fields]){
  if(!f||!f.name||!f.id)continue;
  byId.set(String(f.id),f);
 }
 return [...byId.values()];
}
const oldAdd=add;
add=function(type,coord){
 if(type!=='game')return oldAdd(type,coord);
 if(!needUser())return;
 if(user?.account_type==='team'){toast('Создавать игры можно из аккаунта игрока');return}
 const html='<form id="gameform" class="game-create-form">'+
 '<label>Название игры<input name="title" type="text" required minlength="2" maxlength="120" value="Футбол для всех"></label>'+
 '<label>Площадка <input id="pole-game-field-search" type="search" placeholder="Введи название, адрес или город" maxlength="180" autocomplete="off" required></label>'+
 '<div id="pole-game-field-hits" class="game-field-hits" aria-live="polite"></div>'+
 '<p class="notice" id="pole-game-field-help">Начни вводить название или город и выбери площадку из списка.</p>'+
 '<input type="hidden" name="fieldId" value=""><input type="hidden" name="field" value="">'+
 '<label>Город игры<input type="text" name="city" required minlength="2" maxlength="80" value="'+esc(user?.city||'')+'" placeholder="Например, Москва"></label>'+
 '<div class="game-create-two">'+
 '<label>Дата матча<input type="date" name="date" required min="'+localToday()+'" value="'+localToday()+'"></label>'+
 '<label>Время<input type="time" name="time" required value="19:00"></label></div>'+
 '<div class="game-create-two">'+
 '<label>Формат футбола<select name="game_format" required>'+opts(formats,'Выбери формат')+'</select></label>'+
 '<label>Уровень участников<select name="skill_level" required>'+opts(skills,'Выбери уровень')+'</select></label></div>'+
 '<div class="game-create-two">'+
 '<label>Категория игры<select name="participant_group" required>'+opts(groups,'Выбери категорию')+'</select></label>'+
 '<label>Возраст участников<select name="age_group" required>'+opts(ages,'Выбери категорию')+'</select></label></div>'+
 '<div class="game-create-two">'+
 '<label class="game-capacity-label">Всего игроков, включая тебя<input type="number" name="capacity" required min="2" max="100" value="10"></label>'+
 '<label>Взнос за игрока, ₽ <span class="optional-label">(по желанию)</span><input name="fee_amount" type="number" step="1" min="0" max="100000" placeholder="0 — бесплатно"></label></div>'+
 '<label class="checkline game-unlimited-choice"><input type="checkbox" name="unlimited"> Без ограничения количества участников</label>'+
 '<p class="notice">Цена: 0 ₽ — бесплатная игра, пустое поле — стоимость не указана.</p>'+
 '<label>Дополнительная информация <span class="optional-label">(по желанию)</span><textarea name="description" maxlength="1500" placeholder="Место встречи, раздевалки, инвентарь и другие детали"></textarea></label>'+
 '<p class="form-validation-message" role="alert" id="game-form-hint"></p>'+
 '<button type="submit" class="primary game-create-save">Опубликовать игру</button></form>';
 modal('Организовать матч',html);
 const form=document.querySelector('#gameform');
 const search=form.querySelector('#pole-game-field-search');
 const results=form.querySelector('#pole-game-field-hits');
 const help=form.querySelector('#pole-game-field-help');
 const catalog=gameCatalog();
 const byId=new Map(catalog.map(f=>[String(f.id),f]));
 const searchable=catalog.map(f=>({
  f,terms:[f.name,f.city,f.address].filter(Boolean).join(' ').toLocaleLowerCase('ru-RU')
 }));
 const pick=f=>{
  if(!f||!form.isConnected)return;
  form.elements.fieldId.value=String(f.id);
  form.elements.field.value=String(f.name);
  search.value=f.name+(f.city?' · '+f.city:'');
  search.setCustomValidity('');
  if(f.city)form.elements.city.value=f.city;
  results.innerHTML='';
  help.textContent='Выбрана площадка: '+f.name+(f.city?' · '+f.city:'');
 };
 function suggest(){
  form.elements.fieldId.value='';
  form.elements.field.value='';
  const q=search.value.trim().toLocaleLowerCase('ru-RU');
  if(q.length<2){
   results.innerHTML='';
   help.textContent='Введи минимум 2 символа для поиска по каталогу.';
   return;
  }
  const hits=[];
  for(const item of searchable){
   if(item.terms.includes(q)){
    hits.push(item.f);
    if(hits.length>=20)break;
   }
  }
  results.innerHTML=hits.map(f=>
   '<button type="button" class="game-field-result" data-game-field="'+esc(f.id)+'"><strong>'+esc(f.name)+'</strong><span>'+esc([f.city,f.address].filter(Boolean).join(' · ')||'Местоположение на карте')+'</span></button>'
  ).join('')||'<p class="notice">Площадок не найдено. Попробуй другой запрос или выбери поле на карте.</p>';
  help.textContent=hits.length?'Нажми на нужную площадку в списке.':'Уточни запрос.';
 }
 search.addEventListener('input',suggest);
 results.addEventListener('click',event=>{
  const button=event.target.closest('[data-game-field]');
  if(button)pick(byId.get(button.dataset.gameField));
 });
 window.POLE_SET_GAME_FIELD=pick;
 if(coord){const nearest=catalog.find(f=>Number(f.lat)===Number(coord.lat)&&Number(f.lon)===Number(coord.lng));if(nearest)pick(nearest)}
};
document.addEventListener('submit',e=>{
 const form=e.target;if(form?.id!=='gameform')return;
 const field=form.elements.fieldId?.value;
 if(!field){
  e.preventDefault();
  e.stopImmediatePropagation();
  const hint=form.querySelector('#game-form-hint');
  if(hint)hint.textContent='Выбери конкретную площадку из подсказок поиска.';
  form.querySelector('#pole-game-field-search')?.focus();
 }
},true);
document.addEventListener('change',e=>{
 if(e.target.matches('#gameform input[name="unlimited"]')){
  const form=e.target.form,capacity=form?.elements.capacity;
  if(capacity){capacity.disabled=e.target.checked;capacity.required=!e.target.checked;
   capacity.closest('label').hidden=e.target.checked}
 }
});

const list=document.querySelector('#game-list');
if(list){
 const wrapper=document.createElement('section');
 wrapper.className='game-filters';
 wrapper.innerHTML='<div class="game-filters-intro"><div><h3>Подбери игру для себя</h3><p>Ищи по городу, дате, формату и уровню — без долгого просмотра списка.</p></div>'+
 '<button type="button" class="secondary game-filter-today" id="game-filter-today">Сегодня</button></div>'+
 '<form id="game-filter-form" role="search" aria-label="Поиск матчей">'+
 '<div class="game-filter-grid">'+
 '<label>Название или площадка<input type="search" name="query" placeholder="Например, мини-футбол"></label>'+
 '<label>Город<input type="search" name="city" placeholder="Любой город"></label>'+
 '<label>Дата с<input type="date" name="from"></label>'+
 '<label>Дата по<input type="date" name="to"></label>'+
 '<label>Формат<select name="format">'+opts(formats)+'</select></label>'+
 '<label>Уровень<select name="skill">'+opts(skills)+'</select></label>'+
 '<label>Категория<select name="group">'+opts(groups)+'</select></label>'+
 '<label>Возраст<select name="age">'+opts(ages)+'</select></label>'+
 '<label>Стоимость<select name="fee">'+opts([['free','Бесплатно'],['paid','Платно'],['unknown','Не указана']])+'</select></label>'+
 '<label>Максимальный взнос, ₽<input name="maxFee" type="number" min="0" max="100000" step="1" placeholder="Без ограничения"></label></div>'+
 '<div class="game-filter-bottom"><label class="game-only-available"><input type="checkbox" name="available"> Только со свободными местами</label>'+
 '<button type="button" class="secondary" id="game-filter-reset">Сбросить фильтры</button></div></form>'+
 '<p class="game-result-count" id="game-result-count" role="status"></p>';
 list.before(wrapper);
 const form=wrapper.querySelector('#game-filter-form');
 form.addEventListener('input',()=>renderGames());
 form.addEventListener('change',()=>renderGames());
 form.addEventListener('submit',event=>{event.preventDefault();renderGames()});
 wrapper.querySelector('#game-filter-reset').addEventListener('click',()=>{form.reset();renderGames()});
 wrapper.querySelector('#game-filter-today').addEventListener('click',()=>{
  form.elements.from.value=localToday();
  form.elements.to.value=localToday();
  renderGames();
 });
}

const oldCard=card;
card=function(x,kind){
 if(kind!=='game')return oldCard(x,kind);
 const n=x.attendees?.length||0;
 const limited=x.capacity!==null&&x.capacity!==undefined;
 const capacity=limited?Number(x.capacity):null;
 const spots=limited?Math.max(0,capacity-n):null;
 const full=limited&&spots===0;
 const joined=!!user&&x.attendees?.includes(user.id);
 const pct=limited&&capacity>0?Math.min(100,Math.round(n/capacity*100)):0;
 const cost=x.fee_amount===null||x.fee_amount===undefined?'Стоимость не указана':Number(x.fee_amount)===0?'Бесплатно':Number(x.fee_amount).toLocaleString('ru-RU')+' ₽ / игрок';
 const chips=[
  x.game_format?fm[x.game_format]||x.game_format:'',
  x.skill_level?sm[x.skill_level]||x.skill_level:'',
  x.participant_group?gm[x.participant_group]||x.participant_group:'',
  x.age_group?am[x.age_group]||x.age_group:''
 ].filter(Boolean);
 const last=spots%10,last2=spots%100;
 const noun=last===1&&last2!==11?'место':last>=2&&last<=4&&(last2<12||last2>14)?'места':'мест';
 const availability=limited?(full?'Мест нет':spots+' '+noun):'Без лимита';
 const description=String(x.description||'').trim();
 return '<article class="card pole-game-card">'+
 '<div class="pole-game-card-head"><span class="pole-game-eyebrow">⚽ ОТКРЫТАЯ ИГРА</span><span class="pole-game-space'+(full?' full':'')+'">'+esc(availability)+'</span></div>'+
 '<h3>'+esc(x.title)+'</h3>'+
 '<div class="pole-game-datetime">📅 '+esc(formatLocalDate(x.date))+' · '+esc(x.time||'Время уточняется')+'</div>'+
 '<p class="pole-game-location">📍 '+esc([x.field,x.city].filter(Boolean).join(' · ')||'Площадка не указана')+'</p>'+
 '<div class="pole-game-chips">'+chips.map(c=>'<span>'+esc(c)+'</span>').join('')+
 '<span class="'+(x.fee_amount===0?'free':'cost')+'">'+esc(cost)+'</span></div>'+
 '<div class="pole-game-progress"><div class="pole-game-progress-label"><strong>'+n+(limited?' / '+capacity:'')+' игроков</strong><span>'+(limited?spots+' свободно':'Открытый набор')+'</span></div>'+
 (limited?'<div class="pole-game-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="'+capacity+'" aria-valuenow="'+Math.min(n,capacity)+'" aria-label="Заполненность матча"><div style="width:'+pct+'%"></div></div>':'')+'</div>'+
 (description?'<p class="pole-game-description">'+esc(description)+'</p>':'')+
 '<p class="pole-game-organizer">Организатор: '+esc(x.organizer||'Не указан')+'</p>'+
 (window.POLE_GAME_ROSTER_HTML?.(x)||'')+
 '<div class="pole-game-actions"><button type="button" class="primary" data-kind="game" data-join="'+esc(x.id)+'"'+(full&&!joined?' disabled':'')+'>'+
 (joined?'Отменить участие':full?'Мест нет':'Присоединиться')+'</button>'+
 (joined?'<button type="button" class="secondary game-chat-trigger" data-game-chat="'+esc(x.id)+'">💬 Чат игры</button>':'')+'</div>'+
 '</article>';
};
function matchFilters(x,form){
 if(!form)return true;
 const f=form.elements;
 const query=f.query.value.trim().toLocaleLowerCase('ru-RU');
 const city=f.city.value.trim().toLocaleLowerCase('ru-RU');
 const name=String([x.title,x.field,x.city,x.description].filter(Boolean).join(' ')).toLocaleLowerCase('ru-RU');
 if(query&&!name.includes(query))return false;
 if(city&&!String(x.city||x.field||'').toLocaleLowerCase('ru-RU').includes(city))return false;
 if(f.from.value&&(!x.date||x.date<f.from.value))return false;
 if(f.to.value&&(!x.date||x.date>f.to.value))return false;
 if(f.format.value&&x.game_format!==f.format.value)return false;
 if(f.skill.value&&x.skill_level!==f.skill.value)return false;
 if(f.group.value&&x.participant_group!==f.group.value)return false;
 if(f.age.value&&x.age_group!==f.age.value)return false;
 if(f.fee.value==='free'&&x.fee_amount!==0)return false;
 if(f.fee.value==='paid'&&!(x.fee_amount>0))return false;
 if(f.fee.value==='unknown'&&x.fee_amount!=null)return false;
 if(f.maxFee.value!==''){
  const fee=Number(x.fee_amount);
  if(x.fee_amount==null||fee>Number(f.maxFee.value))return false;
 }
 if(f.available.checked&&x.capacity!=null&&(x.attendees?.length||0)>=Number(x.capacity))return false;
 return true;
}
renderGames=function(){
 const node=document.querySelector('#game-list');if(!node)return;
 const form=document.querySelector('#game-filter-form');
 const filtered=games.filter(x=>matchFilters(x,form)).sort((a,b)=>
  (String(a.date)+' '+String(a.time)).localeCompare(String(b.date)+' '+String(b.time)));
 node.innerHTML=filtered.map(x=>card(x,'game')).join('')||
 '<div class="card pole-game-empty"><h3>Подходящих игр пока нет</h3><p>Попробуй сбросить фильтры или создай свою игру.</p></div>';
 const count=document.querySelector('#game-result-count');
 if(count)count.textContent='Найдено игр: '+filtered.length+(filtered.length!==games.length?' из '+games.length:'');
};
renderGames();
})();