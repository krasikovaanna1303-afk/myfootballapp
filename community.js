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
const types={player:'Ищу команду',team:'Команда ищет игроков',tournament:'Турнир для команд'};
const rows=()=>read('community_posts');
function render(){
 const root=document.querySelector('#community-content');if(!root)return;
 const posts=rows().sort((a,b)=>b.created.localeCompare(a.created));
 root.innerHTML='<div class="community-toolbar"><button class="primary" data-post-create="player">+ Ищу команду</button><button class="secondary" data-post-create="team">+ Нужны игроки</button><button class="secondary" data-post-create="tournament">+ Разместить турнир</button></div><p class="notice">Демо: объявления пока видны только на этом устройстве. Общие публикации, заявки участников, модерация и уведомления требуют серверной базы.</p><div class="cards">'+(posts.map(p=>'<article class="card"><div class="eyebrow">'+escapeHTML(types[p.type])+'</div><h3>'+escapeHTML(p.title)+'</h3><p>📍 '+escapeHTML(p.city)+(p.date?' · 📅 '+escapeHTML(p.date):'')+'</p><p>'+escapeHTML(p.description)+'</p><p class="muted">Автор: '+escapeHTML(p.author)+' · '+escapeHTML(p.created.slice(0,10))+'</p></article>').join('')||'<article class="card"><h3>Пока нет объявлений</h3><p>Размести первую анкету свободного игрока, вакансию команды или турнир.</p></article>')+'</div>';
}
function newPost(type){
 if(!profile())return;
 show(types[type],'<p class="notice">Это локальный черновик объявления. Пока он не отображается другим игрокам.</p><form id="community-post-form"><input type="hidden" name="type" value="'+type+'"><label>Заголовок<input name="title" maxlength="100" required placeholder="'+(type==='player'?'Игрок ищет команду на сезон':type==='team'?'Ищем вратаря в любительскую команду':'Открыт набор команд на турнир')+'"></label><label>Город<input name="city" required maxlength="80" value="'+escapeHTML(user?.city||'')+'"></label>'+(type==='tournament'?'<label>Дата турнира<input name="date" type="date" required></label>':'')+'<label>Подробности<textarea name="description" maxlength="2000" minlength="10" required placeholder="Уровень, возрастная категория, формат, стоимость, контакты и условия участия"></textarea></label><button class="primary">Сохранить черновик</button></form>');
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-post-create]');if(b)newPost(b.dataset.postCreate)});
document.addEventListener('submit',e=>{
 const form=e.target;if(form.id!=='community-field-form'&&form.id!=='community-post-form')return;
 e.preventDefault();const data=Object.fromEntries(new FormData(form).entries());
 if(form.id==='community-field-form'){
   const list=read('field_proposals');
   list.push({id:crypto.randomUUID(),fieldId:data.fieldId,kind:data.kind,surface:data.surface||null,lighting:data.lighting||null,access:data.access||null,rating:data.rating?Number(data.rating):null,message:data.message,author:user.name,status:'pending',created:new Date().toISOString()});
   write('field_proposals',list);toast('Предложение сохранено: ожидает модерацию');
 }else{
   const list=rows();list.push({id:crypto.randomUUID(),type:data.type,title:data.title,city:data.city,date:data.date||'',description:data.description,author:user.name,created:new Date().toISOString()});write('community_posts',list);render();toast('Черновик объявления сохранён');
 }
 document.querySelector('#modal').close();
});
render();
})();
