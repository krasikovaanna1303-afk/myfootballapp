/* POLE community prototype. Pending submissions are NOT published as verified. */
(() => {
'use strict';
const escapeHTML = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(name)=>{try{return JSON.parse(localStorage.getItem('pole_'+name)||'[]')}catch{return []}};
const write=(name,v)=>localStorage.setItem('pole_'+name,JSON.stringify(v));
const all=()=>[...(window.POLE_PERMANENT_FIELDS||[]),...(window.POLE_SEED_FIELDS||[]),...osm,...fields];
const find=id=>all().find(f=>String(f.id)===String(id));
const show=(heading,html)=>modal(heading,html);
const profile=()=>{if(user)return true;toast('Сначала создай профиль игрока');document.querySelector('#account')?.click();return false};
const original=window.showField;
window.showField=function(id){
  original(id);
  const f=find(id),inner=document.querySelector('#modal-inner');
  if(!f||!inner)return;
  const feedback=read('field_proposals').filter(p=>p.fieldId===String(id)&&p.status==='approved');
  inner.insertAdjacentHTML('beforeend','<div class="community-feedback"><h3>Информация от игроков</h3><p class="notice">Предложения по характеристикам и отзывы проходят проверку. Неподтверждённые заявки видны только их автору в этом браузере.</p><div class="actions"><button class="secondary" data-community-edit="'+escapeHTML(id)+'">✎ Предложить изменение</button><button class="secondary" data-community-review="'+escapeHTML(id)+'">★ Оставить отзыв</button></div>'+
  feedback.map(p=>'<p><b>'+escapeHTML(p.author)+'</b>: '+escapeHTML(p.message)+'</p>').join('')+'</div>');
};
const fieldForm=(id,kind)=>{
 if(!profile())return;
 const f=find(id);if(!f)return;
 const edit=kind==='edit';
 show(edit?'Предложить изменения поля':'Отзыв о футбольном поле',
 '<p><b>'+escapeHTML(f.name)+'</b></p><p class="notice">Заявка сохраняется со статусом «На проверке». Другие пользователи не увидят её до подключения серверной модерации.</p>'+
 '<form id="community-field-form"><input type="hidden" name="fieldId" value="'+escapeHTML(f.id)+'"><input type="hidden" name="kind" value="'+kind+'">'+
 (edit?'<label>Покрытие<select name="surface"><option value="">Не менять</option><option>Искусственный газон</option><option>Натуральный газон</option><option>Резина</option><option>Асфальт</option><option>Грунт</option><option>Другое</option></select></label><label>Освещение<select name="lighting"><option value="">Не менять</option><option value="yes">Есть</option><option value="no">Нет</option><option value="unknown">Неизвестно</option></select></label><label>Доступ<select name="access"><option value="">Не менять</option><option value="free">Бесплатный</option><option value="paid">Платный</option><option value="private">Ограниченный</option><option value="unknown">Неизвестно</option></select></label>':'<label>Оценка<select name="rating"><option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option></select></label>')+
 '<label>'+(edit?'Что нужно исправить и как это проверить?':'Отзыв, как пройти и что важно знать')+'<textarea name="message" required minlength="10" maxlength="1500" placeholder="Например, вход с торца дома; ворота исправны; по вечерам свет работает"></textarea></label><button class="primary">Отправить на проверку</button></form>');
};
document.addEventListener('click',e=>{
 const edit=e.target.closest('[data-community-edit]'),review=e.target.closest('[data-community-review]');
 if(edit)fieldForm(edit.dataset.communityEdit,'edit');
 if(review)fieldForm(review.dataset.communityReview,'review');
});
const types={player:'Ищу команду',team:'Команде нужны игроки',tournament:'Турнир для команд'};
const skills=[['','Выбери уровень'],['new','Новичок'],['amateur','Любитель'],['confident','Уверенно играю'],['advanced','Продвинутый']];
const positions=[['','Выбери позицию'],['gk','Вратарь'],['def','Защитник'],['mid','Полузащитник'],['fwd','Нападающий'],['any','Любая позиция']];
const formats=[['','Выбери формат'],['5v5','5×5'],['6v6','6×6'],['7v7','7×7'],['8v8','8×8'],['11v11','11×11'],['any','Любой']];
const genders=[['','Выбери пол'],['female','Женский'],['male','Мужской']];
const targetGenders=[['','Выбери'],['female','Женская команда'],['male','Мужская команда'],['any','Без ограничений по полу']];
const ageGroups=[['','Выбери возрастную категорию'],['under18','До 18 лет'],['18-24','18–24 года'],['25-34','25–34 года'],['35-44','35–44 года'],['45+','45 лет и старше'],['any','18 лет и старше (любая взрослая категория)']];
const teamKinds=[['','Выбери тип команды'],['regular','Обычная женская команда (без ограничений)'],['moms','Команда мам']];
const playerGoals=[['','Выбери цель поиска'],['training','Для регулярных тренировок'],['tournament','Для участия в турнирах'],['both','Для тренировок и турниров'],['matches','Для любительских матчей без постоянных тренировок']];
const skillLabels=Object.fromEntries(skills),positionLabels=Object.fromEntries(positions),formatLabels=Object.fromEntries(formats),genderLabels=Object.fromEntries(genders);

const formatNames=Object.fromEntries(formats);
const chosenFormats=d=>{
 const values=Array.isArray(d?.formats)&&d.formats.length?d.formats:(d?.format?[d.format]:[]);
 return values.map(v=>formatNames[v]||v).filter(Boolean);
};
const formatMulti=(source={})=>{
 const wanted=Array.isArray(source.formats)&&source.formats.length?source.formats:source.format?[source.format]:[];
 return '<fieldset class="profile-formats" data-community-formats><legend>Формат футбола</legend><p class="notice">Можно выбрать несколько. «Любой» — вместо конкретных форматов.</p><div class="format-choices">'+formats.filter(([v])=>v).map(([v,caption])=>'<label class="format-option"><input type="checkbox" name="formats" value="'+v+'" '+(wanted.includes(v)?'checked':'')+'><span>'+caption+'</span></label>').join('')+'</div></fieldset>';
};
const rows=()=>read('community_posts');
const currentPosts=()=>window.POLE_SHARED_POSTS||rows();
const ownsPost=p=>!!user&&(window.POLE_SUPABASE_CLIENT?String(p.creator_id)===String(user.id):p.author===user.name);
const input=(label,name,value='',attrs='required maxlength="100"')=>'<label>'+label+'<input name="'+name+'" value="'+escapeHTML(value)+'" '+attrs+'></label>';
const selection=(label,name,options,chosen='')=>'<label>'+label+'<select name="'+name+'" required>'+options.map(([v,title])=>'<option value="'+escapeHTML(v)+'"'+(!v?' disabled':'')+(String(chosen)===v?' selected':'')+'>'+escapeHTML(title)+'</option>').join('')+'</select></label>';
const detailsLabel=(p)=>{
 const d=p.details||{},kind=p.type;
 const values=kind==='player'?[
  ['Возраст',d.age?' '+d.age+' лет':''],['Пол',genderLabels[d.gender]],['Уровень',skillLabels[d.skill]],
  ['Позиция',positionLabels[d.position]],['Форматы',chosenFormats(d).join(', ')],
  ['Для чего ищет команду',Object.fromEntries(playerGoals)[d.goal]]
 ]:kind==='team'?[
  ['Команда',d.team_name],['Позиция',positionLabels[d.needed_position]],
  ['Состав команды',({female:'Женская команда',male:'Мужская команда',any:'Без ограничений по полу'})[d.team_gender]],
  ['Тип женской команды',d.team_gender==='female'?Object.fromEntries(teamKinds)[d.female_team_kind]:''],
  ['Возрастная категория',Object.fromEntries(ageGroups)[d.age_group]||({'16-18':'16–18 лет','18-25':'18–25 лет','18-35':'18–35 лет','18+':'18+','35+':'35+'})[d.age_group]],
  ['Уровень',skillLabels[d.required_skill]],['Форматы',chosenFormats(d).join(', ')],
  ['Нужно игроков',d.spots?String(d.spots):''],
  ['Цель набора',({regular:'В постоянный состав',match:'На отдельный матч',tournament:'На конкретный турнир'})[d.purpose]],
  ['Турнир',d.purpose==='tournament'?d.tournament_name:''],
  ['Дата начала турнира',d.purpose==='tournament'?d.tournament_date:''],
  ['Взнос за турнир',d.purpose==='tournament'&&d.tournament_fee!==''&&d.tournament_fee!=null?d.tournament_fee+' ₽ / игрок':''],
  ['Где и когда играете',d.schedule]
 ]:[
  ['Название турнира',d.tournament_name],['Дата начала турнира',p.date||d.tournament_date],['Дата окончания',d.end_date],['Форматы',chosenFormats(d).join(', ')],
  ['Возрастная категория',Object.fromEntries(ageGroups)[d.age_group]],
  ['Категория',({female:'Женские команды',male:'Мужские команды',any:'Все команды'})[d.team_gender]],
  ['Взнос',d.tournament_fee!==''&&d.tournament_fee!=null?d.tournament_fee+' ₽ / команду':''],
  ['Место проведения',d.venue],['Свободных мест',d.slots?String(d.slots):'']
 ];
 return values.filter(([,v])=>v!==undefined&&v!==null&&String(v).trim()).map(([k,v])=>'<div><span class="muted">'+escapeHTML(k)+':</span> '+escapeHTML(String(v).trim())+'</div>').join('');
};
const normalizeContact=(platform,raw)=>{
 let s=String(raw||'').trim();
 if(platform==='telegram'){
  s=s.replace(/^https?:\/\/(?:www\.)?t\.me\//i,'').replace(/^@/,'').replace(/\/$/,'');
  return /^[A-Za-z0-9_]{5,32}$/.test(s)?s:null;
 }
 if(platform==='vk'){
  s=s.replace(/^https?:\/\/(?:www\.)?(?:vk\.com|vkontakte\.ru)\//i,'').replace(/^vk\.com\//i,'').replace(/^@/,'').replace(/\/$/,'');
  // В VK можно указать числовой ID, id12345 или короткий адрес профиля.
  if(/^\d+$/.test(s))s='id'+s;
  return /^[A-Za-z0-9_.]{3,50}$/.test(s)?s:null;
 }
 return null;
};
const contactUrl=p=>{
 const handle=normalizeContact(p.contact_platform,p.contact_handle);
 if(!handle)return '';
 if(p.contact_platform==='telegram')return 'https://t.me/'+handle;
 if(p.contact_platform==='vk')return 'https://vk.com/'+handle;
 return '';
};
let communityFilter='all';
function communityAvatar(p){
 const image=window.POLE_AVATAR_URL?.(p.avatar_path)||'';
 const initial=Array.from(String(p.author||'И').trim())[0]?.toUpperCase()||'И';
 return '<span class="community-avatar">'+(image?'<img src="'+escapeHTML(image)+'" loading="lazy" alt="Фото автора объявления">':escapeHTML(initial))+'</span>';
}
function keyChips(p){
 const d=p.details||{},chips=[];
 const push=(v)=>{if(v)chips.push('<span class="community-chip">'+escapeHTML(v)+'</span>')};
 if(p.type==='player'){
  push(positionLabels[d.position]);push(skillLabels[d.skill]);
  push(chosenFormats(d).join(' / '));
  push(Object.fromEntries(playerGoals)[d.goal]);
 }else if(p.type==='team'){
  push(positionLabels[d.needed_position]);
  push(skillLabels[d.required_skill]);
  push(chosenFormats(d).join(' / '));
  push(d.team_gender==='female'?(d.female_team_kind==='moms'?'Команда мам':'Женская команда'):d.team_gender==='male'?'Мужская команда':'');
  push(Object.fromEntries(ageGroups)[d.age_group]);
 }else{
  push(chosenFormats(d).join(' / '));
  push(Object.fromEntries(ageGroups)[d.age_group]);
  push(d.tournament_fee!==undefined?('Взнос: '+d.tournament_fee+' ₽'):'');
 }
 return chips.slice(0,6).join('');
}
function render(){
 const root=document.querySelector('#community-content');if(!root)return;
 const allPosts=[...(window.POLE_SHARED_POSTS||rows())].sort((a,b)=>(b.created||'').localeCompare(a.created||''));
 if(communityFilter==='mine'&&!user)communityFilter='all';
 const posts=communityFilter==='all'?allPosts:communityFilter==='mine'?allPosts.filter(ownsPost):allPosts.filter(p=>p.type===communityFilter);
 const filters=[['all','Все'],['player','Ищу команду'],['team','Нужны игроки'],['tournament','Турниры']];
 if(user)filters.push(['mine','Мои объявления']);
 root.innerHTML=
  '<div class="community-toolbar"><button class="primary" data-post-create="player">+ Ищу команду</button><button class="secondary" data-post-create="team">+ Нужны игроки</button><button class="secondary" data-partner="tournament">🏆 Предложить турнир · партнёрство</button></div>'+
  '<div class="community-feed-head"><div><h2>Футбольное сообщество</h2><p class="notice">Находи игроков и команды. Размещение турниров — по согласованию с «ПОЛЕМ» на коммерческой основе.</p></div><span class="community-post-counter">'+posts.length+' объявлений</span></div>'+
  '<div class="community-switch" role="group" aria-label="Фильтр объявлений">'+filters.map(([v,label])=>'<button type="button" data-community-filter="'+v+'" class="'+(v===communityFilter?'active':'')+'" aria-pressed="'+(v===communityFilter)+'">'+label+'</button>').join('')+'</div>'+
  '<div class="community-feed">'+(posts.map(p=>{
   const url=contactUrl(p),cta=p.type==='player'?'Позвать в команду':p.type==='team'?'Написать команде':'Связаться с организатором';
   const d=p.details||{};
   const author=p.type==='team'?(d.team_name||p.author):p.type==='tournament'?(d.tournament_name||p.author):p.author;
   const caption=p.type==='player'?'Ищет команду':p.type==='team'?'Нужны игроки':'Турнир';
   return '<article class="community-post-card"><div class="community-post-head">'+communityAvatar(p)+
    '<div class="community-post-author"><strong>'+escapeHTML(author||'Игрок')+'</strong><span>'+escapeHTML(p.city||'')+' · '+escapeHTML((p.created||'').slice(0,10))+'</span></div>'+
    '<span class="community-post-label">'+caption+'</span></div>'+
    '<h3>'+escapeHTML(p.title)+'</h3>'+
    '<div class="community-chips">'+keyChips(p)+'</div>'+
    (p.type==='tournament'&&p.date?'<p class="community-competition">🏆 Начало: '+escapeHTML(p.date)+(d.end_date?' · Окончание: '+escapeHTML(d.end_date):'')+'</p>':d.purpose==='tournament'&&d.tournament_name?'<p class="community-competition">🏆 '+escapeHTML(d.tournament_name)+(d.tournament_date?' · с '+escapeHTML(d.tournament_date):'')+'</p>':'')+
    (p.description?.trim()?'<p class="community-post-summary">'+escapeHTML(p.description)+'</p>':'')+
    '<details class="community-post-extra"><summary>Подробнее об объявлении</summary><div class="post-details">'+detailsLabel(p)+'</div></details>'+
     (!ownsPost(p)&&window.POLE_SUPABASE_CLIENT?'<div class="pole-post-contact-actions"><button type="button" class="secondary" data-pole-message-post="'+escapeHTML(p.id)+'">✉ Написать в ПОЛЕ</button>'+
       (p.type==='player'?'<button type="button" class="primary" data-pole-interest="'+escapeHTML(p.id)+'">⭐ Пригласить в команду</button>':'')+'</div>':'')+
     (ownsPost(p)&&p.type==='player'&&window.POLE_SUPABASE_CLIENT?'<button type="button" class="secondary" data-pole-interests-for="'+escapeHTML(p.id)+'">👀 Отклики на анкету</button>':'')+
     (url?'<a class="community-contact-button" href="'+escapeHTML(url)+'" target="_blank" rel="noopener noreferrer">'+cta+' · '+(p.contact_platform==='telegram'?'Telegram':'ВКонтакте')+'</a>':window.POLE_SUPABASE_CLIENT?'<p class="notice">Внешний контакт не указан — напиши через ПОЛЕ.</p>':'<p class="notice">Контакт автора не указан.</p>')+
    (ownsPost(p)?'<div class="community-own-actions"><button type="button" class="secondary" data-post-edit="'+escapeHTML(p.id)+'">✎ Редактировать</button><button type="button" class="secondary danger-text" data-post-delete="'+escapeHTML(p.id)+'">Удалить</button></div>':'')+
    '</article>';
  }).join('')||'<div class="card"><h3>'+(communityFilter==='mine'?'У тебя пока нет объявлений':'Объявлений пока нет')+'</h3><p>'+(communityFilter==='mine'?'Опубликуй анкету игрока или запрос команды, чтобы управлять ими здесь.':'Размести анкету игрока или запрос команды. Для турнира оставь заявку на сотрудничество.')+'</p></div>')+'</div>'+
  '<p class="notice">Контакты указаны авторами объявлений. «ПОЛЕ» не проверяет их и не передаёт ваши сообщения сторонним сервисам.</p>';
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-community-filter]');
 if(!button)return;
 communityFilter=button.dataset.communityFilter;
 render();
});

function contactFields(){
 return '<fieldset class="post-contact-fields"><legend>Как с тобой связаться</legend><p class="notice">Контакт будет виден всем посетителям объявления. Указывай аккаунт, которым готов(а) поделиться.</p>'+
 selection('Мессенджер','contact_platform',[['','Выбери мессенджер'],['telegram','Telegram'],['vk','ВКонтакте']])+
 input('Контакт в Telegram или VK','contact_handle','','required maxlength="100" placeholder="Выбери мессенджер выше" autocomplete="off"')+
 '<p class="notice" id="post-contact-help">Для Telegram подойдёт @username, для VK — id123456, числовой ID или короткий адрес профиля.</p></fieldset>';
}

function newPost(type,existing=null){
 if(!profile())return;
 if(type==='tournament'&&!existing){document.querySelector('[data-partner="tournament"]')?.click();return}
 if(type==='player'&&user?.account_type==='team'){toast('Искать команду можно из аккаунта игрока');return}
 const demo=existing?'Изменения в объявлении будут сохранены после нажатия кнопки.':window.POLE_SUPABASE_CLIENT?'После публикации объявление увидят другие пользователи.':'Пока это локальный черновик объявления.';
 const common='<label>Дополнительная информация <span class="optional-label">(по желанию)</span><textarea name="description" maxlength="2000" placeholder="Уточни пожелания, особенности или условия, если нужно">'+escapeHTML(type==='player'&&user?.bio?user.bio:'')+'</textarea></label>';
 const userNick=escapeHTML(user?.name||'Игрок');
 let extra='';
 if(type==='player'){
  extra='<section class="community-form-section"><h3>Моя футбольная анкета</h3><p class="notice">Данные подставлены из личного кабинета. Здесь их можно изменить только для этого объявления.</p>'+
  '<p class="community-post-nickname"><b>Игрок:</b> '+userNick+'</p>'+
  input('Возраст','age',user?.age||'','required type="number" min="16" max="100"')+
  selection('Пол','gender',genders,user?.gender)+selection('Уровень игры','skill',skills,user?.skill)+
  selection('Основная позиция','position',positions,user?.position)+formatMulti(user||{})+
  '</section><section class="community-form-section"><h3>Какую команду ищу</h3>'+
  selection('Для чего ищешь команду?','goal',playerGoals)+'</section>';
 }else if(type==='team'){
  extra='<section class="community-form-section"><h3>О команде</h3>'+
   input('Название команды','team_name',user?.account_type==='team'?user.name:'','required maxlength="100" placeholder="Название команды"')+
   selection('Тип команды','team_gender',targetGenders,user?.account_type==='team'?user.team_gender:'')+
   '<div class="female-team-fields" id="post-female-team-fields" hidden>'+
   selection('Какая это женская команда?','female_team_kind',teamKinds,user?.account_type==='team'?user.female_team_kind:'')+'</div>'+
   formatMulti(user?.account_type==='team'?user:{})+
   '</section><section class="community-form-section"><h3>Кого ищем</h3>'+
   selection('На какую позицию нужен игрок','needed_position',[positions[0],positions[5],...positions.slice(1,5)])+
   selection('Возрастная категория','age_group',ageGroups,user?.account_type==='team'?user.age_group:'')+
   selection('Желаемый уровень игры','required_skill',skills)+
   input('Сколько игроков нужно','spots','1','required type="number" min="1" max="50"')+
   '</section><section class="community-form-section"><h3>Для чего ищем игрока</h3>'+
   selection('Цель набора','purpose',[['','Выбери цель набора'],['regular','Для регулярных тренировок и игр'],['tournament','Для участия в конкретном турнире'],['match','Для отдельного матча']])+
   '<div class="tournament-fields" id="post-tournament-fields" hidden>'+
   input('Название турнира','tournament_name','','maxlength="120" placeholder="Как называется турнир"')+
   input('Дата начала турнира','tournament_date','','type="date"')+
   input('Взнос за участие в турнире, ₽ за игрока (0 — бесплатно)','tournament_fee','0','type="number" min="0" max="1000000"')+'</div>'+
   input('Где и когда играет команда','schedule','','maxlength="150" placeholder="Стадион, дни и время тренировок или игр"')+'</section>';
 }else if(type==='tournament'){
  extra='<section class="community-form-section"><h3>О турнире</h3>'+
   input('Название турнира','tournament_name','','required maxlength="120"')+
   input('Дата начала турнира','date','','required type="date"')+
   input('Дата окончания турнира (если несколько дней)','end_date','','type="date"')+
   formatMulti({})+
   selection('Какие команды участвуют','team_gender',targetGenders)+
   selection('Возрастная категория участников','age_group',ageGroups)+
   input('Взнос за участие, ₽ за команду (0 — бесплатно)','tournament_fee','0','required type="number" min="0" max="1000000"')+
   input('Место проведения','venue','','required maxlength="150"')+
   input('Количество свободных мест для команд','slots','','type="number" min="1" max="256"')+'</section>';
 }
 show(existing?'Редактировать объявление':types[type],'<p class="notice">'+demo+'</p><form id="community-post-form"><input type="hidden" name="type" value="'+type+'">'+
 '<section class="community-form-section"><h3>Объявление</h3>'+
 input('Заголовок','title',type==='player'?'Ищу футбольную команду':type==='team'?'Команде нужны игроки':'Открыта регистрация на турнир','required maxlength="100" minlength="2"')+
 input('Город','city',user?.city||'','required maxlength="80" minlength="2"')+'</section>'+
 extra+'<section class="community-form-section"><h3>Дополнительно</h3>'+common+'</section>'+
 contactFields()+'<p class="form-validation-message" role="alert" id="community-post-message"></p><button class="primary post-submit" type="submit">'+(existing?'Сохранить изменения':'Опубликовать объявление')+'</button></form>');
 const form=document.querySelector('#community-post-form');
 if(existing){
  form.dataset.editId=existing.id;
  const source={...existing.details,title:existing.title,city:existing.city,date:existing.date,description:existing.description,contact_platform:existing.contact_platform,contact_handle:existing.contact_handle};
  for(const [key,val] of Object.entries(source)){
   if(key==='formats'||val===null||val===undefined)continue;
   const field=form.elements.namedItem(key);
   if(field&&typeof field.value==='string')field.value=String(val);
  }
  const selected=existing.details?.formats||[existing.details?.format].filter(Boolean);
  form.querySelectorAll('input[name="formats"]').forEach(box=>{box.checked=selected.includes(box.value)});
 }
 syncConditionalFields(form);
 syncContactHelp(form);
 form.querySelectorAll('input[name="formats"]').forEach(box=>box.addEventListener('change',()=>{
  if(box.checked&&box.value==='any')form.querySelectorAll('input[name="formats"]').forEach(b=>{if(b!==box)b.checked=false});
  else if(box.checked){const any=form.querySelector('input[name="formats"][value="any"]');if(any)any.checked=false}
  form.querySelectorAll('.format-option').forEach(el=>el.classList.toggle('selected',!!el.querySelector('input')?.checked));
 }));
 form.querySelectorAll('.format-option').forEach(el=>el.classList.toggle('selected',!!el.querySelector('input')?.checked));
}
function syncConditionalFields(form){
 if(!form)return;
 for(const [selector,fieldName,wrapId,targetValue] of [
  ['select[name="purpose"]','tournament','#post-tournament-fields','tournament'],
  ['select[name="team_gender"]','female','#post-female-team-fields','female']
 ]){
  const select=form.querySelector(selector),wrap=form.querySelector(wrapId);
  if(!select||!wrap)continue;
  const enabled=select.value===targetValue;
  wrap.hidden=!enabled;
  wrap.querySelectorAll('input,select').forEach(el=>{el.disabled=!enabled;el.required=enabled});
 }
}
function syncContactHelp(form){
 const platform=form?.elements.contact_platform?.value;
 const handle=form?.elements.contact_handle,help=form?.querySelector('#post-contact-help');
 if(!handle||!help)return;
 if(platform==='vk'){
  handle.placeholder='Например, id123456, 123456 или anna_sport';
  help.textContent='ВКонтакте: числовой ID, id123456 или короткий адрес (также можно вставить ссылку vk.com/…).';
 }else if(platform==='telegram'){
  handle.placeholder='Например, @anna_football';
  help.textContent='Telegram: имя пользователя с @ или ссылка t.me/username.';
 }else{
  handle.placeholder='Выбери мессенджер выше';
  help.textContent='Для Telegram подойдёт @username, для VK — id123456, числовой ID или короткий адрес профиля.';
 }
 handle.setCustomValidity('');
}

document.addEventListener('click',e=>{const b=e.target.closest('[data-post-create]');if(b)newPost(b.dataset.postCreate)});
document.addEventListener('click',async e=>{
 const edit=e.target.closest('[data-post-edit]'),del=e.target.closest('[data-post-delete]');
 if(!edit&&!del)return;
 const id=(edit||del).dataset.postEdit||(edit||del).dataset.postDelete;
 const post=currentPosts().find(p=>String(p.id)===String(id));
 if(!post||!ownsPost(post)){toast('Редактировать или удалять можно только свои объявления');return}
 if(edit){newPost(post.type,post);return}
 if(!confirm('Удалить объявление «'+post.title+'»? Восстановить его не получится.'))return;
 const button=del;button.disabled=true;
 if(window.POLE_SUPABASE_CLIENT){
  if(typeof window.POLE_DELETE_POST==='function')await window.POLE_DELETE_POST(id);else{toast('Удаление пока недоступно');button.disabled=false}
 }else{
  write('community_posts',rows().filter(p=>String(p.id)!==String(id)));
  render();toast('Объявление удалено из этого браузера');
 }
});
document.addEventListener('change',e=>{
 const form=e.target.closest('#community-post-form');if(!form)return;
 if(e.target.matches('select[name="purpose"],select[name="team_gender"]'))syncConditionalFields(form);
 if(e.target.matches('select[name="contact_platform"]'))syncContactHelp(form);
});

function postPayload(form){
 const d=Object.fromEntries(new FormData(form).entries());
 const contact=normalizeContact(d.contact_platform,d.contact_handle);
 if(!contact){
  const note=form.querySelector('[name="contact_handle"]');
  note?.setCustomValidity('Проверь контакт: для Telegram нужен @username, для VK — числовой ID, id123456 или короткий адрес.');
  note?.reportValidity();note?.focus();return null;
 }

 const selected=[...new Set(new FormData(form).getAll('formats'))];
 if(d.type==='tournament'&&d.end_date&&d.date&&d.end_date<d.date){form.querySelector('#community-post-message').textContent='Дата окончания не может быть раньше даты начала.';return null}
 if(!selected.length){
  const group=form.querySelector('[data-community-formats]');
  group?.scrollIntoView({behavior:'smooth',block:'center'});
  group?.classList.add('field-error');
  toast('Выбери формат футбола или «Любой»');
  return null;
 }
 if(selected.includes('any')&&selected.length>1){toast('Выбери «Любой» или конкретные форматы');return null}
 const reserved=new Set(['title','type','city','date','description','contact_platform','contact_handle','formats']);
 const details={formats:selected};
 for(const [key,value] of Object.entries(d))if(!reserved.has(key)&&String(value).trim())details[key]=String(value).trim();
 return {type:d.type,title:d.title.trim(),city:d.city.trim(),date:d.date||'',description:d.description.trim(),details,contact_platform:d.contact_platform,contact_handle:contact};
}
document.addEventListener('input',e=>{if(e.target.matches('#community-post-form [name="contact_handle"]'))e.target.setCustomValidity('')});
document.addEventListener('submit',e=>{
 const form=e.target;if(form.id!=='community-field-form'&&form.id!=='community-post-form')return;
 e.preventDefault();
 if(form.id==='community-field-form'){
  const data=Object.fromEntries(new FormData(form).entries()),list=read('field_proposals');
  list.push({id:crypto.randomUUID(),fieldId:data.fieldId,kind:data.kind,surface:data.surface||null,lighting:data.lighting||null,access:data.access||null,rating:data.rating?Number(data.rating):null,message:data.message,author:user.name,status:'pending',created:new Date().toISOString()});
  write('field_proposals',list);toast('Предложение сохранено: ожидает модерацию');
 }else{
  const data=postPayload(form);if(!data)return;
  const list=rows();
  if(form.dataset.editId){const post=list.find(p=>String(p.id)===String(form.dataset.editId));if(post&&ownsPost(post))Object.assign(post,data);toast('Черновик объявления изменён')}
  else{if(data.type==='tournament'){toast('Турниры публикуются только по партнёрству');return}list.push({id:crypto.randomUUID(),...data,author:user.name,created:new Date().toISOString()});toast('Черновик объявления сохранён')}
  write('community_posts',list);render();
 }
 document.querySelector('#modal').close();
});
window.POLE_POST_PAYLOAD=postPayload;
document.addEventListener('pole-shared-posts',render);
document.addEventListener('pole-account-updated',render);
render();
})();
