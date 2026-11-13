/* Восстановление и смена пароля/почты через Supabase Auth.
   Секреты и пароли никогда не попадают в localStorage или базу приложения. */
(() => {
'use strict';
const sb=window.POLE_SUPABASE_CLIENT;
if(!sb)return;
const dialog=document.querySelector('#modal');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const open=(title,html)=>{if(dialog?.open)dialog.close();modal(title,html)};
const redirectTo=new URL('./',window.location.href).href;
let recovery=!!window.POLE_RECOVERY_LINK;
let shownRecovery=false;
const errorText=e=>e?.message||'Попробуй ещё раз.';

function requestReset(email='',hint=''){
 open('Восстановление пароля',
  '<p class="notice">Укажи почту, с которой зарегистрирован аккаунт. Мы отправим ссылку для создания нового пароля.</p>'+
  '<form id="pole-request-reset"><label>Электронная почта<input type="email" name="email" autocomplete="email" maxlength="254" required value="'+esc(email)+'"></label>'+
  '<p class="form-validation-message" role="status">'+esc(hint)+'</p><button class="primary" type="submit">Отправить ссылку</button></form>'+
  '<p class="notice">Если письмо не приходит, проверь «Спам». Ссылка действует ограниченное время.</p>');
}

function newPassword(){
 recovery=true;shownRecovery=true;
 open('Создать новый пароль',
  '<p class="notice">Придумай новый пароль для своего аккаунта ПОЛЕ.</p>'+
  '<form id="pole-new-password"><label>Новый пароль<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label>'+
  '<label>Повтори пароль<input name="confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label>'+
  '<p class="form-validation-message" role="alert"></p><button class="primary" type="submit">Сохранить новый пароль</button></form>');
}

async function accountSecurity(){
 const {data:{user:me}={},error}=await sb.auth.getUser();
 if(error||!me){toast('Сначала войди в аккаунт');document.querySelector('#account')?.click();return}
 open('Почта и безопасность',
  '<p class="notice">Сейчас входишь с почтой <b>'+esc(me.email||'адрес не указан')+'</b>. Почта не отображается в публичной анкете.</p>'+
  '<h3>Сменить пароль</h3><form id="pole-change-password">'+
  '<label>Новый пароль<input type="password" name="password" autocomplete="new-password" minlength="8" maxlength="128" required></label>'+
  '<label>Повтори пароль<input type="password" name="confirm" autocomplete="new-password" minlength="8" maxlength="128" required></label>'+
  '<p class="form-validation-message" role="alert"></p><button class="primary" type="submit">Изменить пароль</button></form>'+
  '<div class="account-section-title">Электронная почта</div><form id="pole-change-email">'+
  '<label>Новый адрес<input type="email" name="email" autocomplete="email" maxlength="254" required placeholder="name@example.com"></label>'+
  '<p class="form-validation-message" role="status"></p><button class="secondary" type="submit">Изменить почту</button></form>'+
  '<p class="notice">Для изменения почты Supabase может попросить подтвердить адрес через письмо.</p>');
}

document.addEventListener('click',event=>{
 if(event.target.closest('[data-pole-forgot-password]')){
  const email=document.querySelector('#pole-auth-form [name=email]')?.value||'';
  requestReset(email);
 }
 if(event.target.closest('[data-pole-account-security]'))accountSecurity().catch(e=>toast(errorText(e)));
});

document.addEventListener('submit',async event=>{
 const form=event.target;
 if(!['pole-request-reset','pole-new-password','pole-change-password','pole-change-email'].includes(form.id))return;
 event.preventDefault();event.stopImmediatePropagation();
 const note=form.querySelector('.form-validation-message');
 const button=form.querySelector('[type=submit]');
 if(!form.reportValidity())return;
 if(form.elements.confirm&&form.elements.password.value!==form.elements.confirm.value){
  note.textContent='Пароли не совпадают.';return;
 }
 button.disabled=true;const caption=button.textContent;button.textContent='Подождите…';note.textContent='';
 try{
  if(form.id==='pole-request-reset'){
   const {error}=await sb.auth.resetPasswordForEmail(form.elements.email.value.trim(),{redirectTo});
   if(error)throw error;
   // Не подтверждаем существование аккаунта по адресу.
   note.textContent='Если аккаунт с такой почтой существует, письмо отправлено. Проверь входящие и «Спам».';
  }else if(form.id==='pole-change-email'){
   const {error}=await sb.auth.updateUser({email:form.elements.email.value.trim()},{emailRedirectTo:redirectTo});
   if(error)throw error;
   note.textContent='Запрос принят. Проверь письмо с подтверждением изменения адреса.';
  }else{
   const {error}=await sb.auth.updateUser({password:form.elements.password.value});
   if(error)throw error;
   recovery=false;shownRecovery=false;
   dialog?.close();toast('Пароль успешно изменён');
  }
 }catch(error){
  note.textContent='Не удалось выполнить действие: '+errorText(error);
 }finally{button.disabled=false;button.textContent=caption}
},true);

sb.auth.onAuthStateChange((event,session)=>{
 if(event==='PASSWORD_RECOVERY'){
  recovery=true;
  // Показ формы вне callback Auth, чтобы не блокировать обработчик Supabase.
  setTimeout(()=>newPassword(),0);
 }
});

// Некоторые почтовые клиенты открывают ссылку после события PASSWORD_RECOVERY;
// URL-маркер помогает восстановить форму и при поздней инициализации.
if(recovery){
 sb.auth.getSession().then(({data,error})=>{
  if(!shownRecovery&&data?.session&&!error)newPassword();
  else if(!shownRecovery)requestReset('','Ссылка недействительна или устарела. Запроси новую.');
 });
}
const params=new URLSearchParams(window.location.search);
if(!recovery&&params.has('error')&&params.get('error')==='access_denied'){
 setTimeout(()=>requestReset('','Ссылка недействительна или устарела. Запроси новую.'),0);
}
})();
