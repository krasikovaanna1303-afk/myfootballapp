/* Личные сообщения, отклики и центр уведомлений. Данные принадлежат только
   вошедшим пользователям; доступ проверяют политики RLS Supabase. */
(() => {
'use strict';
const sb=window.POLE_SUPABASE_CLIENT;
if(!sb)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dialog=document.querySelector('#modal');
const header=document.querySelector('header');
const account=document.querySelector('#account');
if(!header||!account)return;
const bell=document.createElement('button');
bell.type='button';bell.className='pole-header-action secondary';bell.id='pole-notice-button';
bell.setAttribute('aria-label','Уведомления');bell.hidden=true;
const inbox=document.createElement('button');
inbox.type='button';inbox.className='pole-header-action secondary';inbox.id='pole-inbox-button';
inbox.textContent='✉ Сообщения';inbox.hidden=true;
header.insertBefore(bell,account);header.insertBefore(inbox,account);

let uid=null,items=[],seen=new Set(),ready=false,feedBusy=false,channel=null;
let activeThread=null,chatPoll=null,chatBusy=false,chatFingerprint='';
let pushLinkHandled=false;
const show=(title,html)=>{if(dialog?.open)dialog.close();modal(title,html)};
const friendlyError=e=>{
 const msg=e?.message||'Попробуй ещё раз позже.';
 return /relation .* does not exist|schema cache|Could not find the table|PGRST205|42P01/i.test(msg)
  ?'Функция будет доступна после выполнения SQL-файла notifications-and-inbox.sql в Supabase.':msg;
};
const dateLabel=s=>{
 try{return new Date(s).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
 catch{return ''}
};
const requireLogin=async()=>{
 const {data:{user:me}={},error}=await sb.auth.getUser();
 if(error||!me){toast('Войди в аккаунт, чтобы продолжить');account.click();return null}
 return me;
};
const browserPref=()=>!!uid&&localStorage.getItem('pole_browser_notify_'+uid)==='1';
const pushState=()=>window.POLE_PUSH_STATUS?.()||null;
function renderBell(){
 const count=items.filter(n=>!n.is_read).length;
 bell.innerHTML='🔔 <span class="pole-notice-caption">Уведомления</span>'+
  (count?'<span class="pole-notice-count">'+(count>99?'99+':count)+'</span>':'');
 bell.setAttribute('aria-label',count?'Уведомления, новых: '+count:'Уведомления');
}
function stopChat(){
 if(chatPoll){clearInterval(chatPoll);chatPoll=null}
 activeThread=null;chatFingerprint='';chatBusy=false;
}
dialog?.addEventListener('close',()=>{if(!dialog.open)stopChat()});
function browserNotice(item){
 if(pushState()?.enabled)return; // Service Worker доставит системное уведомление сам.
 if(!browserPref()||!document.hidden||!('Notification' in window)||Notification.permission!=='granted')return;
 try{
  const notice=new Notification(item.title,{body:item.body||'Открой ПОЛЕ, чтобы посмотреть.',tag:'pole-'+item.id,icon:'pole-icon.svg'});
  notice.onclick=()=>{window.focus();openNotices();notice.close()};
 }catch(e){console.warn('ПОЛЕ: уведомление браузера не показано',e)}
}
async function refreshNotices(){
 if(!uid||feedBusy)return;
 const requested=uid;feedBusy=true;
 try{
  const {data,error}=await sb.from('pole_notifications')
   .select('id,kind,actor_id,entity_id,title,body,is_read,created_at')
   .eq('recipient_id',requested).order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  if(uid!==requested)return;
  const fresh=(data||[]).filter(row=>!seen.has(row.id));
  items=data||[];renderBell();
  if(ready)fresh.reverse().forEach(browserNotice);
  seen=new Set(items.map(row=>row.id));ready=true;
  if(dialog?.open&&document.querySelector('#pole-notification-list'))renderNotices();
 }catch(e){console.warn('ПОЛЕ: уведомления пока не загружены',e)}
 finally{feedBusy=false}
}
async function markRead(id){
 if(!uid)return;
 const {error}=await sb.from('pole_notifications').update({is_read:true}).eq('id',id).eq('recipient_id',uid);
 if(error)throw error;
 items=items.map(n=>n.id===id?{...n,is_read:true}:n);renderBell();
}
const noticeActions={game_join:'Посмотреть игру',game_chat:'Открыть чат',direct_message:'Прочитать',interest:'Ответить'};
function renderNotices(){
 const list=document.querySelector('#pole-notification-list');if(!list)return;
 list.innerHTML=items.length?items.map(n=>
  '<article class="pole-notice '+(n.is_read?'':'unread')+'"><span class="pole-notice-date">'+esc(dateLabel(n.created_at))+'</span>'+
  '<strong>'+esc(n.title)+'</strong><p>'+esc(n.body)+'</p><button type="button" class="secondary" data-pole-activate-notice="'+esc(n.id)+'">'+
  (noticeActions[n.kind]||'Открыть')+'</button></article>').join('')
  :'<p class="notice">Пока нет уведомлений. Здесь появятся записи на твои игры, сообщения и отклики.</p>';
}
function openNotices(){
 if(!uid){account.click();return}
 const push=pushState();
 show('Мои уведомления',
  '<div class="pole-notice-tools"><button type="button" class="secondary" id="pole-read-all">Прочитать всё</button>'+
  '<button type="button" class="secondary" id="pole-browser-toggle">'+
  (push?(push.enabled?'🔕 Отключить фоновые push':'🔔 Включить фоновые push'):
   (browserPref()?'🔕 Отключить уведомления браузера':'🔔 Включить уведомления браузера'))+'</button></div>'+
  '<p class="notice">'+(push?.supported?
   'Фоновые push могут приходить даже при закрытом сайте после включения на этом устройстве. На iPhone добавь ПОЛЕ на экран «Домой».':
   'События сохраняются в личном кабинете; этот браузер может не поддерживать фоновые уведомления.')+'</p>'+
  '<div id="pole-notification-list" class="pole-notification-list"></div>');
 renderNotices();refreshNotices();
}

async function currentThread(postId,me){
 let {data,error}=await sb.from('pole_message_threads').select('id,post_id,starter_id,owner_id,subject')
  .eq('post_id',postId).eq('starter_id',me.id).maybeSingle();
 if(error)throw error;
 if(data)return data;
 const {data:post,error:postError}=await sb.from('pole_posts')
  .select('id,creator_id,title').eq('id',postId).maybeSingle();
 if(postError)throw postError;
 if(!post||post.creator_id===me.id)throw new Error('Для своего объявления чат открывается через «Сообщения».');
 const result=await sb.from('pole_message_threads').insert({
  post_id:post.id,starter_id:me.id,owner_id:post.creator_id,subject:post.title.slice(0,160)
 }).select('id,post_id,starter_id,owner_id,subject').single();
 if(result.error?.code==='23505'){
  const retry=await sb.from('pole_message_threads').select('id,post_id,starter_id,owner_id,subject')
   .eq('post_id',postId).eq('starter_id',me.id).single();
  if(retry.error)throw retry.error;
  return retry.data;
 }
 if(result.error)throw result.error;
 return result.data;
}
async function loadThread(force=false){
 const selected=activeThread;
 if(!selected||chatBusy)return;
 chatBusy=true;
 try{
  const {data,error}=await sb.from('pole_direct_messages')
   .select('id,sender_id,body,created_at').eq('thread_id',selected.id)
   .order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  if(activeThread?.id!==selected.id)return;
  const rows=(data||[]).slice().reverse(),fingerprint=rows.map(m=>m.id).join('|');
  if(!force&&fingerprint===chatFingerprint)return;
  chatFingerprint=fingerprint;
  const box=document.querySelector('#pole-direct-chat-log');if(!box)return;
  const pinned=box.scrollHeight-box.scrollTop-box.clientHeight<75;
  box.innerHTML=rows.length?rows.map(m=>
   '<article class="game-chat-message '+(m.sender_id===uid?'mine':'')+'"><div class="game-chat-meta"><b>'+
   (m.sender_id===uid?'Ты':'Собеседник')+'</b> · '+esc(dateLabel(m.created_at))+'</div><p>'+esc(m.body)+'</p></article>').join('')
   :'<p class="notice">Сообщений пока нет. Начни переписку.</p>';
  if(pinned||force)box.scrollTop=box.scrollHeight;
 }catch(e){
  const note=document.querySelector('#pole-direct-chat-state');if(note)note.textContent=friendlyError(e);
 }finally{chatBusy=false}
}
async function openThread(id){
 const me=await requireLogin();if(!me)return;
 const {data:thread,error}=await sb.from('pole_message_threads')
  .select('id,post_id,starter_id,owner_id,subject').eq('id',id).maybeSingle();
 if(error)throw error;
 if(!thread)throw new Error('Переписка не найдена или нет доступа.');
 stopChat();
 show('Личные сообщения · '+thread.subject,
  '<p class="notice">Переписку видят только её участники. Не публикуй здесь пароли или платёжные данные.</p>'+
  '<div id="pole-direct-chat-log" class="game-chat-messages" role="log" aria-live="polite"><p class="notice">Загружаем…</p></div>'+
  '<p class="form-validation-message" id="pole-direct-chat-state" role="alert"></p>'+
  '<form id="pole-direct-chat-form"><label>Сообщение<textarea name="body" minlength="1" maxlength="1000" required rows="3" placeholder="Напиши сообщение…"></textarea></label>'+
  '<button type="submit" class="primary">Отправить</button></form>');
 activeThread={id:thread.id};
 await loadThread(true);
 if(activeThread?.id===id)chatPoll=setInterval(()=>{if(!document.hidden)loadThread()},10000);
}
async function openThreadForPost(postId,actorId){
 const me=await requireLogin();if(!me)return;
 if(actorId){
  const {data,error}=await sb.from('pole_message_threads').select('id').eq('post_id',postId)
   .eq('starter_id',actorId).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('Переписка по отклику ещё не найдена.');
  return openThread(data.id);
 }
 const thread=await currentThread(postId,me);return openThread(thread.id);
}
async function openInbox(){
 const me=await requireLogin();if(!me)return;
 const {data,error}=await sb.from('pole_message_threads')
  .select('id,subject,created_at,starter_id,owner_id').or('starter_id.eq.'+me.id+',owner_id.eq.'+me.id)
  .order('created_at',{ascending:false}).limit(100);
 if(error)throw error;
 show('Личные сообщения',
  '<p class="notice">Здесь переписка по объявлениям и откликам на анкеты. Чаты матчей доступны в карточках игр.</p>'+
  '<div class="pole-inbox-list">'+((data||[]).map(t=>
   '<button type="button" class="pole-thread-link" data-pole-open-thread="'+esc(t.id)+'"><strong>'+esc(t.subject)+'</strong><span>'+esc(dateLabel(t.created_at))+'</span></button>').join('')
   ||'<p class="notice">Переписок пока нет. Открой объявление и нажми «Написать в ПОЛЕ».</p>')+'</div>');
}
async function sendInterest(postId){
 const me=await requireLogin();if(!me)return;
 const {error}=await sb.from('pole_post_interests').insert({post_id:postId,actor_id:me.id});
 if(error?.code==='23505')return toast('Ты уже отправил(а) отклик на эту анкету.');
 if(error)throw error;
 toast('Интерес отправлен! Автор анкеты получит уведомление.');
}
async function showInterests(postId){
 const me=await requireLogin();if(!me)return;
 const {data:post,error:postError}=await sb.from('pole_posts').select('creator_id,title').eq('id',postId).maybeSingle();
 if(postError)throw postError;
 if(!post||post.creator_id!==me.id)throw new Error('Отклики доступны только автору анкеты.');
 const {data,error}=await sb.from('pole_post_interests').select('actor_id,created_at')
  .eq('post_id',postId).order('created_at',{ascending:false}).limit(100);
 if(error)throw error;
 show('Отклики на анкету',
  '<p class="notice">'+esc(post.title)+' · '+(data||[]).length+' откликов</p><div class="pole-inbox-list">'+
  ((data||[]).map((p,i)=>'<div class="pole-interest-item"><span>Отклик №'+(i+1)+' · '+esc(dateLabel(p.created_at))+'</span><button class="secondary" type="button" data-pole-interest-reply="'+esc(postId)+'" data-pole-actor="'+esc(p.actor_id)+'">Написать</button></div>').join('')
   ||'<p class="notice">Пока никто не откликнулся.</p>')+'</div>');
}
async function activateNotice(id){
 const n=items.find(x=>x.id===id);if(!n)return;
 if(!n.is_read)await markRead(n.id);
 if(n.kind==='direct_message'&&n.entity_id)return openThread(n.entity_id);
 if(n.kind==='interest'&&n.entity_id&&n.actor_id)return openThreadForPost(n.entity_id,n.actor_id);
 if(n.kind==='game_join'||n.kind==='game_chat'){
  if(dialog?.open)dialog.close();
  document.querySelector('[data-view="games"]')?.click();
  if(n.kind==='game_chat'&&n.entity_id)return window.POLE_OPEN_GAME_CHAT?.(n.entity_id);
  const target=document.querySelector('[data-join="'+n.entity_id+'"]')?.closest('article')||
   document.querySelector('[data-game-chat="'+n.entity_id+'"]')?.closest('article');
  if(target)target.scrollIntoView({behavior:'smooth',block:'center'});
  else toast('Открой раздел «Игры», чтобы найти матч.');
 }
}

document.addEventListener('click',async event=>{
 const el=event.target.closest('[data-pole-message-post],[data-pole-interest],[data-pole-interests-for],'+
  '[data-pole-open-thread],[data-pole-interest-reply],[data-pole-activate-notice],'+
  '[data-pole-open-notifications],#pole-read-all,#pole-browser-toggle');
 if(!el)return;
 event.preventDefault();
 if(el.disabled)return;
 el.disabled=true;
 try{
  if(el.hasAttribute('data-pole-message-post'))await openThreadForPost(el.dataset.poleMessagePost);
  else if(el.hasAttribute('data-pole-interest'))await sendInterest(el.dataset.poleInterest);
  else if(el.hasAttribute('data-pole-interests-for'))await showInterests(el.dataset.poleInterestsFor);
  else if(el.hasAttribute('data-pole-open-thread'))await openThread(el.dataset.poleOpenThread);
  else if(el.hasAttribute('data-pole-interest-reply'))await openThreadForPost(el.dataset.poleInterestReply,el.dataset.poleActor);
  else if(el.hasAttribute('data-pole-activate-notice'))await activateNotice(el.dataset.poleActivateNotice);
  else if(el.hasAttribute('data-pole-open-notifications'))openNotices();
  else if(el.id==='pole-read-all'){
   if(!uid)return;
   const {error}=await sb.from('pole_notifications').update({is_read:true})
    .eq('recipient_id',uid).eq('is_read',false);
   if(error)throw error;
   items=items.map(n=>({...n,is_read:true}));renderBell();renderNotices();
  }else if(el.id==='pole-browser-toggle'){
   if(window.POLE_PUSH_TOGGLE){await window.POLE_PUSH_TOGGLE();openNotices()}
   else if(browserPref())localStorage.removeItem('pole_browser_notify_'+uid);
   else if(!('Notification' in window))toast('Браузер не поддерживает системные уведомления.');
   else{
    const permission=await Notification.requestPermission();
    if(permission==='granted')localStorage.setItem('pole_browser_notify_'+uid,'1');
    else toast('Уведомления браузера не разрешены. Их можно включить в настройках браузера.');
   }
   if(!window.POLE_PUSH_TOGGLE)openNotices();
  }
 }catch(e){console.warn('ПОЛЕ: ошибка уведомлений / сообщений',e);toast(friendlyError(e))}
 finally{if(el.isConnected)el.disabled=false}
});
bell.onclick=openNotices;
inbox.onclick=()=>openInbox().catch(e=>toast(friendlyError(e)));

document.addEventListener('submit',async event=>{
 const form=event.target;if(form.id!=='pole-direct-chat-form')return;
 event.preventDefault();event.stopImmediatePropagation();
 if(!activeThread)return;
 const msg=String(form.elements.body.value||'').trim();
 if(!msg||msg.length>1000){form.querySelector('textarea')?.focus();return}
 const target=activeThread.id;
 const send=form.querySelector('[type=submit]');send.disabled=true;send.textContent='Отправляем…';
 try{
  const {error}=await sb.from('pole_direct_messages').insert({thread_id:target,sender_id:uid,body:msg});
  if(error)throw error;
  if(activeThread?.id===target){form.elements.body.value='';chatFingerprint='';await loadThread(true)}
 }catch(e){const note=document.querySelector('#pole-direct-chat-state');if(note)note.textContent=friendlyError(e)}
 finally{send.disabled=false;send.textContent='Отправить'}
},true);

async function setUser(next){
 if(next===uid)return;
 if(channel){await sb.removeChannel(channel);channel=null}
 stopChat();uid=next;items=[];seen=new Set();ready=false;feedBusy=false;
 bell.hidden=!next;inbox.hidden=!next;renderBell();
 if(!next)return;
 await refreshNotices();
 if(uid!==next)return;
 const requestedId=new URLSearchParams(window.location.search).get('notice');
 if(!pushLinkHandled&&requestedId&&/^[0-9a-f-]{36}$/i.test(requestedId)){
  pushLinkHandled=true;
  try{
   if(items.some(n=>n.id===requestedId))await activateNotice(requestedId);
   else openNotices();
  }catch(error){console.warn('ПОЛЕ: не удалось открыть push',error);openNotices()}
  const clean=new URL(window.location.href);clean.searchParams.delete('notice');
  window.history.replaceState(null,'',clean.href);
 }
 channel=sb.channel('pole-personal-notices-'+next).on('postgres_changes',{
  event:'INSERT',schema:'public',table:'pole_notifications',filter:'recipient_id=eq.'+next
 },()=>refreshNotices()).subscribe();
}
sb.auth.onAuthStateChange((_event,session)=>setTimeout(()=>setUser(session?.user?.id||null),0));
sb.auth.getSession().then(({data})=>setUser(data?.session?.user?.id||null));
window.addEventListener('focus',refreshNotices);
setInterval(()=>{if(!document.hidden)refreshNotices()},15000);
})();
