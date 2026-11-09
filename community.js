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
const formats=[['','Выбери формат'],['5v5','5 на 5'],['7v7','7 на 7'],['11v11','11 на 11'],['any','Любой']];
const genders=[['','Выбери пол'],['female','Женский'],['male','Мужской']];
const targetGenders=[['','Выбери'],['female','Женская команда'],['male','Мужская команда'],['any','Без ограничений']];
const skillLabels=Object.fromEntries(skills),positionLabels=Object.fromEntries(positions),formatLabels=Object.fromEntries(formats),genderLabels=Object.fromEntries(genders);
const rows=()=>read('community_posts');
const input=(label,name,value='',attrs='required maxlength="100"')=>'<label>'+label+'<input name="'+name+'" value="'+escapeHTML(value)+'" '+attrs+'></label>';
const selection=(label,name,options,chosen='')=>'<label>'+label+'<select name="'+name+'" required>'+options.map(([v,title])=>'<option value="'+escapeHTML(v)+'"'+(!v?' disabled':'')+(String(chosen)===v?' selected':'')+'>'+escapeHTML(title)+'</option>').join('')+'</select></label>';
const detailsLabel=(p)=>{
 const d=p.details||{},kind=p.type;
 const values=kind==='player'?[
  ['Возраст',d.age?' '+d.age+' лет':''],['Пол',genderLabels[d.gender]],['Уровень',skillLabels[d.skill]],
  ['Позиция',positionLabels[d.position]],['Формат',formatLabels[d.format]],
  ['Район / удобное место',d.area],['Как часто готов(а) играть',({regular:'Регулярно',sometimes:'Время от времени',tournament:'Турниры',any:'Любой вариант'})[d.frequency]],
  ['Когда удобно',d.availability]
 ]:kind==='team'?[
  ['Команда',d.team_name],['Позиция',positionLabels[d.needed_position]],
  ['Для кого',({female:'Женская команда',male:'Мужская команда',any:'Без ограничений'})[d.team_gender]],
  ['Возрастная категория',({any:'Любой возраст от 16 лет','16-18':'16–18 лет','18-25':'18–25 лет','18-35':'18–35 лет','18+':'18+','35+':'35+'})[d.age_group]],
  ['Уровень',skillLabels[d.required_skill]],['Формат',formatLabels[d.format]],
  ['Нужно игроков',d.spots?String(d.spots):''],
  ['Цель набора',({regular:'В постоянный состав',match:'На отдельный матч',tournament:'На конкретный турнир'})[d.purpose]],
  ['Турнир',d.purpose==='tournament'?d.tournament_name:''],
  ['Дата турнира',d.purpose==='tournament'?d.tournament_date:''],
  ['Взнос за турнир',d.purpose==='tournament'&&d.tournament_fee!==''&&d.tournament_fee!=null?d.tournament_fee+' ₽ / игрок':''],
  ['Где и когда играете',d.schedule]
 ]:[
  ['Название турнира',d.tournament_name],['Формат',formatLabels[d.format]],
  ['Категория',({female:'Женские команды',male:'Мужские команды',any:'Все команды'})[d.team_gender]],
  ['Взнос',d.tournament_fee!==''&&d.tournament_fee!=null?d.tournament_fee+' ₽ / команду':''],
  ['Место проведения',d.venue],['Свободных мест',d.slots?String(d.slots):'']
 ];
 return values.filter(([,v])=>v!==undefined&&v!==null&&String(v).trim()).map(([k,v])=>'<div><span class="muted">'+escapeHTML(k)+':</span> '+escapeHTML(String(v).trim())+'</div>').join('');
};
const contactUrl=p=>{
 const handle=String(p.contact_handle||'').trim().replace(/^@/,'');
 if(p.contact_platform==='telegram'&&/^[A-Za-z0-9_]{5,32}$/.test(handle))return 'https://t.me/'+handle;
 if(p.contact_platform==='vk'&&/^[A-Za-z0-9_.]{3,50}$/.test(handle))return 'https://vk.com/'+handle;
 return '';
};
function render(){
 const root=document.querySelector('#community-content');if(!root)return;
 const posts=[...(window.POLE_SHARED_POSTS||rows())].sort((a,b)=>(b.created||'').localeCompare(a.created||''));
 root.innerHTML='<div class="community-toolbar"><button class="primary" data-post-create="player">+ Ищу команду</button><button class="secondary" data-post-create="team">+ Нужны игроки</button><button class="secondary" data-post-create="tournament">+ Объявить турнир</button><button class="secondary" data-partner="tournament">Сотрудничество для организаторов</button></div><p class="notice">'+(window.POLE_SUPABASE_CLIENT?'Объявления доступны всем. Для публикации необходимо войти в аккаунт.':'Демо: объявления сохраняются на этом устройстве.')+'</p><div class="cards community-posts">'+(posts.map(p=>{
 const url=contactUrl(p),cta=p.type==='player'?'Позвать в команду':p.type==='team'?'Написать команде':'Связаться с организатором';
 return '<article class="card community-post"><div class="eyebrow">'+escapeHTML(types[p.type]||'Объявление')+'</div><h3>'+escapeHTML(p.title)+'</h3><p>📍 '+escapeHTML(p.city)+(p.date?' · 📅 '+escapeHTML(p.date):'')+'</p><div class="post-details">'+detailsLabel(p)+'</div><p><b>Дополнительная информация</b><span class="post-description">'+escapeHTML(p.description||'')+'</span></p><p class="muted">Автор: '+escapeHTML(p.author)+' · '+escapeHTML((p.created||'').slice(0,10))+'</p>'+(url?'<a class="post-contact primary" href="'+url+'" target="_blank" rel="noopener noreferrer">'+cta+' · '+(p.contact_platform==='telegram'?'Telegram':'VK')+'</a>':'')+'</article>';
 }).join('')||'<article class="card"><h3>Пока нет объявлений</h3><p>Размести анкету свободного игрока, запрос команды или турнир.</p></article>')+'</div>';
}
function contactFields(){
 return '<fieldset class="post-contact-fields"><legend>Как с тобой связаться</legend><p class="notice">Контакт будет виден всем посетителям объявления. Указывай только тот аккаунт, которым готов(а) поделиться.</p>'+
 selection('Мессенджер','contact_platform',[['','Выбери мессенджер'],['telegram','Telegram'],['vk','ВКонтакте']])+
 input('Имя пользователя или короткий адрес профиля','contact_handle','','required maxlength="50" placeholder="@username или username" autocomplete="off"')+
 '<p class="notice">Укажи никнейм без ссылки. Мы добавим ссылку на Telegram или ВКонтакте автоматически.</p></fieldset>';
}
function newPost(type){
 if(!profile())return;
 const demo=window.POLE_SUPABASE_CLIENT?'После публикации объявление увидят другие пользователи.':'Пока это локальный черновик объявления.';
 const common='<label>Дополнительная информация<textarea name="description" maxlength="2000" minlength="10" required placeholder="Расскажи о пожеланиях, условиях и других деталях"></textarea></label>';
 const userNick=escapeHTML(user?.name||'Игрок');
 let extra='';
 if(type==='player'){
  extra='<p class="notice">Имя, возраст, пол, уровень игры, позиция, город и формат подставлены из твоей анкеты. При необходимости поправь их для этого объявления.</p>'+
  '<p><b>Игрок:</b> '+userNick+'</p>'+
  input('Возраст','age',user?.age||'','required type="number" min="16" max="100"')+
  selection('Пол','gender',genders,user?.gender)+selection('Уровень игры','skill',skills,user?.skill)+
  selection('Основная позиция','position',positions,user?.position)+selection('Предпочитаемый формат','format',formats,user?.format)+
  input('Район или удобное место','area','','maxlength="100" placeholder="Например, север города"')+
  selection('Как часто хочешь играть','frequency',[['','Выбери'],['regular','Регулярно'],['sometimes','Время от времени'],['tournament','Турниры'],['any','Любой вариант']])+
  input('Когда удобно играть','availability','','maxlength="100" placeholder="Например, по будням после 19:00"');
 }else if(type==='team'){
  extra=input('Название команды','team_name','','required maxlength="100" placeholder="Название команды"')+
   selection('На какую позицию нужен игрок','needed_position',positions)+
   selection('Тип команды','team_gender',targetGenders)+
   selection('Возрастная категория','age_group',[['','Выбери'],['any','Любой возраст от 16 лет'],['16-18','16–18 лет'],['18-25','18–25 лет'],['18-35','18–35 лет'],['18+','18+'],['35+','35+']])+
   selection('Желаемый уровень игры','required_skill',skills)+
   selection('Формат игры','format',formats)+
   input('Сколько игроков нужно','spots','1','required type="number" min="1" max="50"')+
   selection('Для чего нужен игрок','purpose',[['','Выбери'],['regular','В постоянный состав'],['match','На отдельный матч'],['tournament','На конкретный турнир']])+
   '<div class="tournament-fields" id="post-tournament-fields" hidden>'+
   input('Название турнира','tournament_name','','maxlength="120" placeholder="Как называется турнир"')+
   input('Дата турнира','tournament_date','','type="date"')+
   input('Взнос за участие в турнире, ₽ за игрока (0 — бесплатно)','tournament_fee','0','type="number" min="0" max="1000000"')+'</div>'+
   input('Где и когда играет команда','schedule','','maxlength="150" placeholder="Стадион, дни и время тренировок или игр"');
 }else if(type==='tournament'){
  extra=input('Название турнира','tournament_name','','required maxlength="120"')+
   input('Дата турнира','date','','required type="date"')+
   selection('Формат игры','format',formats)+
   selection('Какие команды участвуют','team_gender',targetGenders)+
   input('Взнос за участие, ₽ за команду (0 — бесплатно)','tournament_fee','0','required type="number" min="0" max="1000000"')+
   input('Место проведения','venue','','required maxlength="150"')+
   input('Количество свободных мест для команд','slots','','type="number" min="1" max="256"');
 }
 show(types[type],'<p class="notice">'+demo+'</p><form id="community-post-form"><input type="hidden" name="type" value="'+type+'">'+
 input('Заголовок','title',type==='player'?'Ищу футбольную команду':type==='team'?'Команде нужны игроки':'Открыта регистрация на турнир','required maxlength="100" minlength="2"')+
 input('Город','city',user?.city||'','required maxlength="80" minlength="2"')+
 extra+common+contactFields()+'<button class="primary post-submit">Опубликовать объявление</button></form>');
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-post-create]');if(b)newPost(b.dataset.postCreate)});
document.addEventListener('change',e=>{
 if(!e.target.matches('#community-post-form select[name="purpose"]'))return;
 const form=e.target.form,wrap=form.querySelector('#post-tournament-fields'),isTournament=e.target.value==='tournament';
 if(!wrap)return;
 wrap.hidden=!isTournament;
 wrap.querySelectorAll('input').forEach(x=>{x.disabled=!isTournament;x.required=isTournament});
});
function postPayload(form){
 const d=Object.fromEntries(new FormData(form).entries());
 const contact=String(d.contact_handle||'').trim().replace(/^@/,'');
 const isTelegram=d.contact_platform==='telegram';
 if(!(isTelegram?/^[A-Za-z0-9_]{5,32}$/.test(contact):d.contact_platform==='vk'&&/^[A-Za-z0-9_.]{3,50}$/.test(contact))){
  const note=form.querySelector('[name="contact_handle"]');
  note?.setCustomValidity('Проверь никнейм: Telegram — от 5 до 32 символов, VK — от 3 до 50.');
  note?.reportValidity();note?.focus();return null;
 }
 const reserved=new Set(['title','type','city','date','description','contact_platform','contact_handle']);
 const details={};
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
  const list=rows();list.push({id:crypto.randomUUID(),...data,author:user.name,created:new Date().toISOString()});
  write('community_posts',list);render();toast('Черновик объявления сохранён');
 }
 document.querySelector('#modal').close();
});
window.POLE_POST_PAYLOAD=postPayload;
document.addEventListener('pole-shared-posts',render);
render();
})();
