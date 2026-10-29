/* Commercial partnership lead drafts: no backend, no payments, no misleading submit. */
(() => {
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const descriptions={
 tournament:{title:'Сотрудничество для организаторов турниров',entity:'Название турнира / организатора',offer:'Продвижение турнира, набор команд, оформление карточки турнира и переход на регистрацию.'},
 venue:{title:'Сотрудничество для владельцев площадок',entity:'Название спортивного объекта',offer:'Карточка площадки с контактами и ценой, продвижение среди игроков и переход к бронированию.'}
};
const root=document.querySelector('#partners-content');
if(root)root.innerHTML='<div class="partner-grid"><article class="card"><div class="eyebrow">01 · Базовое размещение</div><h3>Карточка площадки</h3><p>Адрес, тип покрытия, фотографии, освещение, цены и ссылка на запись. Информация о платном доступе указывается открыто.</p></article><article class="card"><div class="eyebrow">02 · Продвижение</div><h3>Больше заявок на аренду</h3><p>Рекламное выделение площадки и продвижение игр. Рекламные материалы будут помечаться.</p></article><article class="card"><div class="eyebrow">03 · Партнёрство</div><h3>Сотрудничество с ПОЛЕМ</h3><p>Оставьте сведения об объекте и контакты. Условия и стоимость обсудим индивидуально — онлайн-оплаты пока нет.</p><button class="primary" data-partner="venue">Заполнить заявку</button></article></div><p class="notice">Размещение не является бронированием. Подтверждение цены и доступности осуществляется непосредственно владельцем.</p>';
function open(type){
 const d=descriptions[type];if(!d)return;
 modal(d.title,'<p>'+esc(d.offer)+'</p><p class="notice">Сейчас заявка сохраняется как черновик только на этом устройстве. Контакты для отправки владельцам сервиса ещё не настроены; после заполнения можно скопировать текст заявки. Никаких платежей форма не принимает.</p><form id="partner-lead-form" data-type="'+type+'"><label>'+d.entity+'<input name="entity" required maxlength="120"></label><label>Город<input name="city" required maxlength="80"></label><label>Контактное лицо<input name="person" required maxlength="80"></label><label>Email или Telegram для обратной связи<input name="contact" required maxlength="160" placeholder="@username или email"></label>'+(type==='venue'?'<label>Адрес площадки<input name="address" maxlength="160"></label><label>Стоимость аренды / час (если известна)<input name="price" maxlength="100" placeholder="Например, 2500 ₽/час"></label><label>Ссылка на аренду / сайт<input name="url" type="url" placeholder="https://"></label>':'<label>Когда состоится турнир?<input name="date" type="date"></label><label>Ссылка на регламент / регистрацию<input name="url" type="url" placeholder="https://"></label>')+'<label>Предложение и условия<textarea name="details" required minlength="10" maxlength="1600" placeholder="Формат, ожидаемое количество участников, сроки, особенности"></textarea></label><label class="checkline"><input type="checkbox" name="consent" required> Согласен(на) сохранить мои контактные данные в локальном черновике для подготовки обращения</label><button class="primary" type="submit">Подготовить заявку</button></form>');
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-partner]');if(b)open(b.dataset.partner)});
document.addEventListener('submit',e=>{
 const form=e.target;if(form.id!=='partner-lead-form')return;
 e.preventDefault();const v=Object.fromEntries(new FormData(form).entries()),type=form.dataset.type,d=descriptions[type];
 const details=[d.title,d.entity+': '+v.entity,'Город: '+v.city,'Контактное лицо: '+v.person,'Контакт: '+v.contact,v.address?'Адрес: '+v.address:'',v.price?'Стоимость: '+v.price:'',v.date?'Дата: '+v.date:'',v.url?'Ссылка: '+v.url:'','Детали: '+v.details].filter(Boolean).join('\n');
 const lead={...v,type,created:new Date().toISOString(),status:'draft'};
 try{const list=JSON.parse(localStorage.getItem('pole_partner_leads')||'[]');list.push(lead);localStorage.setItem('pole_partner_leads',JSON.stringify(list))}catch{}
 modal('Заявка подготовлена','<p class="notice">Черновик сохранён только в этом браузере. Он не был отправлен команде ПОЛЯ и не опубликован.</p><label>Текст для отправки<textarea id="partner-copy-text" rows="10" readonly>'+esc(details)+'</textarea></label><button class="primary" id="partner-copy">Скопировать заявку</button>');
 document.querySelector('#partner-copy').onclick=async()=>{const text=document.querySelector('#partner-copy-text').value;try{await navigator.clipboard.writeText(text);toast('Заявка скопирована')}catch{document.querySelector('#partner-copy-text').select();toast('Выделен текст — скопируй его вручную')}};
});
})();