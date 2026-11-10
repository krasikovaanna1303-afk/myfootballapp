/* Коммерческие заявки на сотрудничество: публикация только после согласования.
   Онлайн-оплаты нет. Контакты не размещаются в открытых объявлениях. */
(() => {
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sb=window.POLE_SUPABASE_CLIENT;
const descriptions={
 tournament:{
  title:'Размещение турнира · сотрудничество',
  entity:'Название турнира / организатора',
  offer:'Турниры размещаются на коммерческой основе после обсуждения условий с командой «ПОЛЯ». Заявка не публикует турнир автоматически и не списывает деньги.'
 },
 venue:{
  title:'Сотрудничество для владельцев площадок',
  entity:'Название спортивного объекта',
  offer:'Расскажи о площадке и условиях аренды. Возможности продвижения, сроки и стоимость согласуем отдельно. Онлайн-оплаты пока нет.'
 }
};
const root=document.querySelector('#partners-content');
if(root)root.innerHTML='<div class="partner-grid">'+
 '<article class="card"><div class="eyebrow">01 · Площадки</div><h3>Информация о площадке</h3><p>Адрес, покрытие, стоимость и условия доступа. Не подтверждённые сведения отмечаются отдельно.</p></article>'+
 '<article class="card"><div class="eyebrow">02 · Турниры</div><h3>Коммерческое размещение турниров</h3><p>Анонс и набор команд доступны после согласования условий сотрудничества. Свободной публикации турнирных анонсов нет.</p><button class="primary" data-partner="tournament">Предложить турнир</button></article>'+
 '<article class="card"><div class="eyebrow">03 · Партнёрство</div><h3>Для владельцев полей</h3><p>Продвижение площадки, контакты для аренды и дополнительные рекламные форматы.</p><button class="secondary" data-partner="venue">Заполнить заявку</button></article>'+
 '</div><p class="notice">Стоимость партнёрства обсуждается индивидуально. Оплата через «ПОЛЕ» сейчас не принимается, заявки не являются бронированием или покупкой.</p>';

function open(type){
 const d=descriptions[type];if(!d)return;
 const online=!!sb;
 const timeline=type==='tournament'?
  '<div class="partner-date-grid"><label>Дата начала турнира<input name="start_date" type="date" required></label><label>Дата окончания <span class="optional-label">(если несколько дней)</span><input name="end_date" type="date"></label></div>'+
  '<p class="notice">Для турнира, проходящего несколько недель или месяцев, укажи первую и последнюю даты.</p>':'';
 modal(d.title,'<p>'+esc(d.offer)+'</p>'+
  '<p class="notice">'+(online?'Заявка будет приватно сохранена в «ПОЛЕ» для рассмотрения. Размещение и оплата не происходят автоматически. Для отправки нужно войти в аккаунт.':'В демо-режиме заявка сохранится только в этом браузере. Её можно скопировать для отправки вручную.')+'</p>'+
  '<form id="partner-lead-form" data-type="'+type+'">'+
  '<label>'+d.entity+'<input name="entity" required maxlength="120" minlength="2"></label>'+
  '<label>Город<input name="city" required maxlength="80" minlength="2" value="'+esc(user?.city||'')+'"></label>'+
  timeline+
  '<label>Контактное лицо<input name="person" required minlength="2" maxlength="80"></label>'+
  '<label>Email или Telegram для обратной связи<input name="contact" required minlength="3" maxlength="160" placeholder="@username или email"></label>'+
  (type==='venue'?'<label>Адрес площадки<input name="address" maxlength="160"></label><label>Стоимость аренды / час (если известна)<input name="price" maxlength="100" placeholder="Например, 2500 ₽/час"></label>':'')+
  '<label>Ссылка на регламент, регистрацию или сайт <span class="optional-label">(если есть)</span><input name="url" type="url" maxlength="500" placeholder="https://"></label>'+
  '<label>Описание турнира и условия<textarea name="details" required minlength="10" maxlength="1600" placeholder="'+(type==='tournament'?'Формат, количество команд, этапы турнира, место проведения, желаемое продвижение':'Описание площадки, условия аренды и пожелания к продвижению')+'"></textarea></label>'+
  '<label class="checkline"><input type="checkbox" name="consent" required> Согласен(на) передать контактные данные команде «ПОЛЯ» для рассмотрения заявки</label>'+
  '<p class="form-validation-message" id="partner-request-message" role="alert"></p>'+
  '<button class="primary" type="submit">'+(online?'Отправить заявку на сотрудничество':'Подготовить черновик')+'</button></form>');
 const form=document.querySelector('#partner-lead-form');
 form.querySelector('[name="end_date"]')?.addEventListener('change',()=>form.querySelector('#partner-request-message').textContent='');
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-partner]');if(b)open(b.dataset.partner)});

function makeCopy(type,v){
 const d=descriptions[type];
 return [
  d.title,d.entity+': '+v.entity,'Город: '+v.city,
  v.start_date?'Дата начала турнира: '+v.start_date:'',
  v.end_date?'Дата окончания турнира: '+v.end_date:'',
  'Контактное лицо: '+v.person,'Контакт: '+v.contact,
  v.address?'Адрес: '+v.address:'',
  v.price?'Стоимость аренды: '+v.price:'',
  v.url?'Ссылка: '+v.url:'',
  'Описание: '+v.details
 ].filter(Boolean).join('\n');
}
function showLocalDraft(type,v){
 const details=makeCopy(type,v);
 try{
  const list=JSON.parse(localStorage.getItem('pole_partner_leads')||'[]');
  list.push({...v,type,created:new Date().toISOString(),status:'draft'});
  localStorage.setItem('pole_partner_leads',JSON.stringify(list));
 }catch{}
 modal('Черновик заявки','<p class="notice">Сохранено только на этом устройстве. Заявка не отправлена и турнир не опубликован.</p>'+
  '<label>Текст для отправки<textarea id="partner-copy-text" rows="10" readonly>'+esc(details)+'</textarea></label>'+
  '<button class="primary" id="partner-copy">Скопировать текст</button>');
 document.querySelector('#partner-copy').onclick=async()=>{
  const text=document.querySelector('#partner-copy-text').value;
  try{await navigator.clipboard.writeText(text);toast('Текст скопирован')}
  catch{document.querySelector('#partner-copy-text').select();toast('Текст выделен — скопируй вручную')}
 };
}
document.addEventListener('submit',async e=>{
 const form=e.target;if(form.id!=='partner-lead-form')return;
 e.preventDefault();
 const v=Object.fromEntries(new FormData(form).entries()),type=form.dataset.type;
 const message=form.querySelector('#partner-request-message');
 if(type==='tournament'&&v.end_date&&v.start_date&&v.end_date<v.start_date){
  message.textContent='Дата окончания не может быть раньше даты начала турнира.';
  form.elements.end_date.focus();return;
 }
 if(!sb){showLocalDraft(type,v);return}
 const button=form.querySelector('button[type="submit"]');
 button.disabled=true;button.textContent='Отправляем…';
 try{
  const {data:{user:me},error:authError}=await sb.auth.getUser();
  if(authError||!me)throw new Error('Для отправки заявки нужно войти в аккаунт через кнопку «Войти».');
  const body={
   requester_id:me.id,kind:type,entity:v.entity.trim(),city:v.city.trim(),
   person:v.person.trim(),contact:v.contact.trim(),
   start_date:type==='tournament'?(v.start_date||null):null,
   end_date:type==='tournament'?(v.end_date||null):null,
   url:v.url?.trim()||null,
   details:[
    v.details.trim(),
    v.address?'Адрес площадки: '+v.address.trim():'',
    v.price?'Стоимость аренды: '+v.price.trim():''
   ].filter(Boolean).join('\n'),status:'pending'
  };
  const {error}=await sb.from('pole_partner_requests').insert(body);
  if(error)throw error;
  modal('Заявка сохранена','<div class="partner-submitted"><h3>Заявка на сотрудничество получена</h3><p>Она сохранена в системе «ПОЛЯ» и доступна для рассмотрения. Турнир не опубликован, оплата не производилась.</p><p class="notice">Стоимость и дальнейшие условия определяются отдельно. Вопросы можно обсудить по оставленному тобой контакту.</p></div>');
  toast('Заявка отправлена');
 }catch(err){message.textContent='Не удалось отправить заявку: '+(err.message||'повтори попытку')+'. При необходимости проверь выполнение SQL-обновления.'}
 finally{button.disabled=false;button.textContent='Отправить заявку на сотрудничество'}
});
})();
